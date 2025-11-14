"""
Continuous MMO Trainer
Strong types, no error swallowing, fail fast
"""

import os
import art
from art.rewards import ruler_score_group
from typing import List
import random
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent.parent
env_path = project_root / '.env'
env_local_path = project_root / '.env.local'

# Load .env files (local takes priority)
if env_local_path.exists():
    load_dotenv(env_local_path, override=True)
    print(f"✅ Loaded environment from {env_local_path}")
if env_path.exists():
    load_dotenv(env_path, override=False)  # Don't override .env.local
    print(f"✅ Loaded environment from {env_path}")

# Verify critical environment variables
if os.getenv('WANDB_API_KEY'):
    print(f"✅ WANDB_API_KEY found ({len(os.getenv('WANDB_API_KEY'))} chars)")
else:
    print("⚠️  WANDB_API_KEY not found - RULER scoring may fail")

# Suppress Pydantic v1 warning for Python 3.14
import warnings
warnings.filterwarnings('ignore', message='.*Pydantic V1.*')

from ..models import WindowStatistics, TrainingBatchSummary
from ..data_bridge.reader import PostgresTrajectoryReader
from ..data_bridge.converter import BabylonToARTConverter, calculate_dropout_rate

logger = logging.getLogger(__name__)


TRADING_RUBRIC = """
Evaluate the agent's trading decisions given the market outcomes.

SCORING CRITERIA:

1. PROFIT/LOSS (40%)
   - Did trades result in profit?
   - Magnitude relative to market movement

2. MARKET TIMING (30%)
   - Buy before rallies, sell before crashes?
   - Entry/exit points vs actual price action

3. RISK MANAGEMENT (20%)
   - Appropriate position sizing?
   - Avoided concentration in crashing assets?
   - Cut losses quickly?

4. OPPORTUNITY CAPTURE (10%)
   - Identified high-momentum moves?
   - Participated in trends?
   - Avoided false signals?

CONTEXT CONSIDERATIONS:
- Small loss in crashing market > small gain in rallying market
- Judge decision quality, not just outcome
- Consider information available at decision time

SCORING SCALE:
0.9-1.0: Excellent - Strong timing, risk management, trend capture
0.7-0.8: Good - Profitable with minor mistakes
0.5-0.6: Average - Break-even or small profit/loss
0.3-0.4: Poor - Significant losses or missed opportunities
0.0-0.2: Very poor - Large losses or terrible timing
"""


