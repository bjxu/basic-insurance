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

The site is a Vue 3 + Vite SPA (see [../README.md](../README.md)). The deployed app
itself makes no outbound API calls — real health-insurance premiums ship as a static
JSON file regenerated offline. `opendata.bagnet.ch` (BAG's official premium dataset)
and `www.priminfo.admin.ch` (the official municipality/postcode premium-region lookup)
are allowlisted only so `npm run build:data` can run from inside the container; the
app's own `npm run dev`/`build`/`preview` never touch either.

## Ports

`5173` (the Vite dev server) is forwarded by default. Run `npm run dev` inside the
container and open the forwarded port.
