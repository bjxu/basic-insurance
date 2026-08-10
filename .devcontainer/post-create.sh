#!/usr/bin/env bash
# Runs once after the devcontainer is created.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Authenticate gh CLI from the local secret file, if present.
# .devcontainer/.secrets/gh-token is git-ignored and never committed.
#
# We use `gh auth login --with-token` rather than `export GH_TOKEN` so the
# credential is persisted via gh's own auth store (~/.config/gh/hosts.yml)
# and is available in every shell opened later in this container, not just
# this script's process — exporting GH_TOKEN here would only live for this
# script and its children. `--with-token` accepts both classic PATs
# (ghp_...) and OAuth tokens (gho_...) without validating the prefix, and
# doesn't guarantee the token's scopes are sufficient, so we verify with
# `gh auth status` right after. Failure here (expired/revoked/under-scoped
# token) is a warning, not a hard stop — the rest of setup still runs.
TOKEN_FILE=".devcontainer/.secrets/gh-token"
if [ -f "$TOKEN_FILE" ]; then
  if gh auth login --with-token < "$TOKEN_FILE" && gh auth status; then
    echo "gh authenticated successfully."
  else
    echo "WARNING: gh auth login/status failed (expired, revoked, or under-scoped token?) — continuing setup without gh auth." >&2
  fi
else
  echo "No $TOKEN_FILE found — skipping gh auth login."
fi

# Install the Claude Code CLI, matching the host's install method (the
# official native installer, not an npm package). It places the binary at
# ~/.local/bin/claude; this image's .profile + /etc/profile.d already put
# ~/.local/bin on PATH for interactive shells (what VS Code's terminal
# spawns), so no extra PATH wiring is needed. Idempotent, and a failure
# here is a warning, not a hard stop.
if command -v claude >/dev/null 2>&1; then
  echo "claude already installed: $(claude --version)"
elif curl -fsSL https://claude.ai/install.sh | bash; then
  echo "claude installed: $("$HOME/.local/bin/claude" --version)"
else
  echo "WARNING: Claude Code install failed — continuing setup without it." >&2
fi

# Install JS dependencies once a package.json exists.
if [ -f package.json ]; then
  npm install
else
  echo "No package.json yet — skipping npm install."
fi
