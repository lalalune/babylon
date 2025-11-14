"""
Babylon → ART Converter
Strong types, no defensive programming, fail fast
"""

import art
from openai.types.chat.chat_completion import Choice
from openai.types.chat import ChatCompletionMessage
import json
import random
from typing import List

from ..models import BabylonTrajectory, MarketOutcomes, TrajectoryStep


class BabylonToARTConverter:
    """Convert Babylon trajectories to ART format - no error hiding"""
    
    def __init__(self, dropout_rate: float = 0.0):
        if not 0.0 <= dropout_rate <= 0.5:
            raise ValueError(f"Dropout rate must be 0.0-0.5, got {dropout_rate}")
        self.dropout_rate = dropout_rate
    
    def convert_trajectory(
        self,
        babylon_traj: BabylonTrajectory,
        market_outcomes: MarketOutcomes | None = None
    ) -> art.Trajectory | None:
        """
        Convert to ART format with market context
        
        Returns None only if dropout applied, raises on errors
        """
        # Random dropout
        if self.dropout_rate > 0 and random.random() < self.dropout_rate:
            return None
        
        messages_and_choices = []
        
        # System message with context
        system_msg = self._build_system_message(babylon_traj, market_outcomes)
        messages_and_choices.append({
            'role': 'system',
            'content': system_msg
        })
        
        # Convert steps to messages
        for step in babylon_traj.steps:
            # Each step: observation (user) + decision (assistant)
            if step.llm_calls:
                # Use actual LLM prompts
                llm_call = step.llm_calls[0]  # Primary LLM call
                
                messages_and_choices.append({
                    'role': 'user',
                    'content': llm_call.user_prompt
                })
                
                messages_and_choices.append(
                    Choice(
                        finish_reason='stop',
                        index=0,
                        message=ChatCompletionMessage(
                            role='assistant',
                            content=llm_call.response
                        )
                    )
                )
        
        if len(messages_and_choices) < 3:  # Need at least system + user + assistant
            raise ValueError(
                f"Trajectory {babylon_traj.trajectory_id} has insufficient messages: {len(messages_and_choices)}"
            )
        
        return art.Trajectory(
            messages_and_choices=messages_and_choices,
            reward=0.0,  # Set by RULER
            metrics={
                'window_id': babylon_traj.window_id,
                'final_pnl': babylon_traj.final_pnl,
                'episode_length': babylon_traj.episode_length,
                'trades_executed': babylon_traj.trades_executed or 0
            },
            metadata={
                'trajectory_id': babylon_traj.trajectory_id,
                'agent_id': babylon_traj.agent_id,
                'window_id': babylon_traj.window_id
            }
        )
    
    def _build_system_message(
        self,
        trajectory: BabylonTrajectory,
        market_outcomes: MarketOutcomes | None
    ) -> str:
        """Build system message with ground truth"""
        
        msg = f"""You are evaluating trading agent decisions.

AGENT: {trajectory.agent_id}
TIME WINDOW: {trajectory.window_id}
"""
        
        if market_outcomes and market_outcomes.stocks:
            msg += "\nMARKET OUTCOMES (ground truth agent didn't know):\n"
            
            for ticker, outcome in market_outcomes.stocks.items():
                msg += f"\n{ticker}:"
                msg += f"\n  Price: ${outcome.start_price:.2f} → ${outcome.end_price:.2f} ({outcome.change_percent:+.1f}%)"
                msg += f"\n  Sentiment: {outcome.sentiment or 'UNKNOWN'}"
                
                if outcome.news_events:
                    msg += f"\n  News: {outcome.news_events[0]}"
        
        msg += "\n\nEvaluate this agent's decisions given the outcomes."
        return msg
    
    def convert_window_group(
        self,
        trajectories: List[BabylonTrajectory],
        market_outcomes: MarketOutcomes | None,
        max_per_group: int = 8
    ) -> art.TrajectoryGroup:
        """
        Convert window trajectories to ART group
        
        Raises on any conversion error - no silent failures
        """
        if len(trajectories) < 2:
            raise ValueError(f"Need at least 2 trajectories for GRPO, got {len(trajectories)}")
        
        # Sample if too many
        if len(trajectories) > max_per_group:
            sampled = random.sample(trajectories, max_per_group)
        else:
            sampled = trajectories
        
        # Convert all (fail on any error)
        art_trajectories = []
        for traj in sampled:
            art_traj = self.convert_trajectory(traj, market_outcomes)
            if art_traj:  # None means dropout
                art_trajectories.append(art_traj)
        
        if len(art_trajectories) < 2:
            raise ValueError(
                f"After dropout, only {len(art_trajectories)} trajectories remain (need 2+)"
            )
        
        return art.TrajectoryGroup(art_trajectories)


def calculate_dropout_rate(
    total_trajectories: int,
    target_trajectories: int = 1000,
    max_dropout: float = 0.3
) -> float:
    """
    Calculate dropout rate - pure function, no side effects
    
    Args:
        total_trajectories: Available trajectories
        target_trajectories: Desired number
        max_dropout: Maximum dropout allowed
    
    Returns:
        Dropout rate (0.0-max_dropout)
    """
    if total_trajectories <= target_trajectories:
        return 0.0
    
    needed = 1.0 - (target_trajectories / total_trajectories)
    return min(max_dropout, needed)



