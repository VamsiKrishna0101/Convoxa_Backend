import type { Request, Response } from "express";
import { generateSignedUploadUrl, SignedUrlInput } from "../../utils/gcp.js";

/**
 * Get a signed URL for uploading images to GCP Storage
 * 
 * POST /api/upload/signed-url
 * Body: { fileName: string, contentType: string, folder?: string }
 * 
 * Response: { success: true, data: { signedUrl, publicUrl, expiresAt } }
 * 
 * Frontend should:
 * 1. Call this endpoint to get signedUrl and publicUrl
 * 2. PUT the image file to signedUrl with Content-Type header
 * 3. Use publicUrl when creating the community/thread/etc
 */
export async function getSignedUploadUrl(req: Request, res: Response) {
    try {
        const { fileName, contentType, folder } = req.body as SignedUrlInput;

        if (!fileName || !contentType) {
            return res.status(400).json({
                success: false,
                error: "FILE_NAME_AND_CONTENT_TYPE_REQUIRED"
            });
        }

        const result = await generateSignedUploadUrl({ fileName, contentType, folder });
        // console.log(result)

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error: any) {
        const message = error.message || "UNKNOWN_ERROR";

        if (message === "INVALID_CONTENT_TYPE") {
            return res.status(400).json({
                success: false,
                error: "INVALID_CONTENT_TYPE",
                allowed: ["image/jpeg", "image/png", "image/gif", "image/webp"]
            });
        }

        if (message === "FILE_NAME_REQUIRED") {
            return res.status(400).json({
                success: false,
                error: "FILE_NAME_REQUIRED"
            });
        }

        console.error("❌ Error generating signed URL:", {
            message: error.message,
            stack: error.stack,
            body: req.body
        });

        return res.status(500).json({
            success: false,
            error: "INTERNAL_SERVER_ERROR",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
