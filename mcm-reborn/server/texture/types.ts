import type { MeshyTextureTaskResponse } from "@/lib/texture-preview";

export type ExteriorSourceImage = {
  assetId: string;
  signedUrl: string;
  view: "FRONT" | "RIGHT" | "REAR" | "LEFT";
};

export interface RetextureProvider {
  createTask(imageUrls: readonly string[]): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyTextureTaskResponse>;
}
