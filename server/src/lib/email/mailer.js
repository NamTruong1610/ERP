const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DentaCore</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:24px;font-weight:700;color:#1a6bff;letter-spacing:-0.5px;">
                    &#x1F9B7; DentaCore
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:40px 36px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;font-size:12px;color:#9ca3af;line-height:1.6;">
              This email was sent by DentaCore. If you did not request this, you can safely ignore it.<br/>
              &copy; ${new Date().getFullYear()} DentaCore. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

const buttonStyle = 'display:inline-block;padding:12px 28px;background-color:#1a6bff;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;'

exports.sendAccountActivationEmail = async (email, tokenId) => {
  const url = `${process.env.CLIENT_URL}/activate?token=${tokenId}`

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Activate your DentaCore account',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome to DentaCore</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        Your account has been created. Click the button below to set up your password and two-factor authentication.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td>
            <a href="${url}" style="${buttonStyle}">Activate account</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        This link expires in <strong>48 hours</strong>. If you did not expect this email, no action is needed.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Or copy this link into your browser:<br/>
        <span style="color:#1a6bff;word-break:break-all;">${url}</span>
      </p>
    `)
  })
}

exports.sendAccountRecoveryEmail = async (email, tokenId) => {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${tokenId}`

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Reset your DentaCore password',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td>
            <a href="${url}" style="${buttonStyle}">Reset password</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        This link expires in <strong>15 minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will not be changed.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Or copy this link into your browser:<br/>
        <span style="color:#1a6bff;word-break:break-all;">${url}</span>
      </p>
    `)
  })
}

exports.sendEmailChangeVerificationEmail = async (email, tokenId) => {
  const url = `${process.env.CLIENT_URL}/profile/email/verify?token=${tokenId}`

  await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: email,
    subject: 'Verify your new email address',
    html: baseTemplate(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Verify your new email</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6;">
        You requested an email address change on your DentaCore account. Click the button below to confirm your new address.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td>
            <a href="${url}" style="${buttonStyle}">Verify email address</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        This link expires in <strong>15 minutes</strong>. If you did not request this change, please contact your administrator immediately.
      </p>
      <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Or copy this link into your browser:<br/>
        <span style="color:#1a6bff;word-break:break-all;">${url}</span>
      </p>
    `)
  })
}