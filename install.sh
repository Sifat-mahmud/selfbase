#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║                    SelfBase — VPS Installer                         ║
# ║                                                                      ║
# ║  Usage:                                                              ║
# ║    curl -fsSL https://raw.githubusercontent.com/Sifat-mahmud/        ║
# ║      selfbase/main/install.sh | bash                                 ║
# ║                                                                      ║
# ║  Or clone first and run:                                             ║
# ║    git clone https://github.com/Sifat-mahmud/selfbase.git            ║
# ║    cd selfbase && chmod +x install.sh && ./install.sh                ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ─── Colors & Logging ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_step()   { echo -e "\n${BOLD}${BLUE}━━━${NC} ${BOLD}$1${NC} ${BLUE}━━━${NC}\n"; }
log_ok()     { echo -e "  ${GREEN}✔${NC} $1"; }
log_warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; }
log_err()    { echo -e "  ${RED}✖${NC} $1"; }
log_info()   { echo -e "  ${CYAN}→${NC} $1"; }

# ─── Configuration ───────────────────────────────────────────────────────────
REPO_URL="https://github.com/Sifat-mahmud/selfbase.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/selfbase}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3000}"

# ─── Pre-flight Checks ──────────────────────────────────────────────────────
log_step "SelfBase Installer — Pre-flight Checks"

# Check OS
OS_ID=$(cat /etc/os-release 2>/dev/null | grep '^ID=' | head -1 | cut -d= -f2 | tr -d '"' || echo "unknown")
OS_VERSION=$(cat /etc/os-release 2>/dev/null | grep '^VERSION_ID=' | head -1 | cut -d= -f2 | tr -d '"' || echo "unknown")

if [[ "$OS_ID" =~ ^(ubuntu|debian|centos|fedora|rhel|rocky|almalinux|amzn|arch|manjaro)$ ]]; then
    log_ok "OS: ${OS_ID} ${OS_VERSION}"
else
    log_warn "Untested OS: ${OS_ID} ${OS_VERSION} — proceeding anyway"
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "x86_64" ]]; then
    log_ok "Architecture: x86_64"
elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
    log_ok "Architecture: ARM64"
else
    log_warn "Untested architecture: ${ARCH}"
fi

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log_warn "Running as root — recommended: use a non-root user with sudo"
    SUDO=""
else
    SUDO="sudo"
fi

# ─── Install System Dependencies ────────────────────────────────────────────
log_step "Installing System Dependencies"

install_packages() {
    if command -v apt-get &>/dev/null; then
        $SUDO apt-get update -qq
        $SUDO apt-get install -y -qq curl git unzip build-essential python3 ca-certificates
    elif command -v dnf &>/dev/null; then
        $SUDO dnf install -y curl git unzip gcc gcc-c++ make python3 ca-certificates
    elif command -v yum &>/dev/null; then
        $SUDO yum install -y curl git unzip gcc gcc-c++ make python3 ca-certificates
    elif command -v pacman &>/dev/null; then
        $SUDO pacman -Sy --noconfirm curl git unzip base-devel python3 ca-certificates
    else
        log_warn "Unknown package manager — skipping system package installation"
    fi
}

# Check curl
if ! command -v curl &>/dev/null; then
    log_info "curl not found, installing system packages..."
    install_packages
else
    log_ok "curl is available"
fi

# Check git
if ! command -v git &>/dev/null; then
    log_info "git not found, installing system packages..."
    install_packages
else
    log_ok "git is available"
fi

# ─── Install Bun ─────────────────────────────────────────────────────────────
log_step "Installing Bun Runtime"

if command -v bun &>/dev/null; then
    BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
    log_ok "Bun already installed (v${BUN_VERSION})"
else
    log_info "Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    # Source bun into current shell
    export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
    export PATH="$BUN_INSTALL/bin:$PATH"

    if command -v bun &>/dev/null; then
        BUN_VERSION=$(bun --version)
        log_ok "Bun installed (v${BUN_VERSION})"
    else
        log_err "Failed to install Bun"
        exit 1
    fi
fi

