# Babylon - Decentralized Prediction Market MMO

A multiplayer prediction market game with autonomous AI agents and continuous RL training.

---

## 🎯 RL Training System

Babylon includes a complete continuous RL training system with **two modes**:

### 🖥️ Local Mode (Free)
Train on your own GPU - perfect for development and testing.

```bash
cd python

# Setup (no W&B key needed!)
export DATABASE_URL=postgresql://your-db-url
export TRAIN_RL_LOCAL=true

# Train
python -m src.training.babylon_trainer
```

**Features**:
- ✅ Uses your local GPU (free!)
- ✅ All data in YOUR PostgreSQL
- ✅ Local inference serving
- ✅ Perfect for development

**Cost**: $0

### ☁️ Cloud Mode (Serverless)
Train on W&B's managed infrastructure - perfect for production.

```bash
cd python

# Setup (with W&B key)
export DATABASE_URL=postgresql://your-db-url
export WANDB_API_KEY=your-wandb-key  # Get from wandb.ai/settings
export TRAIN_RL_LOCAL=true

# Train
python -m src.training.babylon_trainer
```

**Features**:
- ✅ W&B manages all GPUs (no setup!)
- ✅ All data in YOUR PostgreSQL
- ✅ W&B hosted inference (automatic!)
- ✅ Perfect for production

**Cost**: ~$820-1720/month (vs $7,000+ self-managed)

---

## 🚀 Quick Start (RL Training)

### Step 1: Install Dependencies
```bash
cd python
pip install openpipe-art==0.5.1 asyncpg python-dotenv
```

### Step 2: Configure Environment
```bash
# Copy template
cp env.template .env

# Edit with your values
nano .env
```

**For Local Mode**:
```bash
DATABASE_URL=postgresql://your-db-url
TRAIN_RL_LOCAL=true
# That's it! Will use local GPU
```

**For Cloud Mode (add this)**:
```bash
WANDB_API_KEY=your-wandb-key
```

### Step 3: Run Migration
```bash
source .env
psql $DATABASE_URL -f migrations/002_add_self_hosted_tables.sql
```

### Step 4: List Ready Windows
```bash
MODE=list python -m src.training.babylon_trainer
```

**Output**:
```
Ready windows (3):
  2025-01-15T10:00: 5 agents
  2025-01-15T11:00: 4 agents
  2025-01-15T12:00: 3 agents
```

### Step 5: Train!
```bash
MODE=single python -m src.training.babylon_trainer
```

**Local Mode**: Trains on your GPU  
**Cloud Mode**: Trains on W&B serverless

---

## 📊 Training Modes Comparison

| Feature | Local Mode | Cloud Mode |
|---------|------------|------------|
| **GPU** | Your GPU | W&B managed (CoreWeave) |
| **Setup** | Zero | Zero |
| **Cost** | Free | ~$820/month |
| **Training Time** | Depends on your GPU | ~15 min |
| **Inference** | Local serving | W&B hosted |
| **Deployment** | Manual | Automatic |
| **Best For** | Development | Production |
| **Requires** | DATABASE_URL | DATABASE_URL + WANDB_API_KEY |

**Both modes**:
- ✅ All data in YOUR PostgreSQL
- ✅ No OpenPipe API dependency
- ✅ Local heuristic scoring
- ✅ Automatic inference setup

---

## 🎓 Training Architecture

### What Gets Trained
Your AI agents learn from their trading performance:

1. **Agents play** → Trajectories logged to PostgreSQL
2. **Time windows** → Group agents by hour (fair comparison)
3. **Local scoring** → Heuristic scoring (P&L + win rate + activity)
4. **ART training** → Fine-tune model with RL
5. **Inference ready** → Agents use improved model

### Data Flow

```
TypeScript Agents (MMO)
    ↓ (log trajectories with window_id)
PostgreSQL (YOUR database)
    ↓ (query by window)
Python Trainer
  ├─ Collect from database
  ├─ Score locally (no external API)
  └─ Create ART trajectories
    ↓
ART ServerlessBackend
  ├─ Local Mode: Uses your GPU
  └─ Cloud Mode: W&B manages GPUs on CoreWeave
    ↓
Trained Model
  ├─ Local Mode: Checkpoint saved locally
  └─ Cloud Mode: W&B hosted inference endpoint
    ↓
Better Agents! 🎯
```

---

## 🔧 Two Trainers Available

### Option 1: Simplified Trainer (Recommended for Getting Started)

**File**: `python/src/training/babylon_trainer.py`

**Features**:
- Follows ART ServerlessBackend pattern
- Local heuristic scoring (no external API)
- Automatic local/cloud mode switching
- All data in YOUR database

**Run**:
```bash
# Local mode (free)
MODE=list python -m src.training.babylon_trainer
MODE=single python -m src.training.babylon_trainer

# Cloud mode (add WANDB_API_KEY)
export WANDB_API_KEY=your-key
MODE=single python -m src.training.babylon_trainer
```

