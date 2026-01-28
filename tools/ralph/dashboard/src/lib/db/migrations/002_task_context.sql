-- Add context column for storing navigation/UI state
-- This stores things like: return path, step, temp file paths, selected items, etc.
ALTER TABLE tasks ADD COLUMN context TEXT;
