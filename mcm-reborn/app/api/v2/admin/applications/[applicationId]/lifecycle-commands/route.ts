import {
  assertAllowedKeys,
  assertPlainObject,
  assertRequiredString,
  callUserRpc,
  executeIdempotentOperatorCommand,
  optionalString,
  postgrestEquals,
  readUserTableRows,
  rejectInvalidField,
  type JsonObject,
  type OperatorCommandContext,
} from "@/server/operator-api";
import {
  isLifecycleCommandTarget,
  type LifecycleCommandTarget,
} from "@/data/application-lifecycle";

export const runtime = "nodejs";

const DEFAULT_CARRIER_CODE = "MCM_REBORN_DEMO";
const DEFAULT_CARRIER_NAME = "MCM RE:BORN Demo Logistics";

type LifecycleCommand = {
  carrierCode: string | null;
  carrierName: string | null;
  note: string | null;
  targetStatus: LifecycleCommandTarget;
  trackingNumber: string | null;
};

type LifecycleRpcRow = {
  application_id: string;
  application_status: string;
  occurred_at: string;
  previous_status: string;
  shipment_id: string | null;
};

type ShipmentRow = {
  application_id: string;
  carrier_code: string;
  carrier_name: string;
  status: string;
  tracking_number: string;
};

type LifecycleRouteContext = {
  params: Promise<{ applicationId: string }>;
};

export async function POST(
  request: Request,
  { params }: LifecycleRouteContext,
): Promise<Response> {
  const { applicationId } = await params;

  return executeIdempotentOperatorCommand({
    applicationId,
    execute: executeLifecycleCommand,
    normalizeBody: normalizeLifecycleCommand,
    operation: "advanceApplicationLifecycle",
    request,
  });
}

function normalizeLifecycleCommand(value: unknown): LifecycleCommand {
  const body = assertPlainObject(value);
  assertAllowedKeys(body, [
    "targetStatus",
    "note",
    "trackingNumber",
    "carrierCode",
    "carrierName",
  ]);

  const targetStatus = assertRequiredString(
    body.targetStatus,
    "targetStatus",
    40,
  );
  if (!isLifecycleCommandTarget(targetStatus)) {
    rejectInvalidField("targetStatus");
  }

  const note = optionalString(body.note, "note", 500);
  const trackingNumber = optionalString(
    body.trackingNumber,
    "trackingNumber",
    120,
  );
  const requestedCarrierCode = optionalString(
    body.carrierCode,
    "carrierCode",
    40,
  );
  const requestedCarrierName = optionalString(
    body.carrierName,
    "carrierName",
    100,
  );

  if (targetStatus === "SHIPPED") {
    if (!trackingNumber) {
      rejectInvalidField("trackingNumber");
    }
  } else if (
    Object.hasOwn(body, "trackingNumber") ||
    Object.hasOwn(body, "carrierCode") ||
    Object.hasOwn(body, "carrierName")
  ) {
    rejectInvalidField("trackingNumber");
  }

  const carrierCode = targetStatus === "SHIPPED"
    ? requestedCarrierCode ?? DEFAULT_CARRIER_CODE
    : null;
  const carrierName = targetStatus === "SHIPPED"
    ? requestedCarrierName ?? DEFAULT_CARRIER_NAME
    : null;

  return {
    carrierCode,
    carrierName,
    note,
    targetStatus,
    trackingNumber,
  };
}

async function executeLifecycleCommand(
  context: OperatorCommandContext,
  command: LifecycleCommand,
): Promise<{ body: JsonObject; status: number }> {
  const rows = await callUserRpc<LifecycleRpcRow[]>(
    context,
    "advance_application_lifecycle",
    {
      p_application_id: context.applicationId,
      p_carrier_code: command.carrierCode,
      p_carrier_name: command.carrierName,
      p_note: command.note,
      p_target_status: command.targetStatus,
      p_tracking_number: command.trackingNumber,
    },
  );

  const row = singleRpcRow(rows);
  if (row.application_id !== context.applicationId) {
    throw new Error("Invalid lifecycle RPC response");
  }
  const shipment = row.shipment_id
    ? await readShipment(context, row.shipment_id)
    : null;

  return {
    body: {
      applicationId: row.application_id,
      applicationStatus: row.application_status,
      occurredAt: row.occurred_at,
      previousStatus: row.previous_status,
      shipment,
    },
    status: 200,
  };
}

async function readShipment(
  context: OperatorCommandContext,
  shipmentId: string,
): Promise<JsonObject | null> {
  const query = new URLSearchParams({
    id: postgrestEquals(shipmentId),
    limit: "1",
    select:
      "application_id,carrier_code,carrier_name,tracking_number,status",
  });
  const rows = await readUserTableRows<ShipmentRow>(
    context,
    "mock_shipments",
    query,
  );
  const shipment = rows[0];
  if (!shipment) {
    throw new Error("Shipment returned by lifecycle RPC was not readable");
  }
  if (
    shipment.application_id !== context.applicationId ||
    typeof shipment.carrier_code !== "string" ||
    typeof shipment.carrier_name !== "string" ||
    typeof shipment.status !== "string" ||
    typeof shipment.tracking_number !== "string"
  ) {
    throw new Error("Invalid shipment response");
  }

  return {
    applicationId: shipment.application_id,
    carrierCode: shipment.carrier_code,
    carrierName: shipment.carrier_name,
    status: shipment.status,
    trackingNumber: shipment.tracking_number,
    trackingUrl: null,
  };
}

function singleRpcRow(rows: LifecycleRpcRow[]): LifecycleRpcRow {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("Invalid lifecycle RPC response");
  }
  const row = rows[0];
  if (
    !row ||
    typeof row.application_id !== "string" ||
    typeof row.application_status !== "string" ||
    typeof row.occurred_at !== "string" ||
    typeof row.previous_status !== "string" ||
    (row.shipment_id !== null && typeof row.shipment_id !== "string")
  ) {
    throw new Error("Invalid lifecycle RPC response");
  }

  return row;
}