### Option 2: Original Trainer (Recommended for Production)

**File**: `python/src/training/trainer.py`

**Features**:
- Uses ART's `ruler_score_group()` for RULER scoring
- External LLM judges agents (higher quality)
- Production-tested
- Complete data bridge integration

**Run**:
```bash
python -m src.training.trainer \
  --min-agents 3 \
  --lookback-hours 48 \
  --model Qwen/Qwen2.5-0.5B-Instruct
```

---

## 💡 Switching Between Modes

The beauty of ART's ServerlessBackend is it automatically switches:

### To Use Local Mode
```bash
# Don't set WANDB_API_KEY
export DATABASE_URL=postgresql://...
export TRAIN_RL_LOCAL=true

python -m src.training.babylon_trainer
# → Uses local GPU automatically
```

### To Use Cloud Mode
```bash
# Add WANDB_API_KEY
export DATABASE_URL=postgresql://...
export WANDB_API_KEY=your-key
export TRAIN_RL_LOCAL=true

python -m src.training.babylon_trainer
# → Uses W&B serverless automatically
```

**Same code, automatic switching!** ✨

---

## 📚 Documentation

### Quick Start
- **This file** - Overview and quick start
- **[python/QUICK_START.md](python/QUICK_START.md)** - 4-command setup

### Complete Guides
- **[python/README.md](python/README.md)** - Python package documentation
- **[python/TEST_BOTH_MODES.md](python/TEST_BOTH_MODES.md)** - Local vs Cloud comparison

### Original Design
- **[RL_TRAINING_CONTINUOUS_MMO_SUMMARY.md](RL_TRAINING_CONTINUOUS_MMO_SUMMARY.md)** - Architecture overview

---

## 🐛 Troubleshooting

### Local Mode

**"CUDA out of memory"**
→ Use cloud mode instead:
```bash
export WANDB_API_KEY=your-key
```

**"No GPU available"**
→ Install CUDA drivers or use cloud mode

### Cloud Mode

**"WANDB_API_KEY not set"**
→ Get from: https://wandb.ai/settings

**"W&B quota exceeded"**
→ Check your W&B billing/quota settings

### Both Modes

**"No windows found"**
→ Check database:
```sql
SELECT "scenarioId", COUNT(*) FROM trajectories GROUP BY "scenarioId";
```

**"Database connection failed"**
→ Verify DATABASE_URL:
```bash
psql $DATABASE_URL -c "SELECT 1"
```

---

## 💰 Cost Breakdown

### Local Mode
- **Setup**: Your GPU (one-time)
- **Training**: Free (uses your GPU)
- **Inference**: Free (local serving)
- **Monthly**: $0

**Best for**: Development, testing, learning

### Cloud Mode
- **Setup**: Zero (W&B manages everything)
- **Training**: ~$1-2 per job (~15 min)
  - Daily (24 jobs): ~$24-48
  - Monthly: ~$720
- **Inference**: ~$0.001 per request
  - 100k requests: ~$100
  - 1M requests: ~$1,000
- **Monthly Total**: ~$820-1720

**Best for**: Production, scaling, no GPU management

### vs Self-Managed Infrastructure
- **GPU Rental**: $7,000+/month (24/7 A100s)
- **DevOps**: Ongoing work
- **Monitoring**: Custom setup
- **Total**: $10,000+/month

**Savings with Cloud Mode**: 75-85%!

---

## 🎯 Recommended Path

### Phase 1: Development (Local)
```bash
# Test locally first (free!)
export DATABASE_URL=postgresql://...
export TRAIN_RL_LOCAL=true

MODE=list python -m src.training.babylon_trainer
MODE=single python -m src.training.babylon_trainer
```

**Goal**: Verify data collection, test training flow, iterate quickly

### Phase 2: Production (Cloud)
```bash
# Scale to cloud when ready
export WANDB_API_KEY=your-key

MODE=single python -m src.training.babylon_trainer
```

**Goal**: Production deployment, W&B managed, auto-scaling

---

## 📖 Related Documentation

- **Game Setup**: [START_HERE.md](START_HERE.md)
- **Agent System**: [examples/autonomous-babylon-agent/](examples/autonomous-babylon-agent/)
- **RL Training**: [python/README.md](python/README.md)
- **Architecture**: [TYPESCRIPT_INTEGRATION_MMO.md](TYPESCRIPT_INTEGRATION_MMO.md)

---

## 🆘 Get Help

**RL Training Issues**: See [python/README.md](python/README.md)  
**Database Issues**: Check [prisma/schema.prisma](prisma/schema.prisma)  
**W&B Issues**: https://docs.wandb.ai/  

---

**Ready to train?** See [python/QUICK_START.md](python/QUICK_START.md)

🚀 **Both local and cloud modes ready!**
