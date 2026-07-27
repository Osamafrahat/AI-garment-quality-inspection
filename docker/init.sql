# Initialize Prisma with PostgreSQL
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create custom types (will be created by Prisma migrations)
-- This file runs before Prisma migrations on first startup