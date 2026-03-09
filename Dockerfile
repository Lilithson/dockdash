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

# Create non-root user (optional, runs as root for socket access)
RUN mkdir -p /data/stacks /data/templates

# Copy the compiled binary
COPY --from=go-builder /dockdash /usr/local/bin/dockdash

# Copy example templates
COPY data/templates/ /data/templates/

EXPOSE 8080

VOLUME ["/data"]

ENV PORT=8080 \
    DATA_DIR=/data

ENTRYPOINT ["/usr/local/bin/dockdash"]
