"""
Shared Type Definitions for Babylon RL Training
Strong, validated types - no Any, no unknown casts
"""

from typing import List, Literal
from pydantic import BaseModel, Field
from datetime import datetime


class EnvironmentState(BaseModel):
    """Environment state at a given point"""
    agent_balance: float
    agent_pnl: float
    open_positions: int
    active_markets: int = 0


class ProviderAccess(BaseModel):
    """Data accessed from a provider"""
    provider_name: str
    data: dict
    purpose: str


class LLMCall(BaseModel):
    """Single LLM call record"""
    model: str
    system_prompt: str
    user_prompt: str
    response: str
    reasoning: str | None = None
    temperature: float
    max_tokens: int
    latency_ms: int | None = None
    purpose: Literal['action', 'reasoning', 'evaluation', 'response']
    action_type: str | None = None


class Action(BaseModel):
    """Action taken by agent"""
    action_type: str
    parameters: dict
    success: bool
    result: dict | None = None
    error: str | None = None
    reasoning: str | None = None


class TrajectoryStep(BaseModel):
    """Single step in a trajectory"""
    step_number: int
    timestamp: int
    environment_state: EnvironmentState
    provider_accesses: List[ProviderAccess]
    llm_calls: List[LLMCall]
    action: Action
    reward: float


class BabylonTrajectory(BaseModel):
    """Complete trajectory from database"""
    id: str
    trajectory_id: str
    agent_id: str
    window_id: str
    start_time: datetime
    end_time: datetime
    duration_ms: int
    scenario_id: str | None = None
    episode_id: str | None = None
    steps: List[TrajectoryStep]
    total_reward: float
    final_pnl: float
    final_balance: float | None = None
    trades_executed: int | None = None
    posts_created: int | None = None
    episode_length: int
    final_status: str
    
    class Config:
        frozen = False  # Allow modifications


class StockOutcome(BaseModel):
    """Market outcome for a stock"""
    ticker: str
    start_price: float
    end_price: float
    change_percent: float
    sentiment: Literal['BULLISH', 'BEARISH', 'NEUTRAL'] | None = None
    news_events: List[str] = Field(default_factory=list)


class PredictionOutcome(BaseModel):
    """Outcome for a prediction market"""
    market_id: str
    question: str
    outcome: Literal['YES', 'NO', 'UNRESOLVED']
    final_probability: float


class MarketOutcomes(BaseModel):
    """All market outcomes for a window"""
    window_id: str
    window_start: datetime
    window_end: datetime
    stocks: dict[str, StockOutcome] = Field(default_factory=dict)
    predictions: dict[str, PredictionOutcome] = Field(default_factory=dict)
    overall_trend: Literal['BULLISH', 'BEARISH', 'NEUTRAL'] | None = None
    volatility: Literal['HIGH', 'MEDIUM', 'LOW'] | None = None


class WindowStatistics(BaseModel):
    """Statistics for a training window"""
    window_id: str
    agent_count: int
    trajectory_count: int
    total_actions: int
    avg_pnl: float
    min_pnl: float
    max_pnl: float
    start_time: datetime
    end_time: datetime


class TrainingBatchSummary(BaseModel):
    """Summary of a training batch"""
    windows: int
    total_trajectories: int
    avg_trajectories_per_window: float
    score_min: float
    score_max: float
    score_avg: float
    pnl_min: float
    pnl_max: float
    pnl_avg: float



