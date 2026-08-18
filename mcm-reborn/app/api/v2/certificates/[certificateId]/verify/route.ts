import { handleApiError } from "@/server/auth/errorHandler";
import { verifyCertificate } from "@/server/applications/v2-application-service";
import { jsonApiResult } from "@/server/applications/v2-route-utils";
import { parseUuid } from "@/server/applications/v2-validation";

export const runtime = "nodejs";

type CertificateRouteContext = {
  params: Promise<{ certificateId: string }>;
};

export async function GET(
  _request: Request,
  { params }: CertificateRouteContext,
): Promise<Response> {
  try {
    const { certificateId: rawCertificateId } = await params;
    return jsonApiResult(await verifyCertificate(
      parseUuid(rawCertificateId, "certificateId"),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
