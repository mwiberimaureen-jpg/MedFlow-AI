/**
 * PHI De-identification Unit Tests
 *
 * Permanent, repeatable proof that patient-identifying information
 * is masked before reaching any third-party API.
 *
 * Run: npx tsx --test __tests__/phi-anonymizer.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { anonymize, deAnonymize, deAnonymizeResponse } from '../lib/phi/anonymizer'

describe('anonymize()', () => {
  it('replaces patient full name with "Patient A"', () => {
    const text = 'Jane Doe is a 32-year-old female admitted with fever for 3 days.'
    const result = anonymize(text, { patientName: 'Jane Doe' })

    assert.ok(result.masked.includes('Patient A'), 'Should contain "Patient A"')
    assert.ok(!result.masked.includes('Jane Doe'), 'Should NOT contain "Jane Doe"')
    assert.ok(!result.masked.includes('Jane'), 'Should NOT contain first name "Jane"')
    assert.ok(!result.masked.includes('Doe'), 'Should NOT contain last name "Doe"')
  })

  it('replaces name fragments (first, middle, last) independently', () => {
    const text = 'Lydia Wanjiku Muthoni presented with abdominal pain. Lydia reports onset 2 days ago. Mrs Muthoni is a known diabetic.'
    const result = anonymize(text, { patientName: 'Lydia Wanjiku Muthoni' })

    assert.ok(!result.masked.includes('Lydia'), 'Should NOT contain "Lydia"')
    assert.ok(!result.masked.includes('Wanjiku'), 'Should NOT contain "Wanjiku"')
    assert.ok(!result.masked.includes('Muthoni'), 'Should NOT contain "Muthoni"')
    assert.ok(result.masked.includes('Patient A'), 'Should contain "Patient A"')
  })

  it('replaces patient identifier with "[ID-REDACTED]"', () => {
    const text = 'Patient MRN: KNH-2024-0451. Jane Doe admitted on 15/04/2026.'
    const result = anonymize(text, {
      patientName: 'Jane Doe',
      patientIdentifier: 'KNH-2024-0451'
    })

    assert.ok(!result.masked.includes('KNH-2024-0451'), 'Should NOT contain identifier')
    assert.ok(result.masked.includes('[ID-REDACTED]'), 'Should contain "[ID-REDACTED]"')
    assert.ok(!result.masked.includes('Jane Doe'), 'Should NOT contain name')
  })

  it('is case-insensitive', () => {
    const text = 'JANE DOE was seen today. jane doe complains of headache.'
    const result = anonymize(text, { patientName: 'Jane Doe' })

    assert.ok(!result.masked.toLowerCase().includes('jane doe'), 'Should mask all case variants')
  })

  it('preserves clinical content (age, vitals, drugs, dates)', () => {
    const text = 'Jane Doe, 28y female. BP 130/80, Temp 38.5°C. Started on IV ceftriaxone 1g BD. LMP: 01/03/2026.'
    const result = anonymize(text, { patientName: 'Jane Doe' })

    assert.ok(result.masked.includes('28y'), 'Should preserve age')
    assert.ok(result.masked.includes('130/80'), 'Should preserve BP')
    assert.ok(result.masked.includes('38.5'), 'Should preserve temperature')
    assert.ok(result.masked.includes('ceftriaxone'), 'Should preserve drug name')
    assert.ok(result.masked.includes('01/03/2026'), 'Should preserve date')
  })

  it('handles null/undefined identifier gracefully', () => {
    const text = 'Jane Doe presented with cough.'
    const result = anonymize(text, { patientName: 'Jane Doe', patientIdentifier: null })

    assert.ok(!result.masked.includes('Jane Doe'), 'Should still mask name')
    assert.ok(result.masked.includes('Patient A'), 'Should contain "Patient A"')
  })

  it('returns a tokenMap for later restoration', () => {
    const result = anonymize('Jane Doe has fever.', { patientName: 'Jane Doe' })

    assert.ok(result.tokenMap.size > 0, 'tokenMap should not be empty')
    assert.ok(result.tokenMap.has('Jane Doe'), 'tokenMap should contain full name')
  })
})

describe('deAnonymize()', () => {
  it('restores the original name from masked text', () => {
    const original = 'Jane Doe presented with fever for 3 days.'
    const { masked, tokenMap } = anonymize(original, { patientName: 'Jane Doe' })

    const restored = deAnonymize(masked, tokenMap)

    assert.ok(restored.includes('Jane Doe'), 'Should restore "Jane Doe"')
    assert.ok(!restored.includes('Patient A'), 'Should NOT contain "Patient A" after restoration')
  })

  it('restores identifier from masked text', () => {
    const original = 'MRN: KNH-2024-0451. Jane Doe admitted.'
    const { masked, tokenMap } = anonymize(original, {
      patientName: 'Jane Doe',
      patientIdentifier: 'KNH-2024-0451'
    })

    const restored = deAnonymize(masked, tokenMap)

    assert.ok(restored.includes('KNH-2024-0451'), 'Should restore identifier')
    assert.ok(restored.includes('Jane Doe'), 'Should restore name')
  })
})

describe('deAnonymizeResponse()', () => {
  it('restores PHI in a nested object (simulates AI response)', () => {
    const { tokenMap } = anonymize('Jane Doe has fever.', {
      patientName: 'Jane Doe',
      patientIdentifier: 'KNH-001'
    })

    const aiResponse = {
      summary: 'Patient A is a 32-year-old with fever. [ID-REDACTED] was reviewed.',
      impressions: ['Patient A likely has malaria'],
      management_plan: {
        current_plan_analysis: 'Patient A started on antimalarials'
      }
    }

    const restored = deAnonymizeResponse(aiResponse, tokenMap)

    assert.ok(restored.summary.includes('Jane Doe'), 'Summary should contain real name')
    assert.ok(!restored.summary.includes('Patient A'), 'Summary should NOT contain "Patient A"')
    assert.ok(restored.summary.includes('KNH-001'), 'Summary should contain real identifier')
    assert.ok(restored.impressions[0].includes('Jane Doe'), 'Impressions should contain real name')
    assert.ok(restored.management_plan.current_plan_analysis.includes('Jane Doe'), 'Plan should contain real name')
  })

  it('returns original object if tokenMap is empty', () => {
    const obj = { summary: 'Patient A has fever.' }
    const result = deAnonymizeResponse(obj, new Map())

    assert.deepStrictEqual(result, obj, 'Should return unchanged object')
  })
})
