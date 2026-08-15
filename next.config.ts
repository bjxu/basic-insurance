import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin the Turbopack project root to this checkout. Without this, Next.js
  // infers the root from the nearest ancestor with a lockfile — in a
  // git-worktree layout (this repo keeps worktrees under .claude/worktrees/,
  // each with its own package-lock.json) that ancestor search can walk out
  // to the outer checkout, which caused the dev server to crash. This pin
  // is unrelated to Tailwind's content scanning: that's now bounded by
  // `source(none)` + `@source "../"` in src/app/globals.css, which is what
  // actually stops Tailwind from scanning outside src/.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withNextIntl(nextConfig);
