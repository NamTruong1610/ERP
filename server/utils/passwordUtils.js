const bcrypt = require("bcrypt");

// Number of salt rounds (cost factor)
const SALT_ROUNDS = 10;

exports.hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);
  return hashedPassword;
}

exports.compareHash = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};