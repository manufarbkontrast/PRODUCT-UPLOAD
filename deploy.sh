#!/usr/bin/env bash
# ============================================================
# SPZ Product Upload - Deploy Script
# Deployt die App auf produkt.crftn.de (91.99.3.104)
# ============================================================
set -euo pipefail

# -- Konfiguration --
SERVER_IP="91.99.3.104"
SERVER_USER="root"
DEPLOY_DIR="/opt/spz-product-upload"
REPO_URL="https://github.com/manufarbkontrast/spz-product-upload.git"
DOMAIN="produkt.crftn.de"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_TEMPLATE="${SCRIPT_DIR}/.env.production.template"

# -- Farben --
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { printf "${BLUE}[INFO]${NC}  %s\n" "$1"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
err()   { printf "${RED}[FEHLER]${NC} %s\n" "$1"; }

# -- Hilfsfunktionen --
ssh_cmd() {
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_IP}" "$@"
}

# ============================================================
# Schritt 1: SSH-Verbindung pruefen
# ============================================================
step_ssh_check() {
    info "Pruefe SSH-Verbindung zu ${SERVER_USER}@${SERVER_IP}..."
    if ssh_cmd "echo ok" >/dev/null 2>&1; then
        ok "SSH-Verbindung hergestellt"
    else
        err "SSH-Verbindung fehlgeschlagen!"
        echo ""
        echo "Stelle sicher, dass:"
        echo "  - SSH-Key eingerichtet ist (ssh-copy-id ${SERVER_USER}@${SERVER_IP})"
        echo "  - Der Server erreichbar ist"
        exit 1
    fi
}

# ============================================================
# Schritt 2: Docker pruefen
# ============================================================
step_docker_check() {
    info "Pruefe Docker auf dem Server..."
    if ssh_cmd "docker --version && docker compose version" >/dev/null 2>&1; then
        ok "Docker und Docker Compose sind installiert"
    else
        err "Docker oder Docker Compose nicht gefunden!"
        echo "Installiere Docker: https://docs.docker.com/engine/install/"
        exit 1
    fi
}

# ============================================================
# Schritt 3: Repository klonen oder aktualisieren
# ============================================================
step_repo_setup() {
    info "Richte Repository ein auf ${DEPLOY_DIR}..."
    if ssh_cmd "test -d ${DEPLOY_DIR}/.git"; then
        info "Repository existiert bereits, aktualisiere..."
        ssh_cmd "cd ${DEPLOY_DIR} && git fetch origin && git reset --hard origin/main"
        ok "Repository aktualisiert"
    else
        info "Klone Repository..."
        ssh_cmd "mkdir -p $(dirname "${DEPLOY_DIR}") && git clone ${REPO_URL} ${DEPLOY_DIR}"
        ok "Repository geklont nach ${DEPLOY_DIR}"
    fi
}

# ============================================================
# Schritt 4: .env Datei einrichten
# ============================================================
step_env_setup() {
    info "Richte .env-Datei ein..."

    if ssh_cmd "test -f ${DEPLOY_DIR}/.env"; then
        warn ".env existiert bereits auf dem Server"
        echo ""
        read -rp "Ueberschreiben mit neuem Template? (j/N): " overwrite
        if [[ "${overwrite}" != "j" && "${overwrite}" != "J" ]]; then
            info "Behalte bestehende .env"
            return
        fi
    fi

    if [[ ! -f "${ENV_TEMPLATE}" ]]; then
        err ".env.production.template nicht gefunden: ${ENV_TEMPLATE}"
        exit 1
    fi

    scp "${ENV_TEMPLATE}" "${SERVER_USER}@${SERVER_IP}:${DEPLOY_DIR}/.env"
    ok ".env Template auf Server kopiert"

    echo ""
    printf "${YELLOW}============================================================${NC}\n"
    printf "${YELLOW} WICHTIG: .env-Datei muss noch bearbeitet werden!           ${NC}\n"
    printf "${YELLOW}                                                            ${NC}\n"
    printf "${YELLOW} Folgende Werte muessen eingetragen werden:                 ${NC}\n"
    printf "${YELLOW}  - ACME_EMAIL (fuer SSL-Zertifikat)                        ${NC}\n"
    printf "${YELLOW}  - NEXT_PUBLIC_SUPABASE_URL                                ${NC}\n"
    printf "${YELLOW}  - NEXT_PUBLIC_SUPABASE_ANON_KEY                           ${NC}\n"
    printf "${YELLOW}  - SUPABASE_SERVICE_ROLE_KEY                               ${NC}\n"
    printf "${YELLOW}  - POSTGRES_PASSWORD                                       ${NC}\n"
    printf "${YELLOW}  - APP_USERNAME + APP_PIN                                  ${NC}\n"
    printf "${YELLOW}  - ADMIN_TOKEN                                             ${NC}\n"
    printf "${YELLOW}  - GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET                 ${NC}\n"
    printf "${YELLOW}  - GOOGLE_DRIVE_FOLDER_ID + GOOGLE_SHEET_ID                ${NC}\n"
    printf "${YELLOW}  - GEMINI_API_KEY                                          ${NC}\n"
    printf "${YELLOW}============================================================${NC}\n"
    echo ""
    read -rp "Jetzt .env auf dem Server bearbeiten? (J/n): " edit_env
    if [[ "${edit_env}" != "n" && "${edit_env}" != "N" ]]; then
        ssh -t "${SERVER_USER}@${SERVER_IP}" "nano ${DEPLOY_DIR}/.env || vi ${DEPLOY_DIR}/.env"
        ok ".env bearbeitet"
    else
        warn "Vergiss nicht, die .env spaeter zu bearbeiten!"
        warn "  ssh ${SERVER_USER}@${SERVER_IP} nano ${DEPLOY_DIR}/.env"
    fi
}

