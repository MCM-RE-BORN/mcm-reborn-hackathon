import { NextResponse } from "next/server";

import {
  assertSupabaseServerConfiguration,
  createPublicSupabaseClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API_VERSION = "2.0.0";
const HEALTH_TIMEOUT_MS = 3_000;
const AI_MODES = ["DEMO_FIXTURE", "SEEDED_ESTIMATE", "LIVE"] as const;

type AiMode = (typeof AI_MODES)[number];

export async function GET(): Promise<NextResponse> {
  const configuredAiMode = process.env.AI_MODE?.trim();
  const aiMode: AiMode = isAiMode(configuredAiMode)
    ? configuredAiMode
    : "DEMO_FIXTURE";
  let healthy = configuredAiMode === undefined || isAiMode(configuredAiMode);

  if (aiMode === "LIVE" && !hasExternalAiConfiguration()) {
    healthy = false;
  }

  try {
    assertSupabaseServerConfiguration();
    if (!hasDemoLoginConfiguration()) {
      healthy = false;
    }

    const publicClient = createPublicSupabaseClient();
    const { error } = await publicClient
      .from("products")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(HEALTH_TIMEOUT_MS));
    if (error) {
      healthy = false;
    }
  } catch {
    // Health responses intentionally disclose neither missing variable names nor
    // Supabase error details. `degraded` covers configuration and connectivity.
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      aiMode,
    },
    {
      headers: { "Cache-Control": "no-store" },
      status: 200,
    },
  );
}

function hasExternalAiConfiguration(): boolean {
  return (
    process.env.ENABLE_EXTERNAL_AI === "true" &&
    Boolean(process.env.EXTERNAL_AI_PRIVACY_NOTICE_VERSION?.trim()) &&
    Boolean(process.env.OPENAI_API_KEY?.trim()) &&
    Boolean(process.env.OPENAI_VISION_MODEL?.trim())
  );
}

function isAiMode(value: string | undefined): value is AiMode {
  return AI_MODES.some((mode) => mode === value);
}

function hasDemoLoginConfiguration(): boolean {
  if (process.env.ENABLE_DEMO_LOGIN !== "true") {
    return true;
  }

  return [
    process.env.DEMO_CUSTOMER_EMAIL,
    process.env.DEMO_CUSTOMER_PASSWORD,
    process.env.DEMO_OPERATOR_EMAIL,
    process.env.DEMO_OPERATOR_PASSWORD,
  ].every((value) => typeof value === "string" && value.trim().length > 0);
}
