#!/bin/bash
# Locks down outbound network to an allowlist so that a Claude Code session running
# with --dangerously-skip-permissions cannot exfiltrate data or reach arbitrary hosts,
# even though it can run any shell command inside the container.
#
# Allowed: DNS, loopback, the container's own host network (for VS Code's dev tooling),
# GitHub (git/API), the npm registry, and the Anthropic API. Everything else is dropped.
set -euo pipefail
IFS=$'\n\t'

# --- Flush existing rules -------------------------------------------------
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
ipset destroy allowed-domains 2>/dev/null || true

# --- Baseline: DNS, SSH, loopback -----------------------------------------
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --sport 22 -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# --- Build the allowlist ipset --------------------------------------------
ipset create allowed-domains hash:net

echo "Fetching GitHub IP ranges..."
gh_ranges=$(curl -s https://api.github.com/meta)
if [ -z "$gh_ranges" ]; then
  echo "ERROR: Failed to fetch GitHub IP ranges"
  exit 1
fi
if ! echo "$gh_ranges" | jq -e '.web and .api and .git' >/dev/null; then
  echo "ERROR: GitHub API response missing required fields"
  exit 1
fi

echo "Adding GitHub IP ranges..."
while read -r cidr; do
  [[ "$cidr" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$ ]] || { echo "ERROR: bad CIDR from GitHub meta: $cidr"; exit 1; }
  ipset add allowed-domains "$cidr"
done < <(echo "$gh_ranges" | jq -r '(.web + .api + .git)[]' | aggregate -q)

# Other allowed domains: npm registry + Anthropic API/telemetry + BAG open data
# (opendata.bagnet.ch serves the official Swiss health insurance premium dataset used
# by scripts/build-premium-data.mjs; see .devcontainer/README.md).
for domain in \
  "registry.npmjs.org" \
  "api.anthropic.com" \
  "statsig.anthropic.com" \
  "statsig.com" \
  "sentry.io" \
  "opendata.bagnet.ch"; do
  echo "Resolving $domain..."
  ips=$(dig +short A "$domain" || true)
  if [ -z "$ips" ]; then
    echo "WARNING: could not resolve $domain, skipping"
    continue
  fi
  while read -r ip; do
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    ipset add allowed-domains "$ip"
  done <<<"$ips"
done

# --- Allow the container's own host network (VS Code server, port forwarding) ----
HOST_IP=$(ip route | grep default | cut -d" " -f3 || true)
if [ -n "$HOST_IP" ]; then
  HOST_NETWORK=$(echo "$HOST_IP" | sed 's/\.[0-9]*$/.0\/24/')
  echo "Host network detected as: $HOST_NETWORK"
  iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
  iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT
fi

# --- Lock everything else down --------------------------------------------
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP

iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

iptables -A OUTPUT -m set --match-set allowed-domains dst -j ACCEPT

echo "Firewall configuration complete."

# --- Self-test -------------------------------------------------------------
echo "Verifying firewall rules..."
if curl --connect-timeout 5 https://example.com >/dev/null 2>&1; then
  echo "ERROR: firewall verification FAILED - reached https://example.com (should be blocked)"
  exit 1
else
  echo "OK: https://example.com is blocked as expected"
fi

if ! curl --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
  echo "ERROR: firewall verification FAILED - could not reach https://api.github.com"
  exit 1
else
  echo "OK: https://api.github.com is reachable as expected"
fi
