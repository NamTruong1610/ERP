import bcrypt from "bcrypt";

// Number of salt rounds (cost factor)
const SALT_ROUNDS = 10;

export const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);
  return hashedPassword;
}

export const comparePasswordHash = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};