# ============================================================
# Schritt 5: Firewall pruefen
# ============================================================
step_firewall_check() {
    info "Pruefe Ports 80 und 443..."

    local fw_status
    fw_status=$(ssh_cmd "command -v ufw >/dev/null 2>&1 && ufw status || echo 'no-ufw'" 2>/dev/null)

    if echo "${fw_status}" | grep -q "no-ufw"; then
        info "UFW nicht installiert, ueberspringe Firewall-Check"
        info "Stelle sicher, dass Port 80 und 443 offen sind!"
    elif echo "${fw_status}" | grep -q "inactive"; then
        ok "UFW ist inaktiv (alle Ports offen)"
    else
        local needs_80=false
        local needs_443=false
        echo "${fw_status}" | grep -q "80" || needs_80=true
        echo "${fw_status}" | grep -q "443" || needs_443=true

        if [[ "${needs_80}" == "true" || "${needs_443}" == "true" ]]; then
            warn "Port 80 und/oder 443 sind moeglicherweise nicht offen"
            read -rp "Ports jetzt oeffnen? (J/n): " open_ports
            if [[ "${open_ports}" != "n" && "${open_ports}" != "N" ]]; then
                ssh_cmd "ufw allow 80/tcp && ufw allow 443/tcp"
                ok "Ports 80 und 443 geoeffnet"
            fi
        else
            ok "Ports 80 und 443 sind offen"
        fi
    fi
}

# ============================================================
# Schritt 6: Docker Build & Start
# ============================================================
step_docker_deploy() {
    info "Stoppe laufende Container (falls vorhanden)..."
    ssh_cmd "cd ${DEPLOY_DIR} && docker compose --profile prod down 2>/dev/null || true"

    info "Baue Docker Image (das kann einige Minuten dauern)..."
    ssh_cmd "cd ${DEPLOY_DIR} && DOCKER_BUILD=1 docker compose --profile prod build --no-cache"
    ok "Docker Image gebaut"

    info "Starte Container..."
    ssh_cmd "cd ${DEPLOY_DIR} && docker compose --profile prod up -d"
    ok "Container gestartet"
}

# ============================================================
# Schritt 7: Health Check
# ============================================================
step_health_check() {
    info "Warte auf Health-Check (max 60 Sekunden)..."

    local max_attempts=12
    local attempt=1

    while [[ ${attempt} -le ${max_attempts} ]]; do
        local status
        status=$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health 2>/dev/null" || echo "000")

        if [[ "${status}" == "200" ]]; then
            ok "App laeuft! Health-Check: HTTP ${status}"
            return 0
        fi

        info "Versuch ${attempt}/${max_attempts} - HTTP ${status}, warte 5 Sekunden..."
        sleep 5
        attempt=$((attempt + 1))
    done

    warn "Health-Check nach ${max_attempts} Versuchen nicht erfolgreich"
    info "Pruefe Logs: ssh ${SERVER_USER}@${SERVER_IP} 'cd ${DEPLOY_DIR} && docker compose --profile prod logs'"
    return 1
}

# ============================================================
# Schritt 8: SSL pruefen
# ============================================================
step_ssl_check() {
    info "Warte 10 Sekunden auf SSL-Zertifikat (Let's Encrypt)..."
    sleep 10

    local ssl_status
    ssl_status=$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/health" 2>/dev/null || echo "000")

    if [[ "${ssl_status}" == "200" ]]; then
        ok "SSL funktioniert! HTTPS aktiv."
    else
        warn "SSL noch nicht bereit (HTTP ${ssl_status})"
        info "Caddy braucht manchmal 1-2 Minuten fuer das Zertifikat"
        info "Pruefe spaeter: curl -I https://${DOMAIN}"
    fi
}

# ============================================================
# Hauptprogramm
# ============================================================
main() {
    echo ""
    printf "${GREEN}============================================================${NC}\n"
    printf "${GREEN} SPZ Product Upload - Deploy auf ${DOMAIN}                  ${NC}\n"
    printf "${GREEN}============================================================${NC}\n"
    echo ""

    step_ssh_check
    echo ""
    step_docker_check
    echo ""
    step_repo_setup
    echo ""
    step_env_setup
    echo ""
    step_firewall_check
    echo ""
    step_docker_deploy
    echo ""
    step_health_check
    echo ""
    step_ssl_check

    echo ""
    printf "${GREEN}============================================================${NC}\n"
    printf "${GREEN} Deployment abgeschlossen!                                  ${NC}\n"
    printf "${GREEN}                                                            ${NC}\n"
    printf "${GREEN} URL:    https://${DOMAIN}                                  ${NC}\n"
    printf "${GREEN} Logs:   ssh ${SERVER_USER}@${SERVER_IP}                    ${NC}\n"
    printf "${GREEN}         cd ${DEPLOY_DIR}                                   ${NC}\n"
    printf "${GREEN}         docker compose --profile prod logs -f              ${NC}\n"
    printf "${GREEN}                                                            ${NC}\n"
    printf "${GREEN} Vergiss nicht:                                             ${NC}\n"
    printf "${GREEN}  - Google OAuth Redirect URI aktualisieren auf:            ${NC}\n"
    printf "${GREEN}    https://${DOMAIN}/api/google/callback                   ${NC}\n"
    printf "${GREEN}============================================================${NC}\n"
    echo ""
}

main "$@"
