// s3Utils.ts
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
// s3Presigner.ts
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configure the S3 client using environment variables.
// It’s recommended to load these from a secure env file.
const s3Client = new S3Client({
  region: process.env.AWS_REGION, // e.g., "us-east-1"
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Define an interface for the parameters needed for an upload.
export interface UploadParams {
  /**
   * The S3 bucket name.
   */
  Bucket: string;
  /**
   * The key (path/filename) in the bucket.
   */
  Key: string;
  /**
   * The content of the file. This could be a Buffer, string, or stream.
   */
  Body: Buffer | Uint8Array | Blob | string;
  /**
   * Optional MIME type for the file.
   */
  ContentType?: PutObjectCommandInput["ContentType"];
  /**
   * Optional ACL settings. Defaults to 'public-read' if you want the file to be publicly accessible.
   */
  ACL?: PutObjectCommandInput["ACL"];
}

/**
 * Upload a file or image to S3 with provided parameters.
 * @param params - Upload parameters such as Bucket, Key, Body, ContentType, and ACL.
 * @returns A promise that resolves when the upload is complete.
 */
export const uploadFileToS3 = async (params: UploadParams): Promise<void> => {
  // Set default ACL if not specified (public-read makes the file accessible)
  const uploadParams: PutObjectCommandInput = {
    Bucket: params.Bucket,
    Key: params.Key,
    Body: params.Body,
    ContentType: params.ContentType,
  };

  if (params.ACL) {
    uploadParams.ACL = params.ACL;
  }

  try {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    console.info(`Upload successful: s3://${params.Bucket}/${params.Key}`);
  } catch (error) {
    console.error("Error during file upload:", error);
    throw error;
  }
};

/**
 * Generate a public URL for the uploaded object.
 * This assumes the object is publicly accessible based on its ACL.
 *
 * @param bucketName - Name of the S3 bucket.
 * @param key - The object key (path/filename) in the bucket.
 * @returns The full public URL to the object.
 */
export const getPublicUrl = (bucketName: string, key: string): string => {
  // Note: This URL structure works for most S3 setups.
  // Some regions or bucket configurations (like buckets with dots in their names)
  // might require a different URL structure.
  return `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

/**
 * Generates a signed URL for uploading a file directly to S3.
 * @param bucket - Your S3 bucket name
 * @param key - Desired S3 object key (filename/path)
 * @param expiresIn - URL expiration time in seconds (default 300 = 5 minutes)
 */
export async function generateUploadSignedUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 *
 * @param bucket - Your S3 bucket name
 * @param key - The object key (path/filename) in the bucket
 * @param expiresIn - URL expiration time in seconds (default 300 = 5 minutes)
 * @returns A promise that resolves to the signed URL
 */
export async function generateGetSignedUrl(
  bucket: string,
  key: string,
  expiresIn = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * List all objects under a specific prefix in an S3 bucket.
 * @param bucket - The bucket name.
 * @param prefix - The folder-like path prefix (e.g., "uploads/2025/April/").
 */
export async function listFilesInS3Path(bucket: string, prefix: string) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix, // e.g., "uploads/", "images/users/", etc.
    });

    const response = await s3Client.send(command);
    return (
      response.Contents?.map((item) => ({
        ...item,
        key: item.Key,
        lastModified: item.LastModified,
        size: item.Size,
      })) || []
    );
  } catch (error) {
    console.error("Error listing S3 files:", error);
    throw error;
  }
}
