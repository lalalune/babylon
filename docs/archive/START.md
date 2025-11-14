# 🚀 Babylon RL Training - START

## Execute These 3 Commands

```bash
cd /Users/shawwalters/babylon

# 1. Setup (2 min)
cd python
cp .env.example .env
# Edit: WANDB_API_KEY, DATABASE_URL, OPENAI_API_KEY
pip install -e .

# 2. Generate test data (15 min)
cd ..
./scripts/run-test-agents.sh

# 3. Train (2 hours)
cd python
python scripts/train.py --iterations 10
```

**Trained model in ~3 hours**

---

## Documentation

1. **[README.md](./README.md)** - Project overview
2. **[READ_THIS_FIRST.md](./READ_THIS_FIRST.md)** - Full guide
3. **[EXECUTE_NOW.md](./EXECUTE_NOW.md)** - Detailed steps
4. **[python/README.md](./python/README.md)** - Python API

---

## System

- ✅ Strong types (Pydantic)
- ✅ Fail fast (no error hiding)
- ✅ Clean (88 files deleted)
- ✅ 10 Python files
- ✅ Production-ready

**Execute:** `./scripts/run-test-agents.sh`

