import * as bcrypt from "bcryptjs"

const SALT_ROUNDS = 10

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Check if a string looks like a bcrypt hash
 * Used for backwards compatibility with plaintext passwords
 */
export function isBcryptHash(str: string): boolean {
  return str.startsWith("$2a$") || str.startsWith("$2b$") || str.startsWith("$2y$")
}
