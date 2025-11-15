## RL Benchmark & Continuous Simulation Review

### Current Pipeline Snapshot
- **Benchmark generation & replay** – `src/lib/benchmark/BenchmarkDataGenerator.ts` creates deterministic market snapshots (prediction/perp markets, ground-truth outcomes, tick events). `BenchmarkRunner` plus `SimulationA2AInterface` inject those snapshots into any Eliza runtime and can optionally persist trajectories via `TrajectoryRecorder`.
- **Serverless Eliza runtimes** – `src/lib/agents/runtime/AgentRuntimeManager.ts` provisions isolated runtimes with Babylon plugins, optional W&B-backed models, and trajectory logging hooks for every action/provider call.
- **Autonomous execution & recording** – Cron route `/api/cron/agent-tick` leverages `AutonomousCoordinator` (or `AutonomousCoordinatorWithRecording` when `RECORD_AGENT_TRAJECTORIES=true`) to run real agents, deduct points, and persist step-level data into Prisma via `TrajectoryRecorder`.
- **Trajectory storage schema** – Prisma `Trajectory`, `TrainingBatch`, and `TrainedModel` tables capture episodes, GRPO groupings, training status, and deployment metadata (`prisma/schema.prisma`).
- **Automation pipeline entry points** – `src/lib/training/AutomationPipeline.ts` orchestrates readiness checks, GRPO export (`exportGroupedForGRPO`), python job spawning, and deployment bookkeeping. Cron endpoints (`/api/cron/training-check`, `/api/cron/training`) call this pipeline hourly/daily.
- **Python training utilities** – `python/src/training/babylon_trainer.py` (deterministic ART workflow) and `python/src/training/trainer.py` (RULER scoring scaffolding) connect directly to PostgreSQL. `python/tests/test_continuous_training.py` already sketches end-to-end expectations (window selection, RULER judging, GRPO fine-tuning, deployment).
- **Verification tooling** – `scripts/verify-rl-system.ts` validates configuration, data availability, automation status, and latest model registry entries.

### Observations & Gaps
1. **Automation thresholds** – Pipeline still triggers after only 100 new trajectories, conflicting with the requirement to wait for ≈1000 fresh entries before spinning up GRPO/ART jobs.
2. **Training job invocation** – `AutomationPipeline.triggerTraining` spawns `python/src/training/train_babylon.py`, which does not exist, and there is no CLI harness that wires node-side exports to the python RULER/GRPO scripts.
3. **LLM-as-judge + GRPO integration** – Python package contains raw building blocks (`ContinuousMMOTrainer`, data bridge, tests) but lacks a concrete, callable service (`GRPOTrainingService`, `TrainingResult`) that AutomationPipeline or dev scripts can invoke.
4. **Model tier semantics** – Agents still expose `lite/standard/pro` UI choices and runtime tier switches even though we now mandate a single W&B RL model. Tier-based point deductions and logging are out-of-date.
5. **End-to-end harness** – No executable script currently seeds agents, runs benchmark-length simulations, confirms trajectory ingestion, kicks off training, and verifies model rollout in one go.
6. **Documentation** – There was no consolidated description of how benchmarking feeds RL training or where the missing pieces live, making audits difficult.

### Implementation Plan
1. **Document & align architecture**
   - Capture the current state (this document) so audits and future contributors see how benchmark replay, trajectory logging, AutomationPipeline, and python training are intended to interact.
2. **Raise automation thresholds**
   - Honor an env-driven minimum trajectory count (default 1000). Surfaced through `TRAINING_MIN_TRAJECTORIES`, enforced inside `AutomationPipeline.checkTrainingReadiness`, and reflected in scripts/logging so cron jobs only fire with sufficient data.
3. **Ensure agents default to RL model**
   - Treat W&B as the default inference backend whenever `WANDB_API_KEY` is configured: `getAIModelConfig` should auto-enable W&B, `AgentRuntimeManager` should always inject the RL model into both small/large slots, and cron logging should report actual RL models instead of tier labels.
4. **Live harness for benchmark → training**
   - New script (`scripts/run-rl-harness.ts`) should:
     1. Provision or reuse ≥5 deterministic harness agents via Prisma.
     2. Generate / load a benchmark snapshot and run each agent through `BenchmarkRunner` with trajectory recording enabled.
     3. Report metrics + stored trajectory count, ensuring data is available for GRPO export.
     4. Optionally invoke `automationPipeline.triggerTraining` (with `--force` flag) and stream training status.
     5. Surface post-run stats (latest trained model, readiness deltas).
   - Wire this up as `bun run rl:harness` so it’s easy to execute locally or in CI.
5. **Expose debug training trigger & cron behaviour**
   - Continue to support `/api/admin/training/trigger` but document + log the new thousand-trajectory threshold so ops knows why cron skipped a run. Harness can also call this endpoint indirectly via the shared AutomationPipeline singleton.
6. **Highlight missing python services**
   - The current repo lacks `GRPOTrainingService`/`ModelDeploymentService` implementations referenced by `python/tests/test_continuous_training.py`. Until those land, AutomationPipeline should at least launch an existing python entry point (we can add a lightweight wrapper around `babylon_trainer`) instead of pointing to a non-existent script.

### Testing Harness Strategy
1. **Benchmark replay loop**
   - Deterministic seed + shared snapshot ensures every agent sees identical market conditions. We fast-forward ticks via `SimulationA2AInterface` to keep runs quick.
2. **Trajectory validation**
   - After harness runs, query `prisma.trajectory` filtered by `scenarioId="benchmark-<snapshot-id>"` to confirm episodes persisted with `usedInTraining=false`.
3. **Automation smoke**
   - Reuse `automationPipeline.checkTrainingReadiness()` to print stats before/after harness, ensuring our run actually moves the needle toward the thousand-trajectory bar.
4. **Training trigger (optional)**
   - If `--train` is supplied, call `automationPipeline.triggerTraining({ force: options.force })` and then `monitorTraining` in a simple polling loop to capture completion/errors.
5. **Post-run verification**
   - Call `getLatestRLModel()` to confirm the inference registry updated (or still empty) and print actionable guidance if not.

### Outstanding Risks / Follow-ups
- Python GRPO implementation is still skeletal: `ContinuousMMOTrainer` never hands trajectories to `art.TrainableModel`, `GRPOTrainingService` doesn’t exist, and `TrainingResult`/`ModelDeploymentService` referenced in tests are missing. These will need real implementations before cron-triggered jobs can truly fine-tune via W&B.
- Front-end + API still expose tier toggles; once server defaults to RL, we should clean up those UX/code paths to avoid confusion (tracked separately).
- The harness currently focuses on benchmark replay + AutomationPipeline integration. Once python-side GRPO service exists, extend the harness to assert on actual RULER rankings and fetched W&B artifacts instead of just kicking off the job.


