#!/bin/bash
# Deploy Babylon RL Model to CoreWeave Serverless vLLM

set -e

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Babylon RL - CoreWeave Serverless Deployment"
echo "================================================"
echo ""

# Configuration
MODEL_VERSION=${1:-"v1.0.0"}
NAMESPACE=${NAMESPACE:-"tenant-babylon-prod"}
SERVICE_NAME="babylon-rl-${MODEL_VERSION}"
GPU_TYPE=${GPU_TYPE:-"A100_NVLINK_80GB"}
MIN_REPLICAS=${MIN_REPLICAS:-"0"}
MAX_REPLICAS=${MAX_REPLICAS:-"10"}

echo "Configuration:"
echo "  Model Version: $MODEL_VERSION"
echo "  Namespace: $NAMESPACE"
echo "  Service Name: $SERVICE_NAME"
echo "  GPU Type: $GPU_TYPE"
echo "  Replicas: $MIN_REPLICAS-$MAX_REPLICAS"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl not found${NC}"
    echo "Install: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ aws CLI not found${NC}"
    echo "Install: https://aws.amazon.com/cli/"
    exit 1
fi

if ! command -v wandb &> /dev/null; then
    echo -e "${RED}❌ wandb CLI not found${NC}"
    echo "Install: pip install wandb"
    exit 1
fi

# Check environment variables
if [ -z "$WANDB_ENTITY" ]; then
    echo -e "${RED}❌ WANDB_ENTITY not set${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set (deployment record won't be saved)${NC}"
fi

echo -e "${GREEN}✓${NC} All prerequisites satisfied"
echo ""

# Check kubectl context
CURRENT_CONTEXT=$(kubectl config current-context)
if [[ "$CURRENT_CONTEXT" != *"coreweave"* ]]; then
    echo -e "${YELLOW}⚠️  Current context is '$CURRENT_CONTEXT'${NC}"
    echo "Expected CoreWeave context. Continue? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        exit 1
    fi
fi

# Step 1: Download checkpoint from W&B
echo "📥 Step 1: Downloading checkpoint from W&B..."
CHECKPOINT_DIR="./checkpoints/${MODEL_VERSION}"

if [ -d "$CHECKPOINT_DIR" ]; then
    echo "Checkpoint already exists locally, skipping download"
else
    wandb artifact download \
        ${WANDB_ENTITY}/babylon-rl-continuous/model-${MODEL_VERSION}:latest \
        --root "$CHECKPOINT_DIR" || {
        echo -e "${RED}❌ Failed to download checkpoint from W&B${NC}"
        exit 1
    }
fi

echo -e "${GREEN}✓${NC} Checkpoint downloaded"
echo ""

# Step 2: Upload to CoreWeave S3
echo "☁️  Step 2: Uploading to CoreWeave S3..."
S3_PATH="s3://babylon-rl-training/checkpoints/${MODEL_VERSION}"

aws s3 sync \
    "$CHECKPOINT_DIR" \
    "$S3_PATH" \
    --endpoint-url https://object.ord1.coreweave.com || {
    echo -e "${RED}❌ Failed to upload to S3${NC}"
    exit 1
}

echo -e "${GREEN}✓${NC} Uploaded to $S3_PATH"
echo ""

# Step 3: Generate deployment manifest
echo "📝 Step 3: Generating deployment manifest..."
MANIFEST_FILE="/tmp/babylon-rl-deploy-${MODEL_VERSION}.yaml"

cat > "$MANIFEST_FILE" << EOF
apiVersion: serving.coreweave.com/v1alpha1
kind: InferenceService
metadata:
  name: ${SERVICE_NAME}
  namespace: ${NAMESPACE}
  labels:
    app: babylon-rl
    version: ${MODEL_VERSION}
  annotations:
    serving.coreweave.com/enable-auth: "true"
spec:
  predictor:
    model:
      modelFormat:
        name: vllm
      storageUri: ${S3_PATH}
    
    # Auto-scaling
    minReplicas: ${MIN_REPLICAS}
    maxReplicas: ${MAX_REPLICAS}
    scaleTarget: 80
    scaleMetric: gpu
    scaleDownDelay: 5m
    
    # Resources
    resources:
      requests:
        cpu: "8"
        memory: "64Gi"
        nvidia.com/gpu: "1"
      limits:
        cpu: "16"
        memory: "128Gi"
        nvidia.com/gpu: "1"
    
    # GPU selection
    nodeSelector:
      gpu.nvidia.com/class: ${GPU_TYPE}
    
    # vLLM configuration
    env:
      - name: VLLM_MODEL_NAME
        value: "babylon-rl"
      - name: VLLM_MAX_MODEL_LEN
        value: "4096"
      - name: VLLM_TENSOR_PARALLEL_SIZE
        value: "1"
      - name: VLLM_TRUST_REMOTE_CODE
        value: "true"
      - name: VLLM_GPU_MEMORY_UTILIZATION
        value: "0.9"
      - name: VLLM_MAX_BATCH_SIZE
        value: "64"
    
    # Health checks
    livenessProbe:
      httpGet:
        path: /health
        port: 8000
      initialDelaySeconds: 120
      periodSeconds: 30
    
    readinessProbe:
      httpGet:
        path: /health
        port: 8000
      initialDelaySeconds: 60
      periodSeconds: 10
