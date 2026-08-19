import {
  callUserRpc,
  executeIdempotentOperatorCommand,
  postgrestEquals,
  readUserTableRows,
  rejectInvalidField,
  type JsonObject,
  type OperatorCommandContext,
} from "@/server/operator-api";
import { SubmitPhysicalInspectionRequestSchema } from "@/server/applications/v2-validation";

export const runtime = "nodejs";

type InspectionRouteContext = {
  params: Promise<{ applicationId: string }>;
};

type InspectionCommand = {
  confirmedReusableAreaCm2: number;
  confirmedReusableMaterialRate: number;
  outcome: "NO_CHANGE" | "CHANGE_REQUIRED" | "PRODUCTION_UNAVAILABLE";
  proposedTerms: JsonObject | null;
  reason: string;
};

type InspectionRpcRow = {
  application_id: string;
  application_status: string;
  change_request_id: string | null;
  inspected_at: string;
  inspection_id: string;
  inspection_outcome: string;
};

type ChangeRequestRow = {
  application_id: string;
  created_at: string;
  id: string;
  inspection_id: string;
  previous_terms: JsonObject;
  proposed_terms: JsonObject;
  reason: string;
  responded_at: string | null;
  status: string;
};

export async function POST(
  request: Request,
  { params }: InspectionRouteContext,
): Promise<Response> {
  const { applicationId } = await params;

  return executeIdempotentOperatorCommand({
    applicationId,
    execute: executeInspection,
    normalizeBody: normalizeInspection,
    operation: "submitPhysicalInspection",
    request,
  });
}

function normalizeInspection(value: unknown): InspectionCommand {
  const parsed = SubmitPhysicalInspectionRequestSchema.safeParse(value);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.map(String).join(".") || "body";
    rejectInvalidField(field);
  }

  return {
    confirmedReusableAreaCm2: parsed.data.confirmedReusableAreaCm2,
    confirmedReusableMaterialRate:
      parsed.data.confirmedReusableMaterialRate,
    outcome: parsed.data.outcome,
    proposedTerms: (
      parsed.data.proposedTerms as JsonObject | null | undefined
    ) ?? null,
    reason: parsed.data.reason,
  };
}

async function executeInspection(
  context: OperatorCommandContext,
  command: InspectionCommand,
): Promise<{ body: JsonObject; status: number }> {
  const rows = await callUserRpc<InspectionRpcRow[]>(
    context,
    "submit_physical_inspection",
    {
      p_application_id: context.applicationId,
      p_confirmed_reusable_area_cm2: command.confirmedReusableAreaCm2,
      p_confirmed_reusable_material_rate:
        command.confirmedReusableMaterialRate,
      p_outcome: command.outcome,
      p_proposed_terms: command.proposedTerms,
      p_reason: command.reason,
    },
  );
  const row = singleInspectionRow(rows, context.applicationId);
  const profileQuery = new URLSearchParams({
    id: postgrestEquals(context.userId),
    limit: "1",
    select: "id,display_name",
  });
  const profiles = await readUserTableRows<{
    display_name: string;
    id: string;
  }>(context, "profiles", profileQuery);
  const profile = profiles[0];
  if (!profile || typeof profile.display_name !== "string") {
    throw new Error("Invalid inspector profile response");
  }

  const changeRequest = row.change_request_id
    ? await readChangeRequest(context, row.change_request_id)
    : null;
  if (command.outcome === "CHANGE_REQUIRED" && !changeRequest) {
    throw new Error("Inspection RPC did not return its atomic change request");
  }

  return {
    body: {
      applicationId: row.application_id,
      applicationStatus: row.application_status,
      changeRequest,
      id: row.inspection_id,
      inspectedAt: row.inspected_at,
      inspectedBy: {
        displayName: profile.display_name,
        id: profile.id,
      },
      outcome: row.inspection_outcome,
    },
    status: 200,
  };
}

async function readChangeRequest(
  context: OperatorCommandContext,
  changeRequestId: string,
): Promise<JsonObject> {
  const query = new URLSearchParams({
    id: postgrestEquals(changeRequestId),
    limit: "1",
    select: [
      "id",
      "application_id",
      "inspection_id",
      "status",
      "reason",
      "previous_terms",
      "proposed_terms",
      "created_at",
      "responded_at",
    ].join(","),
  });
  const rows = await readUserTableRows<ChangeRequestRow>(
    context,
    "application_change_requests",
    query,
  );
  const row = rows[0];
  if (!row || row.application_id !== context.applicationId) {
    throw new Error("Invalid inspection change request response");
  }
  return {
    applicationId: row.application_id,
    createdAt: row.created_at,
    id: row.id,
    inspectionId: row.inspection_id,
    previousTerms: row.previous_terms,
    proposedTerms: row.proposed_terms,
    reason: row.reason,
    respondedAt: row.responded_at,
    status: row.status,
  };
}

function singleInspectionRow(
  rows: InspectionRpcRow[],
  applicationId: string,
): InspectionRpcRow {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("Invalid inspection RPC response");
  }
  const row = rows[0];
  if (
    !row ||
    row.application_id !== applicationId ||
    typeof row.application_status !== "string" ||
    typeof row.inspected_at !== "string" ||
    typeof row.inspection_id !== "string" ||
    typeof row.inspection_outcome !== "string" ||
    (row.change_request_id !== null &&
      typeof row.change_request_id !== "string")
  ) {
    throw new Error("Invalid inspection RPC response");
  }
  return row;
}
