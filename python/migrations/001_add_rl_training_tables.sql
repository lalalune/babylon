-- Migration: Add RL Training Tables
-- Description: Tables for continuous RL training pipeline

-- Training windows tracking
CREATE TABLE IF NOT EXISTS training_windows (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, ready, scored, trained, deployed
    agent_count INT,
    total_actions INT,
    avg_pnl DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW(),
    ready_at TIMESTAMP,
    scored_at TIMESTAMP,
    trained_at TIMESTAMP,
    deployed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_windows_window_id ON training_windows(window_id);
CREATE INDEX IF NOT EXISTS idx_training_windows_status ON training_windows(status);
CREATE INDEX IF NOT EXISTS idx_training_windows_created_at ON training_windows(created_at);

-- Add window tracking to trajectories (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trajectories' AND column_name = 'window_id'
    ) THEN
        ALTER TABLE trajectories 
        ADD COLUMN window_id VARCHAR(50),
        ADD COLUMN window_hours INT DEFAULT 1;
        
        CREATE INDEX idx_trajectories_window_id ON trajectories(window_id);
    END IF;
END $$;

-- Market outcomes table
CREATE TABLE IF NOT EXISTS market_outcomes (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50) NOT NULL,
    stock_ticker VARCHAR(20),
    start_price DECIMAL(10,2),
    end_price DECIMAL(10,2),
    change_percent DECIMAL(5,2),
    volume BIGINT,
    sentiment VARCHAR(20),
    news_events JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_outcomes_window_id ON market_outcomes(window_id);
CREATE INDEX IF NOT EXISTS idx_market_outcomes_ticker ON market_outcomes(stock_ticker);

-- RULER scores table
CREATE TABLE IF NOT EXISTS ruler_scores (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50) NOT NULL,
    agent_id VARCHAR(100) NOT NULL,
    trajectory_id INT,
    score DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000
    reasoning TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (trajectory_id) REFERENCES trajectories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ruler_scores_window_id ON ruler_scores(window_id);
CREATE INDEX IF NOT EXISTS idx_ruler_scores_agent_id ON ruler_scores(agent_id);
CREATE INDEX IF NOT EXISTS idx_ruler_scores_trajectory_id ON ruler_scores(trajectory_id);
CREATE INDEX IF NOT EXISTS idx_ruler_scores_score ON ruler_scores(score DESC);

-- Training runs table
CREATE TABLE IF NOT EXISTS training_runs (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50) NOT NULL,
    model_version VARCHAR(100) NOT NULL UNIQUE,
    base_model VARCHAR(100),
    checkpoint_path TEXT NOT NULL,
    metrics JSONB,  -- loss, avg_reward, etc.
    training_time_seconds DECIMAL(10,2),
    gpu_hours DECIMAL(10,4),
    status VARCHAR(20) DEFAULT 'completed',  -- running, completed, failed
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_runs_window_id ON training_runs(window_id);
CREATE INDEX IF NOT EXISTS idx_training_runs_model_version ON training_runs(model_version);
CREATE INDEX IF NOT EXISTS idx_training_runs_status ON training_runs(status);
CREATE INDEX IF NOT EXISTS idx_training_runs_created_at ON training_runs(created_at DESC);

-- Model deployments table
CREATE TABLE IF NOT EXISTS model_deployments (
    id SERIAL PRIMARY KEY,
    model_version VARCHAR(100) NOT NULL,
    environment VARCHAR(20) NOT NULL,  -- local, coreweave
    endpoint_url TEXT NOT NULL,
    deployment_strategy VARCHAR(20),  -- replace, blue-green, canary
    health_status VARCHAR(20),  -- healthy, unhealthy, degraded
    deployment_time_seconds DECIMAL(10,2),
    traffic_percentage INT DEFAULT 100,
    metadata JSONB,
    deployed_at TIMESTAMP DEFAULT NOW(),
    undeployed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_deployments_model_version ON model_deployments(model_version);
CREATE INDEX IF NOT EXISTS idx_model_deployments_environment ON model_deployments(environment);
CREATE INDEX IF NOT EXISTS idx_model_deployments_health_status ON model_deployments(health_status);
CREATE INDEX IF NOT EXISTS idx_model_deployments_deployed_at ON model_deployments(deployed_at DESC);

-- Training metrics table (for monitoring)
CREATE TABLE IF NOT EXISTS training_metrics (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50) NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4),
    metric_type VARCHAR(20),  -- loss, reward, accuracy, etc.
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_metrics_window_id ON training_metrics(window_id);
CREATE INDEX IF NOT EXISTS idx_training_metrics_name ON training_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_training_metrics_recorded_at ON training_metrics(recorded_at);

-- Pipeline logs table (for debugging)
CREATE TABLE IF NOT EXISTS pipeline_logs (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50),
    stage VARCHAR(50),  -- collection, scoring, training, deployment
    log_level VARCHAR(20),  -- info, warning, error
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_window_id ON pipeline_logs(window_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_stage ON pipeline_logs(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_level ON pipeline_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created_at ON pipeline_logs(created_at DESC);

-- View: Training pipeline status
CREATE OR REPLACE VIEW training_pipeline_status AS
SELECT 
    tw.window_id,
    tw.status,
    tw.agent_count,
    tw.avg_pnl,
    COUNT(DISTINCT rs.agent_id) as scored_agents,
    AVG(rs.score) as avg_ruler_score,
    tr.model_version,
    tr.training_time_seconds,
    md.endpoint_url,
    md.health_status as deployment_health,
    tw.created_at,
    tw.scored_at,
    tw.trained_at,
    tw.deployed_at
FROM training_windows tw
LEFT JOIN ruler_scores rs ON tw.window_id = rs.window_id
LEFT JOIN training_runs tr ON tw.window_id = tr.window_id
LEFT JOIN model_deployments md ON tr.model_version = md.model_version
GROUP BY 
    tw.window_id, tw.status, tw.agent_count, tw.avg_pnl,
    tr.model_version, tr.training_time_seconds,
    md.endpoint_url, md.health_status,
    tw.created_at, tw.scored_at, tw.trained_at, tw.deployed_at
ORDER BY tw.created_at DESC;

-- View: Recent model performance
CREATE OR REPLACE VIEW model_performance AS
SELECT 
    md.model_version,
    md.environment,
    md.endpoint_url,
    md.health_status,
    tr.metrics,
    tr.training_time_seconds,
    md.deployed_at,
    EXTRACT(EPOCH FROM (NOW() - md.deployed_at)) / 3600 as hours_deployed
FROM model_deployments md
JOIN training_runs tr ON md.model_version = tr.model_version
WHERE md.undeployed_at IS NULL
ORDER BY md.deployed_at DESC;

-- Function: Get windows ready for next stage
CREATE OR REPLACE FUNCTION get_windows_for_stage(stage_name VARCHAR)
RETURNS TABLE (window_id VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT tw.window_id
    FROM training_windows tw
    WHERE 
        CASE stage_name
            WHEN 'scoring' THEN tw.status = 'ready'
            WHEN 'training' THEN tw.status = 'scored'
            WHEN 'deployment' THEN tw.status = 'trained'
            ELSE FALSE
        END
    ORDER BY tw.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic status updates
CREATE OR REPLACE FUNCTION update_training_window_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-update status based on timestamps
    IF NEW.deployed_at IS NOT NULL THEN
        NEW.status = 'deployed';
    ELSIF NEW.trained_at IS NOT NULL THEN
        NEW.status = 'trained';
    ELSIF NEW.scored_at IS NOT NULL THEN
        NEW.status = 'scored';
    ELSIF NEW.ready_at IS NOT NULL THEN
        NEW.status = 'ready';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_windows_status_update
    BEFORE UPDATE ON training_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_training_window_status();

-- Seed initial data (if needed)
-- This can be removed in production
DO $$
BEGIN
    -- Example: Mark existing trajectories with window_id
    UPDATE trajectories
    SET window_id = TO_CHAR(DATE_TRUNC('hour', created_at), 'YYYY-MM-DD"T"HH24:00')
    WHERE window_id IS NULL AND created_at > NOW() - INTERVAL '7 days';
END $$;

-- Grants (adjust based on your user setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO babylon_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO babylon_user;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'RL Training tables created successfully!';
END $$;



