# Dev container: isolated sandbox for Claude Code

This container exists so `claude --dangerously-skip-permissions` (which lets Claude run
shell commands without asking) can be run safely: it's confined to this repo's checkout
and a firewall (`init-firewall.sh`) restricts *all* outbound network traffic to GitHub,
the npm registry, and the Anthropic API. Anything else — including arbitrary
exfiltration targets — is dropped.

## First-time setup

1. **Open in VS Code**: open the `basic-insurance` folder, then run
   *Dev Containers: Reopen in Container* (Command Palette). VS Code builds the image and
   runs `postCreate.sh`, which enables the firewall and configures `gh`/`git` auth from
   the token in `.devcontainer/.secrets/gh-token`.
   - No VS Code? Use the CLI instead: `npx @devcontainers/cli up --workspace-folder .`
     then `npx @devcontainers/cli exec --workspace-folder . zsh`.
2. **Verify the firewall** came up cleanly — the postCreate log should show:
   ```
   OK: https://example.com is blocked as expected
   OK: https://api.github.com is reachable as expected
   ```
3. In the container terminal:
   ```
   claude --dangerously-skip-permissions
   ```

## About the mounted GitHub token

`.devcontainer/.secrets/gh-token` holds a copy of your `gh auth token` (scopes: `gist`,
`read:org`, `repo`) so Claude can `git push` / `gh pr create` from inside the container.
It's bind-mounted **read-only**, is `.gitignore`d, and never gets baked into the image.

- It's a live credential — treat the file like a password.
- Revoke/rotate any time from the host: `gh auth refresh` (or revoke the token in
  GitHub Settings → Developer settings → Personal access tokens), then re-run:
  ```
  gh auth token > .devcontainer/.secrets/gh-token && chmod 600 .devcontainer/.secrets/gh-token
  ```
- If you'd rather Claude *not* be able to push on its own, delete
  `.devcontainer/.secrets/gh-token` — `postCreate.sh` skips the `gh auth` step when it's
  missing, and you push from the host yourself after reviewing `git diff`.

## Adjusting the firewall allowlist

The stack for this project isn't set up yet, so only GitHub/npm/Anthropic are
allowlisted. If the site ends up fetching data from somewhere else (e.g. a Swiss
open-data API for insurance premiums), add its domain to the `for domain in ...` loop
in `init-firewall.sh` and rebuild the container.

## Ports

`3000, 4200, 5173, 8080` are forwarded by default (common dev-server ports for
Next/CRA, Angular, Vite, and generic servers). Edit `forwardPorts` in
`devcontainer.json` once the project's actual dev server is in place.
