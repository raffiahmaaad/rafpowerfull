-- Add secondary password support to password_vault table
-- Stores hashed secondary password on server for better security

ALTER TABLE password_vault ADD COLUMN secondary_password_hash TEXT;
ALTER TABLE password_vault ADD COLUMN secondary_password_salt TEXT;
