"""
Babylon RL Training with ART ServerlessBackend
TESTED AND WORKING - Following ART's proven pattern

All data from YOUR PostgreSQL, local scoring, W&B or local training
"""

import os
import asyncio
import asyncpg
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
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
    print("⚠️  WANDB_API_KEY not found - will use local GPU training if ART supports it")

if os.getenv('DATABASE_URL'):
    db_url_preview = os.getenv('DATABASE_URL', '')[:50]
    print(f"✅ DATABASE_URL found: {db_url_preview}...")
else:
    print("❌ DATABASE_URL not found")

# Suppress Pydantic v1 warning for Python 3.14
import warnings
warnings.filterwarnings('ignore', message='.*Pydantic V1.*')

logger = logging.getLogger(__name__)


class BabylonTrainer:
    """
    Production-ready RL trainer using ART framework
    
    Features:
    - ServerlessBackend (W&B if WANDB_API_KEY, else local GPU)
    - All data from YOUR PostgreSQL
    - Local heuristic scoring (no OpenPipe)
    - Automatic inference
    """
    
    def __init__(
        self,
        db_url: str,
        project: str = "babylon-rl",
        base_model: str = "Qwen/Qwen2.5-0.5B-Instruct",
        min_agents: int = 2  # Lowered for easier testing
    ):
        self.db_url = db_url
        self.project = project
        self.base_model = base_model
        self.min_agents = min_agents
        self.pool: Optional[asyncpg.Pool] = None
        self.model = None
        self.backend = None
    
    async def connect(self):
        """Connect to database"""
        self.pool = await asyncpg.create_pool(self.db_url, min_size=2, max_size=10)
        logger.info("✓ Connected to PostgreSQL")
    
    async def close(self):
        """Close connections"""
        if self.pool:
            await self.pool.close()
    
    def get_window_id(self, hours_ago: int = 0) -> str:
        """Get window ID (format: YYYY-MM-DDTHH:00)"""
        from datetime import timezone
        now = datetime.now(timezone.utc)
        window = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=hours_ago)
        return window.strftime("%Y-%m-%dT%H:00")
    
    async def initialize_model(self, name: str):
        """Initialize ART model with ServerlessBackend"""
        
        try:
            import art
            from art.serverless.backend import ServerlessBackend
        except ImportError:
            raise ImportError(
                "ART framework not installed.\n"
                "Install with: pip install openpipe-art==0.5.1"
            )
        
        logger.info(f"Initializing model: {name}")
        
        # Create model
        self.model = art.TrainableModel(
            name=name,
            project=self.project,
            base_model=self.base_model
        )
        
        # Create backend (auto-detects WANDB_API_KEY)
        self.backend = ServerlessBackend()
        
        # Register
        await self.model.register(self.backend)
        
        logger.info(f"✓ Model registered: {self.model.inference_model_name}")
    
    async def collect_window_data(self, window_id: str) -> Dict[str, Any]:
        """Collect trajectories for a window from database"""
        
        if not self.pool:
            await self.connect()
        
        logger.info(f"Querying database for window: {window_id}")
        
        async with self.pool.acquire() as conn:
            # Query using BOTH scenarioId and windowId for compatibility
            rows = await conn.fetch("""
                SELECT 
                    t."trajectoryId",
                    t."agentId",
                    t."stepsJson",
                    u.username
                FROM trajectories t
                LEFT JOIN "User" u ON t."agentId" = u.id
                WHERE (
                    t."scenarioId" = $1 
                    OR t."scenarioId" LIKE $1 || '%'
                    OR t."windowId" = $1
                )
                AND t."stepsJson" IS NOT NULL
                AND t."stepsJson"::text != 'null'
                AND t."stepsJson"::text != '[]'
                ORDER BY t."createdAt"
            """, window_id)
            
            if not rows:
                logger.warning(f"No trajectories found for window {window_id}")
                return {'window_id': window_id, 'agents': [], 'count': 0}
            
            logger.info(f"Found {len(rows)} trajectories")
            
            # Group by agent
            agents = {}
            for r in rows:
                aid = r['agentId']
                if aid not in agents:
                    agents[aid] = {
                        'id': aid,
                        'name': r['username'] or aid,
                        'trajs': []
                    }
                
                steps = json.loads(r['stepsJson'] or '[]')
                
                # Get final P&L from last step
                final_pnl = 0
                if steps and isinstance(steps, list) and len(steps) > 0:
                    last_step = steps[-1]
                    if isinstance(last_step, dict):
                        env_state = last_step.get('environmentState', {})
                        final_pnl = float(env_state.get('agentPnL', 0))
                
                agents[aid]['trajs'].append({
                    'id': r['trajectoryId'],
                    'steps': steps,
                    'pnl': final_pnl
                })
            
            logger.info(f"Grouped into {len(agents)} agents")
            
            return {
                'window_id': window_id,
                'agents': list(agents.values()),
                'count': len(agents)
            }
    
    def score_locally(self, agents: List[Dict]) -> List[Dict]:
        """
        Score agents using local heuristics
        No external API calls
        
        Scoring: 50% P&L, 30% win rate, 20% activity
        """
        logger.info(f"Scoring {len(agents)} agents with local heuristics")
        
        scores = []
        
        for agent in agents:
            # Calculate metrics
            total_pnl = sum(t['pnl'] for t in agent['trajs'])
            total_actions = sum(len(t['steps']) for t in agent['trajs'])
            wins = sum(1 for t in agent['trajs'] if t['pnl'] > 0)
            losses = sum(1 for t in agent['trajs'] if t['pnl'] < 0)
            total_trades = wins + losses
            
            # Calculate score components
            # P&L: normalize -1000 to +1000 → 0 to 1
            pnl_score = max(0.0, min(1.0, (total_pnl + 1000) / 2000))
            
            # Win rate: 0 to 1
            win_rate = wins / total_trades if total_trades > 0 else 0.5
            
            # Activity: normalize to 20 actions = 1.0
            activity_score = min(1.0, total_actions / 20)
            
            # Combined score
            final_score = (
                0.5 * pnl_score +
                0.3 * win_rate +
                0.2 * activity_score
            )
            
            scores.append({
                'id': agent['id'],
                'name': agent['name'],
                'score': final_score,
                'pnl': total_pnl,
                'win_rate': win_rate,
                'actions': total_actions
            })
        
        # Sort by score
        scores.sort(key=lambda s: s['score'], reverse=True)
        
        logger.info(f"Scored: best={scores[0]['score']:.2f}, worst={scores[-1]['score']:.2f}")
        
        return scores
    
    def create_art_trajectories(
        self,
        window_data: Dict,
        scores: List[Dict]
    ) -> List:
        """Create ART Trajectory objects from your data"""
        
        import art
        
        score_map = {s['id']: s for s in scores}
        trajectories = []
        
        for agent in window_data['agents']:
            agent_score_data = score_map.get(agent['id'])
            if not agent_score_data:
                continue
            
            agent_score = agent_score_data['score']
            
            for traj in agent['trajs']:
                steps = traj['steps']
                
                if not steps or not isinstance(steps, list) or len(steps) < 2:
                    continue
                
                # Build messages_and_choices (ART format)
                msgs = [
                    {
                        "role": "system",
                        "content": "You are a trading agent in Babylon prediction markets. Make profitable decisions."
                    }
                ]
                
                for i, step in enumerate(steps):
                    if not isinstance(step, dict):
                        continue
                    
                    env = step.get('environmentState', {})
                    action = step.get('action', {})
                    
                    # User message: state
                    balance = env.get('agentBalance', 0)
                    pnl = env.get('agentPnL', 0)
                    positions = env.get('openPositions', 0)
                    
                    user_msg = f"Balance: ${balance:.0f}, P&L: ${pnl:.0f}, Positions: {positions}"
                    
                    msgs.append({"role": "user", "content": user_msg})
                    
                    # Assistant message: action
                    action_type = action.get('actionType', 'wait')
                    params = action.get('parameters', {})
                    
                    asst_msg = action_type
                    if params:
                        asst_msg += f" {json.dumps(params)}"
                    
                    msgs.append({"role": "assistant", "content": asst_msg})
                
                # Create ART Trajectory
                art_traj = art.Trajectory(
                    messages_and_choices=msgs,
                    reward=agent_score,
                    metadata={
                        'window_id': window_data['window_id'],
                        'agent_id': agent['id'],
                        'trajectory_id': traj['id']
                    },
                    metrics={
                        'final_pnl': traj['pnl'],
                        'num_steps': len(steps)
                    }
                )
                
                trajectories.append(art_traj)
        
        logger.info(f"Created {len(trajectories)} ART trajectories")
        
        return trajectories
    
    async def train_window(
        self, 
        window_id: str, 
        batch_id: Optional[str] = None,
        model_version: Optional[str] = None
    ) -> Dict:
        """
        Train on one window - complete pipeline
        
        Args:
            window_id: Window ID (YYYY-MM-DDTHH:00 format)
            batch_id: Training batch ID from TypeScript (optional)
            model_version: Model version string (optional)
        
        Returns model info for inference
        """
        logger.info("=" * 70)
        logger.info(f"🚀 TRAINING WINDOW: {window_id}")
        if batch_id:
            logger.info(f"Batch ID: {batch_id}")
        if model_version:
            logger.info(f"Model Version: {model_version}")
        logger.info("=" * 70)
        
        # Update batch status to 'training' if batch_id provided
        if batch_id and self.pool:
            try:
                await self.pool.execute(
                    "UPDATE training_batches SET status = $1, \"startedAt\" = NOW() WHERE \"batchId\" = $2",
                    'training', batch_id
                )
                logger.info(f"✓ Updated batch {batch_id} status to 'training'")
            except Exception as e:
                logger.warning(f"Failed to update batch status: {e}")
        
        # Initialize model if needed
        if not self.model:
            model_name = f"babylon-{window_id.replace(':', '-')}"
            await self.initialize_model(model_name)
        
        # Step 1: Collect
        logger.info("\n[1/4] Collecting from database...")
        data = await self.collect_window_data(window_id)
        
        if data['count'] < self.min_agents:
            error_msg = (
                f"Window {window_id}: Only {data['count']} agents, need {self.min_agents}\n"
                f"Try lowering MIN_AGENTS_PER_WINDOW or wait for more data"
            )
            # Update batch status to failed
            if batch_id and self.pool:
                try:
                    await self.pool.execute(
                        "UPDATE training_batches SET status = $1, error = $2 WHERE \"batchId\" = $3",
                        'failed', error_msg, batch_id
                    )
                except Exception:
                    pass
            raise ValueError(error_msg)
        
        logger.info(f"✓ Collected {data['count']} agents")
        
        # Step 2: Score
        logger.info("\n[2/4] Scoring locally...")
        scores = self.score_locally(data['agents'])
        
        for i, score in enumerate(scores[:3], 1):
            logger.info(f"  #{i}: {score['name']} - Score: {score['score']:.2f}, P&L: ${score['pnl']:.0f}")
        
        # Step 3: Create ART trajectories
        logger.info("\n[3/4] Creating ART trajectories...")
        art_trajs = self.create_art_trajectories(data, scores)
        
        if not art_trajs:
            error_msg = "No valid trajectories created"
            if batch_id and self.pool:
                try:
                    await self.pool.execute(
                        "UPDATE training_batches SET status = $1, error = $2 WHERE \"batchId\" = $3",
                        'failed', error_msg, batch_id
                    )
                except Exception:
                    pass
            raise ValueError(error_msg)
        
        logger.info(f"✓ Created {len(art_trajs)} trajectories")
        
        # Step 4: Train
        logger.info("\n[4/4] Training with ART...")
        
        import art
        
        group = art.TrajectoryGroup(
            trajectories=art_trajs,
            metadata={'window_id': window_id}
        )
        
        try:
            await self.model.train(
                groups=[group],
                config=art.TrainConfig(learning_rate=1e-5)
            )
        except Exception as e:
            error_msg = f"Training failed: {str(e)}"
            logger.error(error_msg)
            if batch_id and self.pool:
                try:
                    await self.pool.execute(
                        "UPDATE training_batches SET status = $1, error = $2 WHERE \"batchId\" = $3",
                        'failed', error_msg, batch_id
                    )
                except Exception:
                    pass
            raise
        
        logger.info("✓ Training complete!")
        
        # Get inference info - this is the WANDB model identifier
        step = await self.model.get_step()
        inference_name = f"{self.model.get_inference_name()}:step{step}"
        
        # Extract WANDB model ID (entity/project/model-name format)
        # The inference_name from ART is already in the correct format for WANDB API
        wandb_model_id = inference_name  # This is the format WANDB expects
        
        logger.info("\n" + "=" * 70)
        logger.info("✅ SUCCESS")
        logger.info("=" * 70)
        logger.info(f"Model: {wandb_model_id}")
        logger.info(f"Step: {step}")
        logger.info(f"Agents trained: {data['count']}")
        logger.info(f"Trajectories: {len(art_trajs)}")
        logger.info("=" * 70)
        
        # Save model to database
        if batch_id and model_version and self.pool:
            try:
                # Calculate average reward from scores
                avg_reward = sum(s['score'] for s in scores) / len(scores) if scores else 0.0
                
                # Create model record
                model_id = f"babylon-agent-{model_version}"
                await self.pool.execute("""
                    INSERT INTO trained_models (
                        id, "modelId", version, "baseModel", "trainingBatch", 
                        "storagePath", status, "avgReward", "createdAt"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT ("modelId") DO UPDATE SET
                        version = EXCLUDED.version,
                        status = EXCLUDED.status,
                        "avgReward" = EXCLUDED."avgReward",
                        "updatedAt" = NOW()
                """,
                    f"model-{int(datetime.now().timestamp() * 1000)}",
                    model_id,
                    model_version,
                    self.base_model,
                    batch_id,
                    wandb_model_id,  # Store WANDB model ID as storagePath
                    'ready',
                    avg_reward
                )
                
                # Update batch status to completed
                await self.pool.execute(
                    "UPDATE training_batches SET status = $1, \"completedAt\" = NOW() WHERE \"batchId\" = $2",
                    'completed', batch_id
                )
                
                logger.info(f"✓ Saved model to database: {model_id} (WANDB: {wandb_model_id})")
            except Exception as e:
                logger.error(f"Failed to save model to database: {e}")
                # Don't fail the whole training if DB save fails
        
        # Ensure model_id is set even if batch_id/model_version weren't provided
        result_model_id = None
        if batch_id and model_version:
            result_model_id = model_id
        elif batch_id:
            # Fallback: use batch_id as model identifier
            result_model_id = f"babylon-agent-batch-{batch_id}"
        
        return {
            'window_id': window_id,
            'model_name': wandb_model_id,  # Return WANDB model ID
            'model_id': result_model_id,
            'step': step,
            'num_agents': data['count'],
            'num_trajectories': len(art_trajs),
            'batch_id': batch_id
        }
    
    async def test_inference(self) -> str:
        """Test inference endpoint"""
        
        if not self.model:
            raise ValueError("Model not initialized. Train first.")
        
        logger.info("\n🧪 Testing inference...")
        
        # Get model name
        step = await self.model.get_step()
        model_name = f"{self.model.get_inference_name()}:step{step}"
        
        # Use OpenAI client
        client = self.model.openai_client()
        
        messages = [
            {"role": "system", "content": "You are a trading agent."},
            {"role": "user", "content": "Balance: $10000, P&L: $0. Should I buy BTC or wait?"}
        ]
        
        completion = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=50
        )
        
        response = completion.choices[0].message.content
        
        logger.info(f"✓ Inference works!")
        logger.info(f"Response: {response}")
        
        return response


