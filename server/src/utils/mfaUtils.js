const speakeasy = require("speakeasy");

exports.generateMfaSecret = (name) => {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `DentaCore:${name}`,
    issuer: 'DentaCore'
  });
  return secret;
}

exports.verifyMfaOtp = (otp, mfaSecret) => {
  const verified = speakeasy.totp.verify({
    secret: mfaSecret,
    encoding: "base32",
    token: otp,
    window: 1
  });
  return verified
}