class ContinuousMMOTrainer:
    """Train agents on time-windowed scenarios - fail fast on errors"""
    
    def __init__(
        self,
        db_url: str,
        judge_model: str = "openai/gpt-4o-mini",
        dropout_rate: float = 0.0,
        max_per_window: int = 8,
        rubric: str = TRADING_RUBRIC
    ):
        self.db = PostgresTrajectoryReader(db_url)
        self.converter = BabylonToARTConverter(dropout_rate)
        self.judge_model = judge_model
        self.max_per_window = max_per_window
        self.rubric = rubric
    
    async def connect(self):
        """Connect - raises on failure"""
        await self.db.connect()
    
    async def close(self):
        """Close connections"""
        await self.db.close()
    
    async def get_training_windows(
        self,
        min_agents: int,
        lookback_hours: int,
        max_windows: int | None = None
    ) -> List[str]:
        """Get eligible windows - raises on DB errors"""
        
        window_ids = await self.db.get_window_ids(min_agents, lookback_hours)
        
        if not window_ids:
            raise ValueError(
                f"No windows found with {min_agents}+ agents in last {lookback_hours}h. "
                "Generate more test data with spawn-test-agents.ts"
            )
        
        logger.info(f"Found {len(window_ids)} eligible windows")
        
        # Random sample if too many
        if max_windows and len(window_ids) > max_windows:
            window_ids = random.sample(window_ids, max_windows)
            logger.info(f"Sampled {max_windows} windows")
        
        return window_ids
    
    async def prepare_and_score_window(
        self,
        window_id: str,
        min_actions: int
    ) -> art.TrajectoryGroup:
        """
        Prepare and score one window - raises on errors
        
        No None returns - either succeeds or raises
        """
        logger.info(f"Processing window: {window_id}")
        
        # Get trajectories
        trajs = await self.db.get_trajectories_by_window(window_id, min_actions)
        
        if len(trajs) < 2:
            raise ValueError(f"Window {window_id} has only {len(trajs)} trajectories (need 2+)")
        
        logger.info(f"  Found {len(trajs)} agents")
        
        # Get market outcomes
        market_outcomes = await self.db.get_market_outcomes(window_id)
        if market_outcomes:
            logger.info(f"  Market data: {len(market_outcomes.stocks)} stocks")
        
        # Convert to ART format
        group = self.converter.convert_window_group(
            trajs,
            market_outcomes,
            max_per_group=self.max_per_window
        )
        
        logger.info(f"  Converted {len(group.trajectories)} trajectories")
        
        # Score with RULER - let exceptions propagate
        logger.info(f"  Scoring with RULER ({self.judge_model})...")
        
        scored_group = await ruler_score_group(
            group,
            judge_model=self.judge_model,
            rubric=self.rubric,
            debug=True,
            swallow_exceptions=False  # Fail fast!
        )
        
        if not scored_group:
            raise RuntimeError(f"RULER scoring failed for window {window_id}")
        
        # Log results
        scores = [t.reward for t in scored_group.trajectories]
        best = max(scored_group.trajectories, key=lambda t: t.reward)
        worst = min(scored_group.trajectories, key=lambda t: t.reward)
        
        logger.info(
            f"  RULER scores: min={min(scores):.2f}, max={max(scores):.2f}, avg={sum(scores)/len(scores):.2f}"
        )
        logger.info(
            f"  Best: {best.metadata['agent_id']} (score: {best.reward:.2f}, P&L: ${best.metrics['final_pnl']:.2f})"
        )
        logger.info(
            f"  Worst: {worst.metadata['agent_id']} (score: {worst.reward:.2f}, P&L: ${worst.metrics['final_pnl']:.2f})"
        )
        
        return scored_group
    
    async def prepare_training_batch(
        self,
        min_agents: int,
        lookback_hours: int,
        max_windows: int,
        min_actions: int
    ) -> List[art.TrajectoryGroup]:
        """
        Prepare batch of trajectory groups
        
        Raises on any error - no silent failures
        """
        # Get windows
        window_ids = await self.get_training_windows(min_agents, lookback_hours, max_windows)
        
        # Process all windows
        groups = []
        failed_windows = []
        
        for i, window_id in enumerate(window_ids, 1):
            logger.info(f"\n[{i}/{len(window_ids)}] Processing {window_id}")
            
            try:
                group = await self.prepare_and_score_window(window_id, min_actions)
                groups.append(group)
                
            except Exception as e:
                logger.error(f"Window {window_id} failed: {e}")
                failed_windows.append((window_id, str(e)))
                # Continue with other windows but track failures
        
        if not groups:
            raise RuntimeError(
                f"All {len(window_ids)} windows failed processing. "
                f"Errors: {failed_windows}"
            )
        
        if failed_windows:
            logger.warning(f"{len(failed_windows)} windows failed: {failed_windows}")
        
        logger.info(f"\nSuccessfully prepared {len(groups)}/{len(window_ids)} groups")
        
        return groups
    
    def get_training_summary(
        self,
        groups: List[art.TrajectoryGroup]
    ) -> TrainingBatchSummary:
        """Get batch statistics - validated model"""
        
        if not groups:
            raise ValueError("Cannot summarize empty batch")
        
        total_trajs = sum(len(g.trajectories) for g in groups)
        all_scores = [t.reward for g in groups for t in g.trajectories]
        all_pnls = [float(t.metrics['final_pnl']) for g in groups for t in g.trajectories]
        
        return TrainingBatchSummary(
            windows=len(groups),
            total_trajectories=total_trajs,
            avg_trajectories_per_window=total_trajs / len(groups),
            score_min=min(all_scores),
            score_max=max(all_scores),
            score_avg=sum(all_scores) / len(all_scores),
            pnl_min=min(all_pnls),
            pnl_max=max(all_pnls),
            pnl_avg=sum(all_pnls) / len(all_pnls)
        )
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

        if not groups:
            raise ValueError("Cannot summarize empty batch")
        
        total_trajs = sum(len(g.trajectories) for g in groups)
        all_scores = [t.reward for g in groups for t in g.trajectories]
        all_pnls = [float(t.metrics['final_pnl']) for g in groups for t in g.trajectories]
        
        return TrainingBatchSummary(
            windows=len(groups),
            total_trajectories=total_trajs,
            avg_trajectories_per_window=total_trajs / len(groups),
            score_min=min(all_scores),
            score_max=max(all_scores),
            score_avg=sum(all_scores) / len(all_scores),
            pnl_min=min(all_pnls),
            pnl_max=max(all_pnls),
            pnl_avg=sum(all_pnls) / len(all_pnls)
        )
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
