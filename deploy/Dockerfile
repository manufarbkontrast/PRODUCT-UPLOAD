# Deploy-Dockerfile für den GEMEINSAMEN Hetzner-Host (167.233.218.238), auf dem
# diese App neben "mycrafton" (Cockpit) läuft — erreichbar unter dem Pfad "/erfassung"
# (siehe next.config.ts: basePath). Struktur bewusst analog zu
# mycrafton/Dockerfile gehalten, damit beide Apps auf dem Server gleich
# gebaut/betrieben werden.
#
# Build-Kontext ist der Repo-Root (siehe deploy/docker-compose.yml: context: ..),
# NICHT dieses deploy/-Verzeichnis — .dockerignore im Repo-Root gilt entsprechend.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# NEXT_PUBLIC_*-Variablen werden zur BUILD-Zeit in den Client-Bundle eingebacken.
# NEXT_PUBLIC_BASE_PATH hat in next.config.ts bereits den Default "/erfassung" —
# der Build-Arg ist nur da, um ihn ohne Code-Änderung überschreiben zu können.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_BASE_PATH=/erfassung
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH \
    DOCKER_BUILD=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=3072

# NODE_OPTIONS hebt das V8-Heap-Limit an (Default ~2 GB reicht für diesen Build
# mit sharp + Bildverarbeitungs-Routen nicht). Auf dem 4-GB-Host braucht das
# physische Deckung durch Swap (siehe deploy/README bzw. Server-Setup), da neben
# dem Build der Cockpit-Container weiterläuft.
RUN npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
