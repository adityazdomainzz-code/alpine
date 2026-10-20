#!/usr/bin/env bash
# =====================================================================
#  RedPanel installer - Minecraft hosting panel (Docker, non-KVM ready)
#  1. Clones the panel repo from GitHub
#  2. Checks every required file/folder is there
#  3. Installs Docker, Node.js, pm2 (if missing)
#  4. Starts everything one by one: Docker -> Node daemon -> Panel -> (Tunnel)
#  5. Access: (1) Public IP  or  (2) Cloudflare Tunnel
#
#  Usage:  sudo bash install.sh              full install (panel + local node)
#          sudo bash install.sh --node-only  extra machine (node daemon only)
# =====================================================================
set -uo pipefail

REPO_URL="${REPO_URL:-https://github.com/adityazdomainzz-code/alpine.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/redpanel}"
DATA_DIR="${DATA_DIR:-/var/lib/redpanel}"
NODE_PORT="${NODE_PORT:-8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo /nonexistent)"
NODE_ONLY=0
[[ "${1:-}" == "--node-only" ]] && NODE_ONLY=1

R=$'\e[38;5;160m'; W=$'\e[97m'; G=$'\e[32m'; Y=$'\e[33m'; B=$'\e[1m'; N=$'\e[0m'
step() { echo; echo "${R}${B}❀ $*${N}"; }
ok()   { echo "  ${G}✔${N} $*"; }
warn() { echo "  ${Y}!${N} $*"; }
die()  { echo; echo "  ${R}✘ $*${N}"; exit 1; }
HAS_TTY=0; { : </dev/tty; } 2>/dev/null && HAS_TTY=1
ask()  { local q="$1" def="${2:-}" v=""; if [ "$HAS_TTY" = 1 ]; then read -rp "  ${W}${q}${N}${def:+ [$def]}: " v </dev/tty || true; fi; echo "${v:-$def}"; }
asks() { local q="$1" v=""; if [ "$HAS_TTY" = 1 ]; then read -rsp "  ${W}${q}${N}: " v </dev/tty || true; echo >&2; fi; echo "$v"; }

cat <<EOF
${R}
   ██████╗ ███████╗██████╗ ${W}██████╗  █████╗ ███╗   ██╗███████╗██╗     ${R}
   ██╔══██╗██╔════╝██╔══██╗${W}██╔══██╗██╔══██╗████╗  ██║██╔════╝██║     ${R}
   ██████╔╝█████╗  ██║  ██║${W}██████╔╝███████║██╔██╗ ██║█████╗  ██║     ${R}
   ██╔══██╗██╔══╝  ██║  ██║${W}██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║     ${R}
   ██║  ██║███████╗██████╔╝${W}██║     ██║  ██║██║ ╚████║███████╗███████╗${R}
   ╚═╝  ╚═╝╚══════╝╚═════╝ ${W}╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝${N}
        ${W}Minecraft Hosting Panel  ·  Docker  ·  non-KVM ready${N}
EOF

[ "$(id -u)" -eq 0 ] || die "Please run as root:  sudo bash install.sh"

# ---------------------------------------------------------------- packages
if   command -v apt-get >/dev/null; then PM=apt
elif command -v apk     >/dev/null; then PM=apk
elif command -v dnf     >/dev/null; then PM=dnf
elif command -v yum     >/dev/null; then PM=yum
else die "Unsupported OS (need apt, apk, dnf or yum)"; fi

PKG_LOG=/tmp/redpanel-pkg.log
fix_apt() {
  [ "$PM" = apt ] || return 0
  DEBIAN_FRONTEND=noninteractive dpkg --configure -a >>"$PKG_LOG" 2>&1 || true
  DEBIAN_FRONTEND=noninteractive apt-get -f install -y -qq >>"$PKG_LOG" 2>&1 || true
}
pkg() {
  local rc=0
  case $PM in
    apt) DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@" >>"$PKG_LOG" 2>&1 || rc=$?
         if [ $rc -ne 0 ]; then fix_apt; rc=0; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@" >>"$PKG_LOG" 2>&1 || rc=$?; fi ;;
    apk) apk add --no-cache -q "$@" >>"$PKG_LOG" 2>&1 || rc=$? ;;
    dnf) dnf install -y -q "$@" >>"$PKG_LOG" 2>&1 || rc=$? ;;
    yum) yum install -y -q "$@" >>"$PKG_LOG" 2>&1 || rc=$? ;;
  esac
  if [ $rc -ne 0 ]; then echo "  ${Y}--- last lines of $PKG_LOG ---${N}"; tail -n 15 "$PKG_LOG" | sed 's/^/    /'; fi
  return $rc
}

