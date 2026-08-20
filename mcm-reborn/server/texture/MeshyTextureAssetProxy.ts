import "server-only";

import { createHash } from "crypto";
import {
  ServiceUnavailableError,
  UpstreamError,
} from "@/contracts/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const SOURCE_IMAGE_BUCKET = "source-products";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_TEXTURE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MIN_TEXTURE_BYTES = 1;
const REQUEST_TIMEOUT_MS = 30_000;
const SIGNED_TEXTURE_TTL_SECONDS = 5 * 60;

type SupportedTextureType = "image/jpeg" | "image/png";

export type MeshyTextureAssetAccess = {
  expiresAt: string;
  signedUrl: string;
};

export async function persistTrustedMeshyTexture(input: {
  analysisId: string;
  taskId: string;
  textureUrl: string;
  userId: string;
}): Promise<MeshyTextureAssetAccess> {
  const admin = createAdminSupabaseClient();
  const storageFolder = `${input.userId}/texture-previews/${input.analysisId}`;
  const storageKey = createHash("sha256")
    .update(`${input.userId}:${input.analysisId}:TARGET_RETEXTURE:${input.taskId}`)
    .digest("hex");
  const bucket = admin.storage.from(SOURCE_IMAGE_BUCKET);

  const existingPath = await findExistingTexture(
    bucket,
    storageFolder,
    storageKey,
  );
  if (existingPath) {
    return createTextureAccess(existingPath);
  }

  const texture = await downloadTrustedMeshyTexture(input.textureUrl);
  const extension = texture.contentType === "image/jpeg" ? "jpg" : "png";
  const storagePath = `${storageFolder}/${storageKey}.${extension}`;
  const { error: uploadError } = await bucket.upload(storagePath, texture.body, {
    cacheControl: "0",
    contentType: texture.contentType,
    upsert: false,
  });

  if (uploadError) {
    // A concurrent request may have completed the same deterministic upload.
    const racedPath = await findExistingTexture(
      bucket,
      storageFolder,
      storageKey,
    );
    if (!racedPath) {
      throw new ServiceUnavailableError(
        "Supabase Storage could not persist the generated texture",
      );
    }
    return createTextureAccess(racedPath);
  }

  return createTextureAccess(storagePath);
}

async function downloadTrustedMeshyTexture(
  textureUrl: string,
): Promise<{ body: ArrayBuffer; contentType: SupportedTextureType }> {
  let currentUrl = parseTrustedMeshyUrl(textureUrl);
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        cache: "no-store",
        headers: { Accept: "image/jpeg, image/png" },
        redirect: "manual",
        referrerPolicy: "no-referrer",
        signal,
      });
    } catch {
      throw new UpstreamError("Meshy texture download failed");
    }

    if (isRedirect(response.status)) {
      await response.body?.cancel().catch(() => undefined);
      if (redirectCount === MAX_REDIRECTS) {
        throw new UpstreamError("Meshy texture exceeded the redirect limit");
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new UpstreamError("Meshy texture redirect is missing a location");
      }
      currentUrl = parseTrustedMeshyUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new UpstreamError("Meshy texture download returned an error");
    }

    // Manual redirects prevent an untrusted hop. Re-check the runtime URL in
    // case the platform normalized it independently.
    if (response.url) parseTrustedMeshyUrl(response.url);

    const contentType = readContentType(response.headers);
    assertAdvertisedSize(response.headers);
    const body = await readBoundedBody(response);
    assertImageSignature(new Uint8Array(body), contentType);
    return { body, contentType };
  }

  throw new UpstreamError("Meshy texture download failed");
}

type StorageBucket = ReturnType<
  ReturnType<typeof createAdminSupabaseClient>["storage"]["from"]
>;

async function findExistingTexture(
  bucket: StorageBucket,
  storageFolder: string,
  storageKey: string,
) {
  const { data, error } = await bucket.list(storageFolder, {
    limit: 10,
    search: storageKey,
  });
  if (error) {
    throw new ServiceUnavailableError(
      "Supabase Storage could not inspect generated textures",
    );
  }

  const candidates = (data ?? []).filter(
    (file) =>
      file.name === `${storageKey}.jpg` || file.name === `${storageKey}.png`,
  );
  if (candidates.length === 0) return null;
  if (candidates.length !== 1) {
    throw new UpstreamError("Stored generated texture is ambiguous");
  }

  const [candidate] = candidates;
  const metadata = candidate.metadata as
    | { mimetype?: unknown; size?: unknown }
    | null;
  if (
    !metadata ||
    !ALLOWED_IMAGE_TYPES.has(String(metadata.mimetype)) ||
    typeof metadata.size !== "number" ||
    metadata.size < MIN_TEXTURE_BYTES ||
    metadata.size > MAX_TEXTURE_BYTES
  ) {
    throw new UpstreamError("Stored generated texture metadata is invalid");
  }
  return `${storageFolder}/${candidate.name}`;
}

async function createTextureAccess(
  storagePath: string,
): Promise<MeshyTextureAssetAccess> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(SOURCE_IMAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_TEXTURE_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new ServiceUnavailableError(
      "Supabase Storage could not create a texture download URL",
    );
  }
  return {
    expiresAt: new Date(
      Date.now() + SIGNED_TEXTURE_TTL_SECONDS * 1000,
    ).toISOString(),
    signedUrl: data.signedUrl,
  };
}

function parseTrustedMeshyUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UpstreamError("Meshy returned an invalid texture URL");
  }

  const hostname = url.hostname.toLowerCase();
  const trustedHost = hostname === "meshy.ai" || hostname.endsWith(".meshy.ai");
  if (
    url.protocol !== "https:" ||
    !trustedHost ||
    (url.port !== "" && url.port !== "443") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new UpstreamError("Meshy returned an untrusted texture URL");
  }
  return url;
}

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function readContentType(headers: Headers): SupportedTextureType {
  const value = headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!value || !ALLOWED_IMAGE_TYPES.has(value)) {
    throw new UpstreamError(
      "Meshy texture must be JPEG or PNG for private storage",
    );
  }
  return value as SupportedTextureType;
}

function assertAdvertisedSize(headers: Headers) {
  const value = headers.get("content-length");
  if (value === null) return;
  if (!/^\d+$/.test(value)) {
    throw new UpstreamError("Meshy texture has an invalid content length");
  }
  const size = Number(value);
  if (size < MIN_TEXTURE_BYTES || size > MAX_TEXTURE_BYTES) {
    throw new UpstreamError("Meshy texture size is outside the allowed range");
  }
}

async function readBoundedBody(response: Response): Promise<ArrayBuffer> {
  if (!response.body) {
    throw new UpstreamError("Meshy texture response has no body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > MAX_TEXTURE_BYTES) {
        await reader.cancel();
        throw new UpstreamError("Meshy texture exceeds the allowed size");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError("Meshy texture stream could not be read");
  }

  if (size < MIN_TEXTURE_BYTES) {
    throw new UpstreamError("Meshy texture response is empty");
  }

  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

function assertImageSignature(body: Uint8Array, contentType: SupportedTextureType) {
  const valid =
    contentType === "image/jpeg"
      ? body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff
      : hasBytes(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!valid) {
    throw new UpstreamError("Meshy texture content does not match its image type");
  }
}

function hasBytes(body: Uint8Array, expected: readonly number[]) {
  return expected.every((byte, index) => body[index] === byte);
}
