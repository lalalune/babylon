#!/usr/bin/env python3
"""
RL Training Script - Execute training pipeline

Usage:
    python scripts/train.py --min-agents 5 --iterations 10
"""

import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dotenv import load_dotenv
import logging
import art
from art.serverless.backend import ServerlessBackend

from training.trainer import ContinuousMMOTrainer
from data_bridge.converter import calculate_dropout_rate

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


async def train(
    min_agents: int,
    iterations: int,
    windows_per_iteration: int,
    lookback_hours: int,
    min_actions: int,
    learning_rate: float,
    target_trajectories: int,
    max_dropout: float
):
    """Main training function"""
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL')
    wandb_api_key = os.getenv('WANDB_API_KEY')
    judge_model = os.getenv('JUDGE_MODEL', 'openai/gpt-4o-mini')
    base_model = os.getenv('BASE_MODEL', 'Qwen/Qwen2.5-7B-Instruct')
    project = os.getenv('PROJECT_NAME', 'babylon-agents')
    model_name = os.getenv('MODEL_NAME', 'babylon-mmo')
    
    if not db_url:
        raise ValueError("DATABASE_URL required")
    if not wandb_api_key:
        raise ValueError("WANDB_API_KEY required")
    
    logger.info("=" * 80)
    logger.info("BABYLON RL TRAINING")
    logger.info("=" * 80)
    logger.info(f"Model: {project}/{model_name}")
    logger.info(f"Base: {base_model}")
    logger.info("=" * 80)
    
    model = art.TrainableModel(name=model_name, project=project, base_model=base_model)
    backend = ServerlessBackend(api_key=wandb_api_key)
    
    await model.register(backend)
    current_step = await model.get_step()
    logger.info(f"Starting from step {current_step}")
    
    async with ContinuousMMOTrainer(
        db_url=db_url,
        judge_model=judge_model,
        dropout_rate=0.0,
        max_per_window=8
    ) as trainer:
        
        for iteration in range(iterations):
            logger.info(f"\nITERATION {iteration + 1}/{iterations}")
            
            # Dynamic dropout
            available = await trainer.get_training_windows(min_agents, lookback_hours, None)
            dropout_rate = calculate_dropout_rate(len(available) * min_agents, target_trajectories, max_dropout)
            
            if dropout_rate > 0:
                logger.info(f"Applying dropout: {dropout_rate:.1%}")
                trainer.converter.dropout_rate = dropout_rate
            
            # Prepare batch
            groups = await trainer.prepare_training_batch(
                min_agents, lookback_hours, windows_per_iteration, min_actions
            )
            
            summary = trainer.get_training_summary(groups)
            logger.info(f"Training on {summary.windows} windows, {summary.total_trajectories} trajectories")
            
            # Train
            await model.train(groups, config=art.TrainConfig(learning_rate=learning_rate))
            
            new_step = await model.get_step()
            logger.info(f"✅ Iteration {iteration + 1} complete! Step: {new_step}\n")
    
    logger.info("TRAINING COMPLETE")
    logger.info(f"Final step: {await model.get_step()}")
    
    await backend.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-agents", type=int, default=5)
    parser.add_argument("--iterations", type=int, default=10)
    parser.add_argument("--windows-per-iteration", type=int, default=20)
    parser.add_argument("--lookback-hours", type=int, default=168)
    parser.add_argument("--min-actions", type=int, default=5)
    parser.add_argument("--learning-rate", type=float, default=5e-6)
    parser.add_argument("--target-trajectories", type=int, default=1000)
    parser.add_argument("--max-dropout", type=float, default=0.3)
    
    args = parser.parse_args()
    
    asyncio.run(train(**vars(args)))

