import speakeasy from "speakeasy";

export const generateMfaSecret = (name) => {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `DentaCore:${name}`,
    issuer: 'DentaCore'
  });
  return secret;
}

export const verifyMfaOtp = (otp, mfaSecret) => {
  const verified = speakeasy.totp.verify({
    secret: mfaSecret,
    encoding: "base32",
    token: otp,
    window: 1
  });
  return verified
}

