"""
Babylon RL Training System
"""

__version__ = "1.0.0"

# Import and re-export main components
from .models import (
    BabylonTrajectory,
    MarketOutcomes,
    WindowStatistics,
    TrainingBatchSummary
)

from .data_bridge import (
    PostgresTrajectoryReader,
    BabylonToARTConverter,
    calculate_dropout_rate
)

from .training import (
    ContinuousMMOTrainer,
    TRADING_RUBRIC
)

__all__ = [
    # Models
    "BabylonTrajectory",
    "MarketOutcomes",
    "WindowStatistics",
    "TrainingBatchSummary",
    
    # Data Bridge
    "PostgresTrajectoryReader",
    "BabylonToARTConverter",
    "calculate_dropout_rate",
    
    # Training
    "ContinuousMMOTrainer",
    "TRADING_RUBRIC"
]
