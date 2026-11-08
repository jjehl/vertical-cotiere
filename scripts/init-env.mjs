import { randomBytes } from 'node:crypto'
import { writeFileSync, readFileSync, appendFileSync, chmodSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const secret = () => randomBytes(32).toString('hex')
const values = {
  S3_PORT: '8333', S3_ACCESS_KEY_ID: secret(), S3_SECRET_ACCESS_KEY: secret(),
  WEB_PORT: '3000', CMS_PORT: '1337', DATABASE_PASSWORD: secret(),
  APP_KEYS: `${secret()},${secret()}`, ADMIN_JWT_SECRET: secret(),
  API_TOKEN_SALT: secret(), TRANSFER_TOKEN_SALT: secret(), ENCRYPTION_KEY: secret(), JWT_SECRET: secret(),
  MISTRAL_API_KEY: '', MISTRAL_MODEL: 'ministral-8b-2512',
}
const envPath = fileURLToPath(new URL('../.env', import.meta.url))
try {
  writeFileSync(envPath, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 })
  console.log('.env local créé. Les secrets ne sont pas affichés et ne doivent pas être commités.')
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  const existing = readFileSync(envPath, 'utf8')
  const missing = ['MISTRAL_API_KEY', 'MISTRAL_MODEL', 'S3_PORT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter(key => !new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`, 'm').test(existing))
  if (missing.length) appendFileSync(envPath, '\n# Paramètres locaux manquants\n' + missing.map(key => `${key}=${values[key]}`).join('\n') + '\n')
  chmodSync(envPath, 0o600)
  console.log('.env conservé ; paramètres locaux manquants ajoutés sans modifier les secrets existants.')
}