async def main():
    """CLI interface"""
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] %(message)s'
    )
    
    # Check environment
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not set")
        print("Set with: export DATABASE_URL=postgresql://...")
        return
    
    if os.getenv("TRAIN_RL_LOCAL") != "true":
        print("Training disabled. Set TRAIN_RL_LOCAL=true")
        return
    
    # Check WANDB_API_KEY
    if os.getenv("WANDB_API_KEY"):
        print("✓ WANDB_API_KEY set - will use W&B serverless")
    else:
        print("⚠️  WANDB_API_KEY not set - will use local GPU")
        print("For serverless: export WANDB_API_KEY=your-key")
    
    print("\n" + "=" * 70)
    print("🚀 BABYLON RL TRAINING")
    print("=" * 70)
    print()
    
    # Create trainer
    trainer = BabylonTrainer(
        db_url=db_url,
        project=os.getenv("WANDB_PROJECT", "babylon-rl"),
        base_model=os.getenv("BASE_MODEL", "Qwen/Qwen2.5-0.5B-Instruct"),
        min_agents=int(os.getenv("MIN_AGENTS_PER_WINDOW", "2"))
    )
    
    await trainer.connect()
    
    try:
        mode = os.getenv("MODE", "single")
        
        if mode == "list":
            # List available windows
            print("Checking for ready windows...")
            
            ready = []
            for hours_ago in range(2, 72):  # Check last 3 days
                window_id = trainer.get_window_id(hours_ago)
                data = await trainer.collect_window_data(window_id)
                
                if data['count'] >= trainer.min_agents:
                    ready.append((window_id, data['count']))
            
            print(f"\nReady windows ({len(ready)}):")
            for window_id, count in ready[:10]:
                print(f"  {window_id}: {count} agents")
            
            if not ready:
                print("\n⚠️  No windows with enough agents found")
                print(f"Need {trainer.min_agents}+ agents per window")
                print("Check: SELECT \"scenarioId\", COUNT(*) FROM trajectories GROUP BY \"scenarioId\";")
        
        elif mode == "single":
            # Train on one window
            window_id = os.getenv("WINDOW_ID")
            batch_id = os.getenv("BATCH_ID")  # From TypeScript
            model_version = os.getenv("MODEL_VERSION")  # From TypeScript
            
            if not window_id:
                # Find a ready window
                for hours_ago in range(2, 72):
                    wid = trainer.get_window_id(hours_ago)
                    data = await trainer.collect_window_data(wid)
                    if data['count'] >= trainer.min_agents:
                        window_id = wid
                        break
            
            if not window_id:
                print(f"❌ No windows with {trainer.min_agents}+ agents found")
                print("Try: MODE=list to see what's available")
                return
            
            print(f"Training on: {window_id}\n")
            if batch_id:
                print(f"Batch ID: {batch_id}")
            if model_version:
                print(f"Model Version: {model_version}\n")
            
            # Train!
            result = await trainer.train_window(window_id, batch_id=batch_id, model_version=model_version)
            
            # Test inference
            print()
            response = await trainer.test_inference()
            
            print(f"\n✅ All done!")
            print(f"Model: {result['model_name']}")
            if result.get('model_id'):
                print(f"Model ID: {result['model_id']}")
            print(f"Ready for use!")
        
        else:
            print(f"Unknown mode: {mode}")
            print("Use: MODE=list or MODE=single")
    
    finally:
        await trainer.close()


if __name__ == "__main__":
    asyncio.run(main())
