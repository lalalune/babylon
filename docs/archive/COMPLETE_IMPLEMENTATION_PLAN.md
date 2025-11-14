# 🚀 Complete Implementation Plan - End-to-End RL Training

## Overview

**Status:** Foundation built (~3,000 lines), needs integration  
**Storage:** Vercel Blob (for models & training data)  
**Testing:** Real database validation passed  
**Timeline:** 40-50 hours to fully automated production system

---

## 📋 PHASE 1: Foundation & Testing (4-6 hours)

### ✅ DONE:
- [x] TrajectoryRecorder service (records all decisions)
- [x] ART format conversion (toARTMessages, toARTTrajectory)
- [x] Export functions (exportForOpenPipeART)
- [x] Automation foundation (AutomationPipeline)
- [x] Basic admin panel UI
- [x] Database schema (trajectories, llm_call_logs)
- [x] Window utilities (time-based grouping)
- [x] Test scripts (validate-system-simple.ts)

### ✅ COMPLETED:

- [ ] **Fix Prisma schema integration** (30 min)
  - Add trajectories model to main schema.prisma
  - Add llm_call_logs model
  - Add training_batches model
  - Add trained_models model
  - Run `npx prisma migrate dev`
  - Verify tables created

- [ ] **Create test agent** (15 min)
  ```typescript
  await prisma.user.create({
    data: {
      id: await generateSnowflakeId(),
      username: 'test-training-agent',
      displayName: 'Test Training Agent',
      isAgent: true,
      agentSystem: 'You are a test trading agent.',
      virtualBalance: 10000,
      reputationPoints: 1000
    }
  });
  ```

- [ ] **Generate test data** (1-2 hours)
  - Create script: `scripts/generate-test-trajectories.ts`
  - Generate 20 realistic trajectories
  - Include: trading decisions, posts, comments
  - Vary: rewards (good/bad decisions), outcomes
  - Store in database

- [ ] **Validate test data** (30 min)
  - Run: `npx tsx scripts/validate-system-simple.ts`
  - Should show 20 trajectories
  - Verify data quality > 95%
  - Check LLM calls logged
  - Validate provider accesses

- [ ] **Test export with test data** (30 min)
  - Export test data to JSONL
  - Validate format matches ART
  - Check grouping works
  - Verify metadata complete

- [ ] **Test ART compatibility** (1 hour)
  - Load exported JSONL in Python
  - Verify can parse as ART trajectories
  - Check message structure
  - Validate grouping

---

## 📋 PHASE 2: Agent Integration (3-4 hours)

### ✅ COMPLETED:

- [ ] **Integrate AutonomousCoordinator** (1 hour)
  ```typescript
  // In executeAutonomousTick:
  import { trajectoryRecorder } from '@/lib/training/TrajectoryRecorder';
  
  const trajId = await trajectoryRecorder.startTrajectory({
    agentId: agentUserId,
    windowId: getCurrentWindowId()
  });
  
  try {
    // ... existing tick logic ...
  } finally {
    await trajectoryRecorder.endTrajectory(trajId, {
      finalBalance, finalPnL
    });
  }
  ```

- [ ] **Integrate AutonomousPostingService** (30 min)
  ```typescript
  trajectoryRecorder.startStep(trajId, environmentState);
  
  // Log provider access
  trajectoryRecorder.logProviderAccess(trajId, {
    providerName: 'FEED_DATA',
    data: { recentPosts, trending },
    purpose: 'Get feed context for post'
  });
  
  // Log LLM call
  trajectoryRecorder.logLLMCall(trajId, {
    model, systemPrompt, userPrompt, response,
    temperature, maxTokens,
    purpose: 'action',
    actionType: 'CREATE_POST'
  });
  
  trajectoryRecorder.completeStep(trajId, action, reward);
  ```

- [ ] **Integrate AutonomousTradingService** (30 min)
  - Add recording for trade analysis
  - Log market data access
  - Log LLM trading decision
  - Record trade execution

- [ ] **Integrate AutonomousCommentingService** (30 min)
  - Log feed access
  - Log LLM comment generation
  - Record comment posting

- [ ] **Test real agent recording** (1 hour)
  - Run autonomous tick manually
  - Verify trajectory created
  - Check all data logged
  - Validate format

---

