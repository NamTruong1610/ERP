const { v4: uuidv4 } = require('uuid')
const crypto = require("crypto");

exports.generateActivationTokenId = async () => {
  return await uuidv4();
}

exports.hashToken = async (token) => {
  return await crypto.createHash("sha256").update(token).digest("hex");
}

exports.compareHash = async (token, hashedToken) => {
  return hashedToken === await exports.hashToken(token);
}



