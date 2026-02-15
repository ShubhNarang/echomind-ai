
-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension from public to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;
