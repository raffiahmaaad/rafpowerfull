import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { generateId, hashPassword, verifyPassword, generateJWT, verifyJWT, extractToken } from './auth';
import { createILoveAPIService } from './iloveapi';

// Define types
interface KVNamespace {
  get(key: string, options?: any): Promise<any>;
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<{ keys: { name: string; metadata?: any }[] }>;
}

interface ScheduledEvent {
  cron: string;
  type: string;
  scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface EmailMessage {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream;
  rawSize: number;
  setReject(reason: string): void;
  forward(to: string): Promise<void>;
}

interface StoredEmail {
  id: string;
  from: string;
  senderName: string;
  to: string;
  subject: string;
  body: string;
  html: string;
  receivedAt: number;
  isSpam?: boolean;
}

interface AliasData {
  ruleId: string;
  expiresAt: number;
  recoveryToken: string;
  secretHash?: string; // SHA-256 hash of secret for secure verification
  emails: string[]; // Array of email IDs
  isPermanent?: boolean; // If true, this email never expires (for logged-in users)
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: any;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

// Interface for file uploads via FormData
interface UploadedFile {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

type Bindings = {
  GHOSTMAIL_KV: KVNamespace;
  DB: D1Database;
  CLOUDFLARE_ZONE_ID: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  DESTINATION_EMAIL: string;
  DOMAIN: string;
  JWT_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  ADMIN_SECRET_KEY?: string;
  ADMIN_USERNAME?: string;
  // iLoveAPI credentials
  ILOVEAPI_PUBLIC_KEY?: string;
  ILOVEAPI_SECRET_KEY?: string;
};

/**
 * Verify Cloudflare Turnstile token
 */
async function verifyTurnstile(token: string, secretKey: string, ip?: string): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await result.json() as { success: boolean; 'error-codes'?: string[] };
    return outcome.success;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for frontend
app.use('/*', cors({
  origin: [
    'https://raf-tools.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  allowMethods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

// Security Headers Middleware + Manual CORS fix
app.use('/*', async (c, next) => {
  await next();

  // Add CORS header manually to ensure it's always present
  const origin = c.req.header('Origin');
  const allowedOrigins = [
    'https://raf-tools.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  if (origin && allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }

  // === SECURITY HEADERS (Maximum Protection) ===

  // Strict Transport Security - Force HTTPS for 1 year, include subdomains
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Content Security Policy - Prevent XSS and injection attacks
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://ghostmail-worker.rafxyz.workers.dev https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '));

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy browsers)
  c.header('X-XSS-Protection', '1; mode=block');

  // Referrer Policy - Limit referrer information
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy - Disable dangerous features
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');

  // Cross-Origin policies for additional isolation
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');

  // Prevent caching of sensitive data
  if (c.req.path.includes('/api/auth') || c.req.path.includes('/api/user')) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }
});

// Rate Limiting: Now handled by Cloudflare WAF Rules (Dashboard -> Security -> Rate Limiting)
// This eliminates KV writes for rate limiting and reduces daily operation count significantly

// ============================================
// IN-MEMORY CACHE SYSTEM
// Reduces KV read operations by caching frequently accessed config data
// ============================================
interface CacheEntry<T> {
  data: T | null;
  expiresAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Global cache storage
const configCache: {
  app: CacheEntry<any>;
  tools: CacheEntry<any>;
  spamKeywords: CacheEntry<string[]>;
} = {
  app: { data: null, expiresAt: 0 },
  tools: { data: null, expiresAt: 0 },
  spamKeywords: { data: null, expiresAt: 0 }
};

// Helper: Get cached app config
async function getCachedAppConfig(kv: KVNamespace): Promise<any> {
  const now = Date.now();
  if (configCache.app.data !== null && configCache.app.expiresAt > now) {
    return configCache.app.data;
  }
  
  const configStr = await kv.get('config:app');
  const config = configStr ? JSON.parse(configStr) : { loginEnabled: true, registerEnabled: true };
  configCache.app = { data: config, expiresAt: now + CACHE_TTL };
  return config;
}

// Helper: Get cached tools config
async function getCachedToolsConfig(kv: KVNamespace): Promise<any> {
  const now = Date.now();
  if (configCache.tools.data !== null && configCache.tools.expiresAt > now) {
    return configCache.tools.data;
  }
  
  const configStr = await kv.get('config:tools');
  const defaultConfig = {
    tempmail: { enabled: true, access: 'public' },
    imagetools: { enabled: true, access: 'public' },
    pdftools: { enabled: true, access: 'public' },
    cctools: { enabled: true, access: 'public' },
    generators: { enabled: true, access: 'public' },
  };
  const config = configStr ? JSON.parse(configStr) : defaultConfig;
  configCache.tools = { data: config, expiresAt: now + CACHE_TTL };
  return config;
}

// Helper: Get cached spam keywords
async function getCachedSpamKeywords(kv: KVNamespace): Promise<string[]> {
  const now = Date.now();
  if (configCache.spamKeywords.data !== null && configCache.spamKeywords.expiresAt > now) {
    return configCache.spamKeywords.data;
  }
  
  const customKeywordsStr = await kv.get('config:spam_keywords');
  const customKeywords: string[] = customKeywordsStr ? JSON.parse(customKeywordsStr) : [];
  configCache.spamKeywords = { data: customKeywords, expiresAt: now + CACHE_TTL };
  return customKeywords;
}

// Helper: Invalidate cache (call when config is updated)
function invalidateCache(cacheKey: 'app' | 'tools' | 'spamKeywords' | 'all') {
  if (cacheKey === 'all') {
    configCache.app = { data: null, expiresAt: 0 };
    configCache.tools = { data: null, expiresAt: 0 };
    configCache.spamKeywords = { data: null, expiresAt: 0 };
  } else {
    configCache[cacheKey] = { data: null, expiresAt: 0 };
  }
}

// JWT Secret Helper - MUST be set in production, throws error if not configured
function getJwtSecret(env: Bindings): string {
  if (!env.JWT_SECRET) {
    throw new Error('SECURITY ERROR: JWT_SECRET environment variable is not set. Authentication is disabled until this is configured.');
  }
  return env.JWT_SECRET;
}

// Real name lists for random generation
const firstNames = [
  'alex', 'jordan', 'taylor', 'casey', 'morgan', 'riley', 'avery', 'parker',
  'quinn', 'reese', 'skyler', 'dakota', 'blake', 'drew', 'jamie', 'kendall',
  'logan', 'peyton', 'sawyer', 'sydney', 'charlie', 'finley', 'harper', 'hayden',
  'jesse', 'kai', 'lane', 'london', 'max', 'mika', 'noel', 'phoenix',
  'river', 'rowan', 'sage', 'shay', 'spencer', 'tatum', 'winter', 'zion',
  'andi', 'ash', 'bay', 'briar', 'cam', 'eden', 'ellis', 'ember',
  'finn', 'gray', 'jade', 'kira', 'leo', 'luna', 'nova', 'ocean',
  'rain', 'raven', 'sky', 'storm', 'wren', 'zara', 'cole', 'dylan'
];

const lastNames = [
  'smith', 'johnson', 'wilson', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'martinez', 'anderson', 'taylor', 'thomas', 'moore', 'jackson', 'martin', 'lee',
  'walker', 'white', 'harris', 'clark', 'lewis', 'robinson', 'hall', 'young',
  'allen', 'king', 'wright', 'scott', 'green', 'baker', 'adams', 'nelson',
  'hill', 'ramirez', 'campbell', 'mitchell', 'roberts', 'carter', 'phillips', 'evans',
  'turner', 'torres', 'parker', 'collins', 'edwards', 'stewart', 'flores', 'morris'
];

// Default spam/promotional keywords for email filtering
const DEFAULT_SPAM_KEYWORDS = [
  // English keywords
  'unsubscribe', 'newsletter', 'promo', 'promotion', 'discount',
  'sale', 'offer', 'deal', 'subscribe', 'subscription',
  'marketing', 'advertisement', 'sponsored', 'ads',
  'limited time', 'act now', 'click here', 'buy now', 'order now',
  'exclusive offer', 'special offer', 'free trial', 'win', 'winner',
  'congratulations', 'claim your', 'urgent', 'important notice',
  // Indonesian keywords
  'iklan', 'diskon', 'penawaran', 'gratis', 'promo khusus',
  'berlangganan', 'berhenti berlangganan', 'penawaran terbatas',
  // Common sender patterns
  'noreply', 'no-reply', 'newsletter@', 'marketing@',
  'promo@', 'info@', 'news@', 'updates@', 'notifications@',
  'mailer-daemon', 'postmaster'
];

// Helper: Generate Random Realistic Name with numbers
const generateRandomName = () => {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  const separators = ['.', '_', ''];
  const separator = separators[Math.floor(Math.random() * separators.length)];
  return `${firstName}${separator}${lastName}${number}`;
};

// Helper: Validate custom alias
const validateAlias = (alias: string): boolean => {
  const regex = /^[a-zA-Z0-9._-]{3,30}$/;
  return regex.test(alias);
};

// Helper: Check if email is spam/promotional
const isSpamEmail = async (
  from: string,
  subject: string,
  env: Bindings
): Promise<boolean> => {
  try {
    // Get custom keywords from cache (reduces KV reads on every incoming email)
    const customKeywords = await getCachedSpamKeywords(env.GHOSTMAIL_KV);

    // Combine default + custom keywords
    const allKeywords = [...DEFAULT_SPAM_KEYWORDS, ...customKeywords];

    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    // Check if any keyword matches
    return allKeywords.some(keyword =>
      fromLower.includes(keyword.toLowerCase()) ||
      subjectLower.includes(keyword.toLowerCase())
    );
  } catch {
    return false; // Default to not spam on error
  }
};

// ============================================
// SECURE TOKEN SYSTEM (3-Layer Security)
// ============================================

// Helper: Generate cryptographically secure random string (Layer 1)
const generateSecureRandom = (length: number = 32): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Helper: SHA-256 hash (Layer 3 - stored in DB, not in token)
const sha256 = async (message: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

// Helper: HMAC-SHA256 signature (Layer 2 - prevents tampering)
const hmacSign = async (message: string, secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const sigArray = Array.from(new Uint8Array(signature));
  return sigArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

// Helper: Verify HMAC signature
const hmacVerify = async (message: string, signature: string, secret: string): Promise<boolean> => {
  const expectedSig = await hmacSign(message, secret);
  return expectedSig === signature;
};

// Generate secure recovery token
// Format: base64({alias, expiresAt, secret, timestamp}).signature
const generateRecoveryToken = async (alias: string, expiresAt: number, jwtSecret: string): Promise<{ token: string; secretHash: string }> => {
  // Layer 1: Crypto-strength random secret
  const secret = generateSecureRandom(24);

  // Create payload
  const payload = {
    alias,
    expiresAt,
    secret,
    timestamp: Date.now()
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);

  // Layer 2: HMAC signature to prevent tampering
  const signature = await hmacSign(payloadB64, jwtSecret);

  // Layer 3: Hash the secret for storage (not stored in token)
  const secretHash = await sha256(secret);

  // Final token format: payload.signature
  const token = `${payloadB64}.${signature}`;

  return { token, secretHash };
};

// Verify and decode recovery token
const verifyRecoveryToken = async (
  token: string,
  jwtSecret: string,
  storedSecretHash: string
): Promise<{ alias: string; expiresAt: number; secret: string } | null> => {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    // Verify HMAC signature (Layer 2)
    const isValid = await hmacVerify(payloadB64, signature, jwtSecret);
    if (!isValid) return null;

    // Decode payload
    const payload = JSON.parse(atob(payloadB64));

    // Verify secret hash matches stored hash (Layer 3)
    const secretHash = await sha256(payload.secret);
    if (secretHash !== storedSecretHash) return null;

    return payload;
  } catch {
    return null;
  }
};

// Legacy decode for backward compatibility (will be deprecated)
const decodeRecoveryToken = (token: string): { alias: string; expiresAt: number; secret: string } | null => {
  try {
    // Check if it's new format (has signature)
    if (token.includes('.')) {
      const [payloadB64] = token.split('.');
      const decoded = atob(payloadB64);
      return JSON.parse(decoded);
    }
    // Old format (just base64)
    const decoded = atob(token);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

// Helper: Generate unique email ID
const generateEmailId = () => `email-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

// Helper: Cloudflare API Fetcher
const cfFetch = async (endpoint: string, method: string, token: string, body?: any) => {
  const url = `https://api.cloudflare.com/client/v4${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
};

// Helper: Parse email content from raw stream (MIME-aware)
const parseEmailContent = async (raw: ReadableStream): Promise<{ subject: string; body: string; html: string; senderName: string }> => {
  const reader = raw.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const rawEmail = new TextDecoder().decode(new Uint8Array(chunks.flatMap(c => [...c])));

  // Parse headers and body
  const headerBodySplit = rawEmail.indexOf('\r\n\r\n');
  const headers = headerBodySplit > 0 ? rawEmail.substring(0, headerBodySplit) : '';
  const fullBody = headerBodySplit > 0 ? rawEmail.substring(headerBodySplit + 4) : rawEmail;

  // Extract sender name from From header
  // Format: "Display Name" <email@domain.com> or Display Name <email@domain.com> or just email@domain.com
  let senderName = '';
  const fromMatch = headers.match(/^From:\s*(.+?)(?:\r?\n(?![\t ])|\r?\n\r?\n|$)/im);
  if (fromMatch) {
    let fromValue = fromMatch[1].trim();

    // Decode MIME encoded words if present (e.g., =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
    if (fromValue.includes('=?')) {
      try {
        // Handle Base64 encoded
        fromValue = fromValue.replace(/=\?([^?]+)\?[Bb]\?([^?]+)\?=/g, (_, charset, encoded) => {
          try { return atob(encoded); } catch { return encoded; }
        });
        // Handle Quoted-Printable encoded
        fromValue = fromValue.replace(/=\?([^?]+)\?[Qq]\?([^?]+)\?=/g, (_: string, charset: string, encoded: string) => {
          return encoded.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (__: string, hex: string) =>
            String.fromCharCode(parseInt(hex, 16))
          );
        });
      } catch (e) { /* ignore decode errors */ }
    }

    // Try to extract display name from "Name" <email> or Name <email> format
    const nameWithQuotes = fromValue.match(/^"([^"]+)"\s*</);
    if (nameWithQuotes) {
      senderName = nameWithQuotes[1].trim();
    } else {
      const nameWithoutQuotes = fromValue.match(/^([^<]+)</);
      if (nameWithoutQuotes) {
        senderName = nameWithoutQuotes[1].trim();
      } else {
        // If no angle brackets, might just be an email - extract username part
        const emailOnly = fromValue.match(/([^@]+)@/);
        if (emailOnly) {
          senderName = emailOnly[1];
        }
      }
    }
  }

  // Extract subject from headers
  let subject = '(No Subject)';
  const subjectMatch = headers.match(/^Subject:\s*(.+?)(?:\r?\n(?![\t ])|\r?\n\r?\n|$)/im);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    // Decode encoded subject if needed (basic =?UTF-8?B?...?= decoding)
    if (subject.includes('=?')) {
      try {
        const base64Match = subject.match(/=\?[^?]+\?[Bb]\?([^?]+)\?=/);
        if (base64Match) {
          subject = atob(base64Match[1]);
        }
      } catch (e) { /* ignore decode errors */ }
    }
  }

  // Check for MIME boundary
  const boundaryMatch = headers.match(/boundary="?([^"\r\n;]+)"?/i);

  let textBody = '';
  let htmlBody = '';

  if (boundaryMatch) {
    // Multipart email - extract parts
    const boundary = boundaryMatch[1];
    const parts = fullBody.split('--' + boundary);

    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;

      const partHeaderEnd = part.indexOf('\r\n\r\n');
      if (partHeaderEnd === -1) continue;

      const partHeaders = part.substring(0, partHeaderEnd).toLowerCase();
      const partBody = part.substring(partHeaderEnd + 4).trim();

      // Remove trailing boundary marker if present
      const cleanBody = partBody.replace(/\r?\n--[^\r\n]+--?\s*$/, '').trim();

      if (partHeaders.includes('content-type: text/html')) {
        htmlBody = cleanBody;
      } else if (partHeaders.includes('content-type: text/plain')) {
        textBody = cleanBody;
      }
    }
  } else {
    // Simple email without MIME parts
    textBody = fullBody.trim();

    // Check if it's HTML
    if (headers.toLowerCase().includes('content-type: text/html')) {
      htmlBody = textBody;
      textBody = '';
    }
  }

  // If no text body but have HTML, extract text from HTML
  if (!textBody && htmlBody) {
    textBody = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Helper function to decode quoted-printable
  const decodeQuotedPrintable = (str: string): string => {
    return str
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
        const code = parseInt(hex, 16);
        // Handle UTF-8 multi-byte sequences
        return String.fromCharCode(code);
      });
  };

  // Clean up any remaining encoded content (quoted-printable)
  textBody = decodeQuotedPrintable(textBody);
  htmlBody = decodeQuotedPrintable(htmlBody);

  // Clean up extra whitespace and non-breaking spaces
  textBody = textBody.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    subject: subject || '(No Subject)',
    body: textBody || '(No content)',
    html: htmlBody || '',
    senderName: senderName || ''
  };
};


// ==================== AUTH ENDPOINTS ====================

/**
 * POST /api/auth/register
 * Create a new user account
 */
app.post('/api/auth/register', async (c) => {
  try {
    // NOTE: Rate limiting moved to Cloudflare Dashboard -> Security -> WAF -> Rate limiting rules
    // This reduces KV write operations significantly

    // Check if registration is enabled (using cache to reduce KV reads)
    const config = await getCachedAppConfig(c.env.GHOSTMAIL_KV);
    if (!config.registerEnabled) {
      return c.json({ success: false, message: 'Registration is currently disabled' }, 403);
    }

    const body = await c.req.json() as { email: string; password: string; name?: string; turnstileToken?: string };
    const { email, password, name, turnstileToken } = body;

    if (!email || !password) {
      return c.json({ success: false, message: 'Email and password are required' }, 400);
    }

    // === MAXIMUM SECURITY: Strong Password Policy ===
    // Minimum 10 characters
    if (password.length < 10) {
      return c.json({ success: false, message: 'Password must be at least 10 characters' }, 400);
    }
    // Maximum 128 characters (prevent DoS via very long passwords)
    if (password.length > 128) {
      return c.json({ success: false, message: 'Password must be 128 characters or less' }, 400);
    }
    // Must contain at least 1 uppercase letter
    if (!/[A-Z]/.test(password)) {
      return c.json({ success: false, message: 'Password must contain at least one uppercase letter' }, 400);
    }
    // Must contain at least 1 lowercase letter
    if (!/[a-z]/.test(password)) {
      return c.json({ success: false, message: 'Password must contain at least one lowercase letter' }, 400);
    }
    // Must contain at least 1 number
    if (!/[0-9]/.test(password)) {
      return c.json({ success: false, message: 'Password must contain at least one number' }, 400);
    }
    // Must contain at least 1 special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      return c.json({ success: false, message: 'Password must contain at least one special character (!@#$%^&*...)' }, 400);
    }
    // Block common weak passwords
    const commonPasswords = [
      'password', 'password1', 'password123', '123456789', 'qwerty123',
      'letmein', 'welcome', 'admin123', 'iloveyou', 'sunshine',
      'princess', 'football', 'monkey123', 'shadow', 'master',
      'dragon', 'passw0rd', 'trustno1', 'baseball', 'abc123'
    ];
    if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
      return c.json({ success: false, message: 'Password is too common. Please choose a stronger password.' }, 400);
    }

    // Email validation - RFC 5322 compliant regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) {
      return c.json({ success: false, message: 'Invalid email format' }, 400);
    }
    if (email.length > 254) {
      return c.json({ success: false, message: 'Email address too long' }, 400);
    }

