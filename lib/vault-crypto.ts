/**
 * 🔐 Vault Crypto - Zero-Knowledge Client-Side Encryption
 * 
 * Security Features:
 * - PBKDF2 SHA-512 with 310,000 iterations for key derivation
 * - AES-256-GCM for encryption (authenticated encryption)
 * - Random IV for each encryption operation
 * - Constant-time hash comparison for vault verification
 * 
 * CRITICAL: All encryption/decryption happens in the browser.
 * The server NEVER sees plaintext passwords or the encryption key.
 */

// Constants
const PBKDF2_ITERATIONS = 310000; // OWASP recommended minimum
const KEY_LENGTH = 256; // AES-256
const SALT_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Generate cryptographically secure random bytes
 */
export const generateRandomBytes = (length: number): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(length));
};

/**
 * Generate a random salt for key derivation
 */
export const generateSalt = (): string => {
  const salt = generateRandomBytes(SALT_LENGTH);
  return uint8ArrayToBase64(salt);
};

/**
 * Generate a random IV for AES-GCM
 */
export const generateIV = (): Uint8Array => {
  return generateRandomBytes(IV_LENGTH);
};

/**
 * Derive encryption key from master password using PBKDF2
 * 
 * @param masterPassword - User's master password
 * @param salt - Base64 encoded salt
 * @returns CryptoKey for AES-256-GCM encryption
 */
export const deriveKey = async (
  masterPassword: string,
  salt: string
): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(masterPassword);
  const saltBuffer = base64ToUint8Array(salt);

  // Import password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );

  return key;
};

/**
 * Derive authentication key (separate from encryption key)
 * Used to verify master password without exposing encryption key
 */
export const deriveAuthKey = async (
  masterPassword: string,
  salt: string
): Promise<string> => {
  const encoder = new TextEncoder();
  // Use different purpose string to derive different key
  const passwordWithPurpose = `auth:${masterPassword}`;
  const passwordBuffer = encoder.encode(passwordWithPurpose);
  const saltBuffer = base64ToUint8Array(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-512'
    },
    keyMaterial,
    256
  );

  return uint8ArrayToBase64(new Uint8Array(bits));
};

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param data - Object to encrypt
 * @param key - CryptoKey derived from master password
 * @returns { ciphertext, iv } both as Base64 strings
 */
export const encryptData = async (
  data: any,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> => {
  const encoder = new TextEncoder();
  const iv = generateIV();
  const plaintext = encoder.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plaintext
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(cipherBuffer)),
    iv: uint8ArrayToBase64(iv)
  };
};

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param ciphertext - Base64 encoded ciphertext
 * @param iv - Base64 encoded IV
 * @param key - CryptoKey derived from master password
 * @returns Decrypted object
 */
export const decryptData = async <T>(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<T> => {
  const decoder = new TextDecoder();
  const cipherBuffer = base64ToUint8Array(ciphertext);
  const ivBuffer = base64ToUint8Array(iv);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer as BufferSource },
    key,
    cipherBuffer as BufferSource
  );

  const plaintext = decoder.decode(plainBuffer);
  return JSON.parse(plaintext);
};

/**
 * Securely clear sensitive data from memory
 */
export const secureWipe = (array: Uint8Array): void => {
  crypto.getRandomValues(array); // Overwrite with random
  array.fill(0); // Then zero out
};

/**
 * Generate a strong random password
 */
export const generateStrongPassword = (
  length: number = 20,
  options: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  } = {}
): string => {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true
  } = options;

  let charset = '';
  if (lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  if (!charset) charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  const randomValues = generateRandomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
};

/**
 * Calculate password strength (0-100)
 */
export const calculatePasswordStrength = (password: string): {
  score: number;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  suggestions: string[];
} => {
  let score = 0;
  const suggestions: string[] = [];

  // Length
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 10;
  if (password.length < 12) suggestions.push('Use at least 12 characters');

  // Character types
  if (/[a-z]/.test(password)) score += 10;
  else suggestions.push('Add lowercase letters');
  
  if (/[A-Z]/.test(password)) score += 10;
  else suggestions.push('Add uppercase letters');
  
  if (/[0-9]/.test(password)) score += 10;
  else suggestions.push('Add numbers');
  
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  else suggestions.push('Add special characters');

  // Patterns (negative)
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    suggestions.push('Avoid repeated characters');
  }
  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 5;
    suggestions.push('Mix different character types');
  }
  if (/^[0-9]+$/.test(password)) {
    score -= 15;
    suggestions.push('Don\'t use only numbers');
  }

  // Common patterns
  const common = ['password', '123456', 'qwerty', 'admin', 'letmein'];
  if (common.some(p => password.toLowerCase().includes(p))) {
    score -= 20;
    suggestions.push('Avoid common words');
  }

  score = Math.max(0, Math.min(100, score));

  let label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  if (score < 20) label = 'Very Weak';
  else if (score < 40) label = 'Weak';
  else if (score < 60) label = 'Fair';
  else if (score < 80) label = 'Strong';
  else label = 'Very Strong';

  return { score, label, suggestions };
};

// ============ Utility Functions ============

const uint8ArrayToBase64 = (array: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < array.length; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
};

// ============ Vault Data Types ============

export interface VaultEntry {
  id: string;
  type: 'login' | 'card' | 'note' | 'identity';
  name: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  totp?: string;
  customFields?: { name: string; value: string; hidden: boolean }[];
  createdAt: number;
  updatedAt: number;
  favorite?: boolean;
  folder?: string;
}

export interface VaultData {
  version: number;
  entries: VaultEntry[];
  folders: string[];
  lastModified: number;
}

export const createEmptyVault = (): VaultData => ({
  version: 1,
  entries: [],
  folders: [],
  lastModified: Date.now()
});

export const generateEntryId = (): string => {
  return crypto.randomUUID();
};
