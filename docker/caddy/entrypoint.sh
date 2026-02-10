#!/bin/sh
set -eu

SITE_DOMAIN=${SITE_DOMAIN:-}
ACME_EMAIL=${ACME_EMAIL:-}
N8N_DOMAIN=${N8N_DOMAIN:-}

if [ -z "$SITE_DOMAIN" ]; then
  echo "SITE_DOMAIN ist nicht gesetzt." >&2
  exit 1
fi

if [ -z "$ACME_EMAIL" ]; then
  echo "ACME_EMAIL ist nicht gesetzt." >&2
  exit 1
fi

cat <<EOF >/etc/caddy/Caddyfile
{
    email ${ACME_EMAIL}
}

https://${SITE_DOMAIN} {
    encode gzip
    reverse_proxy web:3000
}
EOF

if [ -n "$N8N_DOMAIN" ]; then
cat <<EOF >>/etc/caddy/Caddyfile

https://${N8N_DOMAIN} {
    encode gzip
    reverse_proxy n8n:5678
}
EOF
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile

