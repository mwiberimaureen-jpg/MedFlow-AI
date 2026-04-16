/**
 * Field-Level Encryption for PII columns
 *
 * Encrypts patient_name and patient_identifier at the application layer
 * using AES-256-GCM before storing in Supabase. The encryption key never
 * reaches the database — even with full DB access, data is unreadable.
 *
 * HIPAA: 45 CFR 164.312(a)(2)(iv) — Encryption and decryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12       // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const ENCRYPTED_PREFIX = 'enc:' // Marker to distinguish encrypted from plain text

/**
 * Get the 32-byte encryption key from environment.
 * Throws if not configured — fields will be stored in plain text.
 */
function getKey(): Buffer | null {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY
  if (!keyHex) return null
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    console.error('[ENCRYPTION] FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    return null
  }
  return key
}

/**
 * Encrypt a plaintext string.
 * Returns "enc:<iv>:<authTag>:<ciphertext>" (all base64).
 * Returns the original string if encryption key is not configured.
 */
export function encryptField(plaintext: string): string {
  if (!plaintext) return plaintext
  const key = getKey()
  if (!key) return plaintext // Graceful fallback: store plain if no key

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * Decrypt an encrypted string.
 * If the string doesn't start with "enc:", returns it as-is (plain text / legacy data).
 */
export function decryptField(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext // Plain text, not encrypted

  const key = getKey()
  if (!key) {
    console.error('[ENCRYPTION] Cannot decrypt: FIELD_ENCRYPTION_KEY not configured')
    return '[ENCRYPTED]' // Don't return raw ciphertext
  }

  try {
    const parts = ciphertext.slice(ENCRYPTED_PREFIX.length).split(':')
    if (parts.length !== 3) return '[ENCRYPTED]'

    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const encrypted = Buffer.from(parts[2], 'base64')

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('[ENCRYPTION] Decryption failed:', error)
    return '[ENCRYPTED]'
  }
}

/**
 * Check if a value is encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value?.startsWith(ENCRYPTED_PREFIX) || false
}

/**
 * Encrypt PII fields on a patient record before database insert/update.
 */
export function encryptPatientPII(record: Record<string, any>): Record<string, any> {
  const result = { ...record }
  if (result.patient_name) result.patient_name = encryptField(result.patient_name)
  if (result.patient_identifier) result.patient_identifier = encryptField(result.patient_identifier)
  return result
}

/**
 * Decrypt PII fields on a patient record after database read.
 */
export function decryptPatientPII<T extends Record<string, any>>(record: T): T {
  if (!record) return record
  const result = { ...record } as Record<string, any>
  if (result.patient_name) result.patient_name = decryptField(result.patient_name)
  if (result.patient_identifier) result.patient_identifier = decryptField(result.patient_identifier)
  return result as T
}

/**
 * Decrypt PII fields on an array of patient records.
 */
export function decryptPatientList<T extends Record<string, any>>(records: T[]): T[] {
  return records.map(r => decryptPatientPII(r))
}
