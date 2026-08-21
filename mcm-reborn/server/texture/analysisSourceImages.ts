import { ServiceUnavailableError } from "@/contracts/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const SOURCE_IMAGE_BUCKET = "source-products";
const SOURCE_IMAGE_URL_TTL_SECONDS = 15 * 60;
const ALLOWED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOURCE_VIEW_ORDER = [
  { displayOrder: 0, purpose: "SOURCE_FRONT", view: "front" },
  { displayOrder: 5, purpose: "SOURCE_SIDE", view: "right" },
  { displayOrder: 1, purpose: "SOURCE_FRONT", view: "rear" },
  { displayOrder: 4, purpose: "SOURCE_SIDE", view: "left" },
] as const;

export type AnalysisSourceView = (typeof SOURCE_VIEW_ORDER)[number]["view"];

export type AnalysisSourceImageSet = {
  assetIds: [string, string, string, string];
  imageUrls: [string, string, string, string];
  views: readonly ["front", "right", "rear", "left"];
};

type AnalysisImageRow = {
  display_order: number;
  media_asset_id: string;
};

type MediaAssetRow = {
  bucket: string;
  id: string;
  mime_type: string;
  owner_id: string;
  path: string;
  purpose: string;
  upload_status: string;
};

/**
 * Returns four short-lived source image URLs in Meshy's preferred
 * front/right/rear/left order.
 *
 * The caller must authorize the completed analysis with getAnalysisById before
 * invoking this admin-backed helper. Signed URLs are sensitive and must not be
 * logged or returned directly to the browser.
 */
export async function getAnalysisSourceImageUrls(
  analysisId: string,
): Promise<AnalysisSourceImageSet> {
  const admin = createAdminSupabaseClient();
  const { data: analysis, error: analysisError } = await admin
    .from("analyses")
    .select("customer_id")
    .eq("id", analysisId)
    .maybeSingle();

  if (analysisError || !analysis?.customer_id) {
    throw sourceImagesUnavailable();
  }

  const displayOrders = SOURCE_VIEW_ORDER.map((source) => source.displayOrder);
  const { data: analysisImages, error: analysisImagesError } = await admin
    .from("analysis_images")
    .select("media_asset_id,display_order")
    .eq("analysis_id", analysisId)
    .in("display_order", displayOrders);

  if (analysisImagesError || analysisImages?.length !== SOURCE_VIEW_ORDER.length) {
    throw sourceImagesUnavailable();
  }

  const imageRows = analysisImages as unknown as AnalysisImageRow[];
  const imageByDisplayOrder = new Map(
    imageRows.map((row) => [row.display_order, row]),
  );
  const orderedImageRows = SOURCE_VIEW_ORDER.map((source) =>
    imageByDisplayOrder.get(source.displayOrder),
  );
  if (
    orderedImageRows.some((row) => !row) ||
    new Set(orderedImageRows.map((row) => row?.media_asset_id)).size !==
      SOURCE_VIEW_ORDER.length
  ) {
    throw sourceImagesUnavailable();
  }

  const mediaAssetIds = orderedImageRows.map((row) => row!.media_asset_id);
  if (mediaAssetIds.some((assetId) => !UUID_PATTERN.test(assetId))) {
    throw sourceImagesUnavailable();
  }
  const { data: mediaAssets, error: mediaAssetsError } = await admin
    .from("media_assets")
    .select("id,owner_id,bucket,path,mime_type,purpose,upload_status")
    .in("id", mediaAssetIds);

  if (mediaAssetsError || mediaAssets?.length !== SOURCE_VIEW_ORDER.length) {
    throw sourceImagesUnavailable();
  }

  const assetById = new Map(
    (mediaAssets as unknown as MediaAssetRow[]).map((asset) => [asset.id, asset]),
  );
  const orderedAssets = orderedImageRows.map((row, index) => {
    const asset = row ? assetById.get(row.media_asset_id) : undefined;
    const expected = SOURCE_VIEW_ORDER[index];
    if (
      !asset ||
      asset.owner_id !== analysis.customer_id ||
      asset.bucket !== SOURCE_IMAGE_BUCKET ||
      asset.upload_status !== "UPLOADED" ||
      asset.purpose !== expected.purpose ||
      !ALLOWED_SOURCE_IMAGE_MIME_TYPES.has(asset.mime_type) ||
      !asset.path.startsWith(`${analysis.customer_id}/`)
    ) {
      throw sourceImagesUnavailable();
    }
    return asset;
  });

  const signedUrls = await Promise.all(
    orderedAssets.map(async (asset) => {
      const { data, error } = await admin.storage
        .from(SOURCE_IMAGE_BUCKET)
        .createSignedUrl(asset.path, SOURCE_IMAGE_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        throw sourceImagesUnavailable();
      }
      return data.signedUrl;
    }),
  );

  if (signedUrls.length !== SOURCE_VIEW_ORDER.length) {
    throw sourceImagesUnavailable();
  }

  return {
    assetIds: mediaAssetIds as [string, string, string, string],
    imageUrls: signedUrls as [string, string, string, string],
    views: ["front", "right", "rear", "left"],
  };
}

function sourceImagesUnavailable() {
  return new ServiceUnavailableError("Analysis source images are unavailable", {
    retryable: false,
  });
}