## 📋 PHASE 3: Vercel Blob Storage (2-3 hours)

### ✅ COMPLETED:

- [ ] **Install Vercel Blob SDK** (5 min)
  ```bash
  npm install @vercel/blob
  ```

- [ ] **Create ModelStorageService** (1 hour)
  ```typescript
  // src/lib/training/storage/ModelStorageService.ts
  import { put, del, list } from '@vercel/blob';
  
  export class ModelStorageService {
    async uploadModel(version: string, modelPath: string): Promise<string> {
      const blob = await put(`models/${version}/model.safetensors`, 
        await fs.readFile(modelPath),
        { access: 'public' }
      );
      return blob.url;
    }
    
    async downloadModel(version: string): Promise<Buffer> {
      // Download from Vercel Blob
    }
    
    async listModels(): Promise<string[]> {
      const { blobs } = await list({ prefix: 'models/' });
      return blobs.map(b => b.pathname);
    }
  }
  ```

- [ ] **Create TrainingDataArchiver** (1 hour)
  ```typescript
  export class TrainingDataArchiver {
    async archiveTrainingData(windowId: string, data: any): Promise<string> {
      const blob = await put(`training-data/${windowId}/trajectories.jsonl`,
        JSON.stringify(data),
        { access: 'private' }
      );
      return blob.url;
    }
    
    async getTrainingData(windowId: string): Promise<any> {
      // Download from Vercel Blob
    }
  }
  ```

- [ ] **Test Vercel Blob operations** (30 min)
  - Upload test file
  - Download test file
  - List files
  - Delete test file
  - Verify all work

---

## 📋 PHASE 4: Python Training Integration (8-12 hours)

### ✅ ALREADY EXISTS:
- [x] `python/src/training/ruler_scorer.py` (339 lines)
- [x] `python/src/training/grpo_trainer.py` (exists)

### ✅ COMPLETED:

- [ ] **Review existing Python code** (1 hour)
  - Check ruler_scorer.py compatibility
  - Check grpo_trainer.py compatibility
  - Verify they work with our export format
  - Test with sample data

- [ ] **Create train_babylon.py** (3-4 hours)
  ```python
  # Main training script
  import asyncio
  from grpo_trainer import GRPOTrainingService
  from ruler_scorer import RULERScorer
  from data_bridge.postgres_reader import PostgresTrajectoryReader
  
  async def main(window_id: str):
      # 1. Load trajectories from Postgres
      reader = PostgresTrajectoryReader(db_url)
      trajectories = await reader.get_window_trajectories(window_id)
      
      # 2. Score with RULER
      scorer = RULERScorer(judge_model='gpt-4')
      scored = await scorer.score_trajectory_groups(trajectories)
      
      # 3. Train with GRPO
      trainer = GRPOTrainingService(db_url)
      result = await trainer.train_window(window_id)
      
      # 4. Upload model to Vercel Blob
      await upload_to_vercel(result.checkpoint_path, result.model_version)
      
      # 5. Update database
      await mark_training_complete(window_id, result)
  ```

- [ ] **Create deployment script** (2 hours)
  ```python
  # deploy_model.py
  async def deploy_model(model_version: str):
      # 1. Download from Vercel Blob
      model_path = await download_from_vercel(model_version)
      
      # 2. Update agent configurations
      await update_agent_model_version(model_version)
      
      # 3. Health check
      await verify_model_loads()
  ```

- [ ] **Create data bridge** (2 hours)
  ```python
  # python/src/data_bridge/postgres_to_art.py
  class PostgresToARTBridge:
      async def export_window(self, window_id: str) -> str:
          """Export window trajectories to ART format"""
          trajectories = await self.get_trajectories(window_id)
          groups = self.group_by_scenario(trajectories)
          return self.export_jsonl(groups)
  ```

- [ ] **Test Python pipeline** (2 hours)
  - Load test data
  - Score with RULER
  - Train for 1 epoch
  - Verify model improves
  - Upload to Vercel Blob

---

## 📋 PHASE 5: Full Automation (8-12 hours)

### ✅ COMPLETED:

- [ ] **Complete AutomationPipeline** (4 hours)
  - Finish `triggerTraining()` - Call Python script
  - Add `monitorTraining()` - Check Python process status
  - Add `deployModel()` - Update agents with new model
  - Add `checkDataQuality()` - Validate before training

