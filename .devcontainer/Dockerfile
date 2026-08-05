# Isolated dev container for Claude Code running with --dangerously-skip-permissions.
# Network egress is locked down by init-firewall.sh (run as root via sudo at container
# start) so the agent can only reach GitHub, npm, and the Anthropic API — nothing else.
FROM node:20

ARG TZ
ENV TZ="$TZ"

# Base dev tools + iptables/ipset/dns tooling needed by init-firewall.sh
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  ca-certificates \
  curl \
  nano \
  vim \
  && rm -rf /var/lib/apt/lists/*

ARG USERNAME=node

# Persist bash history across container rebuilds (bind-mounted volume, see devcontainer.json)
RUN mkdir -p /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

ENV DEVCONTAINER=true

# Workspace + Claude config + global npm prefix dirs (created as root, owned by node)
RUN mkdir -p /workspace /home/node/.claude /usr/local/share/npm-global && \
  chown -R node:node /workspace /home/node/.claude /usr/local/share/npm-global

WORKDIR /workspace

USER node

ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
ENV SHELL=/bin/zsh

# Friendly interactive shell (non-essential, safe to remove if you want a smaller image)
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v1.2.0/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Claude Code CLI itself
RUN npm install -g @anthropic-ai/claude-code

# Firewall script: installed as root, runnable by node via passwordless sudo only for this script
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
