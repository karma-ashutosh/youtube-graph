-- Simple batch checkpoint table for MVP
-- One row per segment, grouped by batch_id

CREATE TABLE batch_segments (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID NOT NULL,
    segment_index INTEGER NOT NULL,
    segment_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,

    UNIQUE(batch_id, segment_index)
);

CREATE INDEX idx_batch_segments_batch_id ON batch_segments(batch_id);
CREATE INDEX idx_batch_segments_status ON batch_segments(batch_id, status);
