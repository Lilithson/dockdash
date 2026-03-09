package main

import (
	"crypto/rand"
	"encoding/hex"
	"embed"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/Lilithson/dockdash/internal/db"
	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/router"
)

//go:embed all:ui/dist
var embeddedFiles embed.FS

func main() {
	port := getEnv("PORT", "8080")
	dataDir := getEnv("DATA_DIR", "/data")
	jwtSecret := os.Getenv("JWT_SECRET")

	if jwtSecret == "" {
		jwtSecret = generateSecret()
		log.Println("WARNING: JWT_SECRET not set, using a random secret. Tokens will be invalidated on restart.")
	}

	// Ensure data directory exists.
	if err := os.MkdirAll(dataDir, 0750); err != nil {
		log.Fatalf("Failed to create data directory %s: %v", dataDir, err)
	}

	// Initialize SQLite database.
	dbPath := filepath.Join(dataDir, "dockdash.db")
	database, err := db.New(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize Docker client.
	dockerClient, err := docker.NewDockerClient()
	if err != nil {
		log.Printf("WARNING: Failed to connect to Docker: %v", err)
		log.Println("Docker features will be unavailable until Docker is accessible.")
		// Allow startup to continue so the auth/setup endpoints still work.
		dockerClient = nil
	}

	// Build router.
	var dc *docker.DockerClient
	if dockerClient != nil {
		dc = dockerClient
	}

	h := router.New(router.Config{
		DB:        database,
		Docker:    dc,
		JWTSecret: jwtSecret,
		DataDir:   dataDir,
		Frontend:  embeddedFiles,
	})

	addr := ":" + port
	log.Printf("DockDash starting on http://0.0.0.0%s", addr)

	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func generateSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("failed to generate random secret: %v", err))
	}
	return hex.EncodeToString(b)
}
