import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { handleApiError } from '@/server/auth/errorHandler';
import { ValidationError, ForbiddenError } from '@/contracts/errors';
import { z } from 'zod';

const DemoLoginSchema = z.object({
  demoAccount: z.enum(['CUSTOMER', 'OPERATOR']),
});

/**
 * POST /api/v1/auth/demo-login
 * 해커톤 데모 계정 로그인 (ENABLE_DEMO_LOGIN=true 환경에서만)
 */
export async function POST(request: NextRequest) {
  try {
    // Check if demo login is enabled
    if (process.env.ENABLE_DEMO_LOGIN !== 'true') {
      throw new ForbiddenError('Demo login is not enabled');
    }

    const body = await request.json();
    const { demoAccount } = DemoLoginSchema.parse(body);

    // Demo account email mapping
    const demoEmails: Record<string, string> = {
      CUSTOMER: 'demo-customer@mcm-reborn.example',
      OPERATOR: 'demo-operator@mcm-reborn.example',
    };

    const email = demoEmails[demoAccount];
    const password = 'demo-password-2026';

    // Sign in with demo account
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      throw new ValidationError('Demo account authentication failed', {
        supabaseError: error?.message,
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      throw new ValidationError('Demo account profile not found');
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        role: profile.role,
        displayName: profile.display_name,
        email: data.user.email,
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Invalid request body', { zodErrors: error.issues }));
    }
    return handleApiError(error);
  }
}
