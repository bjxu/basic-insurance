import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the Turbopack/Tailwind project root to this checkout. Without this,
  // Next.js infers the root from the nearest ancestor with a lockfile — in a
  // git-worktree layout (this repo keeps worktrees under .claude/worktrees/,
  // each with its own package-lock.json) that ancestor search can walk out
  // to the outer checkout, causing Tailwind's automatic class scanner to
  // scan sibling worktrees and unrelated files (e.g. markdown docs) instead
  // of just this project's source.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
