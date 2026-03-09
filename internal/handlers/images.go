package handlers

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/respond"
)

// ImageHandler holds dependencies for image endpoints.
type ImageHandler struct {
	docker *docker.DockerClient
}

// NewImageHandler creates a new ImageHandler.
func NewImageHandler(docker *docker.DockerClient) *ImageHandler {
	return &ImageHandler{docker: docker}
}

// List handles GET /api/images.
func (h *ImageHandler) List(w http.ResponseWriter, r *http.Request) {
	images, err := h.docker.ListImages(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "list images: "+err.Error())
		return
	}
	if images == nil {
		images = []docker.ImageSummary{}
	}
	respond.JSON(w, http.StatusOK, images)
}

// Pull handles POST /api/images/pull and streams pull progress as SSE.
func (h *ImageHandler) Pull(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Image == "" {
		respond.Error(w, http.StatusBadRequest, "image name required")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		respond.Error(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	rc, err := h.docker.PullImage(r.Context(), req.Image)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
		return
	}
	defer rc.Close()

	scanner := bufio.NewScanner(rc)
	for scanner.Scan() {
		select {
		case <-r.Context().Done():
			return
		default:
		}
		fmt.Fprintf(w, "data: %s\n\n", scanner.Text())
		flusher.Flush()
	}
	fmt.Fprintf(w, "event: done\ndata: pull complete\n\n")
	flusher.Flush()
}

// Remove handles DELETE /api/images/{id}.
func (h *ImageHandler) Remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	force := r.URL.Query().Get("force") == "true"
	deleted, err := h.docker.RemoveImage(r.Context(), id, force)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "remove image: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, deleted)
}
