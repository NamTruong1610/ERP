const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'RESEND_API_KEY',
  'CLIENT_URL',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'CLINIC_TIMEZONE',
  'STRIPE_SECRET_KEY'
]

exports.validateEnv = () => {
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}