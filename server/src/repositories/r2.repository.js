// repository/r2Repository.js
import * as r2Config from '../config/r2.config.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, DeleteObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const UPLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS = 5 * 60;
const DOWNLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS = 60;

export const generateUploadUrl = (storageKey, mimeType) =>
  getSignedUrl(
    r2Config.r2Client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storageKey,
      ContentType: mimeType,
    }),
    { expiresIn: UPLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS }
  );

export const generateDownloadUrl = (storageKey) =>
  getSignedUrl(
    r2Config.r2Client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }),
    { expiresIn: DOWNLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS }
  );

export const objectExists = async (storageKey) => {
  try {
    await r2Config.r2Client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }));
    return true;
  } catch {
    return false;
  }
};

export const deleteObject = (storageKey) =>
  r2Config.r2Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }));