# Documentation Cleanup Plan

## Current Situation: Too Many Guides

There are multiple overlapping documentation files. Need to consolidate to avoid confusion.

---

## 📚 Keep These (Primary Docs)

### 1. README_RL_TRAINING.md ⭐
**Purpose:** Main entry point and quick reference  
**Status:** Keep and maintain

### 2. RL_TRAINING_COMPLETE_GUIDE.md
**Purpose:** Comprehensive implementation guide  
**Status:** Keep and maintain

### 3. python/README.md
**Purpose:** Python package API documentation  
**Status:** Keep and maintain

### 4. FINAL_STATUS_AND_COMPLETION.md
**Purpose:** Current status and completion tracking  
**Status:** Keep and update as needed

---

## 🗑️ Archive These (Duplicates/Superseded)

### Continuous MMO Docs (Merged into Complete Guide)
- RL_TRAINING_CONTINUOUS_MMO_APPROACH.md → Merged
- RL_TRAINING_CONTINUOUS_MMO_SUMMARY.md → Merged
- TYPESCRIPT_INTEGRATION_MMO.md → Merged into Complete Guide
- START_HERE_MMO_RL.md → Superseded by README_RL_TRAINING.md

### Implementation Docs (Superseded)
- IMPLEMENTATION_COMPLETE.md → Superseded by FINAL_STATUS
- IMPLEMENTATION_SUMMARY.md → Superseded by FINAL_STATUS
- COMPLETE_IMPLEMENTATION_PLAN.md → Superseded by Complete Guide

### Old Planning Docs (Historical)
- SYSTEM_STATUS_AND_NEXT_STEPS.md → Outdated, superseded

---

## 📋 Action Items

### Move to Archive
```bash
mkdir -p docs/archive
mv RL_TRAINING_CONTINUOUS_MMO_*.md docs/archive/
mv START_HERE_MMO_RL.md docs/archive/
mv IMPLEMENTATION_*.md docs/archive/
mv COMPLETE_IMPLEMENTATION_PLAN.md docs/archive/
mv SYSTEM_STATUS_AND_NEXT_STEPS.md docs/archive/
```

### Keep in Root
- README_RL_TRAINING.md
- RL_TRAINING_COMPLETE_GUIDE.md
- FINAL_STATUS_AND_COMPLETION.md

### Update Links
- Update any scripts that reference old docs
- Add note to archived docs pointing to new ones

---

## 📖 New Documentation Structure

```
babylon/
├── README_RL_TRAINING.md           ⭐ START HERE
├── RL_TRAINING_COMPLETE_GUIDE.md   📚 Complete guide
├── FINAL_STATUS_AND_COMPLETION.md  📊 Status tracker
│
├── python/
│   └── README.md                   🐍 Python API docs
│
└── docs/archive/                   📦 Historical docs
    ├── RL_TRAINING_CONTINUOUS_MMO_APPROACH.md
    ├── RL_TRAINING_CONTINUOUS_MMO_SUMMARY.md
    ├── START_HERE_MMO_RL.md
    ├── IMPLEMENTATION_COMPLETE.md
    ├── IMPLEMENTATION_SUMMARY.md
    ├── COMPLETE_IMPLEMENTATION_PLAN.md
    └── SYSTEM_STATUS_AND_NEXT_STEPS.md
```

---

## ✅ Result

**Before:** 11+ documentation files (confusing)  
**After:** 3 primary docs + 1 Python doc (clear)

Users read:
1. README_RL_TRAINING.md (quick start)
2. RL_TRAINING_COMPLETE_GUIDE.md (complete guide)
3. python/README.md (API reference)

**Much cleaner!**