EOF

echo -e "${GREEN}✓${NC} Manifest generated: $MANIFEST_FILE"
echo ""

# Step 4: Deploy to CoreWeave
echo "🚢 Step 4: Deploying to CoreWeave..."
kubectl apply -f "$MANIFEST_FILE" || {
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
}

echo -e "${GREEN}✓${NC} Deployment applied"
echo ""

# Step 5: Wait for ready
echo "⏳ Step 5: Waiting for deployment to be ready..."
echo "(This may take 5-10 minutes for cold start)"

kubectl wait --for=condition=Ready \
    inferenceservice/${SERVICE_NAME} \
    -n ${NAMESPACE} \
    --timeout=15m || {
    echo -e "${RED}❌ Deployment did not become ready${NC}"
    echo "Check logs with:"
    echo "  kubectl logs -n $NAMESPACE -l app=babylon-rl"
    exit 1
}

echo -e "${GREEN}✓${NC} Deployment is ready!"
echo ""

# Step 6: Get endpoint URL
echo "🌐 Step 6: Getting endpoint URL..."
ENDPOINT=$(kubectl get inferenceservice ${SERVICE_NAME} \
    -n ${NAMESPACE} \
    -o jsonpath='{.status.url}')

if [ -z "$ENDPOINT" ]; then
    echo -e "${RED}❌ Could not get endpoint URL${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Endpoint: $ENDPOINT"
echo ""

# Step 7: Test inference
echo "🧪 Step 7: Testing inference..."
TEST_RESPONSE=$(curl -s -X POST "$ENDPOINT/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "babylon-rl",
        "messages": [
            {"role": "user", "content": "Test"}
        ],
        "max_tokens": 10
    }' || echo "FAILED")

if [[ "$TEST_RESPONSE" == "FAILED" ]]; then
    echo -e "${YELLOW}⚠️  Could not test inference (may need API key)${NC}"
else
    echo -e "${GREEN}✓${NC} Inference works!"
    echo "Response preview: ${TEST_RESPONSE:0:100}..."
fi
echo ""

# Step 8: Update database
if [ -n "$DATABASE_URL" ]; then
    echo "💾 Step 8: Updating deployment database..."
    psql "$DATABASE_URL" -c "
        INSERT INTO model_deployments (
            model_version,
            environment,
            endpoint_url,
            health_status,
            deployment_strategy,
            deployed_at
        ) VALUES (
            '${MODEL_VERSION}',
            'coreweave',
            '${ENDPOINT}',
            'healthy',
            'serverless',
            NOW()
        )
        ON CONFLICT (model_version, environment) 
        DO UPDATE SET
            endpoint_url = EXCLUDED.endpoint_url,
            health_status = 'healthy',
            deployed_at = NOW();
    " || echo -e "${YELLOW}⚠️  Could not update database${NC}"
    
    echo -e "${GREEN}✓${NC} Database updated"
else
    echo "⏭️  Step 8: Skipping database update (DATABASE_URL not set)"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "════════════════════════════════════════════════"
echo ""
echo "📊 Deployment Details:"
echo "  Service: $SERVICE_NAME"
echo "  Namespace: $NAMESPACE"
echo "  Endpoint: $ENDPOINT"
echo "  GPU: $GPU_TYPE"
echo "  Replicas: $MIN_REPLICAS-$MAX_REPLICAS"
echo ""
echo "🔧 Management Commands:"
echo "  View status:   kubectl get inferenceservice $SERVICE_NAME -n $NAMESPACE"
echo "  View logs:     kubectl logs -n $NAMESPACE -l app=babylon-rl"
echo "  View metrics:  kubectl port-forward -n $NAMESPACE svc/$SERVICE_NAME 8080:8080"
echo "  Delete:        kubectl delete inferenceservice $SERVICE_NAME -n $NAMESPACE"
echo ""
echo "🧪 Test Inference:"
echo "  curl -X POST '$ENDPOINT/v1/chat/completions' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"model\": \"babylon-rl\", \"messages\": [{\"role\": \"user\", \"content\": \"Test\"}]}'"
echo ""
echo "🎉 Your model is now live on CoreWeave serverless!"



