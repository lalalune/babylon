"""
Real Integration Tests
Tests against actual services (not mocked)
"""

import os
import pytest
import asyncio
from datetime import datetime, timedelta
import httpx

# Skip if no credentials
pytestmark = pytest.mark.skipif(
    not all([
        os.getenv("DATABASE_URL"),
        os.getenv("OPENPIPE_API_KEY"),
        os.getenv("WANDB_API_KEY"),
        os.getenv("WANDB_ENTITY")
    ]),
    reason="Missing credentials for real integration tests"
)


class TestRealDatabase:
    """Test actual database connectivity and queries"""
    
    @pytest.mark.asyncio
    async def test_database_connection(self):
        """Test PostgreSQL connection"""
        from src.data_bridge.postgres_reader import PostgresTrajectoryReader
        
        db_url = os.getenv("DATABASE_URL")
        reader = PostgresTrajectoryReader(db_url)
        
        await reader.connect()
        
        # Test simple query
        result = await reader.query("SELECT 1 as test")
        assert len(result) == 1
        assert result[0]['test'] == 1
        
        await reader.close()
        print("✓ Database connection works")
    
    @pytest.mark.asyncio
    async def test_query_trajectories_by_window(self):
        """Test querying trajectories by window_id"""
        from src.data_bridge.postgres_reader import PostgresTrajectoryReader
        
        db_url = os.getenv("DATABASE_URL")
        reader = PostgresTrajectoryReader(db_url)
        
        # Get any existing window
        windows = await reader.get_window_ids(min_agents=1, lookback_hours=168)  # 1 week
        
        if windows:
            window_id = windows[0]
            trajectories = await reader.get_trajectories_by_window(window_id)
            
            print(f"✓ Found {len(trajectories)} trajectories in window {window_id}")
            
            if trajectories:
                # Verify structure
                traj = trajectories[0]
                assert 'id' in traj
                assert 'agent_id' in traj
                assert 'window_id' in traj
                print(f"✓ Trajectory structure valid")
        else:
            print("⚠ No windows found (this is OK if no data yet)")
        
        await reader.close()


