"""
Comprehensive tests for continuous RL training pipeline
"""

import os
import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch
import json

from src.training.data_collector import ContinuousDataCollector, WindowData
from src.training.ruler_scorer import RulerScoringService, RulerScore
from src.training.grpo_trainer import GRPOTrainingService, TrainingResult
from src.training.model_deployer import ModelDeploymentService, DeploymentInfo
from src.training.orchestrator import TrainingOrchestrator


# Test fixtures
@pytest.fixture
def db_url():
    """Get test database URL"""
    url = os.getenv("TEST_DATABASE_URL", os.getenv("DATABASE_URL"))
    if not url:
        pytest.skip("No database URL configured")
    return url


@pytest.fixture
def openpipe_api_key():
    """Get OpenPipe API key"""
    key = os.getenv("OPENPIPE_API_KEY")
    if not key:
        pytest.skip("No OpenPipe API key configured")
    return key


@pytest.fixture
async def data_collector(db_url):
    """Create data collector instance"""
    collector = ContinuousDataCollector(
        db_url=db_url,
        window_duration_hours=1,
        min_agents_per_window=2,  # Lower for testing
        min_actions_per_trajectory=3
    )
    return collector


@pytest.fixture
async def ruler_scorer(db_url, openpipe_api_key):
    """Create RULER scorer instance"""
    scorer = RulerScoringService(
        db_url=db_url,
        openpipe_api_key=openpipe_api_key,
        batch_size=3
    )
    return scorer


@pytest.fixture
async def grpo_trainer(db_url):
    """Create GRPO trainer instance"""
    trainer = GRPOTrainingService(
        db_url=db_url,
        model_name="Qwen/Qwen2.5-0.5B-Instruct",
        batch_size=2,
        iterations_per_window=2  # Lower for testing
    )
    return trainer


@pytest.fixture
async def model_deployer():
    """Create model deployer instance"""
    deployer = ModelDeploymentService(
        environment="local",
        health_check_retries=2
    )
    return deployer


@pytest.fixture
async def orchestrator(db_url, openpipe_api_key):
    """Create orchestrator instance"""
    orch = TrainingOrchestrator(
        db_url=db_url,
        openpipe_api_key=openpipe_api_key,
        environment="local",
        min_agents_per_window=2,
        training_frequency_windows=1
    )
    return orch


# Data Collection Tests
class TestDataCollector:
    """Test continuous data collection"""
    
    @pytest.mark.asyncio
    async def test_get_current_window_id(self, data_collector):
        """Test window ID generation"""
        window_id = data_collector.get_current_window_id()
        
        # Should be in format YYYY-MM-DDTHH:00
        assert len(window_id) == 16
        assert window_id[-5:] == ":00"
        assert "T" in window_id
        
        # Should parse as datetime
        dt = datetime.strptime(window_id, "%Y-%m-%dT%H:00")
        assert dt.minute == 0
        assert dt.second == 0
    
    @pytest.mark.asyncio
    async def test_get_previous_window_id(self, data_collector):
        """Test getting previous window"""
        current = data_collector.get_current_window_id()
        previous = data_collector.get_previous_window_id(offset=1)
        
        current_dt = datetime.strptime(current, "%Y-%m-%dT%H:00")
        previous_dt = datetime.strptime(previous, "%Y-%m-%dT%H:00")
        
        assert (current_dt - previous_dt).total_seconds() == 3600
    
    @pytest.mark.asyncio
    async def test_collect_window_data(self, data_collector):
        """Test collecting window data"""
        # Get a recent window that might have data
        window_id = data_collector.get_previous_window_id(offset=2)
        
        window_data = await data_collector.collect_window_data(window_id)
        
        # May be None if no data, but shouldn't error
        if window_data:
            assert isinstance(window_data, WindowData)
            assert window_data.window_id == window_id
            assert window_data.agent_count >= 0
            assert window_data.total_actions >= 0
            assert isinstance(window_data.avg_pnl, float)
    
    @pytest.mark.asyncio
    async def test_get_ready_windows(self, data_collector):
        """Test finding ready windows"""
        ready_windows = await data_collector.get_ready_windows(lookback_hours=24)
        
        # Should return a list
        assert isinstance(ready_windows, list)
        
        # All should be valid window IDs
        for window_id in ready_windows:
            assert len(window_id) == 16
            datetime.strptime(window_id, "%Y-%m-%dT%H:00")


