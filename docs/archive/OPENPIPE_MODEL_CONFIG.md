# OpenPipe Model Configuration

## Overview

Babylon now uses **OpenPipe Qwen3-14B-Instruct** as the default model for RL training. This model is specifically optimized by OpenPipe for building agents with fine-tuning.

## Model Details

- **Model ID**: `OpenPipe/Qwen3-14B-Instruct`
- **Type**: Text
- **Context Window**: 32.8K tokens
- **Parameters**: 14.8B (Active-Total)
- **Provider**: OpenPipe
- **Optimization**: Dense, instruction-tuned, multilingual, agent-optimized

## Why OpenPipe Qwen3-14B-Instruct?

1. **Agent-Optimized**: Specifically tuned by OpenPipe for building agents
2. **Efficient Fine-Tuning**: Designed for iterative fine-tuning workflows
3. **Large Context**: 32.8K token context window for complex scenarios
4. **Good Size**: 14.8B parameters - large enough for strong performance, small enough for fast training
5. **OpenPipe Support**: Full support for OpenPipe's serverless RL infrastructure

## Configuration

### TypeScript (AutomationPipeline)

```typescript
// src/lib/training/AutomationPipeline.ts
baseModel: config.baseModel || 'OpenPipe/Qwen3-14B-Instruct'
```

### Python Training Services

#### ART Trainer
```python
# python/src/training/trainer.py
base_model: str = "OpenPipe/Qwen3-14B-Instruct"
```

#### GRPO Trainer
```python
# python/src/training/grpo_trainer.py
model_name: str = "OpenPipe/Qwen3-14B-Instruct"
```

#### W&B Training Service
```python
# python/src/training/wandb_training_service.py
base_model: str = "OpenPipe/Qwen3-14B-Instruct"
```

## Environment Variables

You can override the default model via environment variable:

```bash
# Override in .env or deployment config
BASE_MODEL=OpenPipe/Qwen3-14B-Instruct
```

## Usage in Training

### Local Training

```bash
# Automatic - uses default model
python -m python.src.training.grpo_trainer

# Or specify explicitly
BASE_MODEL=OpenPipe/Qwen3-14B-Instruct python -m python.src.training.grpo_trainer
```

### Serverless RL Training

```python
from python.src.training.trainer import BabylonTrainer

trainer = BabylonTrainer(
    project="babylon-agents",
    model_name="babylon-v1",
    base_model="OpenPipe/Qwen3-14B-Instruct"  # Default
)
```

### W&B Training Integration

```python
from python.src.training.wandb_training_service import WandbTrainingService

service = WandbTrainingService(
    db_url=db_url,
    wandb_api_key=api_key,
    wandb_entity=entity,
    base_model="OpenPipe/Qwen3-14B-Instruct"  # Default
)
```

## API Access

OpenPipe models are accessed via OpenAI-compatible API:

```typescript
// In your agent configuration
{
  "provider": "openpipe",
  "baseURL": "https://api.openpipe.ai/v1",
  "model": "OpenPipe/Qwen3-14B-Instruct",
  "apiKey": process.env.OPENPIPE_API_KEY
}
```

## Fine-Tuned Models

After training, fine-tuned models follow this naming pattern:

```
babylon-agent-v1.0.0
babylon-agent-v1.0.1
...
```

These are stored in:
- **Local**: `storage/models/v1.0.0/`
- **W&B**: Artifacts in your W&B project
- **OpenPipe**: Via OpenPipe's model registry

## Training Performance

Expected metrics with OpenPipe Qwen3-14B-Instruct:

- **Training Speed**: ~2-3 min per batch (GPU)
- **Memory Usage**: ~20GB VRAM (full precision), ~12GB (fp16)
- **Context Length**: Full 32.8K tokens supported
- **Fine-Tune Iterations**: Typically 100-500 for good results

## Cost Considerations

### OpenPipe Serverless Training

- **Training**: Based on tokens processed
- **Inference**: Per-token pricing after deployment
- **Storage**: Model weights stored in OpenPipe registry

### Local Training

- **GPU Required**: Recommended RTX 4090 or A100 for 14B model
- **Training Time**: ~1-2 hours per 100 trajectories
- **Storage**: ~30GB per checkpoint

## Migration from Previous Models

If you were using other models (Qwen2.5, Llama-3.1), the system will automatically use OpenPipe Qwen3-14B-Instruct now. To migrate existing trained models:

1. **Continue Training**: New training runs use new base model
2. **Model Versioning**: Track versions in database
3. **Gradual Rollout**: Deploy new models alongside old ones
4. **A/B Testing**: Compare performance before full migration

## Troubleshooting

### Model Not Found

If you get "model not found" errors:

```bash
# Verify OpenPipe API key is set
echo $OPENPIPE_API_KEY

# Test model access
curl -H "Authorization: Bearer $OPENPIPE_API_KEY" \
  https://api.openpipe.ai/v1/models
```

### Memory Issues

If OOM during training:

```python
# Reduce batch size
trainer = GRPOTrainingService(
    model_name="OpenPipe/Qwen3-14B-Instruct",
    batch_size=2,  # Reduce from 4
    gradient_accumulation_steps=4  # Increase to compensate
)
```

### Slow Training

```python
# Enable mixed precision
import torch
torch.set_float32_matmul_precision('high')

# Or use quantization
from transformers import BitsAndBytesConfig

config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16
)
```

## Next Steps

1. **Set OpenPipe API Key**: Get from [OpenPipe Dashboard](https://openpipe.ai)
2. **Test Training**: Run a small training batch
3. **Monitor Performance**: Check W&B for training metrics
4. **Deploy Models**: Use automation pipeline for deployment

## Resources

- [OpenPipe Documentation](https://docs.openpipe.ai)
- [Qwen3 Model Card](https://huggingface.co/OpenPipe/Qwen3-14B-Instruct)
- [Training Guide](./RL_TRAINING_COMPLETE_GUIDE.md)
- [W&B Integration](./WANDB_TRAINING_INTEGRATION.md)