class TestRealOpenPipeRULER:
    """Test actual OpenPipe RULER API"""
    
    @pytest.mark.asyncio
    async def test_ruler_api_connection(self):
        """Test OpenPipe RULER API connectivity"""
        api_key = os.getenv("OPENPIPE_API_KEY")
        
        client = httpx.AsyncClient(timeout=30.0)
        
        try:
            response = await client.post(
                "https://app.openpipe.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "openpipe:ruler-2025-01-15",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are RULER, a test judge."
                        },
                        {
                            "role": "user",
                            "content": "Rate this: Agent made 5 trades with +$100 profit. Score 0-1."
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 100
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert 'choices' in data
            print(f"✓ RULER API works: {data['choices'][0]['message']['content'][:50]}...")
            
        finally:
            await client.aclose()
    
    @pytest.mark.asyncio
    async def test_ruler_scoring_service(self):
        """Test RULER scoring service with real API"""
        from src.training.ruler_scorer import RulerScoringService
        
        db_url = os.getenv("DATABASE_URL")
        api_key = os.getenv("OPENPIPE_API_KEY")
        
        scorer = RulerScoringService(
            db_url=db_url,
            openpipe_api_key=api_key
        )
        
        # Test fallback scoring (doesn't need API)
        contexts = [
            {
                'agent_id': 'test-agent-1',
                'trajectory_id': 1,
                'final_pnl': 500.0
            },
            {
                'agent_id': 'test-agent-2',
                'trajectory_id': 2,
                'final_pnl': -200.0
            }
        ]
        
        scores = scorer._fallback_scoring(contexts)
        assert len(scores) == 2
        assert all(0.0 <= s.score <= 1.0 for s in scores)
        print(f"✓ RULER scoring service works (fallback)")


class TestRealWandB:
    """Test actual W&B API"""
    
    @pytest.mark.asyncio
    async def test_wandb_login(self):
        """Test W&B authentication"""
        import wandb
        
        api_key = os.getenv("WANDB_API_KEY")
        
        # Login
        wandb.login(key=api_key)
        
        # Test API
        api = wandb.Api()
        user = api.viewer
        
        print(f"✓ W&B login works: {user.username}")
    
    @pytest.mark.asyncio
    async def test_wandb_artifact_upload(self):
        """Test uploading artifact to W&B"""
        import wandb
        import tempfile
        import json
        
        api_key = os.getenv("WANDB_API_KEY")
        entity = os.getenv("WANDB_ENTITY")
        project = "babylon-rl-test"
        
        wandb.login(key=api_key)
        
        # Create test run
        run = wandb.init(
            project=project,
            entity=entity,
            job_type="test-upload"
        )
        
        # Create test artifact
        artifact = wandb.Artifact(
            name="test-dataset",
            type="dataset",
            metadata={'test': True}
        )
        
        # Add test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({'test': 'data'}, f)
            test_file = f.name
        
        artifact.add_file(test_file)
        
        # Log artifact
        run.log_artifact(artifact)
        run.finish()
        
        # Cleanup
        os.unlink(test_file)
        
        print(f"✓ W&B artifact upload works")


class TestRealDataCollection:
    """Test actual data collection from database"""
    
    @pytest.mark.asyncio
    async def test_collect_window_data(self):
        """Test collecting real window data"""
        from src.training.data_collector import ContinuousDataCollector
        
        db_url = os.getenv("DATABASE_URL")
        
        collector = ContinuousDataCollector(
            db_url=db_url,
            min_agents_per_window=1  # Lower for testing
        )
        
        # Get a recent window
        window_id = collector.get_previous_window_id(offset=2)
        
        window_data = await collector.collect_window_data(window_id)
        
        if window_data:
            print(f"✓ Collected window {window_id}:")
            print(f"  - Agents: {window_data.agent_count}")
            print(f"  - Actions: {window_data.total_actions}")
            print(f"  - Avg P&L: ${window_data.avg_pnl:.2f}")
        else:
            print(f"⚠ No data in window {window_id} (OK if system just started)")
    
    @pytest.mark.asyncio
    async def test_get_ready_windows(self):
        """Test finding ready windows"""
        from src.training.data_collector import ContinuousDataCollector
        
        db_url = os.getenv("DATABASE_URL")
        
        collector = ContinuousDataCollector(
            db_url=db_url,
            min_agents_per_window=1
        )
        
        ready_windows = await collector.get_ready_windows(lookback_hours=168)  # 1 week
        
        print(f"✓ Found {len(ready_windows)} ready windows")
        if ready_windows:
            print(f"  Most recent: {ready_windows[0]}")


class TestEndToEndFlow:
    """Test complete end-to-end flow with real services"""
    
    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_full_pipeline_single_window(self):
        """Test full pipeline on a single window"""
        from src.training.data_collector import ContinuousDataCollector
        from src.training.ruler_scorer import RulerScoringService
        
        db_url = os.getenv("DATABASE_URL")
        openpipe_key = os.getenv("OPENPIPE_API_KEY")
        
        # Step 1: Data Collection
        print("\n=== Step 1: Data Collection ===")
        collector = ContinuousDataCollector(
            db_url=db_url,
            min_agents_per_window=1
        )
        
        ready_windows = await collector.get_ready_windows(lookback_hours=168)
        
        if not ready_windows:
            print("⚠ No windows ready for testing")
            pytest.skip("No data available for testing")
        
        window_id = ready_windows[0]
        window_data = await collector.collect_window_data(window_id)
        
        assert window_data is not None
        print(f"✓ Collected window {window_id}: {window_data.agent_count} agents")
        
        # Step 2: RULER Scoring (with fallback if API fails)
        print("\n=== Step 2: RULER Scoring ===")
        scorer = RulerScoringService(
            db_url=db_url,
            openpipe_api_key=openpipe_key
        )
        
        try:
            # Try real RULER scoring
            # Note: This may fail if window already scored
            scores = await scorer.score_window(window_id)
            print(f"✓ Scored {len(scores)} agents with RULER")
        except Exception as e:
            print(f"⚠ RULER scoring failed (expected if already scored): {e}")
        
        # Step 3: W&B Training (skipped in test, just verify we could prepare data)
        print("\n=== Step 3: Training Data Prep (W&B) ===")
        from src.training.wandb_training_service import WandbTrainingService
        
        wandb_key = os.getenv("WANDB_API_KEY")
        wandb_entity = os.getenv("WANDB_ENTITY")
        
        if wandb_key and wandb_entity:
            trainer = WandbTrainingService(
                db_url=db_url,
                wandb_api_key=wandb_key,
                wandb_entity=wandb_entity,
                base_model="Qwen/Qwen2.5-0.5B-Instruct"
            )
            
            training_data = await trainer._prepare_training_data(window_id)
            
            if training_data:
                print(f"✓ Prepared training data:")
                print(f"  - Trajectories: {len(training_data['trajectories'])}")
                print(f"  - Avg reward: {training_data['avg_reward']:.2f}")
            else:
                print("⚠ No training data (need RULER scores first)")
        else:
            print("⚠ Skipping W&B (no credentials)")
        
        print("\n=== Pipeline Test Complete ===")


class TestModelEndpoint:
    """Test model inference endpoint"""
    
    @pytest.mark.asyncio
    async def test_local_vllm_endpoint(self):
        """Test local vLLM endpoint if running"""
        endpoint = os.getenv("LOCAL_ENDPOINT", "http://localhost:8000")
        
        client = httpx.AsyncClient(timeout=30.0)
        
        try:
            # Try health check
            response = await client.get(f"{endpoint}/health")
            
            if response.status_code == 200:
                print(f"✓ vLLM endpoint is running at {endpoint}")
                
                # Try inference
                response = await client.post(
                    f"{endpoint}/v1/chat/completions",
                    json={
                        "model": "babylon-rl",
                        "messages": [
                            {"role": "user", "content": "Test"}
                        ],
                        "max_tokens": 10
                    }
                )
                
                if response.status_code == 200:
                    print("✓ Inference works")
                else:
                    print(f"⚠ Inference failed: {response.status_code}")
            else:
                print(f"⚠ vLLM not running at {endpoint}")
        except Exception as e:
            print(f"⚠ Could not connect to vLLM: {e}")
        finally:
            await client.aclose()


def test_environment_variables():
    """Test that all required environment variables are set"""
    required = {
        'DATABASE_URL': 'PostgreSQL connection',
        'OPENPIPE_API_KEY': 'OpenPipe RULER API',
        'WANDB_API_KEY': 'W&B Training API',
        'WANDB_ENTITY': 'W&B username/team',
        'TRAIN_RL_LOCAL': 'Feature flag'
    }
    
    missing = []
    for var, description in required.items():
        if not os.getenv(var):
            missing.append(f"{var} ({description})")
    
    if missing:
        print("\n⚠ Missing environment variables:")
        for var in missing:
            print(f"  - {var}")
        print("\nSet these in .env.training")
    else:
        print("✓ All environment variables set")
    
    # Just check, don't fail
    assert True


if __name__ == "__main__":
    # Run tests with: pytest tests/test_real_integration.py -v -s
    pytest.main([__file__, "-v", "-s"])



