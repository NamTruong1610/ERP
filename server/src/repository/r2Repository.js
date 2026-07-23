// repository/r2Repository.js
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client } = require('../config/R2Config');

const UPLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS = 5 * 60;
const DOWNLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS = 60;

exports.generateUploadUrl = (storageKey, mimeType) =>
  getSignedUrl(
    r2Client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storageKey,
      ContentType: mimeType,
    }),
    { expiresIn: UPLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS }
  );

exports.generateDownloadUrl = (storageKey) =>
  getSignedUrl(
    r2Client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }),
    { expiresIn: DOWNLOAD_PRESIGNED_URL_EXPIRE_IN_SECONDS }
  );

exports.objectExists = async (storageKey) => {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }));
    return true;
  } catch {
    return false;
  }
};

exports.deleteObject = (storageKey) =>
  r2Client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: storageKey }));