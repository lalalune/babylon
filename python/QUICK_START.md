# Quick Start - Babylon RL Training

## ⚡ 4 Commands to Training

```bash
cd /Users/shawwalters/babylon/python

# 1. Install
pip install openpipe-art==0.5.1 asyncpg

# 2. Setup
export DATABASE_URL=postgresql://your-db-url
export WANDB_API_KEY=your-key  # Optional
export TRAIN_RL_LOCAL=true

# 3. Migrate
psql $DATABASE_URL -f migrations/002_add_self_hosted_tables.sql

# 4. Train!
python -m src.training.babylon_trainer
```

**Done!** 🎉

---

## What You Get

- ✅ Trained model
- ✅ Automatic inference endpoint
- ✅ All data in YOUR database
- ✅ No OpenPipe dependency

---

## Options

### Original Trainer (Recommended)
```bash
python -m src.training.trainer --min-agents 3
```

### Simplified Trainer
```bash
python -m src.training.babylon_trainer
```

---

**Full guide**: [README.md](README.md)

