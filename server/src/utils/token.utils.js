import { v4 as uuidv4 } from 'uuid';
import crypto from "crypto";

export const generateActivationToken = () => {
  return uuidv4();
}

export const hashToken = async (token) => {
  return await crypto.createHash("sha256").update(token).digest("hex");
}

export const compareTokenHash = async (token, hashedToken) => {
  return hashedToken === await hashToken(token);
}



