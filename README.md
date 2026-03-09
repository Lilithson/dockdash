# DockDash

A lightweight, self-hosted Docker management web UI — like Portainer, but simpler.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

| Feature | Description |
|---|---|
| 🐳 **Container Management** | List, start, stop, restart, remove, inspect, view live logs |
| 🖼️ **Image Management** | List images, pull by tag (with live progress), delete |
| 📚 **Stack Management** | Deploy Docker Compose stacks via YAML upload/paste |
| 📊 **System Stats** | Live per-container CPU/memory usage, Docker host info |
| 🏪 **App Store** | Docker Hub search + curated app templates for one-click deploy |
| 👥 **Multi-user Auth** | Admin / Operator / Viewer roles (RBAC), JWT sessions |
| 🔒 **First-run Setup** | Bootstrap admin on first launch |

---

## Quick Start

### Option 1: Docker Compose (recommended)

```bash
# 1. Generate a JWT secret
export JWT_SECRET=$(openssl rand -hex 32)

# 2. Start DockDash
docker compose up -d

# 3. Open your browser
open http://localhost:8080
```

### Option 2: Run directly with Docker

```bash
docker run -d \
  --name dockdash \
  -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v dockdash_data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  dockdash:latest
```

### Option 3: Build from source

```bash
# 1. Build the frontend
cd ui && npm install && npm run build && cd ..

# 2. Build the Go binary
CGO_ENABLED=1 go build -o dockdash .

# 3. Run
DATA_DIR=./data JWT_SECRET=your_secret ./dockdash
```

---

## First-run Setup

On first launch, navigate to `http://localhost:8080`. You will be redirected to the **initial setup page** where you create the first admin account.

After setup, you are logged in as admin and can:
- Create additional users (Admin → Users)
- Manage containers, images, stacks
- Search and deploy images from Docker Hub

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP listen port |
| `DATA_DIR` | `/data` | Data directory (SQLite DB, stacks, templates) |
| `JWT_SECRET` | *(random)* | **Set this in production!** Random secret is regenerated on each restart, invalidating all sessions. |

---

## Directory Layout (inside the container)

```
/data/
├── dockdash.db          # SQLite database (users, stacks)
├── stacks/              # Stored Docker Compose YAML files
│   └── myapp.yml
└── templates/           # Curated app templates (YAML)
    ├── nginx.yaml
    ├── gitea.yaml
    └── ...
```

---

## RBAC (Role-Based Access Control)

| Permission | Admin | Operator | Viewer |
|---|---|---|---|
| View containers/images/stats | ✅ | ✅ | ✅ |
| Start / Stop / Restart | ✅ | ✅ | ❌ |
| Remove containers/images | ✅ | ✅ | ❌ |
| Manage stacks | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

---

## Security Notes

### Docker Socket Access
DockDash mounts `/var/run/docker.sock` to communicate with the Docker daemon. **Anyone with access to DockDash has significant control over the Docker host.** Mitigate this:

1. **Bind to LAN only** – never expose port 8080 to the public internet.
2. **Set a strong `JWT_SECRET`** – prevents token forgery.
3. **Use RBAC** – give viewer/operator roles to less trusted users.
4. **Use a reverse proxy** (nginx/Traefik) with TLS for HTTPS access.

### Bootstrap Security
- The `/api/setup` endpoint is only active when **no users exist** in the database.
- Once the first admin is created, the setup endpoint returns `409 Conflict`.

### Password Storage
All passwords are hashed with **bcrypt** (cost 12) before storage.

---

## App Store Templates

Curated templates are stored in `/data/templates/` as YAML files. The format:

```yaml
name: my-app
description: A description of my app
image: myorg/myapp:latest
category: Web Server
ports:
  - host: 8080
    container: 80
volumes:
  - host: /opt/myapp/data
    container: /data
restart_policy: unless-stopped
env:
  - name: MY_VAR
    value: "default"
    description: "Description of this variable"
```

---

## Development

### Prerequisites
- Go 1.21+
- Node.js 20+
- gcc / musl-dev (for CGO sqlite3)

### Local dev

```bash
# Terminal 1 – frontend dev server (proxies /api to :8080)
cd ui && npm run dev

# Terminal 2 – Go backend (with Docker socket)
DATA_DIR=./data JWT_SECRET=devsecret go run .
```

---

## License

MIT – see [LICENSE](LICENSE).
