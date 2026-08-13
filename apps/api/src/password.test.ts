import { describe, expect, it } from 'vitest'
import bcrypt from 'bcryptjs'

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const hash = await bcrypt.hash('demo1234', 10)
    expect(hash).not.toBe('demo1234')
    expect(await bcrypt.compare('demo1234', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await bcrypt.hash('demo1234', 10)
    expect(await bcrypt.compare('wrong', hash)).toBe(false)
  })
})