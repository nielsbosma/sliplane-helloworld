import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const { S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;

export const storageConfigured = Boolean(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY);

const s3 = storageConfigured
  ? new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION || "auto",
      forcePathStyle: true,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    })
  : undefined;

export const putObject = (key, body, contentType) =>
  s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }));

export const getObject = async (key) => (await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))).Body;

export const deleteObject = (key) => s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
