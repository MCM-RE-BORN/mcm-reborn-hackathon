import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { createPresignedUploadUrls } from '@/server/storage/uploadService';
import { ValidationError } from '@/contracts/errors';
import { z } from 'zod';

const UploadFileRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().min(1).max(6291456), // 6MB
  purpose: z.enum(['SOURCE_PRODUCT', 'DAMAGE_CLOSEUP', 'INTERIOR', 'SERIAL']),
});

const PresignUploadRequestSchema = z.object({
  files: z.array(UploadFileRequestSchema).min(1).max(4),
});

/**
 * POST /api/v1/uploads/presign
 * 원제품 이미지 업로드 URL 발급 (고객 전용)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);

    const body = await request.json();
    const { files } = PresignUploadRequestSchema.parse(body);

    const assets = await createPresignedUploadUrls(user.id, files);

    return NextResponse.json({ assets }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Invalid request body', { zodErrors: error.issues }));
    }
    return handleApiError(error);
  }
}
