-- Self-Hosted Training Tables
-- All data stored in YOUR database, no external dependencies

-- Training datasets table (stores your training data)
CREATE TABLE IF NOT EXISTS training_datasets (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(100) UNIQUE NOT NULL,
    window_id VARCHAR(50) NOT NULL,
    num_examples INT NOT NULL,
    avg_reward DECIMAL(5,4),
    data_json JSONB NOT NULL,  -- Complete dataset stored in YOUR db
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_datasets_window_id ON training_datasets(window_id);
CREATE INDEX IF NOT EXISTS idx_training_datasets_created_at ON training_datasets(created_at DESC);

-- Training jobs table (tracks your training jobs)
CREATE TABLE IF NOT EXISTS training_jobs (
    id SERIAL PRIMARY KEY,
    training_id VARCHAR(100) UNIQUE NOT NULL,
    window_id VARCHAR(50) NOT NULL,
    dataset_id VARCHAR(100) REFERENCES training_datasets(dataset_id),
    base_model VARCHAR(100),
    num_agents INT,
    num_examples INT,
    status VARCHAR(50) DEFAULT 'pending',  -- pending, dataset_ready, training, completed, failed
    checkpoint_path TEXT,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_window_id ON training_jobs(window_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created_at ON training_jobs(created_at DESC);

-- Update ruler_scores table to track scoring method
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ruler_scores' AND column_name = 'scoring_method'
    ) THEN
        ALTER TABLE ruler_scores 
        ADD COLUMN scoring_method VARCHAR(50) DEFAULT 'heuristic',
        ADD COLUMN metrics JSONB;
        
        -- Add unique constraint
        ALTER TABLE ruler_scores
        ADD CONSTRAINT ruler_scores_window_agent_unique 
        UNIQUE (window_id, agent_id);
    END IF;
END $$;

-- View: Complete training pipeline status (your data only)
CREATE OR REPLACE VIEW self_hosted_training_status AS
SELECT 
    tw.window_id,
    COUNT(DISTINCT rs.agent_id) as agents_scored,
    AVG(rs.score) as avg_score,
    td.dataset_id,
    td.num_examples,
    tj.training_id,
    tj.status as training_status,
    tj.checkpoint_path,
    tw.created_at,
    tj.completed_at
FROM training_windows tw
LEFT JOIN ruler_scores rs ON tw.window_id = rs.window_id
LEFT JOIN training_datasets td ON tw.window_id = td.window_id
LEFT JOIN training_jobs tj ON tw.window_id = tj.window_id
GROUP BY 
    tw.window_id, td.dataset_id, td.num_examples,
    tj.training_id, tj.status, tj.checkpoint_path,
    tw.created_at, tj.completed_at
ORDER BY tw.created_at DESC;

-- Function: Get dataset from your database
CREATE OR REPLACE FUNCTION get_training_dataset(p_window_id VARCHAR)
RETURNS TABLE (
    dataset_id VARCHAR,
    data_json JSONB,
    num_examples INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.dataset_id,
        td.data_json,
        td.num_examples
    FROM training_datasets td
    WHERE td.window_id = p_window_id
    ORDER BY td.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Get training examples by agent
CREATE OR REPLACE FUNCTION get_agent_training_examples(p_agent_id VARCHAR, p_limit INT DEFAULT 100)
RETURNS TABLE (
    window_id VARCHAR,
    messages JSONB,
    reward DECIMAL,
    final_pnl DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        td.window_id,
        elem->'messages' as messages,
        (elem->>'reward')::DECIMAL as reward,
        (elem->'metadata'->>'final_pnl')::DECIMAL as final_pnl
    FROM training_datasets td,
         jsonb_array_elements(td.data_json) AS elem
    WHERE elem->'metadata'->>'agent_id' = p_agent_id
    ORDER BY td.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Self-hosted training tables created successfully!';
    RAISE NOTICE 'All your data is stored in YOUR PostgreSQL database.';
    RAISE NOTICE 'No external API dependencies required.';
END $$;

