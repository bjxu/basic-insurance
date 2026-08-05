#!/bin/bash
# Runs once the container is created: locks down the network, then wires up
# GitHub auth so `git push` / `gh pr create` work from inside the sandbox.
set -euo pipefail

echo "==> Locking down network egress"
sudo /usr/local/bin/init-firewall.sh

# Carry over just name/email from the host's ~/.gitconfig (mounted read-only at a
# different path) into a real, writable ~/.gitconfig in the container. We copy fields
# rather than bind-mounting the file itself so `gh auth setup-git` below can write to it.
if [ -f /home/node/.gitconfig-host ]; then
  echo "==> Setting git identity from host .gitconfig"
  name=$(git config -f /home/node/.gitconfig-host user.name 2>/dev/null || true)
  email=$(git config -f /home/node/.gitconfig-host user.email 2>/dev/null || true)
  [ -n "$name" ] && git config --global user.name "$name"
  [ -n "$email" ] && git config --global user.email "$email"
fi

if [ -f /home/node/.gh-token ]; then
  echo "==> Configuring gh auth from mounted token"
  gh auth login --with-token < /home/node/.gh-token
  gh auth setup-git
else
  echo "==> No /home/node/.gh-token mounted; skipping gh auth (git push/gh pr will not work)"
fi

echo "==> Done. Run 'claude --dangerously-skip-permissions' to start."
