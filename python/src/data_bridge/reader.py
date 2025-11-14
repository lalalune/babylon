"""
PostgreSQL Trajectory Reader
Strong types, async, no error hiding
"""

import asyncpg
from typing import List
import logging
import json
from datetime import datetime, timedelta

from ..models import BabylonTrajectory, MarketOutcomes, WindowStatistics, StockOutcome, TrajectoryStep, EnvironmentState, LLMCall, Action, ProviderAccess

logger = logging.getLogger(__name__)


class PostgresTrajectoryReader:
    """Read Babylon trajectories from PostgreSQL - fail fast on errors"""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.pool: asyncpg.Pool | None = None
        
    async def connect(self):
        """Initialize connection pool - raises on failure"""
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                self.db_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("PostgreSQL connection pool created")
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("PostgreSQL connection pool closed")
    
    async def get_window_ids(
        self,
        min_agents: int = 5,
        lookback_hours: int = 24
    ) -> List[str]:
        """
        Get window IDs with enough agents
        
        Raises:
            RuntimeError: If not connected
            asyncpg.PostgresError: On query failure
        """
        if not self.pool:
            raise RuntimeError("Not connected - call connect() first")
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT window_id
                FROM trajectories
                WHERE 
                    window_id IS NOT NULL
                    AND created_at > NOW() - $1::interval
                GROUP BY window_id
                HAVING COUNT(DISTINCT agent_id) >= $2
                ORDER BY window_id DESC
                """,
                f"{lookback_hours} hours",
                min_agents
            )
            
        return [row['window_id'] for row in rows]
    
    async def get_trajectories_by_window(
        self,
        window_id: str,
        min_actions: int = 5
    ) -> List[BabylonTrajectory]:
        """
        Get all trajectories for a window
        
        Returns validated Pydantic models - raises on validation errors
        """
        if not self.pool:
            raise RuntimeError("Not connected - call connect() first")
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT 
                    id, trajectory_id, agent_id, window_id,
                    start_time, end_time, duration_ms,
                    scenario_id, episode_id,
                    steps_json, total_reward, final_pnl, final_balance,
                    trades_executed, posts_created, episode_length, final_status
                FROM trajectories
                WHERE window_id = $1
                ORDER BY created_at
                """,
                window_id
            )
        
        trajectories = []
        for row in rows:
            # Parse steps JSON
            steps_data = json.loads(row['steps_json'])
            
            # Validate and convert steps
            steps = [
                TrajectoryStep(
                    step_number=s['stepNumber'],
                    timestamp=s['timestamp'],
                    environment_state=EnvironmentState(**s['environmentState']),
                    provider_accesses=[ProviderAccess(**p) for p in s.get('providerAccesses', [])],
                    llm_calls=[LLMCall(
                        model=llm['model'],
                        system_prompt=llm['systemPrompt'],
                        user_prompt=llm['userPrompt'],
                        response=llm['response'],
                        reasoning=llm.get('reasoning'),
                        temperature=llm['temperature'],
                        max_tokens=llm['maxTokens'],
                        latency_ms=llm.get('latencyMs'),
                        purpose=llm['purpose'],
                        action_type=llm.get('actionType')
                    ) for llm in s['llmCalls']],
                    action=Action(**s['action']),
                    reward=s['reward']
                )
                for s in steps_data
            ]
            
            # Only include if meets minimum actions
            if len(steps) >= min_actions:
                trajectories.append(BabylonTrajectory(
                    id=row['id'],
                    trajectory_id=row['trajectory_id'],
                    agent_id=row['agent_id'],
                    window_id=row['window_id'],
                    start_time=row['start_time'],
                    end_time=row['end_time'],
                    duration_ms=row['duration_ms'],
                    scenario_id=row['scenario_id'],
                    episode_id=row['episode_id'],
                    steps=steps,
                    total_reward=float(row['total_reward']),
                    final_pnl=float(row['final_pnl']),
                    final_balance=float(row['final_balance']) if row['final_balance'] else None,
                    trades_executed=row['trades_executed'],
                    posts_created=row['posts_created'],
                    episode_length=row['episode_length'],
                    final_status=row['final_status']
                ))
        
        return trajectories
    
    async def get_market_outcomes(self, window_id: str) -> MarketOutcomes | None:
        """Get market outcomes for window - strong types"""
        if not self.pool:
            raise RuntimeError("Not connected")
        
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT 
                    stock_ticker, start_price, end_price,
                    change_percent, sentiment, news_events
                FROM market_outcomes
                WHERE window_id = $1 AND stock_ticker IS NOT NULL
                """,
                window_id
            )
        
        if not rows:
            return None
        
        # Parse window time
        window_start = datetime.fromisoformat(window_id.replace('Z', '+00:00'))
        window_end = window_start + timedelta(hours=1)
        
        stocks = {}
        for row in rows:
            stocks[row['stock_ticker']] = StockOutcome(
                ticker=row['stock_ticker'],
                start_price=float(row['start_price']),
                end_price=float(row['end_price']),
                change_percent=float(row['change_percent']),
                sentiment=row['sentiment'],
                news_events=row['news_events'] if row['news_events'] else []
            )
        
        return MarketOutcomes(
            window_id=window_id,
            window_start=window_start,
            window_end=window_end,
            stocks=stocks
        )
    
    async def get_window_stats(self, window_id: str) -> WindowStatistics | None:
        """Get statistics for window - validated"""
        if not self.pool:
            raise RuntimeError("Not connected")
        
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT 
                    window_id,
                    COUNT(DISTINCT agent_id) as agent_count,
                    COUNT(*) as trajectory_count,
                    COALESCE(SUM(episode_length), 0) as total_actions,
                    COALESCE(AVG(final_pnl), 0) as avg_pnl,
                    COALESCE(MIN(final_pnl), 0) as min_pnl,
                    COALESCE(MAX(final_pnl), 0) as max_pnl,
                    MIN(start_time) as start_time,
                    MAX(end_time) as end_time
                FROM trajectories
                WHERE window_id = $1
                GROUP BY window_id
                """,
                window_id
            )
        
        if not row:
            return None
        
        return WindowStatistics(
            window_id=row['window_id'],
            agent_count=row['agent_count'],
            trajectory_count=row['trajectory_count'],
            total_actions=row['total_actions'],
            avg_pnl=float(row['avg_pnl']),
            min_pnl=float(row['min_pnl']),
            max_pnl=float(row['max_pnl']),
            start_time=row['start_time'],
            end_time=row['end_time']
        )
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()



