import { NextResponse } from "next/server";

import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate } from "@/server/auth/middleware";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const user = await authenticate(request);

    return NextResponse.json(
      {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        email: user.email,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
