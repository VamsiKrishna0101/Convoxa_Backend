import 'dotenv/config';
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize GCS client with explicit credentials path relative to this file
// We check multiple possible locations to be robust (src/utils vs dist/utils)
const possiblePaths = [
    path.join(process.cwd(), "secrets", "gcp-service-account.json"),
    path.join(process.cwd(), "secrets", "gcp-service-account"),
    path.join(__dirname, "..", "..", "secrets", "gcp-service-account.json"),
    path.join(__dirname, "..", "..", "secrets", "gcp-service-account"),
    process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean) as string[];

let credentialsPath = "";
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        credentialsPath = p;
        break;
    }
}

if (!credentialsPath) {
    console.warn("⚠️ GCS Credentials not found at any of the following locations:");
    possiblePaths.forEach(p => console.warn(`   - ${p}`));
    console.warn("   Signed URLs will fail. Ensure gcp-service-account.json is in the secrets folder.");
}

const storageOptions: any = {};
if (credentialsPath) {
    storageOptions.keyFilename = credentialsPath;
}

const storage = new Storage(storageOptions);

// Multiple buckets for different content types
const BUCKETS = {
    community: process.env.COMMUNITY_BUCKET || "adda-community-images-prod",
    thread: process.env.THREADS_BUCKET || "adda-threads-images-prod",
    comment: process.env.THREADS_BUCKET || "adda-threads-images-prod",
    reply: process.env.THREADS_BUCKET || "adda-threads-images-prod",
    profile: process.env.COMMUNITY_BUCKET || "adda-community-images-prod",
    chat: process.env.CHAT_BUCKET || "adda_chat",
};

export type FolderType = "community" | "thread" | "comment" | "reply" | "profile" | "chat";

export type SignedUrlInput = {
    fileName: string;
    contentType: string;
    folder?: FolderType;
};

export type SignedUrlOutput = {
    signedUrl: string;
    publicUrl: string;
    expiresAt: string;
};

/**
 * Get bucket name for a folder type
 */
function getBucketForFolder(folder: FolderType): string {
    return BUCKETS[folder] || BUCKETS.community;
}

/**
 * Generate a signed URL for uploading images to GCS
 * 
 * Frontend flow:
 * 1. Call API endpoint to get signedUrl and publicUrl
 * 2. PUT the image file to signedUrl with Content-Type header
 * 3. Use publicUrl when creating the community/thread/comment
 * 
 * @param input - fileName, contentType, and optional folder
 * @returns signedUrl (for upload), publicUrl (for storage), expiresAt
 */
export async function generateSignedUploadUrl(input: SignedUrlInput): Promise<SignedUrlOutput> {
    const { fileName, contentType, folder = "community" } = input;

    // Validate content type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
        throw new Error("INVALID_CONTENT_TYPE");
    }

    // Validate file name
    if (!fileName || fileName.length === 0) {
        throw new Error("FILE_NAME_REQUIRED");
    }

    // Get the appropriate bucket for this folder type
    const bucketName = getBucketForFolder(folder);
    // console.log("Bucket Name", bucketName)

    // Generate unique file path: folder/uuid-originalname
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFileName = `${folder}/${uuidv4()}-${sanitizedFileName}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(uniqueFileName);

    // Generate signed URL valid for 15 minutes
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const maxSize = 5 * 1024 * 1024; // 5MB

    const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: expiresAt,
        contentType,
        extensionHeaders: {
            "x-goog-content-length-range": `0,${maxSize}`,
        },
    });

    // Public URL for accessing the image after upload
    const cdnUrl = process.env.CDN_URL;
    let publicUrl: string;

    if (cdnUrl) {
        // If CDN is configured, use it. 
        // Assumes CDN_URL points to the bucket root or maps to it.
        // Option A: CDN_URL = "https://cdn.domain.com" mapping to bucket root
        // Result: https://cdn.domain.com/folder/filename

        // Option B: CDN_URL = "https://cdn.domain.com/bucketname"
        // Result: https://cdn.domain.com/bucketname/folder/filename

        // Let's assume simple mapping: CDN Domain -> GCS Domain
        // Original: https://storage.googleapis.com/BUCKET/FILE
        // New: CDN_URL/BUCKET/FILE or CDN_URL/FILE

        // Simplest: User defines CDN_URL including bucket or not.
        // Let's standardise: CDN_URL should be the base. 
        // If CNAME points to c.storage.googleapis.com, then https://cdn.domain.com/BUCKET/FILE is needed.
        // If CNAME points to specific bucket, only FILE is needed.

        // Safest default: Replace the host.
        // But the current code logic is: `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`

        // Let's try to be smart.
        if (cdnUrl.includes(bucketName)) {
            publicUrl = `${cdnUrl}/${uniqueFileName}`;
        } else {
            // Append bucket name if not in URL (assuming generic CDN gateway)
            // But if user mapped cdn.com -> bucket, then bucket name causes 404.
            // Let's just use simple concatenation and let user configure valid path in ENV.
            // RECOMMENDED ENV: CDN_URL="https://cdn.mydomain.com/bucket-name"

            // To be robust:
            // Remove trailing slash
            const contentUrl = cdnUrl.replace(/\/$/, "");
            publicUrl = `${contentUrl}/${bucketName}/${uniqueFileName}`;
        }
    } else {
        publicUrl = `https://storage.googleapis.com/${bucketName}/${uniqueFileName}`;
    }

    return {
        signedUrl,
        publicUrl,
        expiresAt: new Date(expiresAt).toISOString(),
    };
}

/**
 * Delete a file from GCS
 * @param publicUrl - The public URL of the file to delete
 */
export async function deleteFromGCS(publicUrl: string): Promise<void> {
    try {
        // Extract bucket and file path from public URL
        // URL format: https://storage.googleapis.com/BUCKET_NAME/file/path
        const match = publicUrl.match(/https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)/);
        if (!match) {
            throw new Error("INVALID_GCS_URL");
        }

        const [, bucketName, filePath] = match;
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(filePath);

        await file.delete();
    } catch (error: any) {
        // Don't throw if file doesn't exist
        if (error.code !== 404) {
            throw error;
        }
    }
}

/**
 * Get the GCS bucket instance for a specific folder type
 */
export function getBucket(folder: FolderType = "community") {
    return storage.bucket(getBucketForFolder(folder));
}

/**
 * Generate a signed READ URL for a private GCS object (e.g. chat images).
 * The URL expires after `expiresInMs` milliseconds (default: 1 hour).
 * 
 * @param bucketName - The GCS bucket name
 * @param filePath   - The path to the object within the bucket
 * @param expiresInMs - How long the URL should be valid (ms)
 */
export async function generateSignedReadUrl(
    bucketName: string,
    filePath: string,
    expiresInMs: number = 60 * 60 * 1000 // 1 hour
): Promise<string> {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + expiresInMs,
    });
    return signedUrl;
}

/**
 * Upload a buffer directly to GCS and return the GCS object path (not a public URL).
 * Used for private buckets like chat.
 */
export async function uploadBufferToGCS(
    buffer: Buffer,
    contentType: string,
    folder: FolderType = "chat"
): Promise<{ bucketName: string; filePath: string }> {
    const bucketName = getBucketForFolder(folder);
    const ext = contentType.split("/")[1] || "jpg";
    const filePath = `${folder}/${uuidv4()}.${ext}`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    await file.save(buffer, {
        metadata: { contentType },
        resumable: false,
    });

    return { bucketName, filePath };
}

export { BUCKETS };
