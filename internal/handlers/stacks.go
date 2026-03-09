package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"

	"github.com/Lilithson/dockdash/internal/db"
	"github.com/Lilithson/dockdash/internal/docker"
	"github.com/Lilithson/dockdash/internal/respond"
)

// StackHandler holds dependencies for stack endpoints.
type StackHandler struct {
	stacks  *db.StackRepo
	docker  *docker.DockerClient
	dataDir string
}

// NewStackHandler creates a new StackHandler.
func NewStackHandler(stacks *db.StackRepo, docker *docker.DockerClient, dataDir string) *StackHandler {
	return &StackHandler{stacks: stacks, docker: docker, dataDir: dataDir}
}

// List handles GET /api/stacks.
func (h *StackHandler) List(w http.ResponseWriter, r *http.Request) {
	stacks, err := h.stacks.List()
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "list stacks: "+err.Error())
		return
	}
	if stacks == nil {
		stacks = []db.Stack{}
	}
	respond.JSON(w, http.StatusOK, stacks)
}

// Create handles POST /api/stacks.
func (h *StackHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		ComposeYAML string `json:"compose_yaml"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.ComposeYAML == "" {
		respond.Error(w, http.StatusBadRequest, "name and compose_yaml required")
		return
	}

	stacksDir := filepath.Join(h.dataDir, "stacks")
	if err := os.MkdirAll(stacksDir, 0750); err != nil {
		respond.Error(w, http.StatusInternalServerError, "create stacks dir: "+err.Error())
		return
	}

	composePath := filepath.Join(stacksDir, req.Name+".yml")
	if err := os.WriteFile(composePath, []byte(req.ComposeYAML), 0640); err != nil {
		respond.Error(w, http.StatusInternalServerError, "write compose file: "+err.Error())
		return
	}

	if err := h.docker.ComposeUp(req.Name, composePath); err != nil {
		respond.Error(w, http.StatusInternalServerError, "compose up: "+err.Error())
		return
	}

	stack, err := h.stacks.Upsert(req.Name, composePath)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "upsert stack: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusCreated, stack)
}

// Delete handles DELETE /api/stacks/{name}.
func (h *StackHandler) Delete(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	stack, err := h.stacks.GetByName(name)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "get stack: "+err.Error())
		return
	}
	if stack == nil {
		respond.Error(w, http.StatusNotFound, "stack not found")
		return
	}

	if err := h.docker.ComposeDown(name, stack.ComposePath); err != nil {
		respond.Error(w, http.StatusInternalServerError, "compose down: "+err.Error())
		return
	}

	_ = os.Remove(stack.ComposePath)

	if err := h.stacks.Delete(name); err != nil {
		respond.Error(w, http.StatusInternalServerError, "delete stack record: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetCompose handles GET /api/stacks/{name}/compose.
func (h *StackHandler) GetCompose(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	stack, err := h.stacks.GetByName(name)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "get stack: "+err.Error())
		return
	}
	if stack == nil {
		respond.Error(w, http.StatusNotFound, "stack not found")
		return
	}

	data, err := os.ReadFile(stack.ComposePath)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "read compose file: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"compose_yaml": string(data)})
}
