import crypto from 'crypto';

/**
 * AES-256-GCM Encryption Utility
 * 
 * Provides secure encryption/decryption for sensitive financial data.
 * Uses per-user derived keys for additional security.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const MAX_DETAIL_SIZE = 5120; // 5KB limit for event details

/**
 * Get the master encryption key from environment
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!masterKeyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }

  if (masterKeyHex.length !== 64) { // 32 bytes = 64 hex chars
    throw new Error('ENCRYPTION_MASTER_KEY must be a 32-byte hex string (64 characters)');
  }

  return Buffer.from(masterKeyHex, 'hex');
}

/**
 * Derive a user-specific encryption key from master key and user ID
 * Uses HKDF (HMAC-based Key Derivation Function)
 */
function deriveUserKey(userId: string): Buffer {
  const masterKey = getMasterKey();
  const salt = Buffer.from(`adphex-user-${userId}`, 'utf8');
  
  // Use HKDF to derive a user-specific key
  return crypto.hkdfSync('sha256', masterKey, salt, Buffer.from('encryption-key', 'utf8'), KEY_LENGTH);
}

/**
 * Encrypt a string value for a specific user
 * 
 * @param plaintext - The data to encrypt
 * @param userId - User ID to derive encryption key
 * @returns Base64-encoded encrypted data with IV and auth tag
 */
export function encryptField(plaintext: string, userId: string): string {
  if (!plaintext) return '';
  
  try {
    const key = deriveUserKey(userId);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData (all base64)
    const result = Buffer.concat([iv, authTag, encrypted]).toString('base64');
    
    return result;
  } catch (error) {
    console.error('[encryption] Failed to encrypt field:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt an encrypted string value for a specific user
 * 
 * @param encryptedData - Base64-encoded encrypted data with IV and auth tag
 * @param userId - User ID to derive decryption key
 * @returns Decrypted plaintext string
 */
export function decryptField(encryptedData: string, userId: string): string {
  if (!encryptedData) return '';
  
  try {
    const key = deriveUserKey(userId);
    const buffer = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('[encryption] Failed to decrypt field:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * Encrypt a number (converts to string first)
 */
export function encryptNumber(value: number | null | undefined, userId: string): string | null {
  if (value === null || value === undefined) return null;
  return encryptField(value.toString(), userId);
}

/**
 * Decrypt a number (converts from string)
 */
export function decryptNumber(encryptedData: string | null | undefined, userId: string): number | null {
  if (!encryptedData) return null;
  const decrypted = decryptField(encryptedData, userId);
  return decrypted ? parseFloat(decrypted) : null;
}

/**
 * Encrypt a JSON object
 * 
 * @param obj - Object to encrypt
 * @param userId - User ID to derive encryption key
 * @returns Base64-encoded encrypted JSON
 */
export function encryptJSON(obj: any, userId: string): string {
  if (!obj) return '';
  
  try {
    const jsonString = JSON.stringify(obj);
    return encryptField(jsonString, userId);
  } catch (error) {
    console.error('[encryption] Failed to encrypt JSON:', error);
    throw new Error('JSON encryption failed');
  }
}

/**
 * Decrypt a JSON object
 * 
 * @param encryptedData - Base64-encoded encrypted JSON
 * @param userId - User ID to derive decryption key
 * @returns Decrypted object
 */
export function decryptJSON(encryptedData: string, userId: string): any {
  if (!encryptedData) return null;
  
  try {
    const jsonString = decryptField(encryptedData, userId);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('[encryption] Failed to decrypt JSON:', error);
    throw new Error('JSON decryption failed');
  }
}

/**
 * Truncate large objects to prevent memory issues
 * Used for audit log event details
 */
export function truncateEventDetails(details: any): any {
  if (!details) return details;
  
  const jsonString = JSON.stringify(details);
  
  if (jsonString.length <= MAX_DETAIL_SIZE) {
    return details;
  }
  
  // Truncate and add indicator
  const truncated = jsonString.substring(0, MAX_DETAIL_SIZE);
  return {
    _truncated: true,
    _original_size: jsonString.length,
    data: truncated + '...[truncated]'
  };
}

/**
 * Validate that encryption is properly configured
 * Call this at app startup
 */
export function validateEncryptionConfig(): { valid: boolean; error?: string } {
  try {
    getMasterKey();
    
    // Test encryption/decryption
    const testUserId = 'test-user-id';
    const testData = 'test-encryption-data';
    const encrypted = encryptField(testData, testUserId);
    const decrypted = decryptField(encrypted, testUserId);
    
    if (decrypted !== testData) {
      return { valid: false, error: 'Encryption test failed: decrypted data does not match' };
    }
    
    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Generate a new encryption master key (for documentation/setup)
 * Not used in production, only for key generation
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