# ─── Clone Repository ────────────────────────────────────────────────────────
log_step "Cloning SelfBase Repository"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
    log_info "Directory ${INSTALL_DIR} already exists, pulling latest..."
    cd "$INSTALL_DIR"
    git fetch origin "$BRANCH" --quiet
    git reset --hard "origin/${BRANCH}" --quiet 2>/dev/null || true
    log_ok "Repository updated"
else
    log_info "Cloning into ${INSTALL_DIR}..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" --quiet
    log_ok "Repository cloned"
fi

cd "$INSTALL_DIR"

# ─── Install Dependencies ────────────────────────────────────────────────────
log_step "Installing Project Dependencies"

log_info "Installing main project dependencies..."
bun install
log_ok "Main dependencies installed"

# Install mini-service dependencies
if [[ -d "mini-services/realtime-service" ]]; then
    log_info "Installing realtime service dependencies..."
    cd mini-services/realtime-service && bun install && cd "$INSTALL_DIR"
    log_ok "Realtime service dependencies installed"
fi

if [[ -d "mini-services/pipeline-scheduler" ]]; then
    log_info "Installing pipeline scheduler dependencies..."
    cd mini-services/pipeline-scheduler && bun install && cd "$INSTALL_DIR"
    log_ok "Pipeline scheduler dependencies installed"
fi

# ─── Setup Database ──────────────────────────────────────────────────────────
log_step "Setting Up Database"

# Ensure db directory exists
mkdir -p db

# Set up .env if not exists
if [[ ! -f .env ]]; then
    echo "DATABASE_URL=file:./db/custom.db" > .env
    log_ok "Created .env with default DATABASE_URL"
else
    log_ok ".env already exists"
fi

# Generate Prisma client and push schema
log_info "Generating Prisma client..."
bun run db:generate
log_ok "Prisma client generated"

log_info "Pushing database schema..."
bun run db:push
log_ok "Database schema synchronized"

# ─── Build Project ───────────────────────────────────────────────────────────
log_step "Building SelfBase (Production)"

log_info "Building Next.js with standalone output..."
bun run build
log_ok "Build complete — standalone output ready"

# ─── Make Scripts Executable ─────────────────────────────────────────────────
chmod +x manage.sh 2>/dev/null || true
chmod +x install.sh 2>/dev/null || true

# ─── Summary ─────────────────────────────────────────────────────────────────
log_step "Installation Complete!"

echo -e ""
echo -e "${BOLD}${GREEN}  ╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}  ║            SelfBase Installed Successfully!             ║${NC}"
echo -e "${BOLD}${GREEN}  ╚══════════════════════════════════════════════════════════╝${NC}"
echo -e ""
echo -e "  ${CYAN}Project directory:${NC}  ${INSTALL_DIR}"
echo -e "  ${CYAN}Database:${NC}           ${INSTALL_DIR}/db/custom.db"
echo -e "  ${CYAN}Web port:${NC}           ${PORT}"
echo -e "  ${CYAN}Realtime port:${NC}      3003"
echo -e "  ${CYAN}Scheduler port:${NC}     3010"
echo -e ""
echo -e "  ${BOLD}Quick Start:${NC}"
echo -e ""
echo -e "    ${YELLOW}cd ${INSTALL_DIR}${NC}"
echo -e "    ${YELLOW}./manage.sh start${NC}          # Start all services (production)"
echo -e ""
echo -e "  ${BOLD}Or run in dev mode:${NC}"
echo -e ""
echo -e "    ${YELLOW}cd ${INSTALL_DIR}${NC}"
echo -e "    ${YELLOW}./manage.sh dev${NC}            # Start in development mode"
echo -e ""
echo -e "  ${BOLD}Other commands:${NC}"
echo -e ""
echo -e "    ${YELLOW}./manage.sh status${NC}         # Check service status"
echo -e "    ${YELLOW}./manage.sh stop${NC}           # Stop all services"
echo -e "    ${YELLOW}./manage.sh restart${NC}        # Restart all services"
echo -e "    ${YELLOW}./manage.sh logs${NC}           # View logs"
echo -e "    ${YELLOW}./manage.sh update${NC}         # Pull latest & rebuild"
echo -e "    ${YELLOW}./manage.sh reset-db${NC}       # Reset database (fresh start)"
echo -e ""
echo -e "  ${BOLD}Open your browser:${NC} ${CYAN}http://localhost:${PORT}${NC}"
echo -e ""