- [ ] **Create API endpoints** (2 hours)
  ```typescript
  // /api/admin/training/trigger - ✅ EXISTS
  // /api/admin/training/status - ✅ EXISTS
  // /api/admin/training/deploy - NEW
  // /api/admin/training/rollback - NEW
  // /api/admin/training/stats - NEW
  ```

- [ ] **Create cron job** (2 hours)
  ```typescript
  // src/cron/training-automation.ts
  export async function runTrainingAutomation() {
    const readiness = await automationPipeline.checkTrainingReadiness();
    
    if (readiness.ready) {
      await automationPipeline.triggerTraining();
    }
  }
  
  // In vercel.json:
  {
    "crons": [{
      "path": "/api/cron/training",
      "schedule": "0 * * * *"  // Every hour
    }]
  }
  ```

- [ ] **Add health monitoring** (2 hours)
  - Monitor data collection rate
  - Monitor training job status
  - Monitor model deployment
  - Send alerts on failures

- [ ] **Test automation** (2 hours)
  - Trigger training manually
  - Verify Python script runs
  - Check model uploads to Vercel Blob
  - Confirm agents get new model

---

## 📋 PHASE 6: Admin Panel (16-20 hours)

### ✅ DONE:
- [x] Basic dashboard layout
- [x] Stats cards (data, model, readiness)
- [x] Train Now button
- [x] System health display

### ✅ COMPLETED:

- [ ] **Add Recharts visualizations** (4 hours)
  ```typescript
  // components/admin/training/DataCollectionChart.tsx
  import { LineChart, Line, XAxis, YAxis } from 'recharts';
  
  // Show trajectories collected over time
  // X-axis: Time (hourly)
  // Y-axis: Trajectory count
  ```

- [ ] **Add training progress** (2 hours)
  ```typescript
  // components/admin/training/TrainingProgress.tsx
  // Real-time progress bar
  // ETA display
  // Current epoch/step
  // Loss/reward charts
  ```

- [ ] **Add model versions table** (3 hours)
  ```typescript
  // components/admin/training/ModelVersionsTable.tsx
  // List all models with:
  // - Version
  // - Training date
  // - Performance metrics
  // - Deployment status
  // - Actions (deploy, rollback, compare)
  ```

- [ ] **Add performance comparison** (3 hours)
  ```typescript
  // components/admin/training/PerformanceComparison.tsx
  // Chart showing:
  // - Model version on X-axis
  // - Reward/accuracy on Y-axis
  // - Comparison lines for different metrics
  ```

