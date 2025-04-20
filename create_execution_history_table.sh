#!/bin/bash
# Exit on error
set -e

echo "Creating execution_history table..."

# Create the execution_history table directly
psql postgresql://postgres:password@localhost:5432/actaai -c "
CREATE TABLE IF NOT EXISTS execution_history (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES blog_schedules(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    execution_type VARCHAR NOT NULL,
    execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    success BOOLEAN DEFAULT FALSE NOT NULL,
    error_message TEXT,
    post_id INTEGER REFERENCES blog_posts(id)
);

CREATE INDEX IF NOT EXISTS ix_execution_history_id ON execution_history (id);
CREATE INDEX IF NOT EXISTS ix_execution_history_schedule_id ON execution_history (schedule_id);
CREATE INDEX IF NOT EXISTS ix_execution_history_user_id ON execution_history (user_id);
"

echo "Execution history table created successfully!" 