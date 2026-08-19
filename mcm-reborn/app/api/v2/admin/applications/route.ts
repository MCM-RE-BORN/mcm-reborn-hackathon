import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import { listApplicationsForOperator } from "@/server/applications/v2-application-service";
import {
  jsonApiResult,
  readOperatorQuery,
  readStatusFilter,
} from "@/server/applications/v2-route-utils";
import { parsePagination } from "@/server/applications/v2-validation";

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["OPERATOR"]);
    const { page, size } = parsePagination(request);
    return jsonApiResult(await listApplicationsForOperator(user, {
      page,
      query: readOperatorQuery(request),
      size,
      status: readStatusFilter(request),
    }));
  } catch (error) {
    return handleApiError(error);
  }
}