step "[1/7] Installing base packages"
: > "$PKG_LOG"
NEED=()
for c in git curl openssl tar; do command -v "$c" >/dev/null || NEED+=("$c"); done
[ "$PM" = apk ] && ! command -v bash >/dev/null && NEED+=(bash)
if [ ${#NEED[@]} -gt 0 ]; then
  fix_apt
  [ "$PM" = apt ] && { apt-get update -qq >>"$PKG_LOG" 2>&1 || warn "apt-get update had errors (continuing)"; }
  pkg "${NEED[@]}" ca-certificates || die "Could not install: ${NEED[*]}. Fix your package manager (sudo dpkg --configure -a && sudo apt-get -f install) and run again."
fi
ok "git, curl, openssl ready"

# ---------------------------------------------------------------- clone + verify
step "[2/7] Cloning repository  ${REPO_URL}"
TMP="$(mktemp -d)"
SRC="$TMP/repo"
if git clone -q --depth 1 -b "$REPO_BRANCH" "$REPO_URL" "$SRC" 2>/dev/null || git clone -q --depth 1 "$REPO_URL" "$SRC"; then
  ok "Cloned into $SRC"
else
  warn "Could not clone the repo"
  mkdir -p "$SRC"
fi

REQUIRED=(
  "panel/package.json" "panel/src/server.js" "panel/src/db.js" "panel/src/cli.js"
  "panel/public/index.html" "panel/public/css/style.css" "panel/public/js/app.js" "panel/public/js/flowers.js"
  "node/package.json" "node/src/daemon.js"
)
check_tree() { local base="$1" miss=0; for f in "${REQUIRED[@]}"; do [ -f "$base/$f" ] || miss=$((miss+1)); done; return $miss; }

# the files may sit at repo root or inside a sub folder
BASE=""
found="$(find "$SRC" -maxdepth 4 -path '*/panel/src/server.js' -not -path '*/node_modules/*' 2>/dev/null | head -n1)"
[ -n "$found" ] && BASE="${found%/panel/src/server.js}"

echo "  Checking files and folders:"
MISSING=0
for f in "${REQUIRED[@]}"; do
  if [ -n "$BASE" ] && [ -f "$BASE/$f" ]; then echo "    ${G}✔${N} $f"; else echo "    ${R}✘${N} $f"; MISSING=$((MISSING+1)); fi
done
if [ "$MISSING" -gt 0 ]; then
  if check_tree "$SCRIPT_DIR"; then
    warn "$MISSING file(s) missing in the GitHub repo - using the files next to install.sh instead"
    warn "Push the zip contents to $REPO_URL so future installs work from git"
    BASE="$SCRIPT_DIR"
  else
    die "$MISSING required file(s) missing. Upload the RedPanel zip contents (panel/, node/, install.sh) to the repo root and run again."
  fi
else
  ok "All ${#REQUIRED[@]} required files found"
fi

mkdir -p "$INSTALL_DIR" "$DATA_DIR/volumes"
tar -C "$BASE" --exclude='node_modules' --exclude='panel/data' --exclude='panel/config.json' --exclude='node/config.json' -cf - panel node \
  | tar -C "$INSTALL_DIR" -xf - || die "Copy failed"
cp -f "$BASE/install.sh" "$INSTALL_DIR/install.sh" 2>/dev/null || true
ok "Installed to $INSTALL_DIR (your data and config are kept on re-install)"

# ---------------------------------------------------------------- docker
step "[3/7] Docker"
if ! command -v docker >/dev/null; then
  if [ "$PM" = apk ]; then pkg docker docker-cli; else curl -fsSL https://get.docker.com | sh >/dev/null 2>&1 || die "Docker install failed"; fi
  ok "Docker installed"
fi
start_docker() {
  docker info >/dev/null 2>&1 && return 0
  (command -v systemctl >/dev/null && systemctl enable --now docker >/dev/null 2>&1) || true
  docker info >/dev/null 2>&1 && return 0
  (service docker start >/dev/null 2>&1 || rc-service docker start >/dev/null 2>&1) || true
  docker info >/dev/null 2>&1 && return 0
  # container VPS / no init system -> run dockerd directly
  warn "No init system for Docker - starting dockerd manually (container VPS mode)"
  nohup dockerd >/var/log/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}
start_docker || die "Docker daemon is not running. On a container VPS make sure it is privileged / nesting is enabled. Log: /var/log/dockerd.log"
ok "Docker is running ($(docker --version | cut -d, -f1))"
( docker pull -q itzg/minecraft-server:latest >/dev/null 2>&1 & )
ok "Pre-pulling the Minecraft image in the background"

# ---------------------------------------------------------------- node.js + pm2
step "[4/7] Node.js + pm2"
NODE_MAJOR=0
command -v node >/dev/null && NODE_MAJOR="$(node -v | sed 's/v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  case $PM in
    apt) curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1 && pkg nodejs ;;
    apk) pkg nodejs npm ;;
    dnf|yum) curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1 && pkg nodejs ;;
  esac
