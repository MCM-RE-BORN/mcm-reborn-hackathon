import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import { getApplicationTimeline } from "@/server/applications/v2-application-service";
import { jsonApiResult } from "@/server/applications/v2-route-utils";
import { parseUuid } from "@/server/applications/v2-validation";

type ApplicationRouteContext = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(
  request: Request,
  { params }: ApplicationRouteContext,
): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const { applicationId: rawApplicationId } = await params;
    return jsonApiResult(await getApplicationTimeline(
      user,
      parseUuid(rawApplicationId, "applicationId"),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}
