const speakeasy = require("speakeasy");

exports.generateMfaSecret = async (name) => {
  const secret = await speakeasy.generateSecret({
    length: 20,
    name: `ERP:${name}`
  });
  return secret;
}

exports.verifyMfaOtp = async (otp, mfaSecret) => {
  const verified = await speakeasy.totp.verify({
    secret: mfaSecret,
    encoding: "base32",
    token: otp,
    window: 1
  });
  return verified
}