fi
command -v node >/dev/null || die "Node.js install failed"
ok "Node.js $(node -v)"
command -v pm2 >/dev/null || npm install -g pm2 --silent >/dev/null 2>&1 || die "pm2 install failed"
ok "pm2 $(pm2 -v 2>/dev/null | tail -n1)"

# ---------------------------------------------------------------- configure
step "[5/7] Configuration"
NODE_CFG="$INSTALL_DIR/node/config.json"
PANEL_CFG="$INSTALL_DIR/panel/config.json"
PUBLIC_IP="$(curl -4 -fsS --max-time 6 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 6 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
ENV_FILE="$INSTALL_DIR/.install.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

if [ ! -f "$NODE_CFG" ]; then
  NODE_TOKEN="$(openssl rand -hex 32)"
  NODE_HOST="127.0.0.1"; [ "$NODE_ONLY" = 1 ] && NODE_HOST="0.0.0.0"
  NODE_TOKEN="$NODE_TOKEN" NODE_HOST="$NODE_HOST" NODE_PORT="$NODE_PORT" DATA_DIR="$DATA_DIR" CFG="$NODE_CFG" node -e '
    const e=process.env; require("fs").writeFileSync(e.CFG, JSON.stringify({port:+e.NODE_PORT,host:e.NODE_HOST,token:e.NODE_TOKEN,dataDir:e.DATA_DIR+"/volumes",dockerSocket:"/var/run/docker.sock"},null,2));'
  chmod 600 "$NODE_CFG"
  ok "Node daemon config created"
else
  ok "Keeping existing node config"
fi
NODE_TOKEN="$(node -e 'console.log(require(process.argv[1]).token)' "$NODE_CFG")"

