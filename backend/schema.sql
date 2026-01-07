-- GhostMail D1 Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Email addresses created by users
CREATE TABLE IF NOT EXISTS email_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  alias TEXT NOT NULL,
  domain TEXT NOT NULL,
  full_email TEXT NOT NULL,
  recovery_token TEXT,
  note TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Custom domains (for future use)
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  verified INTEGER DEFAULT 0,
  cloudflare_zone_id TEXT,
  destination_email TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sessions for JWT refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Public domains managed by admin (for random email generation)
CREATE TABLE IF NOT EXISTS public_domains (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_addresses_user_id ON email_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_email_addresses_alias ON email_addresses(alias);
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_public_domains_active ON public_domains(is_active);