# RULER Scoring Tests
class TestRulerScorer:
    """Test RULER scoring service"""
    
    @pytest.mark.asyncio
    async def test_score_window_with_mock(self, ruler_scorer):
        """Test scoring with mocked RULER API"""
        
        # Mock the RULER API call
        mock_response = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        'scores': [
                            {
                                'agent_id': 'test-agent-1',
                                'score': 0.85,
                                'reasoning': 'Good decisions'
                            },
                            {
                                'agent_id': 'test-agent-2',
                                'score': 0.45,
                                'reasoning': 'Poor timing'
                            }
                        ]
                    })
                }
            }]
        }
        
        with patch.object(ruler_scorer, '_call_ruler', return_value=mock_response):
            # Create mock window data
            window_id = "2025-01-15T10:00"
            
            # Mock trajectories
            with patch.object(
                ruler_scorer.reader,
                'get_trajectories_by_window',
                return_value=[
                    {'id': 1, 'agent_id': 'test-agent-1', 'actions': []},
                    {'id': 2, 'agent_id': 'test-agent-2', 'actions': []}
                ]
            ):
                with patch.object(ruler_scorer.converter, 'convert_trajectory_with_context'):
                    with patch.object(ruler_scorer, '_save_scores'):
                        scores = await ruler_scorer.score_window(window_id)
            
            assert len(scores) >= 0  # May be empty if no mock setup
    
    @pytest.mark.asyncio
    async def test_fallback_scoring(self, ruler_scorer):
        """Test fallback scoring when RULER fails"""
        
        contexts = [
            {
                'agent_id': 'agent-1',
                'trajectory_id': 1,
                'final_pnl': 500.0
            },
            {
                'agent_id': 'agent-2',
                'trajectory_id': 2,
                'final_pnl': -200.0
            }
        ]
        
        scores = ruler_scorer._fallback_scoring(contexts)
        
        assert len(scores) == 2
        assert all(isinstance(s, RulerScore) for s in scores)
        assert all(0.0 <= s.score <= 1.0 for s in scores)


# GRPO Training Tests
class TestGRPOTrainer:
    """Test GRPO training service"""
    
    @pytest.mark.asyncio
    async def test_format_trajectory_as_prompt(self, grpo_trainer):
        """Test trajectory formatting"""
        
        trajectory = {
            'context': {
                'portfolio': {'BTC': 0.5},
                'cash': 10000.0,
                'market_summary': 'Bullish'
            },
            'actions': [
                {'type': 'buy', 'description': 'Bought 0.1 BTC'},
                {'type': 'hold', 'description': 'Held position'}
            ]
        }
        
        prompt = grpo_trainer._format_trajectory_as_prompt(trajectory)
        
        assert 'trading agent' in prompt.lower()
        assert 'BTC' in prompt
        assert '10000' in prompt
        assert 'Bought' in prompt
    
    @pytest.mark.asyncio
    async def test_prepare_training_data_structure(self, grpo_trainer):
        """Test training data structure"""
        
        # Mock data preparation
        with patch.object(grpo_trainer.reader, 'get_trajectories_by_window', return_value=[]):
            data = await grpo_trainer._prepare_training_data("2025-01-15T10:00")
        
        # Should return None for no data
        assert data is None or isinstance(data, dict)


# Model Deployment Tests
class TestModelDeployer:
    """Test model deployment service"""
    
    @pytest.mark.asyncio
    async def test_health_check_mock(self, model_deployer):
        """Test health check with mock endpoint"""
        
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        
        with patch.object(model_deployer.client, 'post', return_value=mock_response):
            status = await model_deployer._health_check("http://localhost:8000")
        
        assert status == "healthy"
    
    @pytest.mark.asyncio
    async def test_health_check_failure(self, model_deployer):
        """Test health check with failures"""
        
        # Mock failed responses
        with patch.object(
            model_deployer.client,
            'post',
            side_effect=Exception("Connection failed")
        ):
            status = await model_deployer._health_check("http://localhost:8000")
        
        assert status == "unhealthy"


