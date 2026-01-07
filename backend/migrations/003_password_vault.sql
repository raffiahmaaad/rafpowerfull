-- Password Vault table for secure password storage
-- This table stores ONLY encrypted data - server cannot decrypt without user's master password

CREATE TABLE IF NOT EXISTS password_vault (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,      -- AES-256-GCM encrypted JSON containing all passwords
  iv TEXT NOT NULL,                   -- Initialization vector (unique per encryption)
  salt TEXT NOT NULL,                 -- Salt for PBKDF2 key derivation
  vault_key_hash TEXT NOT NULL,       -- Hash to verify master password (NOT the encryption key)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_vault_user ON password_vault(user_id);
