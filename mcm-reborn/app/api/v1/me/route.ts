import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';

/**
 * GET /api/v1/me
 * 현재 로그인 사용자 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    return NextResponse.json({
      id: user.id,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
