import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpsError } from 'firebase-functions/v2/https';

const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT'] as const;

function config() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new HttpsError('failed-precondition', `R2 no está configurado: ${missing.join(', ')}`);
  return {
    bucket: process.env.R2_BUCKET_NAME!,
    client: new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT!,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! }
    })
  };
}

export async function createUploadUrl(objectKey: string, mimeType: string) {
  const { bucket, client } = config();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: mimeType }), { expiresIn: 300 });
}

export async function createDownloadUrl(objectKey: string) {
  const { bucket, client } = config();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 300 });
}