ACCESS_MODE="${ACCESS_MODE:-}"
if [ "$NODE_ONLY" = 0 ]; then
  if [ ! -f "$PANEL_CFG" ]; then
    echo
    echo "  ${B}How do you want to open the panel?${N}"
    echo "    ${R}1)${N} Public IP          http://${PUBLIC_IP}:PORT"
    echo "    ${R}2)${N} Cloudflare Tunnel  https://panel.yourdomain.com  (no open ports needed)"
    ACCESS_MODE="$(ask 'Choose 1 or 2' 1)"
    [[ "$ACCESS_MODE" =~ ^[12]$ ]] || ACCESS_MODE=1
    PANEL_PORT="$(ask 'Panel port' 8000)"
    PUBLIC_IP="$(ask 'Public IP players connect to' "$PUBLIC_IP")"
    ADMIN_USER="$(ask 'Admin username' admin)"
    ADMIN_EMAIL="$(ask 'Admin email' "admin@localhost")"
    ADMIN_PASS="$(asks 'Admin password (empty = generate)')"
    GEN_PASS=0
    if [ -z "$ADMIN_PASS" ] || [ "${#ADMIN_PASS}" -lt 6 ]; then ADMIN_PASS="$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 12)"; GEN_PASS=1; fi
    PANEL_HOST="0.0.0.0"; [ "$ACCESS_MODE" = 2 ] && PANEL_HOST="127.0.0.1"
    PANEL_PORT="$PANEL_PORT" PANEL_HOST="$PANEL_HOST" AU="$ADMIN_USER" AE="$ADMIN_EMAIL" AP="$ADMIN_PASS" NT="$NODE_TOKEN" NP="$NODE_PORT" IP="$PUBLIC_IP" CFG="$PANEL_CFG" node -e '
      const e=process.env; require("fs").writeFileSync(e.CFG, JSON.stringify({port:+e.PANEL_PORT,host:e.PANEL_HOST,admin:{username:e.AU,email:e.AE,password:e.AP},localNode:{url:"http://127.0.0.1:"+e.NP,token:e.NT,publicIp:e.IP}},null,2));'
    chmod 600 "$PANEL_CFG"
    if [ "$ACCESS_MODE" = 2 ] && [ -z "${CF_TUNNEL_TOKEN:-}" ]; then
      echo
      echo "  Cloudflare dashboard → Zero Trust → Networks → Tunnels → Create tunnel (cloudflared)."
      echo "  Copy the token from the install command, and add a Public Hostname → ${B}http://localhost:${PANEL_PORT}${N}"
      CF_TUNNEL_TOKEN="$(ask 'Paste tunnel token' '')"
      [ -n "$CF_TUNNEL_TOKEN" ] || { warn "No token - falling back to Public IP mode"; ACCESS_MODE=1; PANEL_HOST=0.0.0.0; node -e 'const f=process.argv[1],c=require(f);c.host="0.0.0.0";require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$PANEL_CFG"; }
    fi
    printf 'ACCESS_MODE=%q\nCF_TUNNEL_TOKEN=%q\n' "$ACCESS_MODE" "${CF_TUNNEL_TOKEN:-}" > "$ENV_FILE"; chmod 600 "$ENV_FILE"
    ok "Panel config created"
  else
    ok "Keeping existing panel config"
  fi
  PANEL_PORT="$(node -e 'console.log(require(process.argv[1]).port||8000)' "$PANEL_CFG")"
fi

# ---------------------------------------------------------------- npm install
step "[6/7] Installing dependencies"
( cd "$INSTALL_DIR/node" && npm install --omit=dev --no-audit --no-fund --silent ) || die "npm install failed (node)"
ok "node daemon dependencies"
if [ "$NODE_ONLY" = 0 ]; then
  ( cd "$INSTALL_DIR/panel" && npm install --omit=dev --no-audit --no-fund --silent ) || die "npm install failed (panel)"
  ok "panel dependencies"
fi

# ---------------------------------------------------------------- start one by one
step "[7/7] Starting services one by one"
wait_http() { for _ in $(seq 1 30); do curl -fsS "$1" >/dev/null 2>&1 && return 0; sleep 1; done; return 1; }

pm2 delete redpanel-node >/dev/null 2>&1 || true
pm2 start "$INSTALL_DIR/node/src/daemon.js" --name redpanel-node --cwd "$INSTALL_DIR/node" >/dev/null || die "Could not start node daemon"
wait_http "http://127.0.0.1:${NODE_PORT}/health" && ok "Node daemon online   :${NODE_PORT}" || die "Node daemon did not start - check: pm2 logs redpanel-node"

if [ "$NODE_ONLY" = 0 ]; then
  pm2 delete redpanel >/dev/null 2>&1 || true
  pm2 start "$INSTALL_DIR/panel/src/server.js" --name redpanel --cwd "$INSTALL_DIR/panel" >/dev/null || die "Could not start panel"
  wait_http "http://127.0.0.1:${PANEL_PORT}/health" && ok "Panel online         :${PANEL_PORT}" || die "Panel did not start - check: pm2 logs redpanel"

  if [ "${ACCESS_MODE:-1}" = 2 ] && [ -n "${CF_TUNNEL_TOKEN:-}" ]; then
    if ! command -v cloudflared >/dev/null; then
      case "$(uname -m)" in x86_64) CA=amd64;; aarch64|arm64) CA=arm64;; armv7l|armv6l) CA=arm;; *) CA=amd64;; esac
      curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$CA" && chmod +x /usr/local/bin/cloudflared || die "cloudflared download failed"
    fi
    pm2 delete redpanel-tunnel >/dev/null 2>&1 || true
    pm2 start "$(command -v cloudflared)" --name redpanel-tunnel -- tunnel --no-autoupdate run --token "$CF_TUNNEL_TOKEN" >/dev/null && ok "Cloudflare tunnel started" || warn "Tunnel failed - check: pm2 logs redpanel-tunnel"
  fi
