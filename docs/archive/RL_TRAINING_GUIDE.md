# 🤖 RL Training & Inference Guide

Complete guide to using reinforcement learning trained models in Babylon.

## 📋 Quick Start

### Local Development (RL Enabled by Default)

In local development, RL models are **automatically enabled** when W&B credentials are configured:

```bash
# Required for RL training and inference
WANDB_API_KEY=your_wandb_api_key
WANDB_ENTITY=your_wandb_username_or_team
WANDB_PROJECT=babylon-rl-training  # Optional, defaults to this

# Optional: Pin to specific model version
RL_MODEL_VERSION=v1.2.3

# Optional: Disable RL in local (defaults to enabled)
USE_RL_MODEL=false
```

### Production (RL Disabled by Default)

In production, RL models are **disabled by default** for safety. To enable:

```bash
# Explicitly enable RL models in production
USE_RL_MODEL=true

# W&B credentials (required if enabled)
WANDB_API_KEY=your_wandb_api_key
WANDB_ENTITY=your_wandb_username_or_team
```

## 🎯 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_RL_MODEL` | `true` (local) / `false` (prod) | Master toggle for RL models |
| `WANDB_API_KEY` | - | W&B API key (required for RL) |
| `WANDB_ENTITY` | - | W&B username or team (required for RL) |
| `WANDB_PROJECT` | `babylon-rl-training` | W&B project name |
| `RL_MODEL_VERSION` | latest | Pin to specific model version |
| `RL_FALLBACK_TO_BASE` | `true` | Fall back to base model if RL fails |
| `BASE_MODEL` | `OpenPipe/Qwen3-14B-Instruct` | Base model for fallback |

### Training-Specific Variables

```bash
# Required for training (not inference)
DATABASE_URL=postgresql://...
OPENPIPE_API_KEY=your_openpipe_key  # For RULER scoring
TRAIN_RL_LOCAL=true                 # Enable local training
```

## 🚀 Training Workflow

### 1. Collect Trajectories

Trajectories are automatically collected when agents operate:

```typescript
import { trajectoryRecorder } from '@/lib/training/TrajectoryRecorder';

// Start recording
await trajectoryRecorder.startTrajectory({
  agentId: 'agent-123',
  scenarioId: 'trading-scenario-1',
  windowId: '2025-11-13T12:00'
});

// Record steps
await trajectoryRecorder.recordStep({
  trajectoryId,
  stepNumber: 1,
  environmentState: { balance: 1000, pnl: 50 },
  action: { type: 'trade', params: {...} },
  reward: 0.8
});

// End trajectory
await trajectoryRecorder.endTrajectory(trajectoryId, {
  finalStatus: 'completed',
  totalReward: 10.5
});
```

### 2. Trigger Training

**Via API:**
```bash
POST /api/admin/training/trigger
{
  "force": false,
  "batchSize": 100
}
```

**Via Cron:**
Training runs automatically every 24 hours if data is ready.

### 3. Monitor Progress

```bash
GET /api/admin/training/status
```

Returns:
- Training readiness
- Recent jobs
- Deployed models
- Trajectory statistics

### 4. Model Deployment

Models are automatically deployed after successful training:
1. Model weights uploaded to Vercel Blob
2. Metadata saved to database
3. Model marked as `ready`
4. Available for inference

## 🔍 Inference Integration

### Automatic Model Selection

```typescript
import { getModelForInference } from '@/lib/training/WandbModelFetcher';
import { shouldUseRLModel } from '@/lib/training/WandbModelFetcher';

// Check if we should use RL
if (shouldUseRLModel()) {
  const model = await getModelForInference();
  if (model) {
    console.log(`Using RL model ${model.version}`);
    // Use model.modelPath for inference
  } else {
    // Fall back to base model
  }
} else {
  // Use base model
}
```

### Agent Integration

Agents automatically use RL models when available:

```typescript
import { getRLModelConfig } from '@/lib/training/RLModelConfig';

const config = getRLModelConfig();
if (config.enabled) {
  // Agent will use RL-trained weights
} else {
  // Agent will use base model
}
```

