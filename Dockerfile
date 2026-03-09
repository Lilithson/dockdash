# syntax=docker/dockerfile:1

# ─── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --prefer-offline
COPY ui/ ./
RUN npm run build

# ─── Stage 2: Build Go binary ────────────────────────────────────────────────
FROM golang:1.24-alpine AS go-builder
# gcc and musl-dev are required for CGO (go-sqlite3)
RUN apk add --no-cache gcc musl-dev
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy the built frontend into the expected embed path
COPY --from=frontend-builder /build/ui/dist ./ui/dist
RUN CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags="-s -w" -o /dockdash .

# ─── Stage 3: Final runtime image ────────────────────────────────────────────
FROM alpine:3.19

# Install docker CLI and docker compose plugin, plus ca-certificates
RUN apk add --no-cache \
    ca-certificates \
    docker-cli \
    docker-cli-compose

# Create a non-root user; GID 999 matches the common docker group GID so the
# socket (mounted at /var/run/docker.sock) remains accessible at runtime.
RUN grep -q "^docker:" /etc/group || addgroup -g 999 docker && \
    adduser -D -u 1000 -G docker dockdash && \
    mkdir -p /data/stacks /data/templates && \
    chown -R dockdash:docker /data

# Copy the compiled binary
COPY --from=go-builder /dockdash /usr/local/bin/dockdash

# Copy example templates (owned by dockdash so they are writable at runtime)
COPY --chown=dockdash:docker data/templates/ /data/templates/

USER dockdash

EXPOSE 9000

VOLUME ["/data"]

ENV PORT=9000 \
    DATA_DIR=/data

ENTRYPOINT ["/usr/local/bin/dockdash"]
