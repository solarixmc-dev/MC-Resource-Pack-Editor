/**
 * Cryptographic utilities for secure password hashing
 * Uses Web Crypto API for client-side hashing (SHA-256)
 * 
 * NOTE: This is for client-side demo purposes only.
 * In production, password hashing should be done on the server
 * using bcrypt, argon2, or similar secure algorithms.
 */

/**
 * Hash a password using SHA-256 with salt
 * @param password - Plain text password
 * @param salt - Optional salt (generated if not provided)
 * @returns Promise containing hashed password and salt
 */
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  // Generate salt if not provided
  const saltValue = salt || await generateSalt();
  
  // Combine password with salt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltValue);
  
  // Hash using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { hash: hashHex, salt: saltValue };
}

/**
 * Verify a password against a stored hash
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash to compare against
 * @param salt - Salt used when hashing
 * @returns Promise indicating if password matches
 */
export async function verifyPassword(password: string, storedHash: string, salt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Generate a random salt for password hashing
 * @returns Promise containing random salt string
 */
async function generateSalt(): Promise<string> {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

