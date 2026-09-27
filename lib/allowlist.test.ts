// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isAllowedEmail } from './allowlist'

describe('isAllowedEmail', () => {
  const original = process.env.ALLOWED_EMAILS

  beforeEach(() => {
    process.env.ALLOWED_EMAILS = ''
  })
  afterEach(() => {
    process.env.ALLOWED_EMAILS = original
  })

  it('allows an email present in ALLOWED_EMAILS', () => {
    process.env.ALLOWED_EMAILS = 'a@example.com,b@example.com'
    expect(isAllowedEmail('a@example.com')).toBe(true)
  })

  it('rejects an email not in the list', () => {
    process.env.ALLOWED_EMAILS = 'a@example.com'
    expect(isAllowedEmail('stranger@example.com')).toBe(false)
  })

  it('is case-insensitive', () => {
    process.env.ALLOWED_EMAILS = 'a@example.com'
    expect(isAllowedEmail('A@EXAMPLE.com')).toBe(true)
  })

  it('ignores whitespace around entries', () => {
    process.env.ALLOWED_EMAILS = ' a@example.com , b@example.com '
    expect(isAllowedEmail('b@example.com')).toBe(true)
  })

  it('rejects everyone when the list is empty', () => {
    process.env.ALLOWED_EMAILS = ''
    expect(isAllowedEmail('a@example.com')).toBe(false)
  })

  it('rejects everyone when ALLOWED_EMAILS is unset', () => {
    delete process.env.ALLOWED_EMAILS
    expect(isAllowedEmail('a@example.com')).toBe(false)
  })

  it.each([undefined, null, ''])('rejects a falsy email (%p)', (email) => {
    process.env.ALLOWED_EMAILS = 'a@example.com'
    expect(isAllowedEmail(email)).toBe(false)
  })
})