    // Verify Turnstile token if secret key is configured
    if (c.env.TURNSTILE_SECRET_KEY && turnstileToken) {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
      const isHuman = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
      if (!isHuman) {
        return c.json({ success: false, message: 'Human verification failed. Please try again.' }, 400);
      }
    }

    // Check if user exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existingUser) {
      return c.json({ success: false, message: 'Email already registered' }, 409);
    }

    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, email.toLowerCase(), passwordHash, name || null, now, now).run();

    const jwtSecret = getJwtSecret(c.env);
    const token = await generateJWT({ userId, email: email.toLowerCase() }, jwtSecret);

    return c.json({
      success: true,
      token,
      user: { id: userId, email: email.toLowerCase(), name }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
app.post('/api/auth/login', async (c) => {
  try {
    // NOTE: Rate limiting moved to Cloudflare Dashboard -> Security -> WAF -> Rate limiting rules
    // Account lockout removed to reduce KV write operations
    // Cloudflare's built-in bot protection + Turnstile provides adequate security

    const body = await c.req.json() as { email: string; password: string; turnstileToken?: string };
    const { email, password, turnstileToken } = body;

    if (!email || !password) {
      return c.json({ success: false, message: 'Email and password are required' }, 400);
    }

    // Verify Turnstile token if secret key is configured
    if (c.env.TURNSTILE_SECRET_KEY && turnstileToken) {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
      const isHuman = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
      if (!isHuman) {
        return c.json({ success: false, message: 'Human verification failed. Please try again.' }, 400);
      }
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email, password_hash, name FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<{ id: string; email: string; password_hash: string; name: string }>();

    if (!user) {
      return c.json({ success: false, message: 'Invalid email or password' }, 401);
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return c.json({ success: false, message: 'Invalid email or password' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const token = await generateJWT({ userId: user.id, email: user.email }, jwtSecret);

    return c.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
app.get('/api/auth/me', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, email, name, created_at FROM users WHERE id = ?'
    ).bind(payload.userId).first<{ id: string; email: string; name: string; created_at: number }>();

    if (!user) {
      return c.json({ success: false, message: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.created_at }
    });
  } catch (err: any) {
    console.error('Me error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/auth/password
 * Change user password
 */
app.put('/api/auth/password', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload || !payload.userId) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({ success: false, message: 'Current and new password are required' }, 400);
    }

    // === MAXIMUM SECURITY: Strong Password Policy (same as registration) ===
    if (newPassword.length < 10) {
      return c.json({ success: false, message: 'New password must be at least 10 characters' }, 400);
    }
    if (newPassword.length > 128) {
      return c.json({ success: false, message: 'New password must be 128 characters or less' }, 400);
    }
    if (!/[A-Z]/.test(newPassword)) {
      return c.json({ success: false, message: 'New password must contain at least one uppercase letter' }, 400);
    }
    if (!/[a-z]/.test(newPassword)) {
      return c.json({ success: false, message: 'New password must contain at least one lowercase letter' }, 400);
    }
    if (!/[0-9]/.test(newPassword)) {
      return c.json({ success: false, message: 'New password must contain at least one number' }, 400);
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(newPassword)) {
      return c.json({ success: false, message: 'New password must contain at least one special character' }, 400);
    }
    const commonPasswords = ['password', 'password1', 'password123', '123456789', 'qwerty123', 'letmein', 'admin123'];
    if (commonPasswords.some(p => newPassword.toLowerCase().includes(p))) {
      return c.json({ success: false, message: 'Password is too common. Please choose a stronger password.' }, 400);
    }

    // Get user's current password hash
    const user = await c.env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE id = ?'
    ).bind(payload.userId).first<{ id: string; password_hash: string }>();

    if (!user) {
      return c.json({ success: false, message: 'User not found' }, 404);
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return c.json({ success: false, message: 'Current password is incorrect' }, 401);
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(newPasswordHash, Date.now(), payload.userId).run();

    return c.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('Password change error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ==================== USER DASHBOARD ENDPOINTS ====================

/**
 * GET /api/user/emails
 * Get user's email addresses
 */
app.get('/api/user/emails', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const result = await c.env.DB.prepare(
      'SELECT id, alias, domain, full_email, recovery_token, note, expires_at, created_at FROM email_addresses WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(payload.userId).all<{ id: string; alias: string; domain: string; full_email: string; recovery_token: string; note: string | null; expires_at: number; created_at: number }>();

    return c.json({
      success: true,
      emails: result.results || [],
      total: result.results?.length || 0
    });
  } catch (err: any) {
    console.error('Get emails error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/user/emails/:id
 * Delete an email address and all associated data
 */
app.delete('/api/user/emails/:id', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const emailId = c.req.param('id');

    // Get email details from D1
    const emailRecord = await c.env.DB.prepare(
      'SELECT id, alias, domain, full_email FROM email_addresses WHERE id = ? AND user_id = ?'
    ).bind(emailId, payload.userId).first<{ id: string; alias: string; domain: string; full_email: string }>();

    if (!emailRecord) {
      return c.json({ success: false, message: 'Email not found' }, 404);
    }

    const alias = emailRecord.alias;

    // Delete associated emails from KV
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);
    if (aliasDataStr) {
      const aliasData: AliasData = JSON.parse(aliasDataStr);

      // Delete all stored emails
      for (const storedEmailId of aliasData.emails) {
        await c.env.GHOSTMAIL_KV.delete(`email:${storedEmailId}`);
      }
    }

    // Delete alias from KV
    await c.env.GHOSTMAIL_KV.delete(`alias:${alias}`);

    // Delete from D1 database
    await c.env.DB.prepare(
      'DELETE FROM email_addresses WHERE id = ?'
    ).bind(emailId).run();

    return c.json({
      success: true,
      message: 'Email deleted successfully'
    });
  } catch (err: any) {
    console.error('Delete email error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/user/emails/:id/regenerate-token
 * Regenerate recovery token for an email address
 * Old token will be invalidated and replaced with a new one
 */
app.post('/api/user/emails/:id/regenerate-token', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const emailId = c.req.param('id');

    // Verify the email belongs to the user
    const emailRecord = await c.env.DB.prepare(
      'SELECT id, alias, full_email, recovery_token FROM email_addresses WHERE id = ? AND user_id = ?'
    ).bind(emailId, payload.userId).first<{ id: string; alias: string; full_email: string; recovery_token: string }>();

    if (!emailRecord) {
      return c.json({ success: false, message: 'Email not found or access denied' }, 404);
    }

    // Generate new recovery token (JWT-like token for recovery)
    const newRecoveryToken = await generateJWT(
      {
        alias: emailRecord.alias,
        email: emailRecord.full_email,
        type: 'recovery',
        regeneratedAt: Date.now()
      },
      jwtSecret
    );

    // Update the recovery token in database
    await c.env.DB.prepare(
      'UPDATE email_addresses SET recovery_token = ? WHERE id = ?'
    ).bind(newRecoveryToken, emailId).run();

    // Also update the KV store if alias data exists there
    const aliasData = await c.env.GHOSTMAIL_KV.get(`alias:${emailRecord.alias}`, 'json');
    if (aliasData && typeof aliasData === 'object') {
      const updatedAliasData = { ...aliasData as Record<string, unknown>, recoveryToken: newRecoveryToken };
      await c.env.GHOSTMAIL_KV.put(`alias:${emailRecord.alias}`, JSON.stringify(updatedAliasData));
    }

    return c.json({
      success: true,
      message: 'Recovery token regenerated successfully',
      recovery_token: newRecoveryToken
    });
  } catch (err: any) {
    console.error('Regenerate token error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/user/emails/:id/note
 * Update the note for an email address
 */
app.put('/api/user/emails/:id/note', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const emailId = c.req.param('id');
    const body = await c.req.json() as { note: string };
    const { note } = body;

    // Validate note length (max 500 characters)
    if (note && note.length > 500) {
      return c.json({ success: false, message: 'Note must be 500 characters or less' }, 400);
    }

    // Verify the email belongs to the user
    const emailRecord = await c.env.DB.prepare(
      'SELECT id FROM email_addresses WHERE id = ? AND user_id = ?'
    ).bind(emailId, payload.userId).first<{ id: string }>();

    if (!emailRecord) {
      return c.json({ success: false, message: 'Email not found or access denied' }, 404);
    }

    // Update the note
    await c.env.DB.prepare(
      'UPDATE email_addresses SET note = ? WHERE id = ?'
    ).bind(note || null, emailId).run();

    return c.json({
      success: true,
      message: 'Note updated successfully',
      note: note || null
    });
  } catch (err: any) {
    console.error('Update note error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/user/domains
 * Get user's custom domains
 */
app.get('/api/user/domains', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const result = await c.env.DB.prepare(
      'SELECT id, domain, verified, destination_email, created_at FROM domains WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(payload.userId).all<{ id: string; domain: string; verified: number; destination_email: string; created_at: number }>();

    return c.json({
      success: true,
      domains: result.results || [],
      total: result.results?.length || 0
    });
  } catch (err: any) {
    console.error('Get domains error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/user/domains
 * Add a new custom domain
 */
app.post('/api/user/domains', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) {
      return c.json({ success: false, message: 'Invalid or expired token' }, 401);
    }

    const body = await c.req.json() as { domain: string; destinationEmail?: string };
    const { domain, destinationEmail } = body;

    if (!domain) {
      return c.json({ success: false, message: 'Domain is required' }, 400);
    }

    const domainId = generateId();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO domains (id, user_id, domain, destination_email, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(domainId, payload.userId, domain.toLowerCase(), destinationEmail || null, now).run();

    return c.json({
      success: true,
      domain: { id: domainId, domain: domain.toLowerCase(), verified: false, destinationEmail, createdAt: now }
    });
  } catch (err: any) {
    console.error('Add domain error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/user/domains/:id/verify
 * Verify domain ownership via DNS (TXT record)
 */
app.post('/api/user/domains/:id/verify', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) return c.json({ success: false, message: 'Invalid token' }, 401);

    const domainId = c.req.param('id');

    // Get domain details
    const domainData = await c.env.DB.prepare(
      'SELECT id, domain, verified FROM domains WHERE id = ? AND user_id = ?'
    ).bind(domainId, payload.userId).first<{ id: string; domain: string; verified: number }>();

    if (!domainData) {
      return c.json({ success: false, message: 'Domain not found' }, 404);
    }

    if (domainData.verified) {
      return c.json({ success: true, verified: true, message: 'Domain already verified' });
    }

    // Perform DNS Verification using Cloudflare DoH
    // Expected record: TXT @ "ghostmail-verify={user_id}"
    // Note: DoH lookup for root domain or specific subdomain if needed.
    // We check the root domain TXT records.

    const domain = domainData.domain;
    const expectedValue = `ghostmail-verify=${payload.userId}`;
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${domain}&type=TXT`;

    const dnsRes = await fetch(dohUrl, {
      headers: { 'Accept': 'application/dns-json' }
    });

    const dnsData: any = await dnsRes.json();
    let isVerified = false;

    if (dnsData.Answer) {
      for (const record of dnsData.Answer) {
        // TXT records in DoH are returned with quotes, e.g. "somestring"
        // We need to strip quotes and check content
        const txtData = record.data.replace(/^"|"$/g, '');
        if (txtData.includes(expectedValue)) {
          isVerified = true;
          break;
        }
      }
    }

    if (isVerified) {
      // Update DB
      await c.env.DB.prepare(
        'UPDATE domains SET verified = 1 WHERE id = ?'
      ).bind(domainId).run();

      return c.json({ success: true, verified: true });
    } else {
      return c.json({
        success: false,
        verified: false,
        message: 'Verification record not found. Please check your DNS settings.'
      });
    }

  } catch (err: any) {
    console.error('Domain verification error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/user/domains/:id
 * Update domain settings (destination email)
 */
app.put('/api/user/domains/:id', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) return c.json({ success: false, message: 'Invalid or expired token' }, 401);

    const domainId = c.req.param('id');
    const body = await c.req.json() as { destinationEmail?: string };

    // Verify domain belongs to user
    const domain = await c.env.DB.prepare(
      'SELECT id FROM domains WHERE id = ? AND user_id = ?'
    ).bind(domainId, payload.userId).first();

    if (!domain) {
      return c.json({ success: false, message: 'Domain not found' }, 404);
    }

    // Update destination email
    await c.env.DB.prepare(
      'UPDATE domains SET destination_email = ? WHERE id = ?'
    ).bind(body.destinationEmail || null, domainId).run();

    return c.json({ success: true, message: 'Domain updated successfully' });
  } catch (err: any) {
    console.error('Update domain error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/user/domains/:id
 * Delete a domain
 */
app.delete('/api/user/domains/:id', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload) return c.json({ success: false, message: 'Invalid or expired token' }, 401);

    const domainId = c.req.param('id');

    // Verify domain belongs to user
    const domain = await c.env.DB.prepare(
      'SELECT id FROM domains WHERE id = ? AND user_id = ?'
    ).bind(domainId, payload.userId).first();

    if (!domain) {
      return c.json({ success: false, message: 'Domain not found' }, 404);
    }

    // Delete domain
    await c.env.DB.prepare('DELETE FROM domains WHERE id = ?').bind(domainId).run();

    return c.json({ success: true, message: 'Domain deleted successfully' });
  } catch (err: any) {
    console.error('Delete domain error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/generate
 * Creates a temporary email alias
 * NOTE: No routing rule is created - catch-all Email Worker handles all emails
 */
app.post('/api/generate', async (c) => {
  try {
    // NOTE: Rate limiting moved to Cloudflare Dashboard -> Security -> WAF -> Rate limiting rules
    // This reduces KV write operations significantly

    const body = await c.req.json() as { ttlMinutes: number; customAlias?: string; domain?: string; turnstileToken?: string };
    const { ttlMinutes, customAlias, turnstileToken } = body;
    const requestedDomain = body.domain;
    // Use nullish coalescing (??) instead of || to properly handle ttlMinutes=0 (permanent)
    const minutes = ttlMinutes ?? 60;

    // Verify Turnstile token if secret key is configured
    if (c.env.TURNSTILE_SECRET_KEY && turnstileToken) {
      const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
      const isHuman = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
      if (!isHuman) {
        return c.json({ success: false, message: 'Human verification failed. Please try again.' }, 400);
      }
    }

    // Use custom alias or generate random realistic name
    let aliasLocalPart: string;
    if (customAlias && customAlias.trim()) {
      if (!validateAlias(customAlias.trim())) {
        return c.json({
          success: false,
          message: 'Invalid alias. Use 3-30 characters: letters, numbers, dots, underscores, hyphens only.'
        }, 400);
      }
      aliasLocalPart = customAlias.trim().toLowerCase();
    } else {
      aliasLocalPart = generateRandomName();
    }

    // Determine domain to use
    let targetDomain = c.env.DOMAIN; // Default fallback

    // Get available public domains
    const publicDomainsResult = await c.env.DB.prepare(
      'SELECT domain FROM public_domains WHERE is_active = 1'
    ).all<{ domain: string }>();
    const publicDomains = publicDomainsResult.results?.map(d => d.domain) || [];

    // Add default domain to list if no public domains configured
    if (publicDomains.length === 0) {
      publicDomains.push(c.env.DOMAIN);
    }

    // Extract user from token if logged in
    const token = extractToken(c.req.raw);
    let userId: string | null = null;

    if (token) {
      const jwtSecret = getJwtSecret(c.env);
      const payload = await verifyJWT(token, jwtSecret);
      if (payload && payload.userId) {
        userId = payload.userId;
      }
    }

    // Domain selection logic:
    // 1. No domain OR __RANDOM__ => random from public domains
    // 2. Public domain specified => use it
    // 3. User domain specified => verify ownership then use it

    if (!requestedDomain || requestedDomain === '__RANDOM__') {
      // Random from public domains
      targetDomain = publicDomains[Math.floor(Math.random() * publicDomains.length)];
      console.log(`Random domain selected: ${targetDomain}`);
    } else {
      // Domain specified - check if public or user domain
      const isPublicDomain = publicDomains.includes(requestedDomain.toLowerCase()) ||
        requestedDomain.toLowerCase() === c.env.DOMAIN;

      if (isPublicDomain) {
        targetDomain = requestedDomain.toLowerCase();
      } else if (userId) {
        // Logged-in user trying to use custom domain - verify ownership
        const domainRecord = await c.env.DB.prepare(
          'SELECT id, verified FROM domains WHERE user_id = ? AND domain = ?'
        ).bind(userId, requestedDomain.toLowerCase()).first<{ id: string; verified: number }>();

        if (!domainRecord || !domainRecord.verified) {
          return c.json({ success: false, message: 'Domain not found or not verified' }, 403);
        }
        targetDomain = requestedDomain.toLowerCase();
        console.log(`User domain verified: ${targetDomain}`);
      } else {
        // Anonymous trying to use non-public domain - not allowed
        return c.json({ success: false, message: 'Domain not available. Anonymous users can only use public domains.' }, 403);
      }
    }

    // Check if alias already exists (globally or per domain?)
    // KV keys should probably include domain to allow same alias on different domains
    // CURRENTLY: `alias:${aliasLocalPart}` implies GLOBAL uniqueness across ALL domains.
    // IMPROVEMENT: `alias:${aliasLocalPart}@${targetDomain}` or just rely on global uniqueness for now to keep it simple?
    // User requested "testers1@nexpark.web.id". If "testers1" exists on "rafxyz.biz.id", conflict?
    // Existing code uses `alias:${aliasLocalPart}`.
    // Changing this to include domain is a breaking change for existing aliases if we just switch keys.
    // However, for correct functionality with multiple domains, we SHOULD include domain in key OR keep global uniqueness.
    // Global uniqueness is safer/easier for now to avoid collision logic refactor.
    // So "test" cannot be taken on ANY domain. acceptable limitation for v3.0.

    const existingAlias = await c.env.GHOSTMAIL_KV.get(`alias:${aliasLocalPart}`);
    if (existingAlias) {
      // Wait, if I user 'test@domainA' and someone else used 'test@default', it blocks.
      // Ideally we want `alias:${fullEmail}`.
      // Let's check if we can switch. 
      // If I switch to `alias:${fullEmail}`, verifying incoming email in handleEmail needs to parse FULL email.
      // handleEmail currently does `const alias = aliasMatch[1]; const aliasDataStr = await env.GHOSTMAIL_KV.get('alias:' + alias);`
      // This implies it only looks at local part.
      // So we MUST stick to global uniqueness for local part unless we update handleEmail too.
      // User didn't ask for collision fix, just correct domain display.
      // So I will stick to global uniqueness for now.
    }

    if (existingAlias) {
      return c.json({
        success: false,
        message: 'Alias already exists (globally). Please choose a different name.'
      }, 409);
    }

    const fullEmail = `${aliasLocalPart}@${targetDomain}`;
    // ... rest of logic uses fullEmail?
    // yes: const fullEmail = `${aliasLocalPart}@${c.env.DOMAIN}`; -> updated to targetDomain

    // ... code continues ...

    // For logged-in users: 
    //   - ttlMinutes = 0 means PERMANENT (100 years)
    //   - ttlMinutes > 0 means custom duration
    // For anonymous users: always use the provided duration (minutes)
    const isPermanent = !!(userId && minutes === 0);
    const expiresAt = isPermanent
      ? Date.now() + (100 * 365 * 24 * 60 * 60 * 1000) // 100 years = permanent
      : Date.now() + (minutes * 60 * 1000);

    // Generate secure recovery token (3-layer security)
    const jwtSecret = getJwtSecret(c.env);
    const { token: recoveryToken, secretHash } = await generateRecoveryToken(aliasLocalPart, expiresAt, jwtSecret);

    // Store alias data in KV (no routing rule - catch-all Worker handles all emails)
    const aliasData: AliasData = {
      ruleId: '', // No routing rule created
      expiresAt,
      recoveryToken,
      secretHash, // Store hashed secret for verification
      emails: [],
      isPermanent // Mark if this is a permanent email
    };

    // We still store by local part because handleEmail uses local part
    // For permanent emails, don't set expiresAt in metadata (so cron won't clean them)
    await c.env.GHOSTMAIL_KV.put(`alias:${aliasLocalPart}`, JSON.stringify(aliasData), {
      metadata: isPermanent ? { isPermanent: true } : { expiresAt },
    });

    // Save to D1 for all emails (both logged-in and anonymous)
    // This allows admin panel to display all emails with created_at
    const emailId = generateId();
    const now = Date.now();

    try {
      await c.env.DB.prepare(
        'INSERT INTO email_addresses (id, user_id, alias, domain, full_email, recovery_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(emailId, userId, aliasLocalPart, targetDomain, fullEmail, recoveryToken, expiresAt, now).run();
      console.log(`Saved email ${fullEmail} to D1${userId ? ` (linked to user ${userId})` : ' (anonymous)'}`);
    } catch (err) {
      console.error('Failed to save email to D1:', err);
      // Don't fail the request, just log
    }

    return c.json({
      success: true,
      email: fullEmail,
      expiresAt: isPermanent ? null : expiresAt, // null means permanent
      recoveryToken,
      isPermanent
    });

  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/inbox/:alias
 * Fetches emails for an alias
 * NOTE: Rate limiting moved to Cloudflare WAF Rules
 */
app.get('/api/inbox/:alias', async (c) => {
  try {
    const alias = c.req.param('alias');

    // SECURITY: Validate alias format (prevent injection)
    if (!alias || alias.length < 3 || alias.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(alias)) {
      return c.json({ success: false, message: 'Invalid alias format' }, 400);
    }

    // Get alias data
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);
    if (!aliasDataStr) {
      return c.json({ success: false, message: 'Alias not found' }, 404);
    }

    const aliasData: AliasData = JSON.parse(aliasDataStr);

    // Check if expired
    if (aliasData.expiresAt < Date.now()) {
      return c.json({ success: false, message: 'Alias expired' }, 410);
    }

    // Fetch all emails
    const emails: StoredEmail[] = [];
    for (const emailId of aliasData.emails) {
      const emailDataStr = await c.env.GHOSTMAIL_KV.get(`email:${emailId}`);
      if (emailDataStr) {
        emails.push(JSON.parse(emailDataStr));
      }
    }

    // Sort by receivedAt (newest first)
    emails.sort((a, b) => b.receivedAt - a.receivedAt);

    return c.json({
      success: true,
      emails,
      expiresAt: aliasData.expiresAt
    });

  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/inbox/:alias/:emailId
 * Delete a single email from an alias's inbox
 */
app.delete('/api/inbox/:alias/:emailId', async (c) => {
  try {
    const alias = c.req.param('alias');
    const emailId = c.req.param('emailId');

    if (!alias || !emailId) {
      return c.json({ success: false, message: 'Alias and email ID required' }, 400);
    }

    // Get alias data
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);
    if (!aliasDataStr) {
      return c.json({ success: false, message: 'Alias not found' }, 404);
    }

    const aliasData: AliasData = JSON.parse(aliasDataStr);

    // Check if email exists in alias
    if (!aliasData.emails.includes(emailId)) {
      return c.json({ success: false, message: 'Email not found in inbox' }, 404);
    }

    // Delete the email from KV
    await c.env.GHOSTMAIL_KV.delete(`email:${emailId}`);

    // Remove email ID from alias's email list
    aliasData.emails = aliasData.emails.filter(id => id !== emailId);

    // Update alias data in KV
    await c.env.GHOSTMAIL_KV.put(`alias:${alias}`, JSON.stringify(aliasData));

    return c.json({
      success: true,
      message: 'Email deleted successfully'
    });

  } catch (err: any) {
    console.error('Delete inbox email error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/recover
 * Recover session using token
 * NOTE: Rate limiting moved to Cloudflare WAF Rules
 */
app.post('/api/recover', async (c) => {
  try {
    const body = await c.req.json() as { token: string };
    const { token } = body;

    if (!token) {
      return c.json({ success: false, message: 'Token required' }, 400);
    }

    // SECURITY: Validate token format before processing
    if (typeof token !== 'string' || token.length < 50 || token.length > 500) {
      return c.json({ success: false, message: 'Invalid token format' }, 400);
    }

    const decoded = decodeRecoveryToken(token);
    if (!decoded) {
      return c.json({ success: false, message: 'Invalid token' }, 400);
    }

    // Verify alias exists and token matches
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${decoded.alias}`);
    if (!aliasDataStr) {
      return c.json({ success: false, message: 'Alias not found or expired' }, 404);
    }

    const aliasData: AliasData = JSON.parse(aliasDataStr);

    // Verify token matches
    if (aliasData.recoveryToken !== token) {
      return c.json({ success: false, message: 'Invalid token' }, 401);
    }

    // Check expiration
    if (aliasData.expiresAt < Date.now()) {
      return c.json({ success: false, message: 'Alias expired' }, 410);
    }

    return c.json({
      success: true,
      email: `${decoded.alias}@${c.env.DOMAIN}`,
      expiresAt: aliasData.expiresAt,
      recoveryToken: token
    });

  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/destroy/:alias
 * Destroy an alias completely (from KV and D1)
 * Works for both anonymous and logged-in users
 * NOTE: Rate limiting moved to Cloudflare WAF Rules
 */
app.delete('/api/destroy/:alias', async (c) => {
  try {
    const alias = c.req.param('alias');

    if (!alias) {
      return c.json({ success: false, message: 'Alias required' }, 400);
    }

    // SECURITY: Validate alias format
    if (alias.length < 3 || alias.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(alias)) {
      return c.json({ success: false, message: 'Invalid alias format' }, 400);
    }

    // Check if alias exists in KV
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);

    if (aliasDataStr) {
      const aliasData: AliasData = JSON.parse(aliasDataStr);

      // Delete all associated emails from KV
      for (const emailId of aliasData.emails) {
        await c.env.GHOSTMAIL_KV.delete(`email:${emailId}`);
      }

      // Delete alias from KV
      await c.env.GHOSTMAIL_KV.delete(`alias:${alias}`);
    }

    // Also delete from D1 database (for logged-in users)
    try {
      await c.env.DB.prepare(
        'DELETE FROM email_addresses WHERE alias = ?'
      ).bind(alias).run();
    } catch (dbErr) {
      // Ignore DB errors - KV might be the only storage for anonymous users
      console.log('D1 delete attempted:', dbErr);
    }

    return c.json({
      success: true,
      message: 'Alias destroyed successfully'
    });

  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/email-received (internal - for Email Worker to call)
 * Store received email
 */
app.post('/api/email-received', async (c) => {
  try {
    const body = await c.req.json() as {
      to: string;
      from: string;
      subject: string;
      body: string;
      html: string;
    };

    // Extract alias from to address
    const aliasMatch = body.to.match(/^([^@]+)@/);
    if (!aliasMatch) {
      return c.json({ success: false, message: 'Invalid email address' }, 400);
    }
    const alias = aliasMatch[1];

    // Get alias data
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);
    if (!aliasDataStr) {
      return c.json({ success: false, message: 'Alias not found' }, 404);
    }

    const aliasData: AliasData = JSON.parse(aliasDataStr);

    // Generate email ID and store email
    const emailId = generateEmailId();
    const email: StoredEmail = {
      id: emailId,
      from: body.from,
      senderName: '', // For test emails, we use the from field directly
      to: body.to,
      subject: body.subject || '(No Subject)',
      body: body.body || '',
      html: body.html || '',
      receivedAt: Date.now()
    };

    await c.env.GHOSTMAIL_KV.put(`email:${emailId}`, JSON.stringify(email), {
      metadata: { expiresAt: aliasData.expiresAt }
    });

    // Update alias with new email ID
    aliasData.emails.push(emailId);
    await c.env.GHOSTMAIL_KV.put(`alias:${alias}`, JSON.stringify(aliasData), {
      metadata: { expiresAt: aliasData.expiresAt }
    });

    return c.json({ success: true, emailId });

  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * Email Worker Handler
 * Receives emails and stores them
 */
async function handleEmail(message: EmailMessage, env: Bindings, ctx: ExecutionContext) {
  try {
    // Extract alias from recipient
    const toAddress = message.to;
    const aliasMatch = toAddress.match(/^([^@]+)@/);
    if (!aliasMatch) {
      message.setReject('Invalid recipient');
      return;
    }
    const alias = aliasMatch[1];

    // Check if alias exists
    const aliasDataStr = await env.GHOSTMAIL_KV.get(`alias:${alias}`);
    if (!aliasDataStr) {
      message.setReject('Recipient not found');
      return;
    }

    const aliasData: AliasData = JSON.parse(aliasDataStr);

    // Check expiration - skip for permanent emails (logged-in users)
    if (!aliasData.isPermanent && aliasData.expiresAt < Date.now()) {
      message.setReject('Recipient expired');
      return;
    }

    // Parse email content
    const { subject, body, html, senderName } = await parseEmailContent(message.raw);

    // Check if email is spam/promotional
    const isSpam = await isSpamEmail(message.from, subject, env);

    // Generate email ID and store
    const emailId = generateEmailId();

    // Build the 'from' field in proper format: "Name <email@domain.com>"
    // This allows frontend to extract both name and email address
    let fromField = message.from;
    if (senderName && senderName !== message.from) {
      fromField = `${senderName} <${message.from}>`;
    }

    const email: StoredEmail = {
      id: emailId,
      from: fromField,
      senderName: senderName || '',
      to: toAddress,
      subject,
      body,
      html,
      receivedAt: Date.now(),
      isSpam // Store spam flag
    };

    await env.GHOSTMAIL_KV.put(`email:${emailId}`, JSON.stringify(email), {
      metadata: { expiresAt: aliasData.expiresAt }
    });

    // Update alias with new email ID
    aliasData.emails.push(emailId);
    await env.GHOSTMAIL_KV.put(`alias:${alias}`, JSON.stringify(aliasData), {
      metadata: { expiresAt: aliasData.expiresAt }
    });

    // Forwarding Logic - SKIP for spam emails
    if (!isSpam) {
      try {
        // Extract domain to check for custom forwarding
        const domain = toAddress.split('@')[1];

        const domainConfig = await env.DB.prepare(
          'SELECT destination_email FROM domains WHERE domain = ?'
        ).bind(domain).first<{ destination_email: string }>();

        if (domainConfig && domainConfig.destination_email) {
          console.log(`Forwarding email for ${toAddress} to custom destination: ${domainConfig.destination_email}`);
          await message.forward(domainConfig.destination_email);
        } else {
          // Fallback to default admin email
          await message.forward(env.DESTINATION_EMAIL);
        }
      } catch (fwdErr) {
        console.error('Forwarding error:', fwdErr);
        // Try fallback if custom failed (essential for reliability)
        try {
          await message.forward(env.DESTINATION_EMAIL);
        } catch (e) { /* ignore if even default fails */ }
      }
    } else {
      console.log(`Spam detected for ${alias}: "${subject}" - skipping forward`);
    }

    console.log(`Email received for ${alias}: ${subject}${isSpam ? ' [SPAM]' : ''}`);

  } catch (err) {
    console.error('Email handling error:', err);
    message.setReject('Internal error');
  }
}

/**
 * Scheduled Handler (Cron) - Cleanup expired aliases
 * - Skips permanent aliases (isPermanent = true)
 * - Deletes from both KV and D1
 */
async function handleScheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
  const { keys } = await env.GHOSTMAIL_KV.list();
  const now = Date.now();
  const deletePromises: Promise<any>[] = [];
  const expiredAliases: string[] = []; // Track for D1 cleanup

  for (const key of keys) {
    const metadata = key.metadata as { expiresAt?: number; isPermanent?: boolean } | undefined;

    // Skip permanent aliases (logged-in user emails)
    if (metadata?.isPermanent) {
      continue;
    }

    // Only delete if has expiresAt AND is expired
    if (metadata?.expiresAt && metadata.expiresAt < now) {
      // Check if it's an alias (to delete associated emails)
      if (key.name.startsWith('alias:')) {
        const aliasName = key.name.replace('alias:', '');
        expiredAliases.push(aliasName); // Track for D1 cleanup

        const aliasDataStr = await env.GHOSTMAIL_KV.get(key.name);
        if (aliasDataStr) {
          const aliasData: AliasData = JSON.parse(aliasDataStr);

          // Delete associated emails from KV
          for (const emailId of aliasData.emails) {
            deletePromises.push(env.GHOSTMAIL_KV.delete(`email:${emailId}`));
          }
        }
      }

      // Delete the key itself from KV
      deletePromises.push(env.GHOSTMAIL_KV.delete(key.name));
      console.log(`Cleaning up expired: ${key.name}`);
    }
  }

  await Promise.all(deletePromises);

  // Cleanup D1: Delete expired anonymous emails from database
  // (Anonymous emails have expires_at set, logged-in have NULL)
  if (expiredAliases.length > 0) {
    try {
      await env.DB.prepare(
        `DELETE FROM email_addresses WHERE expires_at IS NOT NULL AND expires_at < ?`
      ).bind(now).run();
      console.log(`D1 cleanup: Removed ${expiredAliases.length} expired email records.`);
    } catch (err) {
      console.error('D1 cleanup error:', err);
    }
  }

  console.log(`Cleanup complete. Processed ${deletePromises.length} KV items.`);
}

// ==================== ADMIN ENDPOINTS ====================

// --- Admin Auth Endpoints ---

/**
 * POST /api/admin/login
 * Admin login
 * NOTE: Rate limiting moved to Cloudflare WAF Rules, Turnstile provides bot protection
 */
app.post('/api/admin/login', async (c) => {
  try {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';

    const { username, password, turnstileToken } = await c.req.json();
    const adminUsername = c.env.ADMIN_USERNAME || 'admin';
    const adminKey = c.env.ADMIN_SECRET_KEY;

    // Verify Turnstile token if secret key is configured
    if (c.env.TURNSTILE_SECRET_KEY && turnstileToken) {
      const isHuman = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
      if (!isHuman) {
        return c.json({ success: false, message: 'Human verification failed. Please try again.' }, 400);
      }
    }

    // Constant-time comparison to prevent timing attacks
    const usernameMatch = username === adminUsername;
    const passwordMatch = adminKey && password === adminKey;

    if (!username || !password || !usernameMatch || !passwordMatch) {
      // Add artificial delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 300) + 200));
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const jwtSecret = getJwtSecret(c.env);
    const token = await generateJWT({ role: 'admin', username, loginTime: Date.now(), ip }, jwtSecret);

    setCookie(c, 'ghostmail_admin_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/admin/logout
 * Admin logout
 */
app.post('/api/admin/logout', async (c) => {
  // To properly delete a cross-origin cookie, we need to set it with the same options
  // but with maxAge=0 or expires in the past
  setCookie(c, 'ghostmail_admin_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: 0 // Expire immediately
  });
  return c.json({ success: true });
});

/**
 * GET /api/admin/verify
 * Verify admin session
 */
app.get('/api/admin/verify', async (c) => {
  if (await verifyAdminKey(c)) {
    return c.json({ success: true });
  }
  return c.json({ success: false }, 401);
});

/**
 * Verify admin secret key from request
 */
async function verifyAdminKey(c: any): Promise<boolean> {
  const adminKey = c.env.ADMIN_SECRET_KEY;
  if (!adminKey) {
    return false; // No admin key configured
  }

  // 1. Check Cookie (Preferred)
  const token = getCookie(c, 'ghostmail_admin_token');
  if (token) {
    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (payload && payload.role === 'admin') {
      return true;
    }
  }

  // 2. Check query param or header (Legacy/Fallback) - REMOVED FOR SECURITY
  // We only allow secure httpOnly cookies now via the login flow

  return false;
}

/**
 * GET /api/admin/config
 * Get app configuration
 */
app.get('/api/admin/config', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    // Use cached config to reduce KV reads
    const config = await getCachedAppConfig(c.env.GHOSTMAIL_KV);
    return c.json({ success: true, config });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/admin/config
 * Update app configuration
 */
app.put('/api/admin/config', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json() as { loginEnabled?: boolean; registerEnabled?: boolean };

    // Get existing config (use cache)
    const config = await getCachedAppConfig(c.env.GHOSTMAIL_KV);

    // Update with new values
    if (body.loginEnabled !== undefined) config.loginEnabled = body.loginEnabled;
    if (body.registerEnabled !== undefined) config.registerEnabled = body.registerEnabled;

    await c.env.GHOSTMAIL_KV.put('config:app', JSON.stringify(config));
    
    // Invalidate cache after update
    invalidateCache('app');

    return c.json({ success: true, config });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ==================== TOOLS CONFIG API ====================

// Default tools configuration
const DEFAULT_TOOLS_CONFIG = {
  tempmail: { enabled: true, access: 'public' as const },
  imagetools: { enabled: true, access: 'public' as const },
  pdftools: { enabled: true, access: 'public' as const },
  cctools: { enabled: true, access: 'public' as const },
  generators: { enabled: true, access: 'public' as const },
};

type ToolAccess = 'public' | 'authenticated';
interface ToolConfig {
  enabled: boolean;
  access: ToolAccess;
}
interface ToolsConfig {
  tempmail: ToolConfig;
  imagetools: ToolConfig;
  pdftools: ToolConfig;
  cctools: ToolConfig;
  generators: ToolConfig;
}

/**
 * GET /api/config/tools
 * Public endpoint to get tools configuration
 */
app.get('/api/config/tools', async (c) => {
  try {
    // Use cached config to reduce KV reads (public endpoint called frequently)
    const config = await getCachedToolsConfig(c.env.GHOSTMAIL_KV);
    return c.json({ success: true, config });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/admin/config/tools
 * Admin: Get tools configuration with details
 */
app.get('/api/admin/config/tools', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    // Use cached config
    const config = await getCachedToolsConfig(c.env.GHOSTMAIL_KV);

    // Return with tool metadata
    const toolsWithMeta = {
      tempmail: { ...config.tempmail, name: 'TempMail', description: 'Temporary Email Generator', icon: 'mail' },
      imagetools: { ...config.imagetools, name: 'Image Tools', description: 'Image Manipulation Tools', icon: 'image' },
      pdftools: { ...config.pdftools, name: 'PDF Tools', description: 'PDF Manipulation Tools', icon: 'file-text' },
      cctools: { ...config.cctools, name: 'CC Tools', description: 'Credit Card Generator (Testing)', icon: 'credit-card' },
      generators: { ...config.generators, name: 'Address Tools', description: 'Address & Identity Generator', icon: 'map-pin' },
    };

    return c.json({ success: true, config: toolsWithMeta });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/admin/config/tools
 * Admin: Update tools configuration
 */
app.put('/api/admin/config/tools', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json() as Partial<ToolsConfig>;

    // Get existing config (use cache)
    const config = await getCachedToolsConfig(c.env.GHOSTMAIL_KV);

    // Update each tool if provided
    const toolIds: (keyof ToolsConfig)[] = ['tempmail', 'imagetools', 'pdftools', 'cctools', 'generators'];
    
    for (const toolId of toolIds) {
      if (body[toolId]) {
        if (body[toolId]!.enabled !== undefined) {
          config[toolId].enabled = body[toolId]!.enabled;
        }
        if (body[toolId]!.access !== undefined) {
          config[toolId].access = body[toolId]!.access;
        }
      }
    }

    await c.env.GHOSTMAIL_KV.put('config:tools', JSON.stringify(config));
    
    // Invalidate cache after update
    invalidateCache('tools');

    return c.json({ success: true, config });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ==================== PUBLIC DOMAINS API ====================

/**
 * GET /api/public-domains
 * Public endpoint to get list of active domains for email generation
 */
app.get('/api/public-domains', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'SELECT id, domain FROM public_domains WHERE is_active = 1 ORDER BY domain ASC'
    ).all<{ id: string; domain: string }>();

    // If no domains configured, return the default domain
    let domains = result.results || [];
    if (domains.length === 0) {
      domains = [{ id: 'default', domain: c.env.DOMAIN }];
    }

    return c.json({ success: true, domains });
  } catch (err: any) {
    // Fallback to default domain on error
    return c.json({ success: true, domains: [{ id: 'default', domain: c.env.DOMAIN }] });
  }
});

/**
 * GET /api/admin/public-domains
 * Admin: Get all public domains (including inactive)
 * Auto-seeds the default domain if no domains exist
 */
app.get('/api/admin/public-domains', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    // Check if default domain exists, if not, seed it
    const defaultDomain = c.env.DOMAIN;
    const existingDefault = await c.env.DB.prepare(
      'SELECT id FROM public_domains WHERE domain = ?'
    ).bind(defaultDomain).first();

    if (!existingDefault) {
      // Auto-seed the default domain
      const id = generateId();
      const now = Date.now();
      await c.env.DB.prepare(
        'INSERT INTO public_domains (id, domain, is_active, created_at) VALUES (?, ?, 1, ?)'
      ).bind(id, defaultDomain, now).run();
    }

    const result = await c.env.DB.prepare(
      'SELECT id, domain, is_active, created_at FROM public_domains ORDER BY created_at ASC'
    ).all<{ id: string; domain: string; is_active: number; created_at: number }>();

    // Mark the default domain
    const domains = (result.results || []).map(d => ({
      ...d,
      isDefault: d.domain === defaultDomain
    }));

    return c.json({ success: true, domains, defaultDomain });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/admin/public-domains
 * Admin: Add a new public domain
 */
app.post('/api/admin/public-domains', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const { domain } = await c.req.json() as { domain: string };

    if (!domain || !domain.trim()) {
      return c.json({ success: false, message: 'Domain is required' }, 400);
    }

    const cleanDomain = domain.trim().toLowerCase();

    // Validate domain format
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(cleanDomain)) {
      return c.json({ success: false, message: 'Invalid domain format' }, 400);
    }

    const id = generateId();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO public_domains (id, domain, is_active, created_at) VALUES (?, ?, 1, ?)'
    ).bind(id, cleanDomain, now).run();

    return c.json({ success: true, domain: { id, domain: cleanDomain, is_active: 1, created_at: now } });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint')) {
      return c.json({ success: false, message: 'Domain already exists' }, 409);
    }
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/admin/public-domains/:id
 * Admin: Toggle domain active status
 */
app.put('/api/admin/public-domains/:id', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const { is_active } = await c.req.json() as { is_active: boolean };

    await c.env.DB.prepare(
      'UPDATE public_domains SET is_active = ? WHERE id = ?'
    ).bind(is_active ? 1 : 0, id).run();

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/admin/public-domains/:id
 * Admin: Delete a public domain
 */
app.delete('/api/admin/public-domains/:id', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');

    await c.env.DB.prepare(
      'DELETE FROM public_domains WHERE id = ?'
    ).bind(id).run();

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/admin/public-domains/:id/verify
 * Admin: Verify DNS configuration for a public domain
 */
app.post('/api/admin/public-domains/:id/verify', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');

    // Get the domain from database
    const domain = await c.env.DB.prepare(
      'SELECT domain FROM public_domains WHERE id = ?'
    ).bind(id).first<{ domain: string }>();

    if (!domain) {
      return c.json({ success: false, message: 'Domain not found' }, 404);
    }

    // Check MX records using Cloudflare DNS-over-HTTPS
    const dnsResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain.domain}&type=MX`,
      {
        headers: {
          'Accept': 'application/dns-json'
        }
      }
    );

    const dnsData = await dnsResponse.json() as { Answer?: { type: number; data: string }[] };

    // Check if MX records exist and point to Cloudflare
    const mxRecords = dnsData.Answer?.filter((r: any) => r.type === 15) || [];
    const hasCloudfareMX = mxRecords.some((r: any) =>
      r.data?.toLowerCase().includes('route') ||
      r.data?.toLowerCase().includes('cloudflare')
    );

    if (mxRecords.length > 0) {
      return c.json({
        success: true,
        verified: true,
        mxRecords: mxRecords.map((r: any) => r.data),
        message: `Found ${mxRecords.length} MX record(s). Domain is configured for email receiving.`
      });
    } else {
      return c.json({
        success: true,
        verified: false,
        message: 'No MX records found. Please add MX records pointing to Cloudflare Email Routing.'
      });
    }
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/admin/spam-keywords
 * Get all spam filter keywords (default + custom)
 */
app.get('/api/admin/spam-keywords', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    // Use cached spam keywords
    const customKeywords = await getCachedSpamKeywords(c.env.GHOSTMAIL_KV);

    return c.json({
      success: true,
      defaultKeywords: DEFAULT_SPAM_KEYWORDS,
      customKeywords,
      totalCount: DEFAULT_SPAM_KEYWORDS.length + customKeywords.length
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/admin/spam-keywords
 * Replace all custom spam keywords
 */
app.put('/api/admin/spam-keywords', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json() as { keywords: string[] };
    const keywords = body.keywords || [];

    // Validate and clean keywords
    const cleanedKeywords = keywords
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    await c.env.GHOSTMAIL_KV.put('config:spam_keywords', JSON.stringify(cleanedKeywords));
    
    // Invalidate cache
    invalidateCache('spamKeywords');

    return c.json({
      success: true,
      customKeywords: cleanedKeywords,
      message: 'Spam keywords updated'
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/admin/spam-keywords
 * Add a new custom spam keyword
 */
app.post('/api/admin/spam-keywords', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json() as { keyword: string };
    const keyword = body.keyword?.trim().toLowerCase();

    if (!keyword) {
      return c.json({ success: false, message: 'Keyword is required' }, 400);
    }

    // Get existing custom keywords
    const customKeywordsStr = await c.env.GHOSTMAIL_KV.get('config:spam_keywords');
    const customKeywords: string[] = customKeywordsStr ? JSON.parse(customKeywordsStr) : [];

    // Check if already exists
    if (customKeywords.includes(keyword) || DEFAULT_SPAM_KEYWORDS.includes(keyword)) {
      return c.json({ success: false, message: 'Keyword already exists' }, 409);
    }

    // Add new keyword
    customKeywords.push(keyword);
    await c.env.GHOSTMAIL_KV.put('config:spam_keywords', JSON.stringify(customKeywords));
    
    // Invalidate cache
    invalidateCache('spamKeywords');

    return c.json({
      success: true,
      keyword,
      customKeywords,
      message: 'Keyword added'
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/admin/spam-keywords/:keyword
 * Delete a custom spam keyword
 */
app.delete('/api/admin/spam-keywords/:keyword', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const keyword = decodeURIComponent(c.req.param('keyword')).trim().toLowerCase();

    // Get existing custom keywords
    const customKeywordsStr = await c.env.GHOSTMAIL_KV.get('config:spam_keywords');
    const customKeywords: string[] = customKeywordsStr ? JSON.parse(customKeywordsStr) : [];

    // Check if exists
    const index = customKeywords.indexOf(keyword);
    if (index === -1) {
      return c.json({ success: false, message: 'Keyword not found' }, 404);
    }

    // Remove keyword
    customKeywords.splice(index, 1);
    await c.env.GHOSTMAIL_KV.put('config:spam_keywords', JSON.stringify(customKeywords));
    
    // Invalidate cache
    invalidateCache('spamKeywords');

    return c.json({
      success: true,
      keyword,
      customKeywords,
      message: 'Keyword deleted'
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/admin/emails
 * List all email aliases (from D1 and KV)
 */
app.get('/api/admin/emails', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const emails: any[] = [];

    // Get emails from D1 database (logged-in users) - include domain and full_email
    const d1Results = await c.env.DB.prepare(
      'SELECT id, alias, domain, full_email, user_id, created_at, expires_at FROM email_addresses ORDER BY created_at DESC'
    ).all<{ id: string; alias: string; domain: string; full_email: string; user_id: string | null; created_at: number; expires_at: number | null }>();

    if (d1Results.results) {
      for (const row of d1Results.results) {
        // Get recovery token from KV for this alias
        let recoveryToken = null;
        const kvDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${row.alias}`);
        if (kvDataStr) {
          try {
            const kvData = JSON.parse(kvDataStr);
            recoveryToken = kvData.recoveryToken || null;
          } catch { }
        }

        emails.push({
          id: row.id,
          alias: row.alias,
          domain: row.domain,
          email: row.full_email || `${row.alias}@${row.domain || c.env.DOMAIN}`,
          userId: row.user_id,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          source: 'database',
          isActive: row.expires_at ? row.expires_at > Date.now() : true,
          recoveryToken
        });
      }
    }

    // Get emails from KV (anonymous users)
    const kvList = await c.env.GHOSTMAIL_KV.list({ prefix: 'alias:' });
    for (const key of kvList.keys) {
      const alias = key.name.replace('alias:', '');
      // Check if already in D1 results
      if (!emails.find(e => e.alias === alias)) {
        const aliasDataStr = await c.env.GHOSTMAIL_KV.get(key.name);
        if (aliasDataStr) {
          const aliasData = JSON.parse(aliasDataStr);
          emails.push({
            id: aliasData.ruleId || alias,
            alias: alias,
            email: `${alias}@${c.env.DOMAIN}`,
            userId: null,
            createdAt: null,
            expiresAt: aliasData.expiresAt,
            source: 'kv',
            isActive: aliasData.expiresAt ? aliasData.expiresAt > Date.now() : true,
            recoveryToken: aliasData.recoveryToken || null
          });
        }
      }
    }

    return c.json({
      success: true,
      emails,
      total: emails.length
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/admin/emails/:alias/inbox
 * View inbox for a specific email alias
 */
app.get('/api/admin/emails/:alias/inbox', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  const alias = c.req.param('alias');

  try {
    // Get alias data
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);
    if (!aliasDataStr) {
      return c.json({ success: false, message: 'Alias not found' }, 404);
    }

    const aliasData = JSON.parse(aliasDataStr);
    const emailIds = aliasData.emails || [];
    const emails: StoredEmail[] = [];

    for (const emailId of emailIds) {
      const emailDataStr = await c.env.GHOSTMAIL_KV.get(`email:${emailId}`);
      if (emailDataStr) {
        emails.push(JSON.parse(emailDataStr));
      }
    }

    // Sort by received time, newest first
    emails.sort((a, b) => b.receivedAt - a.receivedAt);

    // Get correct domain from D1 database
    const emailRecord = await c.env.DB.prepare(
      'SELECT full_email FROM email_addresses WHERE alias = ?'
    ).bind(alias).first<{ full_email: string }>();

    const fullEmail = emailRecord?.full_email || `${alias}@${c.env.DOMAIN}`;

    return c.json({
      success: true,
      alias,
      email: fullEmail,
      emails,
      total: emails.length
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/admin/emails/:alias
 * Delete an email alias completely (admin only)
 */
app.delete('/api/admin/emails/:alias', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  const alias = c.req.param('alias');

  try {
    // Get alias data to find associated emails
    const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);

    if (aliasDataStr) {
      const aliasData = JSON.parse(aliasDataStr);

      // Delete all associated emails from KV
      if (aliasData.emails && Array.isArray(aliasData.emails)) {
        for (const emailId of aliasData.emails) {
          await c.env.GHOSTMAIL_KV.delete(`email:${emailId}`);
        }
      }

      // Delete alias from KV
      await c.env.GHOSTMAIL_KV.delete(`alias:${alias}`);
    }

    // Delete from D1 database
    await c.env.DB.prepare(
      'DELETE FROM email_addresses WHERE alias = ?'
    ).bind(alias).run();

    return c.json({
      success: true,
      message: `Alias ${alias} deleted successfully`
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/admin/users
 * List all registered users
 */
app.get('/api/admin/users', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const users = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.created_at,
        (SELECT COUNT(*) FROM email_addresses WHERE user_id = u.id) as email_count
       FROM users u ORDER BY u.created_at DESC`
    ).all<{ id: string; email: string; name: string | null; created_at: number; email_count: number }>();

    return c.json({
      success: true,
      users: users.results || [],
      total: users.results?.length || 0
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their email aliases
 */
app.delete('/api/admin/users/:userId', async (c) => {
  if (!await verifyAdminKey(c)) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  const userId = c.req.param('userId');

  try {
    // Get all email aliases for this user
    const aliases = await c.env.DB.prepare(
      'SELECT alias FROM email_addresses WHERE user_id = ?'
    ).bind(userId).all<{ alias: string }>();

    // Delete each alias from KV
    if (aliases.results) {
      for (const { alias } of aliases.results) {
        // Get alias data to find associated emails
        const aliasDataStr = await c.env.GHOSTMAIL_KV.get(`alias:${alias}`);
        if (aliasDataStr) {
          const aliasData = JSON.parse(aliasDataStr);

          // Delete all associated emails from KV
          if (aliasData.emails && Array.isArray(aliasData.emails)) {
            for (const emailId of aliasData.emails) {
              await c.env.GHOSTMAIL_KV.delete(`email:${emailId}`);
            }
          }

          // Delete alias from KV
          await c.env.GHOSTMAIL_KV.delete(`alias:${alias}`);
        }
      }
    }

    // Delete all email addresses from D1
    await c.env.DB.prepare(
      'DELETE FROM email_addresses WHERE user_id = ?'
    ).bind(userId).run();

    // Delete user from D1
    await c.env.DB.prepare(
      'DELETE FROM users WHERE id = ?'
    ).bind(userId).run();

    return c.json({
      success: true,
      message: 'User and all associated emails deleted successfully'
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * GET /api/config (public - for frontend to check login/register status)
 * Uses cache to reduce KV reads - this endpoint is called frequently on every page load
 */
app.get('/api/config', async (c) => {
  try {
    // Use cached config to dramatically reduce KV reads
    const config = await getCachedAppConfig(c.env.GHOSTMAIL_KV);

    return c.json({
      success: true,
      loginEnabled: config.loginEnabled,
      registerEnabled: config.registerEnabled
    });
  } catch (err: any) {
    return c.json({ success: true, loginEnabled: true, registerEnabled: true });
  }
});

// ==================== PDF TOOLS API (iLoveAPI) ====================

/**
 * Helper: Check if iLoveAPI is configured
 */
function getILoveAPIService(env: Bindings) {
  if (!env.ILOVEAPI_PUBLIC_KEY || !env.ILOVEAPI_SECRET_KEY) {
    return null;
  }
  return createILoveAPIService(env.ILOVEAPI_PUBLIC_KEY, env.ILOVEAPI_SECRET_KEY);
}

/**
 * POST /api/pdf/compress
 * Compress PDF file
 */
app.post('/api/pdf/compress', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const level = (formData.get('level') as string) || 'recommended';

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const compressionLevel = level === 'high' ? 'extreme' : level === 'low' ? 'low' : 'recommended';

    const result = await service.compressPDF(arrayBuffer, file.name, compressionLevel as any);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Original-Size': String(result.originalSize),
        'X-Output-Size': String(result.outputSize),
        'Access-Control-Expose-Headers': 'X-Original-Size, X-Output-Size'
      }
    });
  } catch (err: any) {
    console.error('Compress PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to compress PDF' }, 500);
  }
});

/**
 * POST /api/pdf/unlock
 * Remove password from PDF
 */
app.post('/api/pdf/unlock', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const password = formData.get('password') as string;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.unlockPDF(arrayBuffer, file.name, password || undefined);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Unlock PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to unlock PDF' }, 500);
  }
});

/**
 * POST /api/pdf/protect
 * Add password protection to PDF
 */
app.post('/api/pdf/protect', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const password = formData.get('password') as string;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    if (!password) {
      return c.json({ success: false, message: 'Password is required' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.protectPDF(arrayBuffer, file.name, password);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Protect PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to protect PDF' }, 500);
  }
});

/**
 * POST /api/pdf/officetopdf
 * Convert Office documents (Word, Excel, PowerPoint) to PDF
 */
app.post('/api/pdf/officetopdf', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.officeToPDF(arrayBuffer, file.name);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Office to PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to convert to PDF' }, 500);
  }
});

/**
 * POST /api/pdf/pdftojpg
 * Convert PDF to JPG images
 */
app.post('/api/pdf/pdftojpg', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const mode = (formData.get('mode') as string) || 'pages';

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.pdfToJPG(arrayBuffer, file.name, mode as 'pages' | 'extract');

    // Result will be a ZIP file containing JPG images
    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('PDF to JPG error:', err);
    return c.json({ success: false, message: err.message || 'Failed to convert PDF to JPG' }, 500);
  }
});

/**
 * POST /api/pdf/rotate
 * Rotate PDF pages
 */
app.post('/api/pdf/rotate', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const rotation = parseInt(formData.get('rotation') as string) || 90;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.rotatePDF(arrayBuffer, file.name, rotation as 0 | 90 | 180 | 270);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Rotate PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to rotate PDF' }, 500);
  }
});

/**
 * POST /api/pdf/watermark
 * Add watermark to PDF
 */
app.post('/api/pdf/watermark', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    
    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const options: Record<string, any> = {
      mode: formData.get('mode') || 'text',
      text: formData.get('text') || 'WATERMARK',
      pages: formData.get('pages') || 'all',
      vertical_position: formData.get('vertical_position') || 'middle',
      horizontal_position: formData.get('horizontal_position') || 'center',
      mosaic: formData.get('mosaic') === 'true',
      rotation: parseInt(formData.get('rotation') as string) || 0,
      font_family: formData.get('font_family') || 'Arial',
      font_size: parseInt(formData.get('font_size') as string) || 48,
      font_color: formData.get('font_color') || '#000000',
      transparency: parseInt(formData.get('transparency') as string) || 50,
      layer: formData.get('layer') || 'above'
    };

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.watermarkPDF(arrayBuffer, file.name, options);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Watermark PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to add watermark' }, 500);
  }
});

/**
 * POST /api/pdf/pagenumber
 * Add page numbers to PDF
 */
app.post('/api/pdf/pagenumber', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    
    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const options: Record<string, any> = {
      facing_pages: formData.get('facing_pages') === 'true',
      first_cover: formData.get('first_cover') === 'true',
      pages: formData.get('pages') || 'all',
      starting_number: parseInt(formData.get('starting_number') as string) || 1,
      vertical_position: formData.get('vertical_position') || 'bottom',
      horizontal_position: formData.get('horizontal_position') || 'center',
      font_family: formData.get('font_family') || 'Arial',
      font_size: parseInt(formData.get('font_size') as string) || 12,
      font_color: formData.get('font_color') || '#000000'
    };

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.pageNumbersPDF(arrayBuffer, file.name, options);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Page numbers PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to add page numbers' }, 500);
  }
});

/**
 * POST /api/pdf/split
 * Split PDF into multiple files
 */
app.post('/api/pdf/split', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    
    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const options: Record<string, any> = {
      split_mode: formData.get('split_mode') || 'ranges',
      ranges: formData.get('ranges') || '1',
      fixed_range: parseInt(formData.get('fixed_range') as string) || 1,
      remove_pages: formData.get('remove_pages') || '',
      merge_after: formData.get('merge_after') === 'true'
    };

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.splitPDF(arrayBuffer, file.name, options);

    // Result will be a ZIP file if multiple outputs
    const contentType = result.filename.endsWith('.zip') ? 'application/zip' : 'application/pdf';
    
    return new Response(result.data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Split PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to split PDF' }, 500);
  }
});

/**
 * POST /api/pdf/repair
 * Repair corrupted PDF
 */
app.post('/api/pdf/repair', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'PDF API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    
    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.repairPDF(arrayBuffer, file.name);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Repair PDF error:', err);
    return c.json({ success: false, message: err.message || 'Failed to repair PDF' }, 500);
  }
});

/**
 * GET /api/pdf/status
 * Check if PDF API is configured and available
 */
app.get('/api/pdf/status', async (c) => {
  const publicKeySet = !!c.env.ILOVEAPI_PUBLIC_KEY;
  const secretKeySet = !!c.env.ILOVEAPI_SECRET_KEY;
  const publicKeyLength = c.env.ILOVEAPI_PUBLIC_KEY?.length || 0;
  const secretKeyLength = c.env.ILOVEAPI_SECRET_KEY?.length || 0;
  
  const service = getILoveAPIService(c.env);
  return c.json({
    success: true,
    available: service !== null,
    message: service ? 'PDF API is configured' : 'PDF API not configured',
    debug: {
      publicKeySet,
      secretKeySet,
      publicKeyLength,
      secretKeyLength
    }
  });
});

// ============================================
// iLoveIMG API Endpoints
// ============================================

/**
 * POST /api/image/compress
 * Compress image file
 */
app.post('/api/image/compress', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.compressImage(arrayBuffer, file.name);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Original-Size': String(result.originalSize),
        'X-Output-Size': String(result.outputSize),
        'Access-Control-Expose-Headers': 'X-Original-Size, X-Output-Size'
      }
    });
  } catch (err: any) {
    console.error('Compress image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to compress image' }, 500);
  }
});

/**
 * POST /api/image/resize
 * Resize image
 */
app.post('/api/image/resize', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const width = parseInt(formData.get('width') as string) || undefined;
    const height = parseInt(formData.get('height') as string) || undefined;
    const percentage = parseInt(formData.get('percentage') as string) || undefined;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.resizeImage(arrayBuffer, file.name, {
      resize_mode: percentage ? 'percentage' : 'pixels',
      pixels_width: width,
      pixels_height: height,
      percentage,
      maintain_ratio: true
    });

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Resize image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to resize image' }, 500);
  }
});

/**
 * POST /api/image/crop
 * Crop image
 */
app.post('/api/image/crop', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const x = parseInt(formData.get('x') as string) || 0;
    const y = parseInt(formData.get('y') as string) || 0;
    const width = parseInt(formData.get('width') as string);
    const height = parseInt(formData.get('height') as string);

    if (!file || !width || !height) {
      return c.json({ success: false, message: 'File, width and height required' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.cropImage(arrayBuffer, file.name, { x, y, width, height });

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Crop image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to crop image' }, 500);
  }
});

/**
 * POST /api/image/convert
 * Convert image format
 */
app.post('/api/image/convert', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const format = (formData.get('format') as string) || 'jpg';

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.convertImage(arrayBuffer, file.name, { 
      to: format as 'jpg' | 'png' | 'gif' | 'webp' 
    });

    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp'
    };

    return new Response(result.data, {
      headers: {
        'Content-Type': mimeTypes[format] || 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Convert image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to convert image' }, 500);
  }
});

/**
 * POST /api/image/rotate
 * Rotate image
 */
app.post('/api/image/rotate', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const rotation = parseInt(formData.get('rotation') as string) || 90;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.rotateImage(arrayBuffer, file.name, { 
      rotation: rotation as 0 | 90 | 180 | 270 
    });

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Rotate image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to rotate image' }, 500);
  }
});

/**
 * POST /api/image/watermark
 * Add watermark to image
 */
app.post('/api/image/watermark', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const text = formData.get('text') as string;

    if (!file || !text) {
      return c.json({ success: false, message: 'File and text required' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.watermarkImage(arrayBuffer, file.name, {
      mode: 'text',
      text,
      font_size: parseInt(formData.get('font_size') as string) || 48,
      font_color: (formData.get('font_color') as string) || '#000000',
      transparency: parseInt(formData.get('transparency') as string) || 50,
      vertical_position: (formData.get('vertical_position') as any) || 'middle',
      horizontal_position: (formData.get('horizontal_position') as any) || 'center'
    });

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Watermark image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to add watermark' }, 500);
  }
});

/**
 * POST /api/image/upscale
 * Upscale/enhance image
 */
app.post('/api/image/upscale', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const scale = parseInt(formData.get('scale') as string) || 2;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.upscaleImage(arrayBuffer, file.name, { 
      scale: scale as 2 | 4 
    });

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Original-Size': String(result.originalSize),
        'X-Output-Size': String(result.outputSize),
        'Access-Control-Expose-Headers': 'X-Original-Size, X-Output-Size'
      }
    });
  } catch (err: any) {
    console.error('Upscale image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to upscale image' }, 500);
  }
});

/**
 * POST /api/image/removebg
 * Remove background from image
 */
app.post('/api/image/removebg', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.removeBackground(arrayBuffer, file.name);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Remove background error:', err);
    return c.json({ success: false, message: err.message || 'Failed to remove background' }, 500);
  }
});

/**
 * POST /api/image/blurface
 * Blur faces in image
 */
app.post('/api/image/blurface', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;
    const blurPower = parseInt(formData.get('blur_power') as string) || 50;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.blurFace(arrayBuffer, file.name, { blur_power: blurPower });

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Blur face error:', err);
    return c.json({ success: false, message: err.message || 'Failed to blur faces' }, 500);
  }
});

/**
 * POST /api/image/repair
 * Repair damaged image
 */
app.post('/api/image/repair', async (c) => {
  try {
    const service = getILoveAPIService(c.env);
    if (!service) {
      return c.json({ success: false, message: 'Image API not configured' }, 503);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as UploadedFile | null;

    if (!file) {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await service.repairImage(arrayBuffer, file.name);

    return new Response(result.data, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${result.filename}"`
      }
    });
  } catch (err: any) {
    console.error('Repair image error:', err);
    return c.json({ success: false, message: err.message || 'Failed to repair image' }, 500);
  }
});

// ============================================================
// 🔐 SECURE PASSWORD VAULT API (Zero-Knowledge Architecture)
// Server ONLY stores encrypted data - CANNOT decrypt without user's master password
// ============================================================

/**
 * GET /api/vault
 * Get user's encrypted vault data
 */
app.get('/api/vault', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const vault = await c.env.DB.prepare(
      'SELECT encrypted_data, iv, salt, created_at, updated_at FROM password_vault WHERE user_id = ?'
    ).bind(payload.userId).first<{ encrypted_data: string; iv: string; salt: string; created_at: number; updated_at: number }>();

    if (!vault) {
      return c.json({ success: true, hasVault: false });
    }

    return c.json({
      success: true,
      hasVault: true,
      encryptedData: vault.encrypted_data,
      iv: vault.iv,
      salt: vault.salt,
      createdAt: vault.created_at,
      updatedAt: vault.updated_at
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/vault/setup
 * Initialize a new vault with encrypted data
 */
app.post('/api/vault/setup', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const existing = await c.env.DB.prepare('SELECT id FROM password_vault WHERE user_id = ?').bind(payload.userId).first();
    if (existing) return c.json({ success: false, message: 'Vault already exists' }, 409);

    const body = await c.req.json() as { encryptedData: string; iv: string; salt: string; authKeyHash: string };
    const { encryptedData, iv, salt, authKeyHash } = body;

    if (!encryptedData || !iv || !salt || !authKeyHash) {
      return c.json({ success: false, message: 'Missing required fields' }, 400);
    }

    const vaultId = generateId();
    const now = Date.now();

    await c.env.DB.prepare(
      'INSERT INTO password_vault (id, user_id, encrypted_data, iv, salt, vault_key_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(vaultId, payload.userId, encryptedData, iv, salt, authKeyHash, now, now).run();

    return c.json({ success: true, message: 'Vault created', vaultId });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/vault
 * Update encrypted vault data
 */
app.put('/api/vault', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as { encryptedData: string; iv: string; authKeyHash: string };
    const { encryptedData, iv, authKeyHash } = body;

    if (!encryptedData || !iv || !authKeyHash) {
      return c.json({ success: false, message: 'Missing required fields' }, 400);
    }

    const vault = await c.env.DB.prepare('SELECT vault_key_hash FROM password_vault WHERE user_id = ?')
      .bind(payload.userId).first<{ vault_key_hash: string }>();

    if (!vault) return c.json({ success: false, message: 'Vault not found' }, 404);
    if (vault.vault_key_hash !== authKeyHash) return c.json({ success: false, message: 'Invalid master password' }, 403);

    const now = Date.now();
    await c.env.DB.prepare('UPDATE password_vault SET encrypted_data = ?, iv = ?, updated_at = ? WHERE user_id = ?')
      .bind(encryptedData, iv, now, payload.userId).run();

    return c.json({ success: true, message: 'Vault updated', updatedAt: now });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/vault/verify
 * Verify master password
 */
app.post('/api/vault/verify', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as { authKeyHash: string };
    if (!body.authKeyHash) return c.json({ success: false, message: 'Auth key required' }, 400);

    const vault = await c.env.DB.prepare('SELECT vault_key_hash FROM password_vault WHERE user_id = ?')
      .bind(payload.userId).first<{ vault_key_hash: string }>();

    if (!vault) return c.json({ success: false, message: 'Vault not found' }, 404);

    return c.json({ success: true, verified: vault.vault_key_hash === body.authKeyHash });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/vault/change-password
 * Change master password with re-encryption
 */
app.post('/api/vault/change-password', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as {
      oldAuthKeyHash: string; newEncryptedData: string; newIv: string; newSalt: string; newAuthKeyHash: string;
    };

    const vault = await c.env.DB.prepare('SELECT vault_key_hash FROM password_vault WHERE user_id = ?')
      .bind(payload.userId).first<{ vault_key_hash: string }>();

    if (!vault) return c.json({ success: false, message: 'Vault not found' }, 404);
    if (vault.vault_key_hash !== body.oldAuthKeyHash) return c.json({ success: false, message: 'Invalid current password' }, 403);

    const now = Date.now();
    await c.env.DB.prepare(
      'UPDATE password_vault SET encrypted_data = ?, iv = ?, salt = ?, vault_key_hash = ?, updated_at = ? WHERE user_id = ?'
    ).bind(body.newEncryptedData, body.newIv, body.newSalt, body.newAuthKeyHash, now, payload.userId).run();

    return c.json({ success: true, message: 'Password changed', updatedAt: now });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/vault
 * Permanently delete vault
 */
app.delete('/api/vault', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as { authKeyHash: string; confirmDelete: boolean };
    if (!body.confirmDelete) return c.json({ success: false, message: 'Deletion not confirmed' }, 400);

    const vault = await c.env.DB.prepare('SELECT vault_key_hash FROM password_vault WHERE user_id = ?')
      .bind(payload.userId).first<{ vault_key_hash: string }>();

    if (!vault) return c.json({ success: false, message: 'Vault not found' }, 404);
    if (vault.vault_key_hash !== body.authKeyHash) return c.json({ success: false, message: 'Invalid password' }, 403);

    await c.env.DB.prepare('DELETE FROM password_vault WHERE user_id = ?').bind(payload.userId).run();

    return c.json({ success: true, message: 'Vault deleted permanently' });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

// ==================== SECONDARY PASSWORD ENDPOINTS ====================

/**
 * GET /api/vault/secondary-password
 * Check if secondary password is set
 */
app.get('/api/vault/secondary-password', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const vault = await c.env.DB.prepare(
      'SELECT secondary_password_hash FROM password_vault WHERE user_id = ?'
    ).bind(payload.userId).first<{ secondary_password_hash: string | null }>();

    return c.json({ 
      success: true, 
      hasSecondaryPassword: !!(vault?.secondary_password_hash) 
    });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * POST /api/vault/secondary-password
 * Setup secondary password
 */
app.post('/api/vault/secondary-password', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as { hash: string; salt: string };
    if (!body.hash || !body.salt) {
      return c.json({ success: false, message: 'Hash and salt required' }, 400);
    }

    await c.env.DB.prepare(
      'UPDATE password_vault SET secondary_password_hash = ?, secondary_password_salt = ? WHERE user_id = ?'
    ).bind(body.hash, body.salt, payload.userId).run();

    return c.json({ success: true, message: 'Secondary password set' });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * PUT /api/vault/secondary-password
 * Update/verify secondary password (returns salt for verification)
 */
app.put('/api/vault/secondary-password', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as { 
      action: 'verify' | 'change';
      currentHash?: string;
      newHash?: string;
      newSalt?: string;
    };

    const vault = await c.env.DB.prepare(
      'SELECT secondary_password_hash, secondary_password_salt FROM password_vault WHERE user_id = ?'
    ).bind(payload.userId).first<{ secondary_password_hash: string | null; secondary_password_salt: string | null }>();

    if (!vault) return c.json({ success: false, message: 'Vault not found' }, 404);

    if (body.action === 'verify') {
      // Return salt for client to compute hash
      if (!vault.secondary_password_salt) {
        return c.json({ success: false, message: 'No secondary password set' }, 400);
      }
      return c.json({ 
        success: true, 
        salt: vault.secondary_password_salt,
        storedHash: vault.secondary_password_hash 
      });
    }

    if (body.action === 'change') {
      // Verify old password first
      if (vault.secondary_password_hash && vault.secondary_password_hash !== body.currentHash) {
        return c.json({ success: false, message: 'Current password incorrect' }, 403);
      }

      if (!body.newHash || !body.newSalt) {
        return c.json({ success: false, message: 'New hash and salt required' }, 400);
      }

      await c.env.DB.prepare(
        'UPDATE password_vault SET secondary_password_hash = ?, secondary_password_salt = ? WHERE user_id = ?'
      ).bind(body.newHash, body.newSalt, payload.userId).run();

      return c.json({ success: true, message: 'Secondary password updated' });
    }

    return c.json({ success: false, message: 'Invalid action' }, 400);
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

/**
 * DELETE /api/vault/secondary-password
 * Remove secondary password
 */
app.delete('/api/vault/secondary-password', async (c) => {
  try {
    const token = extractToken(c.req.raw);
    if (!token) return c.json({ success: false, message: 'Unauthorized' }, 401);

    const jwtSecret = getJwtSecret(c.env);
    const payload = await verifyJWT(token, jwtSecret);
    if (!payload?.userId) return c.json({ success: false, message: 'Invalid token' }, 401);

    const body = await c.req.json() as { confirmHash: string };

    const vault = await c.env.DB.prepare(
      'SELECT secondary_password_hash FROM password_vault WHERE user_id = ?'
    ).bind(payload.userId).first<{ secondary_password_hash: string | null }>();

    if (!vault?.secondary_password_hash) {
      return c.json({ success: false, message: 'No secondary password set' }, 400);
    }

    if (vault.secondary_password_hash !== body.confirmHash) {
      return c.json({ success: false, message: 'Password incorrect' }, 403);
    }

    await c.env.DB.prepare(
      'UPDATE password_vault SET secondary_password_hash = NULL, secondary_password_salt = NULL WHERE user_id = ?'
    ).bind(payload.userId).run();

    return c.json({ success: true, message: 'Secondary password removed' });
  } catch (err: any) {
    return c.json({ success: false, message: err.message }, 500);
  }
});

export default {
  fetch: app.fetch,
  email: handleEmail,
  scheduled: handleScheduled,
};                                                                                                                                                                                                                                                                                                                                                                                                          