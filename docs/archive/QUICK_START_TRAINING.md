# Quick Start: RL Training with OpenPipe

## Prerequisites

1. **OpenPipe API Key**: Get from [OpenPipe Dashboard](https://openpipe.ai)
2. **W&B Account**: Sign up at [wandb.ai](https://wandb.ai)
3. **Database**: PostgreSQL with trajectory schema
4. **Python Environment**: Python 3.10+ with dependencies

## 1. Environment Setup

Create `.env` file:

```bash
# Copy template
cp env.test.template .env

# Edit and add your keys
nano .env
```

Required environment variables:

```bash
# OpenPipe (for model training)
OPENPIPE_API_KEY=your-openpipe-api-key

# W&B (for experiment tracking)
WANDB_API_KEY=your-wandb-api-key
WANDB_PROJECT=babylon-rl-training
WANDB_ENTITY=your-username

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/babylon

# Model Configuration (default - can override)
BASE_MODEL=OpenPipe/Qwen3-14B-Instruct
```

## 2. Verify Model Access

Test OpenPipe API:

```bash
curl -H "Authorization: Bearer $OPENPIPE_API_KEY" \
  https://api.openpipe.ai/v1/models
```

You should see `OpenPipe/Qwen3-14B-Instruct` in the response.

## 3. Run Your First Training

### Option A: Serverless (Recommended)

```python
import asyncio
from python.src.training.trainer import BabylonTrainer
import art

async def train():
    # Initialize trainer
    trainer = BabylonTrainer(
        project="babylon-agents",
        model_name="babylon-v1",
        base_model="OpenPipe/Qwen3-14B-Instruct"
    )
    
    # Register model
    await trainer.register()
    
    # Create sample trajectory
    trajectory = art.Trajectory(
        messages=[
            {"role": "system", "content": "You are a trading agent."},
            {"role": "user", "content": "What should I do?"},
            {"role": "assistant", "content": "Buy 10 shares of AAPL"}
        ],
        reward=0.85
    )
    
    # Group trajectories (GRPO requires groups)
    group = art.TrajectoryGroup([trajectory])
    
    # Train
    step = await trainer.train([group])
    print(f"Training complete! Step: {step}")
    
    # Close
    await trainer.close()

asyncio.run(train())
```

### Option B: Automated Pipeline

```typescript
import { automationPipeline } from '@/lib/training/AutomationPipeline';

// Check if ready to train
const readiness = await automationPipeline.checkTrainingReadiness();
console.log('Ready to train:', readiness);

// Trigger training if ready
if (readiness.ready) {
  const result = await automationPipeline.triggerTraining();
  console.log('Training job:', result.jobId);
}

// Monitor training
const status = await automationPipeline.monitorTraining(result.jobId!);
console.log('Status:', status);
```

### Option C: Continuous Training

```bash
# Start continuous training service
python -m python.src.training.grpo_trainer
```

This will:
1. ✅ Monitor for new trajectory data
2. ✅ Score trajectories with RULER
3. ✅ Train models when data is ready
4. ✅ Deploy new versions automatically

## 4. Verify Training

### Check W&B Dashboard

1. Go to [wandb.ai](https://wandb.ai)
2. Navigate to your project: `babylon-rl-training`
3. You should see:
   - **Runs**: Training jobs
   - **Artifacts**: Trained models
   - **Metrics**: Loss, rewards, etc.

### Check Database

```sql
-- See training batches
SELECT * FROM training_batches ORDER BY created_at DESC LIMIT 5;

-- See trained models
SELECT * FROM trained_models ORDER BY created_at DESC LIMIT 5;

-- See trajectories used
SELECT COUNT(*) FROM trajectories WHERE used_in_training = true;
```

## 5. Use Trained Model

### Get Latest Model

```typescript
const status = await automationPipeline.getStatus();
console.log('Latest model:', status.models.latest);
```

### Deploy for Inference

```typescript
// The model is automatically deployed and ready to use
// Access via OpenPipe API:
const response = await fetch('https://api.openpipe.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENPIPE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'babylon-agent-v1.0.0',  // Your trained model
    messages: [
      { role: 'user', content: 'What should I trade?' }
    ]
  })
});
```

## 6. Automation Setup

Enable continuous training:

```typescript
// In your main application
import { automationPipeline } from '@/lib/training/AutomationPipeline';

// Configure automation
automationPipeline = new AutomationPipeline({
  minTrajectoriesForTraining: 100,
  minGroupSize: 4,
  autoTriggerTraining: true,
  trainingInterval: 24,  // Train daily
  baseModel: 'OpenPipe/Qwen3-14B-Instruct',
  wandbProject: process.env.WANDB_PROJECT
});

// Start automation cycle (runs every hour)
setInterval(async () => {
  await automationPipeline.runAutomationCycle();
}, 60 * 60 * 1000);
```

## Common Issues

### "Model not found"

```bash
# Verify API key
echo $OPENPIPE_API_KEY

# Test access
curl -H "Authorization: Bearer $OPENPIPE_API_KEY" \
  https://api.openpipe.ai/v1/models | grep Qwen3
```

### "Not enough trajectories"

You need at least 100 trajectories for training:

```sql
-- Check trajectory count
SELECT COUNT(*) FROM trajectories WHERE is_training_data = true;

-- Check by scenario
SELECT scenario_id, COUNT(*) 
FROM trajectories 
WHERE is_training_data = true 
GROUP BY scenario_id;
```

Minimum requirements:
- ✅ 100+ total trajectories
- ✅ 10+ scenario groups
- ✅ 4+ trajectories per group

### "Out of memory"

Reduce batch size:

```python
# In grpo_trainer.py
trainer = GRPOTrainingService(
    model_name="OpenPipe/Qwen3-14B-Instruct",
    batch_size=2,  # Reduce from 4
    gradient_accumulation_steps=4  # Compensate
)
```

Or use serverless (recommended):

```python
# Serverless training handles scaling automatically
trainer = BabylonTrainer(
    project="babylon-agents",
    model_name="babylon-v1"
)
```

## Next Steps

1. **Collect More Data**: Let agents run to collect trajectories
2. **Score Quality**: RULER automatically scores trajectories
3. **Monitor Training**: Watch W&B dashboard
4. **Test Models**: Compare trained vs base model performance
5. **Iterate**: Continuous improvement loop

## Resources

- [Full Configuration Guide](./OPENPIPE_MODEL_CONFIG.md)
- [Complete Training Guide](./RL_TRAINING_COMPLETE_GUIDE.md)
- [W&B Integration](./WANDB_TRAINING_INTEGRATION.md)
- [Troubleshooting](./docs/content/agents/python-training.mdx)

## Architecture

```
┌─────────────────┐
│   Trajectories  │  ← Agents generate data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RULER Scoring  │  ← Score trajectories
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AutoPipeline   │  ← Check readiness
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OpenPipe Train  │  ← Fine-tune Qwen3-14B
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Deploy Model   │  ← Use in production
└─────────────────┘
```

## Questions?

- Check [Documentation](./docs/)
- Open an issue on GitHub
- Join Discord community

