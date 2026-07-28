import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64
const ALGORITHM = 'scrypt:v1'

export async function hashPasswordForBridge(password: string) {
  const salt = randomBytes(16).toString('base64url')
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer

  return {
    algorithm: ALGORITHM,
    passwordHash: key.toString('base64url'),
    passwordSalt: salt,
  }
}

export async function verifyBridgePassword(password: string, passwordHash: string, passwordSalt: string) {
  const expected = Buffer.from(passwordHash, 'base64url')
  const actual = (await scrypt(password, passwordSalt, expected.length)) as Buffer

  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
