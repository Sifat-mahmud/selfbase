#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║              SelfBase — Service Manager                             ║
# ║                                                                      ║
# ║  ./manage.sh start       Start all services (production)            ║
# ║  ./manage.sh dev          Start in development mode                 ║
# ║  ./manage.sh stop         Stop all services                         ║
# ║  ./manage.sh restart      Restart all services                      ║
# ║  ./manage.sh status       Show service status                       ║
# ║  ./manage.sh logs         Tail logs from all services               ║
# ║  ./manage.sh update       Pull latest code & rebuild                ║
# ║  ./manage.sh reset-db     Wipe and recreate the database            ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─── Configuration ───────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PID_DIR="$SCRIPT_DIR/.pids"
LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

MAIN_PORT="${PORT:-3000}"
REALTIME_PORT=3003
SCHEDULER_PORT=3010

# Ensure bun is in PATH
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

# ─── Helper Functions ────────────────────────────────────────────────────────

is_running() {
    local pid_file="$1"
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -s --connect-timeout 1 "http://localhost:${port}" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

status_icon() {
    if is_running "$1"; then
        echo -e "${GREEN}● RUNNING${NC}"
    else
        echo -e "${RED}○ STOPPED${NC}"
    fi
}

print_banner() {
    echo -e ""
    echo -e "${BOLD}${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}  ║           SelfBase Service Manager        ║${NC}"
    echo -e "${BOLD}${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
    echo -e ""
}

# ─── Start Production ────────────────────────────────────────────────────────
cmd_start() {
    print_banner
    echo -e "${BOLD}Starting SelfBase in production mode...${NC}\n"

    # Check if already running
    if is_running "$PID_DIR/main.pid" && is_running "$PID_DIR/realtime.pid" && is_running "$PID_DIR/scheduler.pid"; then
        echo -e "  ${YELLOW}⚠ All services are already running${NC}"
        echo -e "  Use ${CYAN}./manage.sh restart${NC} to restart, or ${CYAN}./manage.sh stop${NC} first."
        return 0
    fi

    # Check if build exists
    if [[ ! -d ".next/standalone" ]]; then
        echo -e "  ${RED}✖ Production build not found.${NC}"
        echo -e "  Run ${CYAN}./manage.sh build${NC} first, or use ${CYAN}./manage.sh dev${NC} for development."
        return 1
    fi

    # Ensure database exists
    if [[ ! -f "db/custom.db" ]]; then
        echo -e "  ${YELLOW}⚠ Database not found, creating...${NC}"
        mkdir -p db
        bun run db:generate 2>/dev/null
        bun run db:push 2>/dev/null
    fi

    # Start Realtime Service
    echo -e "  ${CYAN}→${NC} Starting realtime service (port ${REALTIME_PORT})..."
    cd mini-services/realtime-service
    nohup bun index.ts > "$LOG_DIR/realtime.log" 2>&1 &
    echo $! > "$PID_DIR/realtime.pid"
    cd "$SCRIPT_DIR"
    sleep 1
    if is_running "$PID_DIR/realtime.pid"; then
        echo -e "  ${GREEN}✔${NC} Realtime service started (PID: $(cat "$PID_DIR/realtime.pid"))"
    else
        echo -e "  ${RED}✖${NC} Realtime service failed to start"
    fi

    # Start Pipeline Scheduler
    echo -e "  ${CYAN}→${NC} Starting pipeline scheduler (port ${SCHEDULER_PORT})..."
    cd mini-services/pipeline-scheduler
    nohup bun index.ts > "$LOG_DIR/scheduler.log" 2>&1 &
    echo $! > "$PID_DIR/scheduler.pid"
    cd "$SCRIPT_DIR"
    sleep 1
    if is_running "$PID_DIR/scheduler.pid"; then
        echo -e "  ${GREEN}✔${NC} Pipeline scheduler started (PID: $(cat "$PID_DIR/scheduler.pid"))"
    else
        echo -e "  ${RED}✖${NC} Pipeline scheduler failed to start"
    fi

    # Start Main Next.js Server (standalone)
    echo -e "  ${CYAN}→${NC} Starting SelfBase server (port ${MAIN_PORT})..."
    export NODE_ENV=production
    export PORT="$MAIN_PORT"
    export HOSTNAME="0.0.0.0"
    # Use absolute path for DATABASE_URL — standalone server runs from .next/standalone/
    export DATABASE_URL="file:${SCRIPT_DIR}/db/custom.db"

    cd .next/standalone
    # Copy static files and public into standalone if not already there
    if [[ ! -d ".next/static" ]]; then
        cp -r "$SCRIPT_DIR/.next/static" .next/ 2>/dev/null || true
    fi
    if [[ ! -d "public" ]]; then
        cp -r "$SCRIPT_DIR/public" . 2>/dev/null || true
    fi
    # Copy db directory into standalone for SQLite access
    if [[ ! -d "db" ]]; then
        cp -r "$SCRIPT_DIR/db" . 2>/dev/null || true
    fi
    # Update .env in standalone to point to the correct DB location
    echo "DATABASE_URL=file:${SCRIPT_DIR}/db/custom.db" > .env

    nohup bun server.js > "$LOG_DIR/main.log" 2>&1 &
    echo $! > "$PID_DIR/main.pid"
    cd "$SCRIPT_DIR"
    sleep 2

    if wait_for_port "$MAIN_PORT" "Main server" 15; then
        echo -e "  ${GREEN}✔${NC} SelfBase server started (PID: $(cat "$PID_DIR/main.pid"))"
    else
        echo -e "  ${RED}✖${NC} SelfBase server may have failed to start — check ${LOG_DIR}/main.log"
    fi

    echo -e ""
    echo -e "  ${BOLD}${GREEN}SelfBase is running!${NC}"
    echo -e "  Open ${CYAN}http://localhost:${MAIN_PORT}${NC} in your browser."
    echo -e ""
    echo -e "  ${DIM}Logs: ${LOG_DIR}/${NC}"
    echo -e "  ${DIM}PIDs: ${PID_DIR}/${NC}"
    echo -e ""
}

# ─── Start Development ──────────────────────────────────────────────────────
cmd_dev() {
    print_banner
    echo -e "${BOLD}Starting SelfBase in development mode...${NC}\n"

    # Start Realtime Service
    echo -e "  ${CYAN}→${NC} Starting realtime service (port ${REALTIME_PORT})..."
    cd mini-services/realtime-service
    nohup bun index.ts > "$LOG_DIR/realtime.log" 2>&1 &
    echo $! > "$PID_DIR/realtime.pid"
    cd "$SCRIPT_DIR"

    # Start Pipeline Scheduler
    echo -e "  ${CYAN}→${NC} Starting pipeline scheduler (port ${SCHEDULER_PORT})..."
    cd mini-services/pipeline-scheduler
    nohup bun index.ts > "$LOG_DIR/scheduler.log" 2>&1 &
    echo $! > "$PID_DIR/scheduler.pid"
    cd "$SCRIPT_DIR"

    sleep 1

    # Start Next.js dev server (foreground)
    echo -e "  ${CYAN}→${NC} Starting Next.js dev server (port ${MAIN_PORT})..."
    echo -e "  ${DIM}Mini-services running in background. Press Ctrl+C to stop all.${NC}"
    echo -e ""

    # Trap to clean up background services on exit
    cleanup_dev() {
        echo -e "\n  ${YELLOW}Stopping all services...${NC}"
        for pid_file in "$PID_DIR/realtime.pid" "$PID_DIR/scheduler.pid"; do
            if [[ -f "$pid_file" ]]; then
                kill "$(cat "$pid_file")" 2>/dev/null || true
                rm -f "$pid_file"
            fi
        done
        echo -e "  ${GREEN}✔ All services stopped${NC}"
        exit 0
    }
    trap cleanup_dev INT TERM

    bun run dev
}

# ─── Stop ────────────────────────────────────────────────────────────────────
cmd_stop() {
    print_banner
    echo -e "${BOLD}Stopping all SelfBase services...${NC}\n"

    local stopped=0
    for service in main realtime scheduler; do
        local pid_file="$PID_DIR/${service}.pid"
        if is_running "$pid_file"; then
            local pid
            pid=$(cat "$pid_file")
            echo -e "  ${CYAN}→${NC} Stopping ${service} (PID: ${pid})..."
            kill "$pid" 2>/dev/null || true

            # Wait for process to die (up to 5s)
            local timeout=5
            while [[ $timeout -gt 0 ]] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done

            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi

            rm -f "$pid_file"
            echo -e "  ${GREEN}✔${NC} ${service} stopped"
            stopped=$((stopped + 1))
        else
            rm -f "$pid_file"
            echo -e "  ${DIM}○ ${service} not running${NC}"
        fi
    done

    if [[ $stopped -eq 0 ]]; then
        echo -e "\n  ${YELLOW}No services were running${NC}"
    else
        echo -e "\n  ${GREEN}✔ ${stopped} service(s) stopped${NC}"
    fi
}

# ─── Status ──────────────────────────────────────────────────────────────────
cmd_status() {
    print_banner

    echo -e "  ${BOLD}Service Status:${NC}\n"

    # Main server
    echo -ne "  SelfBase Server   :${MAIN_PORT}   "
    status_icon "$PID_DIR/main.pid"

    # Realtime
    echo -ne "  Realtime Service  :${REALTIME_PORT}   "
    status_icon "$PID_DIR/realtime.pid"

    # Scheduler
    echo -ne "  Pipeline Scheduler:${SCHEDULER_PORT}  "
    status_icon "$PID_DIR/scheduler.pid"

    echo -e ""

    # Quick health checks if running
    if is_running "$PID_DIR/main.pid"; then
        local setup_status
        setup_status=$(curl -s --connect-timeout 2 "http://localhost:${MAIN_PORT}/api/auth/setup" 2>/dev/null || echo '{"error":"unreachable"}')
        echo -e "  ${DIM}Setup: ${setup_status}${NC}"
    fi

    if is_running "$PID_DIR/realtime.pid"; then
        local realtime_status
        realtime_status=$(curl -s --connect-timeout 2 "http://localhost:${REALTIME_PORT}/health" 2>/dev/null || echo '{"error":"unreachable"}')
        echo -e "  ${DIM}Realtime: ${realtime_status}${NC}"
    fi

    if is_running "$PID_DIR/scheduler.pid"; then
        local scheduler_status
        scheduler_status=$(curl -s --connect-timeout 2 "http://localhost:${SCHEDULER_PORT}/api/health" 2>/dev/null || echo '{"error":"unreachable"}')
        echo -e "  ${DIM}Scheduler: ${scheduler_status}${NC}"
    fi

    echo -e ""
    echo -e "  ${DIM}PID files: ${PID_DIR}/${NC}"
    echo -e "  ${DIM}Log files: ${LOG_DIR}/${NC}"
    echo -e ""
}

# ─── Logs ────────────────────────────────────────────────────────────────────
cmd_logs() {
    local service="${1:-all}"
    local lines="${2:-50}"

    echo -e "${BOLD}SelfBase Logs (last ${lines} lines)${NC}\n"

    case "$service" in
        main|next|app)
            tail -n "$lines" -f "$LOG_DIR/main.log" 2>/dev/null || echo "No main log found"
            ;;
        realtime|ws|socket)
            tail -n "$lines" -f "$LOG_DIR/realtime.log" 2>/dev/null || echo "No realtime log found"
            ;;
        scheduler|pipeline)
            tail -n "$lines" -f "$LOG_DIR/scheduler.log" 2>/dev/null || echo "No scheduler log found"
            ;;
        all|"")
            echo -e "${CYAN}── Main Server ──${NC}"
            tail -n "$lines" "$LOG_DIR/main.log" 2>/dev/null || echo "(no log)"
            echo -e "\n${CYAN}── Realtime Service ──${NC}"
            tail -n "$lines" "$LOG_DIR/realtime.log" 2>/dev/null || echo "(no log)"
            echo -e "\n${CYAN}── Pipeline Scheduler ──${NC}"
            tail -n "$lines" "$LOG_DIR/scheduler.log" 2>/dev/null || echo "(no log)"
            ;;
        *)
            echo -e "${RED}Unknown service: ${service}${NC}"
            echo -e "Use: main, realtime, scheduler, or all"
            ;;
    esac
}

