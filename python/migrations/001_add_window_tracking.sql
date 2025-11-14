-- Migration: Add window tracking for continuous MMO training
-- This enables time-windowed scenario grouping for GRPO

-- Add window columns to trajectories table
ALTER TABLE trajectories 
  ADD COLUMN IF NOT EXISTS window_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS window_hours INT DEFAULT 1;

-- Create indexes for window queries
CREATE INDEX IF NOT EXISTS idx_trajectories_window_id 
  ON trajectories(window_id);

CREATE INDEX IF NOT EXISTS idx_trajectories_window_agent 
  ON trajectories(window_id, agent_id);

CREATE INDEX IF NOT EXISTS idx_trajectories_window_created 
  ON trajectories(window_id, created_at);

-- Create market_outcomes table
CREATE TABLE IF NOT EXISTS market_outcomes (
    id SERIAL PRIMARY KEY,
    window_id VARCHAR(50) NOT NULL,
    
    -- Stock price outcomes
    stock_ticker VARCHAR(20),
    start_price DECIMAL(10,2),
    end_price DECIMAL(10,2),
    change_percent DECIMAL(5,2),
    sentiment VARCHAR(20),
    news_events JSONB,
    
    -- Prediction market outcomes
    prediction_market_id VARCHAR(100),
    question TEXT,
    outcome VARCHAR(20),
    final_probability DECIMAL(5,4),
    volume DECIMAL(15,2),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT market_outcomes_window_fk 
      FOREIGN KEY (window_id) 
      REFERENCES trajectories(window_id) 
      ON DELETE CASCADE
);

-- Indexes for market_outcomes
CREATE INDEX IF NOT EXISTS idx_market_outcomes_window 
  ON market_outcomes(window_id);

CREATE INDEX IF NOT EXISTS idx_market_outcomes_ticker 
  ON market_outcomes(window_id, stock_ticker);

-- Add comment
COMMENT ON TABLE market_outcomes IS 
  'Stores ground truth market outcomes per window for context-rich RULER judging';

COMMENT ON COLUMN trajectories.window_id IS 
  'Time window identifier (e.g., "2025-01-15T10:00") used for grouping simultaneous agents';

-- Show statistics
DO $$
BEGIN
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Added window_id tracking to trajectories';
  RAISE NOTICE 'Created market_outcomes table';
  RAISE NOTICE 'Created necessary indexes';
END $$;



