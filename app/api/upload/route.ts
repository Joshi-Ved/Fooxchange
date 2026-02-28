import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import {
    checkRateLimit,
    RateLimitPresets,
    getClientIdentifier,
    rateLimitExceededResponse,
} from "@/lib/middleware/rate-limit";

// Magic byte signatures for allowed image types
const MAGIC_BYTES: Record<string, number[][]> = {
    "image/jpeg": [[0xff, 0xd8, 0xff]],
    "image/png": [[0x89, 0x50, 0x4e, 0x47]],
    "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
    "image/gif": [
        [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
        [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
    const signatures = MAGIC_BYTES[mimeType];
    if (!signatures) return false;
    return signatures.some((sig) =>
        sig.every((byte, i) => buffer[i] === byte)
    );
}

/**
 * POST /api/upload — Simple file upload endpoint
 * Saves uploaded images to public/uploads/ directory
 * In production, replace with S3/Cloudinary/UploadThing
 */
export async function POST(req: NextRequest) {
    try {
        // 1. Authentication required
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        // 2. Rate limiting (10 uploads per minute)
        const identifier = getClientIdentifier(req, userId);
        const rateLimit = await checkRateLimit(identifier, {
            maxRequests: 10,
            windowSeconds: 60,
        });
        if (!rateLimit.success) {
            return rateLimitExceededResponse(rateLimit) as unknown as NextResponse;
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // 3. Validate file type (client-supplied MIME)
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
                { status: 400 }
            );
        }

        // 4. Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: "File too large. Maximum size is 5MB." },
                { status: 400 }
            );
        }

        // 5. Read file bytes and validate magic bytes
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        if (!validateMagicBytes(buffer, file.type)) {
            return NextResponse.json(
                { error: "File content does not match its declared type." },
                { status: 400 }
            );
        }

        // 6. Generate unique filename (use only the validated extension)
        const extMap: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
        };
        const ext = extMap[file.type] || "jpg";
        const filename = `${randomUUID()}.${ext}`;

        // 7. Ensure uploads directory exists
        const uploadsDir = join(process.cwd(), "public", "uploads");
        await mkdir(uploadsDir, { recursive: true });

        // 8. Write file to disk
        const filepath = join(uploadsDir, filename);
        await writeFile(filepath, buffer);

        // Return the public URL
        const url = `/uploads/${filename}`;

        return NextResponse.json({ url, filename });
    } catch (error) {
        console.error("[Upload API] Error:", error);
        return NextResponse.json(
            { error: "Upload failed" },
            { status: 500 }
        );
    }
}
