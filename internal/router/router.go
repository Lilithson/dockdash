package router

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/Lilithson/dockdash/internal/auth"
	"github.com/Lilithson/dockdash/internal/db"
	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/handlers"
)

// Config holds all dependencies needed to build the router.
type Config struct {
	DB        *db.DB
	Docker    *docker.DockerClient
	JWTSecret string
	DataDir   string
	Frontend  embed.FS
}

// New creates and returns the application router.
func New(cfg Config) http.Handler {
	r := chi.NewRouter()

	// dockerUnavailable is a placeholder handler when Docker is not connected.
	dockerUnavailable := func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"error":"Docker is not available"}`))
	}

	// Global middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Repositories
	userRepo := db.NewUserRepo(cfg.DB)
	stackRepo := db.NewStackRepo(cfg.DB)

	// Handlers
	authH := handlers.NewAuthHandler(cfg.DB, userRepo, cfg.JWTSecret)
	userH := handlers.NewUserHandler(userRepo)
	hubH := handlers.NewHubHandler()

	// Docker-dependent handlers (may be nil if Docker is unavailable)
	var (
		containerList    = dockerUnavailable
		containerInspect = dockerUnavailable
		containerStart   = dockerUnavailable
		containerStop    = dockerUnavailable
		containerRestart = dockerUnavailable
		containerRemove  = dockerUnavailable
		containerLogs    = dockerUnavailable
		imageList        = dockerUnavailable
		imagePull        = dockerUnavailable
		imageRemove      = dockerUnavailable
		stackList        = dockerUnavailable
		stackCreate      = dockerUnavailable
		stackDelete      = dockerUnavailable
		stackGetCompose  = dockerUnavailable
		statsGet         = dockerUnavailable
		statsStream      = dockerUnavailable
	)

	if cfg.Docker != nil {
		containerH := handlers.NewContainerHandler(cfg.Docker)
		imageH := handlers.NewImageHandler(cfg.Docker)
		stackH := handlers.NewStackHandler(stackRepo, cfg.Docker, cfg.DataDir)
		statsH := handlers.NewStatsHandler(cfg.Docker)

		containerList = containerH.List
		containerInspect = containerH.Inspect
		containerStart = containerH.Start
		containerStop = containerH.Stop
		containerRestart = containerH.Restart
		containerRemove = containerH.Remove
		containerLogs = containerH.Logs
		imageList = imageH.List
		imagePull = imageH.Pull
		imageRemove = imageH.Remove
		stackList = stackH.List
		stackCreate = stackH.Create
		stackDelete = stackH.Delete
		stackGetCompose = stackH.GetCompose
		statsGet = statsH.Stats
		statsStream = statsH.Stream
	}

	// Public routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.SetHeader("Content-Type", "application/json"))
		r.Post("/api/setup", authH.Setup)
		r.Post("/api/auth/login", authH.Login)
	})

	// Protected API routes (require valid JWT)
	r.Group(func(r chi.Router) {
		r.Use(middleware.SetHeader("Content-Type", "application/json"))
		r.Use(auth.Authenticator(cfg.JWTSecret))

		r.Post("/api/auth/logout", authH.Logout)
		r.Get("/api/auth/me", authH.Me)

		// Containers
		r.Get("/api/containers", containerList)
		r.Get("/api/containers/{id}", containerInspect)
		r.Post("/api/containers/{id}/start", containerStart)
		r.Post("/api/containers/{id}/stop", containerStop)
		r.Post("/api/containers/{id}/restart", containerRestart)
		r.Delete("/api/containers/{id}", containerRemove)
		r.Get("/api/containers/{id}/logs", containerLogs)

		// Images
		r.Get("/api/images", imageList)
		r.Post("/api/images/pull", imagePull)
		r.Delete("/api/images/{id}", imageRemove)

		// Stacks
		r.Get("/api/stacks", stackList)
		r.Post("/api/stacks", stackCreate)
		r.Delete("/api/stacks/{name}", stackDelete)
		r.Get("/api/stacks/{name}/compose", stackGetCompose)

		// Stats
		r.Get("/api/stats", statsGet)
		r.Get("/api/stats/stream", statsStream)

		// Docker Hub
		r.Get("/api/hub/search", hubH.Search)
		r.Get("/api/hub/tags", hubH.Tags)

		// Admin-only routes
		r.Group(func(r chi.Router) {
			r.Use(auth.RequireRole("admin"))
			r.Get("/api/users", userH.List)
			r.Post("/api/users", userH.Create)
			r.Delete("/api/users/{id}", userH.Delete)
			r.Put("/api/users/{id}/password", userH.UpdatePassword)
		})
	})

	// Serve the embedded frontend SPA for all other routes
	r.Get("/*", spaHandler(cfg.Frontend))

	return r
}

// spaHandler serves the embedded frontend, falling back to index.html for SPA routing.
func spaHandler(fsys embed.FS) http.HandlerFunc {
	sub, err := fs.Sub(fsys, "ui/dist")
	if err != nil {
		// Fallback: return a placeholder page
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(placeholderHTML))
		}
	}
	fileServer := http.FileServer(http.FS(sub))
	return func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the exact file; fall back to index.html.
		_, statErr := fs.Stat(sub, r.URL.Path[1:])
		if r.URL.Path == "/" || statErr != nil {
			// Serve index.html for SPA client-side routing
			index, readErr := fs.ReadFile(sub, "index.html")
			if readErr != nil {
				w.Header().Set("Content-Type", "text/html")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(placeholderHTML))
				return
			}
			w.Header().Set("Content-Type", "text/html")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(index)
			return
		}
		fileServer.ServeHTTP(w, r)
	}
}

const placeholderHTML = `<!DOCTYPE html>
<html>
<head><title>DockDash</title></head>
<body>
  <h1>DockDash</h1>
  <p>Frontend not built yet. Run <code>npm run build</code> in the <code>ui/</code> directory.</p>
  <p>API is available at <a href="/api/">/api/</a></p>
</body>
</html>`
