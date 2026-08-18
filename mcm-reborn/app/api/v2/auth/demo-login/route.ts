import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ForbiddenError,
  ServiceUnavailableError,
  UpstreamError,
  ValidationError,
} from "@/contracts/errors";
import {
  createPublicSupabaseClient,
  createUserSupabaseClient,
} from "@/lib/supabase/server";
import { handleApiError } from "@/server/auth/errorHandler";
import { readJsonBody, zodErrorDetails } from "@/server/http/json";

export const runtime = "nodejs";

const DemoLoginSchema = z
  .object({
    demoAccount: z.enum(["CUSTOMER", "OPERATOR"]),
  })
  .strict();

type DemoAccount = z.infer<typeof DemoLoginSchema>["demoAccount"];

export async function POST(request: Request): Promise<NextResponse> {
  try {
    if (process.env.ENABLE_DEMO_LOGIN !== "true") {
      throw new ForbiddenError("Demo login is not enabled");
    }

    const body = DemoLoginSchema.parse(await readJsonBody(request));
    const credentials = readDemoCredentials(body.demoAccount);
    const publicClient = createPublicSupabaseClient();
    const { data, error } = await publicClient.auth.signInWithPassword(
      credentials,
    );

    if (error) {
      if (typeof error.status === "number" && error.status >= 500) {
        throw new ServiceUnavailableError("Supabase Auth is unavailable");
      }
      throw new ForbiddenError("Demo account authentication failed");
    }
    if (!data.user || !data.session) {
      throw new UpstreamError("Supabase Auth returned an incomplete session");
    }

    const userClient = createUserSupabaseClient(data.session.access_token);
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role, display_name")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) {
      throw new ServiceUnavailableError(
        "Supabase profile storage is unavailable",
      );
    }
    if (
      !profile ||
      profile.role !== body.demoAccount ||
      typeof profile.display_name !== "string" ||
      profile.display_name.trim().length === 0 ||
      typeof data.user.email !== "string" ||
      data.user.email.length === 0
    ) {
      throw new ForbiddenError("Demo account profile is not available");
    }

    const expiresAtSeconds = data.session.expires_at ??
      Math.floor(Date.now() / 1000) + data.session.expires_in;
    if (!Number.isFinite(expiresAtSeconds)) {
      throw new UpstreamError("Supabase Auth returned an invalid expiry");
    }

    return NextResponse.json(
      {
        user: {
          id: data.user.id,
          role: profile.role,
          displayName: profile.display_name,
          email: data.user.email,
        },
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token || null,
          expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError("Invalid request body", zodErrorDetails(error)),
      );
    }
    return handleApiError(error);
  }
}

function readDemoCredentials(demoAccount: DemoAccount): {
  email: string;
  password: string;
} {
  const email = process.env[
    demoAccount === "CUSTOMER"
      ? "DEMO_CUSTOMER_EMAIL"
      : "DEMO_OPERATOR_EMAIL"
  ]?.trim();
  const password = process.env[
    demoAccount === "CUSTOMER"
      ? "DEMO_CUSTOMER_PASSWORD"
      : "DEMO_OPERATOR_PASSWORD"
  ];

  if (!email || !password) {
    throw new ServiceUnavailableError(
      "Demo account credentials are not configured",
      { retryable: false },
    );
  }

  return { email, password };
}
