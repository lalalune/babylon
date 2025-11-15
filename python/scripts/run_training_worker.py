"""
Training Worker - Separate Service for Long-Running Training

Runs independently from Vercel (Railway/Render/CoreWeave)
Polls database for pending training batches
Executes training via babylon_trainer.py
Updates database with results

Can be triggered via:
1. HTTP POST /train (from Vercel cron)
2. Background polling loop (checks database every 5 minutes)
3. Manual trigger for testing

Architecture:
- FastAPI web server for HTTP triggers
- Background async loop for polling
- Connects to same PostgreSQL as Vercel
- Calls W&B for training
- No GPU required locally (W&B handles it)
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

# Load environment
project_root = Path(__file__).parent.parent
load_dotenv(project_root / '.env.local', override=True)
load_dotenv(project_root / '.env')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(project_root / 'logs' / 'training_worker.log')
    ]
)
logger = logging.getLogger(__name__)

# Optional: FastAPI for HTTP triggers
try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel
    import uvicorn
    HAS_FASTAPI = True
except ImportError:
    logger.warning("FastAPI not installed - HTTP triggers disabled")
    HAS_FASTAPI = False

# Required: Database and trainer
try:
    import asyncpg
    from training.babylon_trainer import BabylonTrainer
except ImportError as e:
    logger.error(f"Required dependencies missing: {e}")
    sys.exit(1)

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL')
WANDB_API_KEY = os.getenv('WANDB_API_KEY')
WANDB_PROJECT = os.getenv('WANDB_PROJECT', 'babylon-rl')
POLL_INTERVAL = int(os.getenv('POLL_INTERVAL', '300'))  # 5 minutes default
PORT = int(os.getenv('PORT', '8000'))

if not DATABASE_URL:
    logger.error("DATABASE_URL not set!")
    sys.exit(1)

# Initialize trainer
trainer = BabylonTrainer(
    db_url=DATABASE_URL,
    project=WANDB_PROJECT
)

# FastAPI app (if available)
if HAS_FASTAPI:
    app = FastAPI(title="Babylon Training Worker")

    class TrainRequest(BaseModel):
        batchId: str
        source: str = "unknown"

    @app.get("/health")
    async def health():
        """Health check endpoint"""
        try:
            if not trainer.pool:
                await trainer.connect()
            
            # Quick DB check
            async with trainer.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            
            return {
                "status": "healthy",
                "database": "connected",
                "wandb": "configured" if WANDB_API_KEY else "not_configured",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            raise HTTPException(status_code=503, detail=str(e))

    @app.post("/train")
    async def trigger_training(request: TrainRequest):
        """Trigger training for a specific batch"""
        logger.info(f"Received training request: {request.batchId} from {request.source}")
        
        try:
            # Run training async (don't block HTTP response)
            asyncio.create_task(process_batch(request.batchId))
            
            return {
                "status": "started",
                "batchId": request.batchId,
                "message": "Training started in background"
            }
        except Exception as e:
            logger.error(f"Failed to start training: {e}")
            raise HTTPException(status_code=500, detail=str(e))

async def process_batch(batch_id: str) -> None:
    """Process a single training batch"""
    try:
        logger.info(f"Processing batch: {batch_id}")
        
        if not trainer.pool:
            await trainer.connect()
        
        # Get batch details
        async with trainer.pool.acquire() as conn:
            batch = await conn.fetchrow(
                'SELECT * FROM training_batches WHERE "batchId" = $1',
                batch_id
            )
            
            if not batch:
                logger.error(f"Batch not found: {batch_id}")
                return
            
            if batch['status'] != 'pending':
                logger.warning(f"Batch {batch_id} is not pending (status: {batch['status']})")
                return
            
            window_id = batch['scenarioId']
            model_version = batch['modelVersion']
        
        # Run training
        logger.info(f"Training window {window_id} as {model_version}")
        
        result = await trainer.train_window(
            window_id=window_id,
            batch_id=batch_id,
            model_version=model_version
        )
        
        logger.info(f"Training complete for batch {batch_id}", result)
        
    except Exception as e:
        logger.error(f"Batch processing failed: {batch_id}", exc_info=True)
        
        # Update batch status to failed
        if trainer.pool:
            try:
                async with trainer.pool.acquire() as conn:
                    await conn.execute(
                        'UPDATE training_batches SET status = $1, error = $2 WHERE "batchId" = $3',
                        'failed', str(e), batch_id
                    )
            except Exception as update_error:
                logger.error(f"Failed to update batch status: {update_error}")

async def poll_for_batches():
    """Background loop: poll database for pending batches"""
    logger.info(f"Starting poll loop (interval: {POLL_INTERVAL}s)")
    
    if not trainer.pool:
        await trainer.connect()
    
    while True:
        try:
            # Find pending batches
            async with trainer.pool.acquire() as conn:
                batches = await conn.fetch(
                    '''SELECT "batchId", "scenarioId", "modelVersion" 
                       FROM training_batches 
                       WHERE status = 'pending'
                       ORDER BY "createdAt" ASC
                       LIMIT 5'''
                )
            
            if batches:
                logger.info(f"Found {len(batches)} pending batches")
                
                for batch in batches:
                    await process_batch(batch['batchId'])
            
            # Check for newly completed batches to deploy
            async with trainer.pool.acquire() as conn:
                completed = await conn.fetch(
                    '''SELECT b."batchId", b."modelVersion", m."modelId"
                       FROM training_batches b
                       LEFT JOIN trained_models m ON m."trainingBatch" = b.id
                       WHERE b.status = 'completed'
                       AND m.status = 'ready'
                       AND m."deployedAt" IS NULL
                       ORDER BY b."completedAt" DESC
                       LIMIT 1'''
                )
            
            if completed:
                for batch in completed:
                    logger.info(f"Auto-deploying model: {batch['modelId']}")
                    # Mark as deployed
                    async with trainer.pool.acquire() as conn:
                        await conn.execute(
                            'UPDATE trained_models SET status = $1, "deployedAt" = NOW() WHERE "modelId" = $2',
                            'deployed', batch['modelId']
                        )
            
        except Exception as e:
            logger.error(f"Poll loop error: {e}", exc_info=True)
        
        # Wait before next poll
        await asyncio.sleep(POLL_INTERVAL)

async def run_worker():
    """Main worker loop"""
    logger.info("="*70)
    logger.info("🚀 BABYLON TRAINING WORKER STARTING")
    logger.info("="*70)
    logger.info(f"Database: {DATABASE_URL[:50]}...")
    logger.info(f"W&B: {'Configured' if WANDB_API_KEY else 'Not configured (will use local)'}")
    logger.info(f"Project: {WANDB_PROJECT}")
    logger.info(f"Poll Interval: {POLL_INTERVAL}s")
    logger.info("="*70)
    
    # Connect to database
    await trainer.connect()
    logger.info("✅ Database connected")
    
    # Start poll loop
    if HAS_FASTAPI:
        # Run FastAPI + poll loop concurrently
        logger.info(f"Starting FastAPI server on port {PORT}")
        logger.info(f"Starting background poll loop")
        
        # Start poll loop as background task
        poll_task = asyncio.create_task(poll_for_batches())
        
        # Run FastAPI
        config = uvicorn.Config(
            app,
            host="0.0.0.0",
            port=PORT,
            log_level="info"
        )
        server = uvicorn.Server(config)
        
        try:
            await server.serve()
        finally:
            poll_task.cancel()
    else:
        # Just poll loop
        logger.info("Running in poll-only mode (no HTTP triggers)")
        await poll_for_batches()

if __name__ == "__main__":
    try:
        asyncio.run(run_worker())
    except KeyboardInterrupt:
        logger.info("Worker shutdown requested")
        if trainer.pool:
            asyncio.run(trainer.close())
    except Exception as e:
        logger.error(f"Worker failed: {e}", exc_info=True)
        sys.exit(1)

