# Cloud Mode Test - Setup Required

## 🔑 Need Your Credentials

To run the full W&B cloud mode test, I need:

### 1. DATABASE_URL
Your PostgreSQL connection string:
```bash
export DATABASE_URL=postgresql://user:password@host:port/database
```

**Where to find**: Your database credentials

### 2. WANDB_API_KEY  
Your Weights & Biases API key:
```bash
export WANDB_API_KEY=your-key-here
```

**Where to get**: https://wandb.ai/settings → API Keys

### 3. Feature Flag
```bash
export TRAIN_RL_LOCAL=true
```

---

## What I'll Test

Once you provide these, I'll run the complete pipeline:

### Step 1: Environment Check
- Verify DATABASE_URL connects
- Verify WANDB_API_KEY is valid
- Check W&B project access

### Step 2: Database Verification
- Run migrations if needed
- Check for trajectory data
- List available windows

### Step 3: Cloud Training
- Initialize ART ServerlessBackend
- Collect data from YOUR database
- Score agents locally
- Submit to W&B Training
- Monitor training job

### Step 4: Verify Inference
- Test W&B hosted endpoint
- Verify model responds
- Save endpoint info

### Step 5: Full Integration Test
- Complete end-to-end flow
- Verify all data in YOUR database
- Confirm no OpenPipe calls
- Test inference with real agent queries

---

## Alternative: Test Locally First

If you don't want to use W&B credits yet, I can test local mode first:

```bash
export DATABASE_URL=postgresql://your-db-url
export TRAIN_RL_LOCAL=true
# NO WANDB_API_KEY - will use local GPU

MODE=list python -m src.training.babylon_trainer
```

This will:
- Use your local GPU (free)
- Verify database connectivity
- Show ready windows
- No W&B charges

---

## What I Need From You

Please provide ONE of:

**Option A - Full Cloud Test**:
```bash
DATABASE_URL=postgresql://...
WANDB_API_KEY=...
```

**Option B - Local Test First**:
```bash
DATABASE_URL=postgresql://...
# (no W&B key)
```

Let me know which you prefer and provide the credentials!

