import { NextResponse } from 'next/server';

/**
 * GET /api/v1/health
 * API 상태 확인 (인증 불필요)
 */
export async function GET() {
  const aiMode = process.env.AI_MODE ?? 'hybrid';

  return NextResponse.json({
    status: 'ok',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    aiMode,
  });
}