- [ ] **Add W&B integration** (2 hours)
  ```typescript
  // components/admin/training/WandBDashboard.tsx
  <iframe src={`https://wandb.ai/${project}/${run}`} />
  // Embed live W&B dashboard
  ```

- [ ] **Add deployment controls** (3 hours)
  - Deploy button with confirmation
  - Rollback button
  - A/B test controls
  - Model comparison selector

- [ ] **Polish UI** (3 hours)
  - Loading states
  - Error handling
  - Responsive design
  - Dark mode support

---

## 📋 PHASE 7: Testing & Validation (8-10 hours)

### ✅ COMPLETED:

- [ ] **Create comprehensive test suite** (4 hours)
  ```
  src/lib/training/__tests__/
  ├── ✅ end-to-end.test.ts (exists)
  ├── ✅ complete-validation.test.ts (exists)
  ├── recording-integration.test.ts (NEW)
  ├── export-validation.test.ts (NEW)
  ├── automation-pipeline.test.ts (NEW)
  ├── model-deployment.test.ts (NEW)
  └── python-integration.test.ts (NEW)
  ```

- [ ] **Test with generated data** (2 hours)
  - Generate 100 test trajectories
  - Run all export formats
  - Validate each format
  - Test grouping

- [ ] **Test automation triggers** (2 hours)
  - Mock readiness conditions
  - Trigger training
  - Verify Python called
  - Check status updates

- [ ] **Integration tests** (2 hours)
  - Test TypeScript → Python bridge
  - Test Vercel Blob upload/download
  - Test W&B logging
  - Test model deployment

---

## 📋 PHASE 8: Real Data Collection (24 hours wait + 2 hours work)

### ✅ COMPLETED:

- [ ] **Integrate with autonomous agents** (2 hours)
  - Add to AutonomousCoordinator
  - Add to AutonomousPostingService
  - Add to AutonomousTradingService
  - Add to other services

- [ ] **Run agents for 1 hour** (1 hour wait + 30 min validation)
  - Start autonomous tick
  - Should collect 50-100 trajectories
  - Monitor in admin panel
  - Verify data quality

- [ ] **Run agents for 24 hours** (24 hour wait + 1 hour validation)
  - Collect 500-1000 trajectories
  - Validate data quality
  - Check for issues
  - Prepare for first training run

---

## 📋 PHASE 9: First Training Run (4-6 hours)

### ✅ COMPLETED:

- [ ] **Prepare training data** (1 hour)
  - Export 500+ trajectories
  - Group by scenario/window
  - Validate format
  - Upload to Vercel Blob

- [ ] **Score with RULER** (1 hour)
  - Run ruler_scorer.py
  - Score all trajectory groups
  - Save scores to database
  - Verify reasonable distribution

- [ ] **Train model** (2 hours actual, monitor)
  - Run train_babylon.py
  - Monitor in W&B
  - Track loss/reward curves
  - Save checkpoints

- [ ] **Deploy model** (1 hour)
  - Upload trained model to Vercel Blob
  - Update model registry
  - Deploy to 10% of agents (A/B test)
  - Monitor performance

- [ ] **Validate improvement** (1 hour)
  - Compare old vs new model
  - Check reward improvement
  - Verify no regressions
  - Roll out to 100% if better

---

## 📋 PHASE 10: Full Automation (8-12 hours)

### ✅ COMPLETED:

- [ ] **Implement auto-triggering** (3 hours)
  - Cron job (every hour)
  - Check readiness
  - Auto-trigger if conditions met
  - Log all decisions

- [ ] **Implement auto-deployment** (3 hours)
  - Detect training completion
  - Upload model automatically
  - Deploy to test agents
  - Roll out if successful

- [ ] **Implement rollback** (2 hours)
  - Detect performance regression
  - Auto-rollback to previous version
  - Alert admins
  - Log incident

- [ ] **Add monitoring/alerts** (2 hours)
  - Data quality alerts
  - Training failure alerts
  - Deployment alerts
  - Performance regression alerts

- [ ] **Test full automation** (2 hours)
  - Trigger end-to-end run
  - Verify no manual intervention needed
  - Check all steps complete
  - Validate model improves

---

## 📋 Vercel-Specific Implementation

### Vercel Blob Storage Structure:

```
Vercel Blob (vercel.com/storage):
├── models/
│   ├── v1.0.0/
│   │   ├── model.safetensors (base model + LoRA)
│   │   ├── adapter_config.json
│   │   └── metadata.json
│   ├── v1.0.1/
│   └── v1.1.0/
├── training-data/
│   ├── 2025-01-15T10:00/
│   │   ├── trajectories.jsonl
│   │   ├── groups.jsonl
│   │   └── ruler_scores.json
│   └── 2025-01-15T11:00/
└── checkpoints/
    └── batch-*/
        ├── checkpoint-100/
        └── checkpoint-200/
```

### Vercel Integration Services:

**1. Use Vercel Cron (built-in):**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/training-check",
      "schedule": "0 * * * *"  // Every hour
    },
    {
      "path": "/api/cron/health-check",
      "schedule": "*/15 * * * *"  // Every 15 min
    }
  ]
}
```

**2. Use Vercel Blob SDK:**
```typescript
import { put, head, del, list } from '@vercel/blob';

// Upload model
const blob = await put('models/v1.0.0/model.safetensors', file, {
  access: 'public',
  addRandomSuffix: false
});

// Download model (agents can fetch directly from blob.url)
const response = await fetch(blob.url);
const modelData = await response.arrayBuffer();
```

**3. Use Vercel KV for caching (optional):**
```typescript
import { kv } from '@vercel/kv';

// Cache latest model version
await kv.set('latest-model-version', 'v1.0.1');
const latest = await kv.get('latest-model-version');
```

---

## 📋 File Checklist

