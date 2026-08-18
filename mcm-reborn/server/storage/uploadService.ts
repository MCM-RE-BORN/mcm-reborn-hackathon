import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { ValidationError } from '@/contracts/errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
const BUCKET_NAME = 'source-products';

export interface UploadFileRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  purpose: 'SOURCE_PRODUCT' | 'DAMAGE_CLOSEUP' | 'INTERIOR' | 'SERIAL';
}

export interface UploadAsset {
  assetId: string;
  method: 'PUT';
  uploadUrl: string;
  headers: Record<string, string>;
  storagePath: string;
  expiresAt: string;
}

/**
 * Create presigned upload URLs for customer images
 */
export async function createPresignedUploadUrls(
  userId: string,
  files: UploadFileRequest[]
): Promise<UploadAsset[]> {
  // Validate file count
  if (files.length < 1 || files.length > 4) {
    throw new ValidationError('File count must be between 1 and 4');
  }

  const assets: UploadAsset[] = [];

  for (const file of files) {
    // Validate content type
    if (!ALLOWED_MIME_TYPES.includes(file.contentType)) {
      throw new ValidationError(`Unsupported content type: ${file.contentType}`, {
        allowedTypes: ALLOWED_MIME_TYPES,
      });
    }

    // Validate file size
    if (file.sizeBytes > MAX_FILE_SIZE) {
      throw new ValidationError(`File size exceeds maximum of 6MB`, {
        fileName: file.fileName,
        sizeBytes: file.sizeBytes,
        maxSizeBytes: MAX_FILE_SIZE,
      });
    }

    // Generate asset ID and path
    const assetId = randomUUID();
    const ext = file.contentType.split('/')[1];
    const storagePath = `${userId}/${assetId}.${ext}`;

    // Create presigned upload URL (expires in 15 minutes)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(`Failed to create upload URL: ${error?.message}`);
    }

    // Record asset in database
    const { error: insertError } = await supabaseAdmin.from('media_assets').insert({
      id: assetId,
      owner_id: userId,
      bucket: BUCKET_NAME,
      path: storagePath,
      mime_type: file.contentType,
      size_bytes: file.sizeBytes,
      purpose: file.purpose,
    });

    if (insertError) {
      throw new Error(`Failed to record asset: ${insertError.message}`);
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    assets.push({
      assetId,
      method: 'PUT',
      uploadUrl: data.signedUrl,
      headers: {
        'Content-Type': file.contentType,
      },
      storagePath,
      expiresAt,
    });
  }

  return assets;
}

/**
 * Get signed URL for reading a private image (for OpenAI analysis)
 */
export async function getSignedReadUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}