## 📊 Monitoring

### Check RL Status

```bash
# View configuration on server startup
npm run dev
# Look for: "🤖 RL Model Configuration:"
```

### Training Status API

```bash
curl http://localhost:3000/api/admin/training/status
```

Returns:
```json
{
  "status": "healthy",
  "automation": {
    "dataCollection": {
      "last24h": 150,
      "ratePerHour": 6.25
    },
    "training": {
      "currentJob": null,
      "lastCompleted": "2025-11-13T10:30:00Z"
    },
    "models": {
      "latest": "v1.2.3",
      "deployed": 5
    }
  },
  "readiness": {
    "ready": true,
    "reason": "Ready to train!",
    "stats": {
      "totalTrajectories": 250,
      "scenarioGroups": 15
    }
  }
}
```

## 🧪 Testing

### Run Training Tests

```bash
# All training tests
bun test src/lib/training/__tests__/

# Specific tests
bun test src/lib/training/__tests__/training-pipeline.test.ts
bun test src/lib/training/__tests__/trajectory-recorder.test.ts
```

### Test RL Configuration

```typescript
import { getRLModelConfig, isRLModelAvailable } from '@/lib/training/RLModelConfig';

const config = getRLModelConfig();
console.log('RL enabled:', config.enabled);

const available = isRLModelAvailable();
console.log('RL available:', available);
```

## 🔒 Security & Safety

### Production Checklist

- [ ] RL disabled by default (`USE_RL_MODEL` not set or `false`)
- [ ] W&B credentials in secure environment variables
- [ ] Fallback to base model enabled
- [ ] Monitoring and alerting configured
- [ ] Model validation before deployment

### Gradual Rollout

```bash
# Start with small percentage
USE_RL_MODEL=true
RL_ROLLOUT_PERCENTAGE=10  # 10% of requests use RL

# Monitor performance
# Increase gradually
RL_ROLLOUT_PERCENTAGE=50

# Full rollout
RL_ROLLOUT_PERCENTAGE=100
```

## 🐛 Troubleshooting

### RL Models Not Loading

1. **Check configuration:**
   ```bash
   # In your app, look for startup logs
   🤖 RL Model Configuration: { enabled: true, available: true, ... }
   ```

2. **Verify W&B credentials:**
   ```bash
   echo $WANDB_API_KEY
   echo $WANDB_ENTITY
   ```

3. **Check database:**
   ```sql
   SELECT version, status, createdAt 
   FROM trained_models 
   ORDER BY createdAt DESC 
   LIMIT 5;
   ```

### Training Not Starting

1. **Check data readiness:**
   ```bash
   GET /api/admin/training/status
   ```

2. **Check environment:**
   ```bash
   echo $TRAIN_RL_LOCAL
   echo $OPENPIPE_API_KEY
   ```

3. **Manual trigger:**
   ```bash
   POST /api/admin/training/trigger
   {"force": true}
   ```

### Inference Failing

1. **Check model availability:**
   ```typescript
   const model = await getLatestRLModel();
   console.log('Latest model:', model);
   ```

2. **Verify fallback:**
   ```bash
   # Should be true (default)
   echo $RL_FALLBACK_TO_BASE
   ```

3. **Check logs for errors:**
   ```bash
   grep -i "RL model" logs/app.log
   ```

## 📚 Additional Resources

- [Python Training README](./python/README.md) - Python training pipeline
- [RULER Integration](./python/README_TRAINING.md) - RULER scoring system
- [W&B Documentation](https://docs.wandb.ai/) - Weights & Biases docs

## 🎯 Best Practices

1. **Always test in staging first**
2. **Monitor model performance metrics**
3. **Keep base model fallback enabled**
4. **Gradually roll out new models**
5. **Document model versions and performance**
6. **Set up alerts for training failures**
7. **Regularly review trajectory quality**

## 📞 Support

If you encounter issues:
1. Check this guide
2. Review server logs
3. Check training status API
4. Review W&B dashboard
5. Open an issue with logs and configuration

