package handlers

import (
	"net/http"
	"strconv"

	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/respond"
)

// HubHandler holds dependencies for Docker Hub search endpoints.
type HubHandler struct{}

// NewHubHandler creates a new HubHandler.
func NewHubHandler() *HubHandler { return &HubHandler{} }

// Search handles GET /api/hub/search?q=...
func (h *HubHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		respond.Error(w, http.StatusBadRequest, "query parameter 'q' required")
		return
	}
	limit := 25
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	results, err := docker.SearchImages(q, limit)
	if err != nil {
		respond.Error(w, http.StatusBadGateway, "hub search: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, results)
}

// Tags handles GET /api/hub/tags?image=...
func (h *HubHandler) Tags(w http.ResponseWriter, r *http.Request) {
	image := r.URL.Query().Get("image")
	if image == "" {
		respond.Error(w, http.StatusBadRequest, "query parameter 'image' required")
		return
	}
	page := 1
	if p := r.URL.Query().Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}
	tags, err := docker.GetTags(image, page)
	if err != nil {
		respond.Error(w, http.StatusBadGateway, "hub tags: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, tags)
}
