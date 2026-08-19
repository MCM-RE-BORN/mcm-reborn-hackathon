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

const LoginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(256),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = LoginSchema.parse(await readJsonBody(request));
    const publicClient = createPublicSupabaseClient();
    const { data, error } = await publicClient.auth.signInWithPassword(body);
    if (error) {
      if (typeof error.status === "number" && error.status >= 500) {
        throw new ServiceUnavailableError("Supabase Auth is unavailable");
      }
      throw new ForbiddenError("아이디 또는 비밀번호를 확인해 주세요.");
    }
    if (!data.user || !data.session || !data.user.email) {
      throw new UpstreamError("Supabase Auth returned an incomplete session");
    }

    const userClient = createUserSupabaseClient(data.session.access_token);
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role, display_name")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) {
      throw new ServiceUnavailableError("Supabase profile storage is unavailable");
    }
    if (
      !profile ||
      !["CUSTOMER", "OPERATOR"].includes(profile.role) ||
      !profile.display_name.trim()
    ) {
      throw new ForbiddenError("계정 프로필을 확인할 수 없습니다.");
    }

    const expiresAtSeconds =
      data.session.expires_at ??
      Math.floor(Date.now() / 1000) + data.session.expires_in;
    if (!Number.isFinite(expiresAtSeconds)) {
      throw new UpstreamError("Supabase Auth returned an invalid expiry");
    }

    return NextResponse.json(
      {
        session: {
          accessToken: data.session.access_token,
          expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
          refreshToken: data.session.refresh_token || null,
        },
        user: {
          displayName: profile.display_name,
          email: data.user.email,
          id: data.user.id,
          role: profile.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError("로그인 정보가 올바르지 않습니다.", zodErrorDetails(error)),
      );
    }
    return handleApiError(error);
  }
}
