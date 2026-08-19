import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabasePublicConfig = {
  publishableKey: string;
  url: string;
};

type SupabaseServerConfig = SupabasePublicConfig & {
  serviceRoleKey: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]", "localhost"]);

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase server configuration is unavailable");
    this.name = "SupabaseConfigurationError";
  }
}

/**
 * Creates an unauthenticated Supabase client for public Auth and RLS access.
 * Environment variables are read lazily so a missing local integration does not
 * crash `next build` or the Fixture-only UI at module import time.
 */
export function createPublicSupabaseClient(): SupabaseClient {
  const config = readPublicConfig();

  return createClient(config.url, config.publishableKey, clientOptions());
}

/**
 * Creates a request-scoped client whose PostgREST and Storage calls carry the
 * caller's JWT. This is the default for reads/writes covered by Supabase RLS.
 */
export function createUserSupabaseClient(
  accessToken: string,
): SupabaseClient {
  const config = readPublicConfig();
  const token = accessToken.trim();
  if (!token) {
    throw new SupabaseConfigurationError();
  }

  return createClient(config.url, config.publishableKey, {
    ...clientOptions(),
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Creates a server-only service-role client. Callers must authenticate and
 * authorize the user before using this RLS-bypassing client.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const config = readServerConfig();

  return createClient(config.url, config.serviceRoleKey, clientOptions());
}

/** Returns only whether all server-side Supabase variables are syntactically valid. */
export function assertSupabaseServerConfiguration(): void {
  readServerConfig();
}

function clientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  } as const;
}

function readPublicConfig(): SupabasePublicConfig {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!rawUrl || !publishableKey) {
    throw new SupabaseConfigurationError();
  }

  return {
    publishableKey,
    url: normalizeSupabaseUrl(rawUrl),
  };
}

function readServerConfig(): SupabaseServerConfig {
  const publicConfig = readPublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new SupabaseConfigurationError();
  }

  return { ...publicConfig, serviceRoleKey };
}

function normalizeSupabaseUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SupabaseConfigurationError();
  }

  const allowedProtocol =
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
  if (!allowedProtocol || url.username || url.password) {
    throw new SupabaseConfigurationError();
  }

  return url.origin;
}
