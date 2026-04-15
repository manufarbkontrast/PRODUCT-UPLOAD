# Hetzner Deployment Guide

Migration von Vercel → Hetzner Cloud VPS mit Docker + Caddy (automatisches HTTPS).

## 1. SSH-Key (lokal schon erstellt)

Wurde bereits generiert:

```
~/.ssh/hetzner_spz          # privater Schlüssel (NIE teilen)
~/.ssh/hetzner_spz.pub      # öffentlicher Schlüssel (in Hetzner hinterlegen)
```

Public-Key:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK7lIQBZUesgGOBMoZP2LVEsLo9s5fIvNb6J9wKnBMyb spz-product-upload@hetzner 2026-04-15
```

SSH-Config-Alias (`~/.ssh/config`) ist angelegt. Nach Server-Erstellung die IP ersetzen:

```bash
sed -i '' 's/PLACEHOLDER_SERVER_IP/<deine-server-ip>/' ~/.ssh/config
# danach einfach:
ssh hetzner-spz
```

## 2. Hetzner-Server erstellen

1. https://console.hetzner.cloud → Projekt → Server hinzufügen
2. **Location**: Nürnberg / Falkenstein / Helsinki
3. **Image**: Ubuntu 24.04
4. **Type**: mindestens CX22 (2 vCPU, 4 GB RAM) — empfohlen CX32 wegen Next.js Build
5. **SSH Keys**: Oben angelegten Public-Key hinzufügen
6. **Firewall**: Ports 22, 80, 443 eingehend erlauben
7. Server erstellen → IP notieren → in `~/.ssh/config` eintragen (siehe oben)

## 3. Server-Vorbereitung

```bash
ssh hetzner-spz

# System-Update
apt update && apt upgrade -y

# Docker + Compose installieren
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git

# App-Benutzer (empfohlen statt root)
useradd -m -s /bin/bash spz
usermod -aG docker spz
mkdir -p /home/spz/.ssh
cp ~/.ssh/authorized_keys /home/spz/.ssh/authorized_keys
chown -R spz:spz /home/spz/.ssh
chmod 700 /home/spz/.ssh
chmod 600 /home/spz/.ssh/authorized_keys

# Ab jetzt als spz:
su - spz
```

SSH-Config auf `User spz` umstellen (lokal):

```bash
sed -i '' 's/User root/User spz/' ~/.ssh/config
```

## 4. DNS

Beim Domain-Provider einen A-Record setzen:

```
spz.example.com  →  <server-ip>
```

TTL auf 300s setzen, damit Propagation schnell ist.

## 5. Repo clonen + Konfiguration

```bash
# als spz-User
cd ~
git clone https://github.com/manufarbkontrast/PRODUCT-UPLOAD.git spz-product-upload
cd spz-product-upload

# Env vorbereiten
cp .env.example .env
nano .env   # Werte aus Vercel übernehmen (SUPABASE_*, GOOGLE_*, REORDER_SHEETS_FOLDER_ID, etc.)
```

### Wichtige Env-Werte

| Variable | Wert |
|----------|------|
| `SITE_DOMAIN` | `spz.example.com` |
| `ACME_EMAIL` | Admin-Email (für Let's-Encrypt) |
| `NEXT_PUBLIC_SITE_URL` | `https://spz.example.com` |
| `GOOGLE_REDIRECT_URI` | `https://spz.example.com/api/google/callback` |
| `DOCKER_BUILD` | `1` (aktiviert Next.js standalone output) |

Supabase + Google-Credentials 1:1 aus Vercel kopieren (Env-Variablen siehe Vercel Dashboard).

## 6. Google OAuth Redirect-URI aktualisieren

In der Google Cloud Console → Credentials → OAuth-Client `454292127022-tekoo76...` öffnen → **Autorisierte Weiterleitungs-URIs** ergänzen:

```
https://spz.example.com/api/google/callback
```

(Die Vercel-URI kann parallel drin bleiben.)

## 7. Erster Start

```bash
docker compose --profile prod up -d --build
docker compose --profile prod logs -f web
```

Caddy holt beim ersten Zugriff automatisch ein Let's-Encrypt-Zertifikat. DNS muss dafür auf den Server zeigen.

Health-Check:

```bash
curl https://spz.example.com/api/health
# erwartet: {"status":"ok"}
```

## 8. OAuth-Token neu einspielen (wegen neuer Redirect-URI)

Der bestehende Token in `GOOGLE_OAUTH_TOKENS` wurde mit der Vercel-Redirect-URI ausgestellt, kann aber ohne Probleme weiter refresht werden — der Refresh-Token ist redirect-URI-unabhängig. Solange du den Token nicht komplett neu holst, brauchst du nichts zu tun.

Falls doch neu: https://spz.example.com einloggen → DevTools Console:

```js
fetch('/api/google/auth', {method:'POST'}).then(r=>r.json()).then(d=>location.href=d.authUrl)
```

→ Google-Consent → Callback zeigt neuen Base64-Token → in `.env` übernehmen → `docker compose --profile prod restart web`.

## 9. Updates ausrollen

```bash
ssh hetzner-spz
cd spz-product-upload
git pull
docker compose --profile prod up -d --build
```

## 10. Backups

- **Sheet / Drive**: bleibt bei Google, kein Backup nötig
- **Supabase**: automatische Backups im Supabase-Dashboard
- **Server-Config**: versioniert im Git-Repo
- **`.env`**: separat sichern (enthält Secrets) → Passwort-Manager

## 11. Monitoring

```bash
docker compose --profile prod ps
docker compose --profile prod logs -f --tail 100 web
docker compose --profile prod logs -f --tail 50 caddy
```

## 12. Vercel abschalten (optional)

Nach erfolgreicher Migration + DNS-Umstellung auf Hetzner:

1. DNS abwarten (bis `dig +short spz.example.com` die Hetzner-IP zeigt)
2. In Vercel Dashboard → Project Settings → Delete Project

Oder Vercel als Staging behalten und nur Hetzner als Production nutzen.

## Troubleshooting

**Caddy bekommt kein Zertifikat**
- DNS prüfen: `dig +short spz.example.com`
- Port 80 + 443 offen? `nc -zv <ip> 80 443`
- Logs: `docker compose --profile prod logs caddy | tail -30`

**Build schlägt fehl wegen Speicher**
- Auf größeren Server upgraden (CX32 oder CX42)
- Oder `.next/cache` erhalten: Volume für `/app/.next/cache` in docker-compose hinzufügen

**OAuth callback landet bei Vercel**
- `GOOGLE_REDIRECT_URI` in `.env` muss Hetzner-Domain sein
- Google Cloud Console: URI in OAuth-Client hinzufügen

**Next.js sieht env vars nicht**
- Sind sie in `.env` gesetzt?
- `docker compose --profile prod exec web env | grep GOOGLE`
- Bei `NEXT_PUBLIC_*`: muss zur **Build-Zeit** gesetzt sein. `docker compose up -d --build` neu bauen.
