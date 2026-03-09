package handlers

import (
	"encoding/binary"
	"fmt"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/respond"
)

// ContainerHandler holds dependencies for container endpoints.
type ContainerHandler struct {
	docker *docker.DockerClient
}

// NewContainerHandler creates a new ContainerHandler.
func NewContainerHandler(docker *docker.DockerClient) *ContainerHandler {
	return &ContainerHandler{docker: docker}
}

// List handles GET /api/containers.
func (h *ContainerHandler) List(w http.ResponseWriter, r *http.Request) {
	all := r.URL.Query().Get("all") == "true"
	containers, err := h.docker.ListContainers(r.Context(), all)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "list containers: "+err.Error())
		return
	}
	if containers == nil {
		containers = []docker.ContainerSummary{}
	}
	respond.JSON(w, http.StatusOK, containers)
}

// Inspect handles GET /api/containers/{id}.
func (h *ContainerHandler) Inspect(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	info, err := h.docker.InspectContainer(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "inspect container: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, info)
}

// Start handles POST /api/containers/{id}/start.
func (h *ContainerHandler) Start(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.docker.StartContainer(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "start container: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "started"})
}

// Stop handles POST /api/containers/{id}/stop.
func (h *ContainerHandler) Stop(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.docker.StopContainer(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "stop container: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "stopped"})
}

// Restart handles POST /api/containers/{id}/restart.
func (h *ContainerHandler) Restart(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.docker.RestartContainer(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "restart container: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "restarted"})
}

// Remove handles DELETE /api/containers/{id}.
func (h *ContainerHandler) Remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	force := r.URL.Query().Get("force") == "true"
	if err := h.docker.RemoveContainer(r.Context(), id, force); err != nil {
		respond.Error(w, http.StatusInternalServerError, "remove container: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Logs handles GET /api/containers/{id}/logs as an SSE stream.
func (h *ContainerHandler) Logs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		respond.Error(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	rc, err := h.docker.ContainerLogs(r.Context(), id)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
		return
	}
	defer rc.Close()

	// Docker log stream uses a multiplexed format: 8-byte header per frame.
	// Header: [stream_type(1), 0, 0, 0, size(4 big-endian)]
	hdr := make([]byte, 8)
	for {
		select {
		case <-r.Context().Done():
			return
		default:
		}

		_, err := io.ReadFull(rc, hdr)
		if err != nil {
			return
		}
		size := binary.BigEndian.Uint32(hdr[4:])
		if size == 0 {
			continue
		}
		buf := make([]byte, size)
		if _, err := io.ReadFull(rc, buf); err != nil {
			return
		}
		line := string(buf)
		fmt.Fprintf(w, "data: %s\n\n", line)
		flusher.Flush()
	}
}
