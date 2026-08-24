import { z } from "zod";
import {
  ServiceUnavailableError,
  UpstreamError,
  ValidationError,
} from "@/contracts/errors";
import type { MeshyTextureTaskResponse } from "@/lib/texture-preview";
import { throwMeshyHttpError } from "./MeshyHttpError";

const MESHY_API_BASE_URL = "https://api.meshy.ai/openapi/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const POLL_TIMEOUT_MS = 15_000;

const SourceImageUrlsSchema = z
  .array(z.string().url())
  .length(4)
  .refine((urls) => new Set(urls).size === urls.length)
  .refine((urls) => urls.every(isPublicHttpsUrl));

const TaskIdSchema = z.string().trim().min(1).max(160);

const CreateTaskResponseSchema = z.object({
  result: TaskIdSchema,
});

const TextureSetSchema = z
  .object({
    base_color: z.string().url().optional(),
    metallic: z.string().url().optional(),
    normal: z.string().url().optional(),
    roughness: z.string().url().optional(),
  })
  .partial()
  .passthrough();

const MeshySourceModelTaskSchema = z
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
    texture_urls: z.array(TextureSetSchema).nullish(),
  })
  .passthrough();

/** Meshy asynchronous multi-image source GLB/PBR adapter. */
export class MeshySourceModelProvider {
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

  async createTask(imageUrls: readonly string[]): Promise<{ taskId: string }> {
    const parsedUrls = SourceImageUrlsSchema.safeParse(imageUrls);
    if (!parsedUrls.success) {
      throw new ValidationError(
        "Exactly four unique public HTTPS source image URLs are required",
      );
    }

    const response = await this.request("/multi-image-to-3d", {
      body: JSON.stringify({
        ai_model: readMeshySourceModel(),
        enable_pbr: true,
        image_urls: parsedUrls.data,
        should_texture: true,
        target_formats: ["glb"],
        texture_resolution: "2k",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const parsed = CreateTaskResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new UpstreamError("Meshy returned an invalid source-model task response");
    }
    return { taskId: parsed.data.result };
  }

  async getTask(taskId: string): Promise<MeshyTextureTaskResponse> {
    const parsedTaskId = TaskIdSchema.safeParse(taskId);
    if (!parsedTaskId.success) {
      throw new ValidationError("Meshy source-model task ID is invalid");
    }

    const response = await this.request(
      `/multi-image-to-3d/${encodeURIComponent(parsedTaskId.data)}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      },
    );
    const parsed = MeshySourceModelTaskSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new UpstreamError("Meshy returned an invalid source-model task status");
    }

    const task = parsed.data;
    const status = normalizeStatus(task.status);
    const modelUrl = trustedMeshyAssetUrl(task.model_urls?.glb);
    const texture = task.texture_urls?.[0];
    const pbr = toTrustedPbr(texture);

    if (status === "succeeded" && !modelUrl) {
      throw new UpstreamError(
        "Meshy completed without a trusted source GLB output",
      );
    }

    return {
      ...(typeof task.consumed_credits === "number"
        ? { consumedCredits: task.consumed_credits }
        : {}),
      ...(status === "failed" || status === "canceled"
        ? { errorMessage: "Meshy 원제품 3D 생성 작업을 완료하지 못했습니다." }
        : {}),
      ...(task.expires_at ? { expiresAt: toIsoTimestamp(task.expires_at) } : {}),
      ...(modelUrl ? { modelUrl } : {}),
      ...(pbr ? { pbr } : {}),
      jobKind: "SOURCE_MODEL",
      kind: "task",
      progress: Math.round(task.progress ?? (status === "succeeded" ? 100 : 0)),
      provider: "MESHY",
      status,
      usage: "REFERENCE_ONLY",
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
    return throwMeshyHttpError(response);
  }
}

export function isMeshySourceModelConfigured() {
  return Boolean(process.env.MESHY_API_KEY?.trim());
}

function readMeshySourceModel() {
  const configured = process.env.MESHY_SOURCE_MODEL?.trim();
  if (
    configured === "meshy-5" ||
    configured === "meshy-6" ||
    configured === "meshy-7" ||
    configured === "latest"
  ) {
    return configured;
  }
  return "meshy-7";
}

function normalizeStatus(
  status: z.infer<typeof MeshySourceModelTaskSchema>["status"],
): MeshyTextureTaskResponse["status"] {
  if (status === "PENDING") return "queued";
  if (status === "IN_PROGRESS") return "running";
  if (status === "SUCCEEDED") return "succeeded";
  if (status === "FAILED") return "failed";
  return "canceled";
}

function toTrustedPbr(
  texture?: z.infer<typeof TextureSetSchema>,
): MeshyTextureTaskResponse["pbr"] | undefined {
  if (!texture) return undefined;
  const baseColorUrl = trustedMeshyAssetUrl(texture.base_color);
  const metallicUrl = trustedMeshyAssetUrl(texture.metallic);
  const normalUrl = trustedMeshyAssetUrl(texture.normal);
  const roughnessUrl = trustedMeshyAssetUrl(texture.roughness);
  if (!baseColorUrl && !metallicUrl && !normalUrl && !roughnessUrl) {
    return undefined;
  }
  return {
    ...(baseColorUrl ? { baseColorUrl } : {}),
    ...(metallicUrl ? { metallicUrl } : {}),
    ...(normalUrl ? { normalUrl } : {}),
    ...(roughnessUrl ? { roughnessUrl } : {}),
  };
}

function trustedMeshyAssetUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const trustedHost =
      url.hostname === "meshy.ai" || url.hostname.endsWith(".meshy.ai");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !trustedHost
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function toIsoTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new UpstreamError("Meshy returned an invalid source-model expiry");
  }
  return date.toISOString();
}
