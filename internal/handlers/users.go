package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/Lilithson/dockdash/internal/db"
	"github.com/Lilithson/dockdash/internal/respond"
)

// UserHandler holds dependencies for user management endpoints.
type UserHandler struct {
	users *db.UserRepo
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(users *db.UserRepo) *UserHandler {
	return &UserHandler{users: users}
}

// List handles GET /api/users.
func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.users.List()
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "list users: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, users)
}

// Create handles POST /api/users.
func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Username == "" || req.Password == "" {
		respond.Error(w, http.StatusBadRequest, "username and password required")
		return
	}
	switch req.Role {
	case "admin", "operator", "viewer":
	case "":
		req.Role = "viewer"
	default:
		respond.Error(w, http.StatusBadRequest, "role must be admin, operator, or viewer")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "hash error")
		return
	}

	user, err := h.users.Create(req.Username, string(hash), req.Role)
	if err != nil {
		respond.Error(w, http.StatusConflict, "create user: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusCreated, user)
}

// Delete handles DELETE /api/users/{id}.
func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.users.Delete(id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "delete user: "+err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdatePassword handles PUT /api/users/{id}/password.
func (h *UserHandler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid user id")
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Password == "" {
		respond.Error(w, http.StatusBadRequest, "password required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "hash error")
		return
	}

	if err := h.users.UpdatePassword(id, string(hash)); err != nil {
		respond.Error(w, http.StatusInternalServerError, "update password: "+err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]string{"message": "password updated"})
}
