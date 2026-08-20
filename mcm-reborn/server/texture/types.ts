import type {
  MeshyTextureTaskResponse,
  TexturePreviewCreateResponse,
} from "@/lib/texture-preview";

export type TextureStyleImage = {
  bytes: Buffer;
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png";
};

export interface TextureImageProvider {
  createTexture(
    styleImage: TextureStyleImage,
  ): Promise<Extract<TexturePreviewCreateResponse, { kind: "texture" }>>;
}

export interface RetextureProvider {
  createTask(styleImage: TextureStyleImage): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<MeshyTextureTaskResponse>;
}