fi

pm2 save >/dev/null 2>&1
if command -v systemctl >/dev/null && [ -d /run/systemd/system ]; then
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 && ok "Auto-start on boot enabled (systemd)"
else
  cat > "$INSTALL_DIR/start.sh" <<'EOS'
#!/usr/bin/env bash
# Auto-start for container VPS without systemd
docker info >/dev/null 2>&1 || { nohup dockerd >/var/log/dockerd.log 2>&1 & sleep 8; }
pm2 resurrect
EOS
  chmod +x "$INSTALL_DIR/start.sh"
  if command -v crontab >/dev/null; then
    ( crontab -l 2>/dev/null | grep -v redpanel/start.sh; echo "@reboot $INSTALL_DIR/start.sh >/var/log/redpanel-boot.log 2>&1" ) | crontab -
    ok "Auto-start on boot via cron @reboot"
  else
    warn "No systemd/cron: after a reboot run  bash $INSTALL_DIR/start.sh"
  fi
fi
rm -rf "$TMP"

# ---------------------------------------------------------------- summary
echo
echo "${R}${B}  ❀ ════════════════════════════════════════════════ ❀${N}"
if [ "$NODE_ONLY" = 1 ]; then
  echo "  ${G}${B}Node daemon installed!${N}  Add it in Panel → Admin → Nodes:"
  echo "    Daemon URL : ${B}http://${PUBLIC_IP}:${NODE_PORT}${N}"
  echo "    Token      : ${B}${NODE_TOKEN}${N}"
  echo "    Public IP  : ${B}${PUBLIC_IP}${N}"
  echo "  Open TCP ${NODE_PORT} (to the panel) and 25565-25665 (players)."
else
  echo "  ${G}${B}RedPanel is ready!${N}"
  if [ "${ACCESS_MODE:-1}" = 2 ] && [ -n "${CF_TUNNEL_TOKEN:-}" ]; then
    echo "    Panel  : ${B}https://<the hostname you set in the tunnel>${N}"
  else
    echo "    Panel  : ${B}http://${PUBLIC_IP}:${PANEL_PORT}${N}"
  fi
  if [ -n "${ADMIN_USER:-}" ]; then
    echo "    Login  : ${B}${ADMIN_USER}${N}"
    [ "${GEN_PASS:-0}" = 1 ] && echo "    Pass   : ${B}${ADMIN_PASS}${N}   (generated - change it in Account info)"
  fi
  echo "    Local node is already set up. Minecraft ports: 25565-25665 (open them in your firewall)."
  echo "    Logs   : pm2 logs redpanel   |   pm2 logs redpanel-node"
  echo "    Reset admin: cd $INSTALL_DIR/panel && node src/cli.js <user> <newpass> && pm2 restart redpanel"
fi
echo "${R}${B}  ❀ ════════════════════════════════════════════════ ❀${N}"