# ─── Build ───────────────────────────────────────────────────────────────────
cmd_build() {
    print_banner
    echo -e "${BOLD}Building SelfBase for production...${NC}\n"

    echo -e "  ${CYAN}→${NC} Generating Prisma client..."
    bun run db:generate

    echo -e "  ${CYAN}→${NC} Building Next.js (standalone)..."
    bun run build

    echo -e "\n  ${GREEN}✔ Build complete!${NC}"
    echo -e "  Run ${CYAN}./manage.sh start${NC} to start the production server."
}

# ─── Update ──────────────────────────────────────────────────────────────────
cmd_update() {
    print_banner
    echo -e "${BOLD}Updating SelfBase...${NC}\n"

    # Stop services first
    echo -e "  ${CYAN}→${NC} Stopping running services..."
    cmd_stop 2>/dev/null || true

    # Pull latest code
    echo -e "  ${CYAN}→${NC} Pulling latest code from Git..."
    git fetch origin main --quiet
    git reset --hard origin/main --quiet 2>/dev/null || git pull origin main --quiet

    # Install dependencies
    echo -e "  ${CYAN}→${NC} Installing dependencies..."
    bun install

    # Install mini-service dependencies
    if [[ -d "mini-services/realtime-service" ]]; then
        cd mini-services/realtime-service && bun install && cd "$SCRIPT_DIR"
    fi
    if [[ -d "mini-services/pipeline-scheduler" ]]; then
        cd mini-services/pipeline-scheduler && bun install && cd "$SCRIPT_DIR"
    fi

    # Generate Prisma client
    echo -e "  ${CYAN}→${NC} Updating database schema..."
    bun run db:generate
    bun run db:push

    # Build
    echo -e "  ${CYAN}→${NC} Rebuilding..."
    bun run build

    echo -e "\n  ${GREEN}✔ Update complete!${NC}"
    echo -e "  Run ${CYAN}./manage.sh start${NC} to start the updated server."
}

