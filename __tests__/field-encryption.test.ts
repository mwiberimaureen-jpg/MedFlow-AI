/**
 * Field-Level Encryption Unit Tests
 *
 * Verifies PII columns are encrypted at rest using AES-256-GCM.
 * Run: npx tsx --test __tests__/field-encryption.test.ts
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

// Set a test encryption key before importing the module
process.env.FIELD_ENCRYPTION_KEY = require('crypto').randomBytes(32).toString('hex')

import {
  encryptField,
  decryptField,
  isEncrypted,
  encryptPatientPII,
  decryptPatientPII,
  decryptPatientList,
} from '../lib/crypto/field-encryption'

describe('encryptField()', () => {
  it('encrypts a string and returns enc: prefixed ciphertext', () => {
    const result = encryptField('Jane Doe')
    assert.ok(result.startsWith('enc:'), 'Should start with "enc:" prefix')
    assert.ok(!result.includes('Jane Doe'), 'Should NOT contain plaintext')
  })

  it('produces different ciphertext each time (random IV)', () => {
    const a = encryptField('Jane Doe')
    const b = encryptField('Jane Doe')
    assert.notStrictEqual(a, b, 'Two encryptions of the same value should differ')
  })

  it('returns empty string for empty input', () => {
    assert.strictEqual(encryptField(''), '')
  })
})

describe('decryptField()', () => {
  it('round-trips: encrypt then decrypt returns original', () => {
    const original = 'Jane Wanjiku Muthoni'
    const encrypted = encryptField(original)
    const decrypted = decryptField(encrypted)
    assert.strictEqual(decrypted, original)
  })

  it('returns plain text as-is (backwards compatible)', () => {
    const plain = 'John Smith'
    assert.strictEqual(decryptField(plain), plain)
  })

  it('handles special characters and unicode', () => {
    const original = "O'Brien-Smith (KNH/2024/001) - temp 38.5\u00B0C"
    const encrypted = encryptField(original)
    const decrypted = decryptField(encrypted)
    assert.strictEqual(decrypted, original)
  })

  it('handles long text (patient identifiers)', () => {
    const original = 'KNH-OUTPATIENT-2024-00451-INTERNAL-MEDICINE'
    const encrypted = encryptField(original)
    const decrypted = decryptField(encrypted)
    assert.strictEqual(decrypted, original)
  })
})

describe('isEncrypted()', () => {
  it('returns true for encrypted values', () => {
    const encrypted = encryptField('test')
    assert.ok(isEncrypted(encrypted))
  })

  it('returns false for plain text', () => {
    assert.ok(!isEncrypted('Jane Doe'))
  })

  it('returns false for null/undefined', () => {
    assert.ok(!isEncrypted(null as any))
    assert.ok(!isEncrypted(undefined as any))
  })
})

describe('encryptPatientPII()', () => {
  it('encrypts patient_name and patient_identifier', () => {
    const record = { patient_name: 'Jane Doe', patient_identifier: 'KNH-001', history_text: 'Some clinical history' }
    const encrypted = encryptPatientPII(record)

    assert.ok(isEncrypted(encrypted.patient_name), 'patient_name should be encrypted')
    assert.ok(isEncrypted(encrypted.patient_identifier), 'patient_identifier should be encrypted')
    assert.strictEqual(encrypted.history_text, 'Some clinical history', 'history_text should NOT be encrypted')
  })
})

describe('decryptPatientPII()', () => {
  it('decrypts patient_name and patient_identifier', () => {
    const original = { patient_name: 'Jane Doe', patient_identifier: 'KNH-001', patient_age: 28 }
    const encrypted = encryptPatientPII(original)
    const decrypted = decryptPatientPII(encrypted)

    assert.strictEqual(decrypted.patient_name, 'Jane Doe')
    assert.strictEqual(decrypted.patient_identifier, 'KNH-001')
    assert.strictEqual(decrypted.patient_age, 28, 'Non-PII fields should be unchanged')
  })

  it('handles records with no identifier', () => {
    const original = { patient_name: 'Jane Doe', patient_identifier: null }
    const encrypted = encryptPatientPII(original)
    const decrypted = decryptPatientPII(encrypted)

    assert.strictEqual(decrypted.patient_name, 'Jane Doe')
    assert.strictEqual(decrypted.patient_identifier, null)
  })
})

describe('decryptPatientList()', () => {
  it('decrypts an array of patient records', () => {
    const records = [
      encryptPatientPII({ patient_name: 'Jane Doe', patient_identifier: 'A1' }),
      encryptPatientPII({ patient_name: 'John Smith', patient_identifier: 'B2' }),
    ]

    const decrypted = decryptPatientList(records)

    assert.strictEqual(decrypted[0].patient_name, 'Jane Doe')
    assert.strictEqual(decrypted[1].patient_name, 'John Smith')
    assert.strictEqual(decrypted[0].patient_identifier, 'A1')
    assert.strictEqual(decrypted[1].patient_identifier, 'B2')
  })
})
