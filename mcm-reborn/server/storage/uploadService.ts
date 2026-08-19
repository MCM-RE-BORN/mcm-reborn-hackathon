import { randomUUID } from 'node:crypto';

import {
  ServiceUnavailableError,
  ValidationError,
} from '@/contracts/errors';
import {
  createAdminSupabaseClient,
  createUserSupabaseClient,
} from '@/lib/supabase/server';

const BUCKET_NAME = 'source-products';
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_UPLOAD_URL_TTL_MS = 2 * 60 * 60 * 1000;

export type V2UploadPurpose =
  | 'SOURCE_FRONT'
  | 'SOURCE_SIDE'
  | 'INTERIOR'
  | 'ENGRAVING';

export interface V2UploadFileRequest {
  contentType: (typeof ALLOWED_MIME_TYPES)[number];
  fileName: string;
  purpose: V2UploadPurpose;
  sizeBytes: number;
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
 * Create v2 upload URLs after CUSTOMER authentication.
 *
 * Metadata is reserved before a signed URL is issued. The Storage INSERT
 * policy requires the matching PENDING media_assets row, preventing a customer
 * JWT from bypassing this endpoint to create arbitrary orphan objects.
 */
export async function createV2PresignedUploadUrls(
  userId: string,
  accessToken: string,
  files: V2UploadFileRequest[],
): Promise<UploadAsset[]> {
  if (files.length < 1 || files.length > 4) {
    throw new ValidationError('File count must be between 1 and 4');
  }

  const descriptors = files.map((file) => {
    if (!ALLOWED_MIME_TYPES.includes(file.contentType)) {
      throw new ValidationError('Unsupported content type', {
        allowedTypes: ALLOWED_MIME_TYPES,
      });
    }
    if (file.sizeBytes < 1 || file.sizeBytes > MAX_FILE_SIZE) {
      throw new ValidationError('File size must be between 1 byte and 10MB', {
        fileName: file.fileName,
        maxSizeBytes: MAX_FILE_SIZE,
      });
    }

    const assetId = randomUUID();
    const extension = file.contentType === 'image/jpeg' ? 'jpg' : 'png';
    return {
      assetId,
      contentType: file.contentType,
      purpose: file.purpose,
      sizeBytes: file.sizeBytes,
      storagePath: `${userId}/${assetId}.${extension}`,
    };
  });

  const adminClient = createAdminSupabaseClient();
  const assetIds = descriptors.map((descriptor) => descriptor.assetId);
  const { data: reservedRows, error: insertError } = await adminClient
    .from('media_assets')
    .insert(
      descriptors.map((descriptor) => ({
        id: descriptor.assetId,
        owner_id: userId,
        bucket: BUCKET_NAME,
        path: descriptor.storagePath,
        mime_type: descriptor.contentType,
        size_bytes: descriptor.sizeBytes,
        purpose: descriptor.purpose,
        upload_status: 'PENDING',
      })),
    )
    .select('id');

  if (insertError || (reservedRows?.length ?? 0) !== descriptors.length) {
    throw new ServiceUnavailableError(
      'Supabase could not reserve upload metadata',
    );
  }

  try {
    const userClient = createUserSupabaseClient(accessToken);
    return await Promise.all(
      descriptors.map(async (descriptor) => {
        const { data, error } = await userClient.storage
          .from(BUCKET_NAME)
          .createSignedUploadUrl(descriptor.storagePath, { upsert: false });

        if (error || !data?.signedUrl) {
          throw new ServiceUnavailableError(
            'Supabase Storage could not create an upload URL',
          );
        }

        return {
          assetId: descriptor.assetId,
          method: 'PUT' as const,
          uploadUrl: data.signedUrl,
          headers: { 'Content-Type': descriptor.contentType },
          storagePath: descriptor.storagePath,
          expiresAt: new Date(
            Date.now() + SIGNED_UPLOAD_URL_TTL_MS,
          ).toISOString(),
        };
      }),
    );
  } catch (error) {
    const { error: cleanupError } = await adminClient
      .from('media_assets')
      .delete()
      .eq('owner_id', userId)
      .eq('upload_status', 'PENDING')
      .in('id', assetIds);
    if (cleanupError) {
      console.error('[Uploads] Failed to clean up upload reservations');
    }
    throw error;
  }
}
