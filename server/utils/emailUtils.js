const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

exports.sendAccountActivationEmail = async (email, tokenId) => {
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Activate your account',
    html: `<p>Click <a href="${process.env.CLIENT_URL}/activate?token=${tokenId}">here</a> to activate your account. This link expires in 48 hours.</p>`
  })
}

exports.sendAccountRecoveryEmail = async (email, tokenId) => {
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Reset your password',
    html: `<p>Click <a href="${process.env.CLIENT_URL}/reset-password?token=${tokenId}">here</a> to reset your password. This link expires in 15 minutes.</p>`
  })
}

exports.sendEmailChangeVerificationEmail = async (email, tokenId) => {
  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Verify your new email',
    html: `<p>Click <a href="${process.env.CLIENT_URL}/profile/email/verify?token=${tokenId}">here</a> to confirm your new email address. This link expires in 15 minutes.</p>`
  })
}