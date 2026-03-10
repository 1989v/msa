-- Charting Service — PostgreSQL + pgvector initialization
-- This script runs once when the Docker container first starts.

CREATE EXTENSION IF NOT EXISTS vector;