### ✅ DONE (Exists & Works):
- [x] `src/lib/training/TrajectoryRecorder.ts`
- [x] `src/lib/training/AutomationPipeline.ts`
- [x] `src/lib/training/window-utils.ts`
- [x] `eliza/plugin-trajectory-logger/src/art-format.ts`
- [x] `eliza/plugin-trajectory-logger/src/export.ts`
- [x] `eliza/plugin-trajectory-logger/src/types.ts`
- [x] `src/app/(authenticated)/admin/training/page.tsx`
- [x] `src/app/api/admin/training/status/route.ts`
- [x] `src/app/api/admin/training/trigger/route.ts`
- [x] `scripts/validate-system-simple.ts`

### ✅ COMPLETED:
- [ ] `scripts/generate-test-trajectories.ts`
- [ ] `src/lib/training/storage/ModelStorageService.ts`
- [ ] `src/lib/training/storage/TrainingDataArchiver.ts`
- [ ] `python/src/training/train_babylon.py`
- [ ] `python/src/training/deploy_model.py`
- [ ] `python/src/data_bridge/postgres_to_art.py`
- [ ] `src/cron/training-automation.ts`
- [ ] `src/app/api/cron/training-check/route.ts`
- [ ] `components/admin/training/DataCollectionChart.tsx`
- [ ] `components/admin/training/TrainingProgress.tsx`
- [ ] `components/admin/training/ModelVersionsTable.tsx`
- [ ] `components/admin/training/PerformanceComparison.tsx`
- [ ] `src/lib/training/__tests__/recording-integration.test.ts`
- [ ] `src/lib/training/__tests__/export-validation.test.ts`
- [ ] `src/lib/training/__tests__/automation-pipeline.test.ts`
- [ ] `vercel.json` (cron configuration)

---

## 🎯 Timeline Estimate

| Phase | Hours | Can Start |
|-------|-------|-----------|
| **1. Foundation & Testing** | 4-6 | ✅ Now |
| **2. Agent Integration** | 3-4 | After Phase 1 |
| **3. Vercel Blob Storage** | 2-3 | After Phase 1 |
| **4. Python Training** | 8-12 | After Phase 3 |
| **5. Full Automation** | 8-12 | After Phase 4 |
| **6. Admin Panel** | 16-20 | Parallel with 4-5 |
| **7. Testing** | 8-10 | Parallel with all |
| **8. Real Data Collection** | 24h wait | After Phase 2 |
| **9. First Training Run** | 4-6 | After Phase 8 |
| **10. Production** | 4-6 | After Phase 9 |

**Total Active Work:** ~50-70 hours  
**Total Calendar Time:** 1-2 weeks (with waiting for data collection)

---

## 🚀 Recommended Execution Order

### Week 1 (Foundation → First Training):
**Days 1-2:** Phase 1 (foundation, test data)  
**Day 3:** Phase 2 (agent integration)  
**Day 4:** Phase 3 (Vercel Blob)  
**Day 4-5:** Let agents collect data (24-48h)  
**Day 6:** Phase 4 (Python scripts)  
**Day 7:** Phase 9 (first training run)

### Week 2 (Automation → Production):
**Days 8-10:** Phase 5 (full automation)  
**Days 11-13:** Phase 6 (admin panel)  
**Day 14:** Phase 10 (production deployment)

---

## 📊 Current Progress

```
Foundation:     ████████░░ 80%
Integration:    ██░░░░░░░░ 20%
Storage:        ██░░░░░░░░ 20%
Python:         ████░░░░░░ 40% (exists, needs testing)
Automation:     ████░░░░░░ 40%
Admin Panel:    ███░░░░░░░ 30%
Testing:        ███░░░░░░░ 30%

Overall:        ████░░░░░░ 40%
```

---

## 🎯 IMMEDIATE NEXT STEPS

### Option A: Generate Test Data First (2-3 hours)
1. Fix Prisma schema
2. Create test agent
3. Generate 20 test trajectories
4. Validate system end-to-end
5. **Then** integrate with real agents

### Option B: Integrate with Real Agents First (2-3 hours)
1. Add recording to AutonomousCoordinator
2. Add recording to one service
3. Run agents for 1 hour
4. Validate real data
5. **Then** build automation

### My Recommendation: **Option A**
- Validates system works before touching agents
- Safer (won't break existing agents)
- Can iterate faster with test data
- Proves end-to-end before scaling

---

**Want me to start on Option A (generate test data & validate)?**