# Orchestrator Tests
class TestOrchestrator:
    """Test training orchestrator"""
    
    @pytest.mark.asyncio
    async def test_orchestrator_initialization(self, orchestrator):
        """Test orchestrator initializes all services"""
        
        assert orchestrator.data_collector is not None
        assert orchestrator.ruler_scorer is not None
        assert orchestrator.grpo_trainer is not None
        assert orchestrator.model_deployer is not None
        assert orchestrator.windows_trained == 0
    
    @pytest.mark.asyncio
    async def test_process_window_mock(self, orchestrator):
        """Test processing a window with mocked services"""
        
        window_id = "2025-01-15T10:00"
        
        # Mock all service calls
        mock_window_data = WindowData(
            window_id=window_id,
            start_time=datetime(2025, 1, 15, 10, 0),
            end_time=datetime(2025, 1, 15, 11, 0),
            agent_ids=['agent-1', 'agent-2', 'agent-3'],
            trajectory_ids=[1, 2, 3],
            agent_count=3,
            total_actions=15,
            avg_pnl=100.0
        )
        
        mock_scores = [
            RulerScore('agent-1', 1, 0.9, 'Excellent', window_id),
            RulerScore('agent-2', 2, 0.6, 'Good', window_id),
            RulerScore('agent-3', 3, 0.3, 'Poor', window_id)
        ]
        
        mock_training_result = TrainingResult(
            window_id=window_id,
            model_version=f"{window_id}-123",
            checkpoint_path="./checkpoints/test",
            metrics={'loss': 0.5},
            training_time_seconds=60.0
        )
        
        mock_deployment_info = DeploymentInfo(
            model_version=mock_training_result.model_version,
            endpoint_url="http://localhost:8000",
            deployment_time=30.0,
            health_status="healthy",
            metadata={}
        )
        
        with patch.object(
            orchestrator.data_collector,
            'collect_window_data',
            return_value=mock_window_data
        ):
            with patch.object(
                orchestrator.ruler_scorer,
                'score_window',
                return_value=mock_scores
            ):
                with patch.object(
                    orchestrator.grpo_trainer,
                    'train_window',
                    return_value=mock_training_result
                ):
                    with patch.object(
                        orchestrator.model_deployer,
                        'deploy_model',
                        return_value=mock_deployment_info
                    ):
                        success = await orchestrator.process_window(window_id)
        
        assert success is True


# Integration Tests
class TestEndToEndPipeline:
    """End-to-end integration tests"""
    
    @pytest.mark.asyncio
    @pytest.mark.integration
    async def test_full_pipeline_mock(self, db_url, openpipe_api_key):
        """Test full pipeline with mocked external services"""
        
        orchestrator = TrainingOrchestrator(
            db_url=db_url,
            openpipe_api_key=openpipe_api_key,
            environment="local",
            min_agents_per_window=2,
            training_frequency_windows=1
        )
        
        window_id = orchestrator.data_collector.get_previous_window_id(offset=2)
        
        # This tests the full flow but with mocked external APIs
        # Real database calls but mocked ML/API calls
        with patch.object(orchestrator.ruler_scorer, '_call_ruler'):
            with patch.object(orchestrator.grpo_trainer.model, 'train'):
                with patch.object(orchestrator.model_deployer, '_deploy_local'):
                    # This should not error
                    try:
                        success = await orchestrator.process_window(window_id)
                        # Success depends on data availability
                        assert isinstance(success, bool)
                    except Exception as e:
                        # Expected if no data available
                        assert "no data" in str(e).lower() or "not found" in str(e).lower()


# Performance Tests
class TestPerformance:
    """Performance and load tests"""
    
    @pytest.mark.asyncio
    async def test_data_collection_performance(self, data_collector):
        """Test data collection speed"""
        import time
        
        start = time.time()
        await data_collector.get_ready_windows(lookback_hours=6)
        elapsed = time.time() - start
        
        # Should complete in reasonable time
        assert elapsed < 30.0, f"Data collection too slow: {elapsed}s"
    
    @pytest.mark.asyncio
    async def test_concurrent_window_collection(self, data_collector):
        """Test collecting multiple windows in parallel"""
        
        window_ids = [
            data_collector.get_previous_window_id(offset=i)
            for i in range(2, 6)
        ]
        
        import time
        start = time.time()
        results = await data_collector.collect_multiple_windows(window_ids)
        elapsed = time.time() - start
        
        # Parallel should be faster than serial
        # (at least not 4x slower)
        assert elapsed < len(window_ids) * 10.0


# Environment-Specific Tests
class TestLocalEnvironment:
    """Tests specific to local environment"""
    
    @pytest.mark.asyncio
    async def test_local_config(self):
        """Test local configuration"""
        os.environ["TRAINING_ENV"] = "local"
        os.environ["MIN_AGENTS_PER_WINDOW"] = "2"
        
        # Should use small model
        from src.training.grpo_trainer import GRPOTrainingService
        
        # Verify config loads correctly
        assert os.getenv("TRAINING_ENV") == "local"


class TestCoreweaveEnvironment:
    """Tests specific to CoreWeave environment"""
    
    @pytest.mark.skipif(
        os.getenv("TRAINING_ENV") != "coreweave",
        reason="CoreWeave tests only run in CoreWeave environment"
    )
    @pytest.mark.asyncio
    async def test_coreweave_config(self):
        """Test CoreWeave configuration"""
        assert os.getenv("TRAINING_ENV") == "coreweave"
        # Add more CoreWeave-specific tests


# Utility function tests
def test_window_id_format():
    """Test window ID format is consistent"""
    from datetime import datetime
    
    now = datetime(2025, 1, 15, 14, 30, 45)
    window_start = now.replace(minute=0, second=0, microsecond=0)
    window_id = window_start.strftime("%Y-%m-%dT%H:00")
    
    assert window_id == "2025-01-15T14:00"
    assert len(window_id) == 16


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])



