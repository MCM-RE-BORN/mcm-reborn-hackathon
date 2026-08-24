import { z } from "zod";
import {
  RateLimitError,
  ServiceUnavailableError,
  UpstreamError,
} from "@/contracts/errors";
import type { MeshyTextureTaskResponse } from "@/lib/texture-preview";
import type { RetextureProvider } from "./types";

const MESHY_API_BASE_URL = "https://api.meshy.ai/openapi/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 15_000;
const LOOPBACK_HOSTS = new Set([
  "0.0.0.0",
  "127.0.0.1",
  "[::1]",
  "[::]",
  "localhost",
]);

const CreateTaskResponseSchema = z.object({
  result: z.string().trim().min(1).max(160),
});

const MeshyTaskSchema = z
  .object({
    consumed_credits: z.number().int().nonnegative().nullish(),
    expires_at: z.number().int().nonnegative().nullish(),
    model_urls: z
      .object({ glb: z.string().url().optional() })
      .partial()
      .nullish(),
    progress: z.number().min(0).max(100).nullish(),
    status: z.enum([
      "PENDING",
      "IN_PROGRESS",
      "SUCCEEDED",
      "FAILED",
      "CANCELED",
    ]),
    task_error: z
      .object({ message: z.string().optional() })
      .partial()
      .nullish(),
    texture_urls: z
      .array(
        z
          .object({ base_color: z.string().url().optional() })
          .partial()
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

/** Meshy asynchronous GLB retexture adapter. */
export class MeshyRetextureProvider implements RetextureProvider {
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.MESHY_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableError("Meshy API is not configured", {
        retryable: false,
      });
    }
    this.apiKey = apiKey;
  }

  async createTask(imageUrls: readonly string[]) {
    const modelUrl = readMeshyMockupModelUrl();
    if (!modelUrl) {
      throw new ServiceUnavailableError(
        "Meshy retexture model URL is not configured",
        { retryable: false },
      );
    }
    if (imageUrls.length !== 4 || imageUrls.some((url) => !isHttpsUrl(url))) {
      throw new ServiceUnavailableError(
        "Exactly four HTTPS exterior images are required for Meshy retexture",
        { retryable: false },
      );
    }
    const response = await this.request("/retexture", {
      body: JSON.stringify({
        ai_model: readMeshyModel(),
        enable_original_uv: true,
        enable_pbr: true,
        model_url: modelUrl,
        multiview_image_urls: imageUrls,
        target_formats: ["glb"],
        texture_resolution: "2k",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const parsed = CreateTaskResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new UpstreamError("Meshy returned an invalid task response");
    }
    return { taskId: parsed.data.result };
  }

  async getTask(taskId: string): Promise<MeshyTextureTaskResponse> {
    const response = await this.request(`/retexture/${encodeURIComponent(taskId)}`, {
      method: "GET",
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    const parsed = MeshyTaskSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new UpstreamError("Meshy returned an invalid task status");
    }

    const task = parsed.data;
    const status = normalizeStatus(task.status);
    const modelUrl = trustedMeshyAssetUrl(task.model_urls?.glb);
    const textureUrl = trustedMeshyAssetUrl(
      task.texture_urls?.find((texture) => texture.base_color)?.base_color,
    );

    if (status === "succeeded" && !modelUrl) {
      throw new UpstreamError("Meshy completed without a trusted GLB output");
    }

    if (status === "succeeded" && !textureUrl) {
      throw new UpstreamError(
        "Meshy completed without a trusted target UV texture",
      );
    }

    return {
      ...(typeof task.consumed_credits === "number"
        ? { consumedCredits: task.consumed_credits }
        : {}),
      ...(status === "failed" || status === "canceled"
        ? { errorMessage: "Meshy 3D 리텍스처 작업을 완료하지 못했습니다." }
        : {}),
      ...(modelUrl ? { modelUrl } : {}),
      ...(textureUrl ? { textureUrl } : {}),
      ...(task.expires_at
        ? { expiresAt: new Date(task.expires_at).toISOString() }
        : {}),
      jobKind: "TARGET_RETEXTURE",
      kind: "task",
      progress: Math.round(task.progress ?? (status === "succeeded" ? 100 : 0)),
      provider: "MESHY",
      status,
      usage: "TARGET_PREVIEW",
    };
  }

  private async request(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await fetch(`${MESHY_API_BASE_URL}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...init.headers,
        },
      });
    } catch {
      throw new UpstreamError("Meshy API request failed");
    }

    if (response.ok) return response;
    if (response.status === 402) {
      throw markMeshyHttpRejection(
        new ServiceUnavailableError("Meshy API credits are insufficient", {
          retryable: false,
        }),
      );
    }
    if (response.status === 429) {
      throw markMeshyHttpRejection(
        new RateLimitError("Meshy API rate limit exceeded"),
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw markMeshyHttpRejection(
        new ServiceUnavailableError("Meshy API credentials are invalid", {
          retryable: false,
        }),
      );
    }
    const error = new UpstreamError("Meshy API returned an error");
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 408
    ) {
      throw markMeshyHttpRejection(error);
    }
    throw error;
  }
}

function markMeshyHttpRejection<T extends Error>(error: T): T {
  error.name = "MeshyHttpRejectionError";
  return error;
}

export function isMeshyRetextureConfigured() {
  return Boolean(
    process.env.MESHY_API_KEY?.trim() && readMeshyMockupModelUrl(),
  );
}

export function isMeshyPollingConfigured() {
  return Boolean(process.env.MESHY_API_KEY?.trim());
}

function readMeshyMockupModelUrl() {
  const configured =
    process.env.MESHY_MOCKUP_MODEL_URL?.trim() ||
    buildDeployedMockupModelUrl();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      LOOPBACK_HOSTS.has(url.hostname) ||
      isPrivateHostname(url.hostname) ||
      !url.pathname.toLowerCase().endsWith(".glb")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function buildDeployedMockupModelUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  try {
    return new URL(
      "/assets/models/reborn-passport-wallet.glb",
      appUrl,
    ).toString();
  } catch {
    return null;
  }
}

function readMeshyModel() {
  // Meshy's multiview_image_urls contract currently requires Meshy 7.
  return "meshy-7";
}

function normalizeStatus(
  status: z.infer<typeof MeshyTaskSchema>["status"],
): MeshyTextureTaskResponse["status"] {
  if (status === "PENDING") return "queued";
  if (status === "IN_PROGRESS") return "running";
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED") return "failed";
  return "canceled";
}

function trustedMeshyAssetUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const trustedHost =
      url.hostname === "meshy.ai" || url.hostname.endsWith(".meshy.ai");
    return url.protocol === "https:" && trustedHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized.endsWith(".local")) return true;

  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return true;
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  return (
    normalized.startsWith("[fc") ||
    normalized.startsWith("[fd") ||
    normalized.startsWith("[fe8") ||
    normalized.startsWith("[fe9") ||
    normalized.startsWith("[fea") ||
    normalized.startsWith("[feb")
  );
}
