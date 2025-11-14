# Weights & Biases Inference API Integration - Complete ✅

## Overview

The Babylon platform now supports Weights & Biases (wandb) inference API as the primary AI provider for serverless agents, with intelligent fallback to Groq, Claude, and OpenAI.

## Features Implemented

### 1. **Multi-Provider AI Support** ✅
- **Priority Chain**: wandb → groq → claude → openai
- Automatic fallback based on available API keys
- Configurable per-deployment via environment variables

### 2. **BabylonLLMClient Updates** ✅
- Added wandb provider support with OpenAI-compatible client
- Base URL: `https://api.inference.wandb.ai/v1`
- Configurable model selection (environment + database)
- Methods to get/set wandb model dynamically

### 3. **Database Schema** ✅
- New `SystemSettings` table for system-wide configuration
- Fields:
  - `wandbModel`: Selected wandb model ID
  - `wandbEnabled`: Toggle wandb on/off
  - Singleton pattern (id = "system")

### 4. **Admin Interface** ✅
- **New "AI Models" Tab** in Admin Dashboard
- Features:
  - View active provider and status
  - List all available providers
  - Browse available wandb models
  - Select recommended models (Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B)
  - Enable/disable wandb
  - Save configuration with immediate effect

### 5. **API Endpoints** ✅
- `GET /api/admin/ai-models`: Get current config and available models
- `PUT /api/admin/ai-models`: Update AI model configuration
- Fetches available models from wandb API
- Updates system settings in database
- Clears configuration cache for immediate effect

### 6. **Configuration Helper** ✅
- `src/lib/ai-model-config.ts`: Centralized config loading
- In-memory cache (1 minute TTL) to reduce database queries
- Functions:
  - `getAIModelConfig()`: Load current settings
  - `getWandbModel()`: Get configured wandb model
  - `clearAIModelConfigCache()`: Invalidate cache

### 7. **Serverless Agent Integration** ✅
- Updated `executeGameTick()` to load wandb model from config
- All serverless agents use configured model
- Changes take effect immediately for new agent actions

### 8. **Documentation** ✅
- Updated `docs/content/getting-started/configuration.mdx`
- Added AI provider setup instructions
- Environment variable examples
- Links to get API keys

## Environment Variables

```bash
# AI Provider Configuration (fallback chain)
WANDB_API_KEY="..."         # Primary - Weights & Biases inference API
GROQ_API_KEY="gsk_..."      # Fast inference fallback
ANTHROPIC_API_KEY="sk-..."  # Claude fallback
OPENAI_API_KEY="sk-..."     # Final fallback

# Optional: Set specific wandb model (can also be set in admin)
WANDB_MODEL="meta-llama/Llama-3.3-70B-Instruct"
```

## How It Works

### Provider Selection Logic

1. **Check for WANDB_API_KEY**
   - If present AND enabled in admin → Use wandb with configured model
   - Base URL: `https://api.inference.wandb.ai/v1`

2. **Fallback to GROQ_API_KEY**
   - If present → Use Groq with llama-3.3-70b-versatile
   - Base URL: `https://api.groq.com/openai/v1`

3. **Fallback to ANTHROPIC_API_KEY**
   - If present → Use Claude with claude-3-5-sonnet
   - Base URL: `https://api.anthropic.com/v1`

4. **Final Fallback to OPENAI_API_KEY**
   - If present → Use OpenAI with gpt-4o-mini
   - Default OpenAI base URL

### Model Configuration Priority

1. Admin-configured model (database `SystemSettings.wandbModel`)
2. Environment variable `WANDB_MODEL`
3. Default: `meta-llama/Llama-3.3-70B-Instruct`

### Cache Strategy

- Configuration cached in memory for 1 minute
- Reduces database load (agents make many LLM calls)
- Cache invalidated when admin updates settings
- Environment variable also updated for immediate effect

## Admin Usage

1. **Navigate to Admin → AI Models**
2. **Check Provider Status**: See which providers are available
3. **Enable Wandb**: Toggle "Enable Wandb" switch
4. **Select Model**: Choose from recommended or all available models
5. **Save Configuration**: Click "Save Configuration"
6. **Verify**: Active provider should show "Weights & Biases"

## Recommended Models

| Model ID | Name | Description |
|----------|------|-------------|
| `meta-llama/Llama-3.3-70B-Instruct` | Llama 3.3 70B Instruct | Powerful and efficient for most tasks |
| `meta-llama/Llama-3.1-8B-Instruct` | Llama 3.1 8B Instruct | Fast and cost-effective for simple tasks |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | Mixtral 8x7B Instruct | Balanced performance and speed |

## File Changes

### New Files
- `src/components/admin/AIModelsTab.tsx` - Admin UI component
- `src/app/api/admin/ai-models/route.ts` - API endpoints
- `src/lib/ai-model-config.ts` - Configuration helper

### Modified Files
- `src/generator/llm/openai-client.ts` - Added wandb support
- `src/lib/serverless-game-tick.ts` - Load config on initialization
- `src/app/admin/page.tsx` - Added AI Models tab
- `prisma/schema.prisma` - Added SystemSettings model
- `docs/content/getting-started/configuration.mdx` - Updated docs

## Testing

### 1. Test Provider Fallback
```bash
# Test with only wandb
WANDB_API_KEY=xxx npm run dev

# Test fallback to groq
GROQ_API_KEY=xxx npm run dev

# Test fallback to openai
OPENAI_API_KEY=xxx npm run dev
```

### 2. Test Admin Interface
1. Go to `/admin` → AI Models tab
2. Verify provider status shows correctly
3. Enable wandb and select a model
4. Save and verify active provider changes

### 3. Test Agent Usage
1. Trigger a game tick: `npm run cron:tick`
2. Check logs for "Using Weights & Biases inference API"
3. Verify agents generate content using wandb

## Benefits

✅ **Flexibility**: Easy to switch between providers
✅ **Cost-Effective**: Use open-source models via wandb
✅ **Reliability**: Automatic fallback if primary fails
✅ **Performance**: Fast inference with wandb
✅ **Control**: Admin can change models without code deployment
✅ **Transparent**: Clear visibility of active provider

## Future Enhancements

- [ ] Per-agent model selection (override system default)
- [ ] Model performance metrics (latency, token usage)
- [ ] A/B testing between models
- [ ] Cost tracking per provider
- [ ] Model fine-tuning integration with wandb

## Support

- Wandb Docs: https://docs.wandb.ai/guides/prompts/weave-intro
- Get API Key: https://wandb.ai/authorize
- Inference API: https://api.inference.wandb.ai/v1

---

**Status**: ✅ Complete and Ready for Production
**Date**: 2025-01-13
**Version**: 1.0.0

