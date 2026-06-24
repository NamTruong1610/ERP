const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'RESEND_API_KEY',
  'CLIENT_URL'
]

exports.validateEnv = () => {
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}