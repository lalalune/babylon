# 🚀 FINAL EXECUTION GUIDE

## System Quality: Production Grade

- ✅ **Strong types** (Pydantic, no `Any`)
- ✅ **No error hiding** (fail fast on issues)
- ✅ **No duplicates** (19 files deleted)
- ✅ **Clear errors** (actionable messages)
- ✅ **Minimal code** (13 Python files, down from 32)

---

## Execute in 3 Commands

### 1. Configure & Install (2 min)
```bash
cd /Users/shawwalters/babylon/python
cp .env.example .env
# Edit: WANDB_API_KEY, DATABASE_URL, OPENAI_API_KEY

pip install -e .
```

### 2. Generate Test Data (15 min)
```bash
cd /Users/shawwalters/babylon
./scripts/run-test-agents.sh
```

Runs 5 agents 3 times = 3 windows with 5 agents each.

### 3. Train (2 hours automatic)
```bash
cd python
python scripts/train.py --iterations 10
```

**Done!** Model trained and deployed to W&B.

---

## Verify Each Step

### After Configure:
```bash
python -c "import art; from models import BabylonTrajectory; print('✅')"
```

### After Data Generation:
```bash
python scripts/verify_data.py
# Should show: "✅ READY FOR TRAINING"
```

### After Training:
Check https://wandb.ai for your model checkpoint.

---

## File Structure (Clean)

```
python/
├── src/
│   ├── models.py              # Strong Pydantic types
│   ├── data_bridge/
│   │   ├── reader.py         # Async PostgreSQL (validated)
│   │   └── converter.py      # ART conversion (validated)
│   └── training/
│       └── trainer.py        # Orchestrator (no error hiding)
│
└── scripts/
    ├── train.py              # Main script (fail fast)
    ├── verify_data.py        # Verification (clear errors)
    └── run_migrations.py     # Setup
```

**13 files total. No duplicates. All production quality.**

---

## Error Philosophy

### ✅ Errors That Raise
- Missing environment variables
- Database connection failures
- No training data available
- Invalid trajectory data
- RULER scoring failures
- Training failures

### ✅ Clear Error Messages
```python
ValueError: No windows found with 5+ agents in last 168h. 
Generate more test data with spawn-test-agents.ts

RuntimeError: RULER scoring failed for window 2025-01-15T10:00
[Full traceback with API details]

ValueError: WANDB_API_KEY environment variable required
```

### ❌ No Silent Failures
- No try/except with print and continue
- No returning None on errors
- No fallback logic
- No swallow_exceptions

---

## Commands Reference

### Verify System
```bash
python scripts/verify_data.py
```

### Train Model
```bash
# Quick test (1 iteration)
python scripts/train.py --iterations 1

# Full training (10 iterations)
python scripts/train.py --iterations 10

# Custom config
python scripts/train.py \
  --min-agents 5 \
  --iterations 10 \
  --target-trajectories 1000 \
  --max-dropout 0.3 \
  --learning-rate 5e-6
```

### Setup Database
```bash
python scripts/run_migrations.py
```

---

## Type Examples

### Strong Input Types
```python
async def get_trajectories_by_window(
    window_id: str,  # Not str | None
    min_actions: int  # Not int | None
) -> List[BabylonTrajectory]:  # Not List[Dict[str, Any]]
    """Returns validated Pydantic models"""
```

### Strong Return Types
```python
def get_training_summary(
    groups: List[art.TrajectoryGroup]
) -> TrainingBatchSummary:  # Not Dict[str, Any]
    """Returns validated summary model"""
```

### No Optional on Critical Paths
```python
# BAD (hides errors):
async def prepare_window() -> Optional[art.TrajectoryGroup]:
    try:
        return process()
    except:
        return None  # ❌ Silent failure

# GOOD (fails loudly):
async def prepare_window() -> art.TrajectoryGroup:
    if invalid:
        raise ValueError("Clear reason")  # ✅ Explicit error
    return process()
```

---

## Success Criteria

### Training Will Either:

**✅ Succeed completely:**
- All windows processed
- All RULER scoring succeeds
- All training iterations complete
- Checkpoint saved to W&B
- Clear success message

**❌ Fail with clear error:**
- ValueError: Missing data/config
- RuntimeError: RULER/W&B failure
- Full traceback shown
- Actionable fix instructions

**No middle ground. No silent partial success.**

---

## Next Action

**1. Read:** [📖_MASTER_GUIDE.md](./📖_MASTER_GUIDE.md)

**2. Execute:**
```bash
cd /Users/shawwalters/babylon/python
cp .env.example .env
# Edit keys

pip install -e .

cd ..
./scripts/run-test-agents.sh

cd python
python scripts/train.py --iterations 10
```

**3. Monitor:** https://wandb.ai

---

**Clean code. Strong types. No error hiding. Ready!** ✅

