import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import {
  createApplication,
  deterministicResourceId,
  executeIdempotentApplicationCommand,
  listMyApplications,
} from "@/server/applications/v2-application-service";
import {
  jsonApiResult,
  parseJsonRequest,
  readStatusFilter,
} from "@/server/applications/v2-route-utils";
import {
  CreateApplicationRequestSchema,
  parsePagination,
  readIdempotencyKey,
} from "@/server/applications/v2-validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const idempotencyKey = readIdempotencyKey(request);
    const body = await parseJsonRequest(request, CreateApplicationRequestSchema);
    const operation = "createApplication";
    const applicationId = deterministicResourceId(
      user.id,
      operation,
      idempotencyKey,
    );
    const result = await executeIdempotentApplicationCommand({
      body,
      execute: () => createApplication(user, body, applicationId),
      idempotencyKey,
      operation,
      resourceId: applicationId,
      user,
    });
    return jsonApiResult(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const { page, size } = parsePagination(request);
    return jsonApiResult(await listMyApplications(user, {
      page,
      size,
      status: readStatusFilter(request),
    }));
  } catch (error) {
    return handleApiError(error);
  }
}