# ─── Reset Database ─────────────────────────────────────────────────────────
cmd_reset_db() {
    print_banner
    echo -e "${BOLD}${RED}⚠  WARNING: This will delete all data!${NC}\n"

    read -rp "  Are you sure? Type 'yes' to confirm: " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo -e "  ${YELLOW}Cancelled.${NC}"
        return 0
    fi

    # Stop services
    cmd_stop 2>/dev/null || true

    # Remove database
    echo -e "  ${CYAN}→${NC} Removing existing database..."
    rm -f db/custom.db db/custom.db-shm db/custom.db-wal

    # Recreate
    echo -e "  ${CYAN}→${NC} Creating fresh database..."
    bun run db:generate
    bun run db:push

    echo -e "\n  ${GREEN}✔ Database reset complete!${NC}"
    echo -e "  Run ${CYAN}./manage.sh start${NC} to start with a fresh database."
}

# ─── Help ────────────────────────────────────────────────────────────────────
cmd_help() {
    print_banner
    echo -e "  ${BOLD}Usage:${NC} ./manage.sh <command>\n"
    echo -e "  ${GREEN}start${NC}       Start all services in production mode"
    echo -e "  ${GREEN}dev${NC}         Start in development mode (hot reload)"
    echo -e "  ${GREEN}stop${NC}        Stop all running services"
    echo -e "  ${GREEN}restart${NC}     Restart all services"
    echo -e "  ${GREEN}status${NC}      Show status of all services"
    echo -e "  ${GREEN}build${NC}       Build for production (without starting)"
    echo -e "  ${GREEN}logs${NC}        View logs (optional: main, realtime, scheduler, all)"
    echo -e "  ${GREEN}update${NC}      Pull latest code, rebuild & restart"
    echo -e "  ${GREEN}reset-db${NC}    Delete database and start fresh"
    echo -e "  ${GREEN}help${NC}        Show this help message"
    echo -e ""
    echo -e "  ${DIM}Examples:${NC}"
    echo -e "    ${YELLOW}./manage.sh start${NC}              # Start production server"
    echo -e "    ${YELLOW}./manage.sh logs realtime${NC}       # Tail realtime service logs"
    echo -e "    ${YELLOW}./manage.sh logs main 100${NC}       # Last 100 lines of main log"
    echo -e "    ${YELLOW}./manage.sh update${NC}              # Pull latest & rebuild"
    echo -e ""
}

# ─── Command Router ──────────────────────────────────────────────────────────
case "${1:-help}" in
    start)    cmd_start ;;
    dev)      cmd_dev ;;
    stop)     cmd_stop ;;
    restart)  cmd_stop; sleep 2; cmd_start ;;
    status)   cmd_status ;;
    build)    cmd_build ;;
    logs)     cmd_logs "${2:-all}" "${3:-50}" ;;
    update)   cmd_update ;;
    reset-db) cmd_reset_db ;;
    help|--help|-h)
        cmd_help ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        cmd_help
        exit 1
        ;;
esac
