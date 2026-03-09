package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/respond"
)

// StatsHandler holds dependencies for stats endpoints.
type StatsHandler struct {
	docker *docker.DockerClient
}

// NewStatsHandler creates a new StatsHandler.
func NewStatsHandler(docker *docker.DockerClient) *StatsHandler {
	return &StatsHandler{docker: docker}
}

type statsResponse struct {
	Containers []docker.ContainerStats `json:"containers"`
	Host       *docker.HostInfo        `json:"host"`
}

// Stats handles GET /api/stats.
func (h *StatsHandler) Stats(w http.ResponseWriter, r *http.Request) {
	payload, err := h.gatherStats(r)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "gather stats: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, payload)
}

// Stream handles GET /api/stats/stream as an SSE stream updating every 3s.
func (h *StatsHandler) Stream(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		respond.Error(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			payload, err := h.gatherStats(r)
			if err != nil {
				fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
				flusher.Flush()
				continue
			}
			data := marshalJSON(payload)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (h *StatsHandler) gatherStats(r *http.Request) (*statsResponse, error) {	containers, err := h.docker.ListContainers(r.Context(), false)
	if err != nil {
		return nil, err
	}

	statsList := make([]docker.ContainerStats, 0, len(containers))
	for _, c := range containers {
		stats, err := h.docker.GetContainerStats(r.Context(), c.ID)
		if err != nil {
			continue
		}
		statsList = append(statsList, *stats)
	}

	hostInfo, err := h.docker.GetHostInfo(r.Context())
	if err != nil {
		return nil, err
	}

	return &statsResponse{Containers: statsList, Host: hostInfo}, nil
}

func marshalJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
