import type { NextConfig } from "next";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd(), "..");

const nextConfig: NextConfig = {
  // The canonical API fixture lives at the repository root. Both Turbopack
  // resolution and production output tracing must include that monorepo level
  // when the Next.js project root is `mcm-reborn/`.
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
  },
};

export default nextConfig;
