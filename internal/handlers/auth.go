package handlers

import (
	"encoding/json"
	"net/http"

	"golang.org/x/crypto/bcrypt"

	"github.com/Lilithson/dockdash/internal/auth"
	"github.com/Lilithson/dockdash/internal/db"
	"github.com/Lilithson/dockdash/internal/respond"
)

// AuthHandler holds dependencies for auth endpoints.
type AuthHandler struct {
	users     *db.UserRepo
	database  *db.DB
	jwtSecret string
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(database *db.DB, users *db.UserRepo, jwtSecret string) *AuthHandler {
	return &AuthHandler{database: database, users: users, jwtSecret: jwtSecret}
}

// Setup handles POST /api/setup — creates the first admin account.
func (h *AuthHandler) Setup(w http.ResponseWriter, r *http.Request) {
	has, err := h.database.HasUsers()
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "db error")
		return
	}
	if has {
		respond.Error(w, http.StatusConflict, "setup already completed")
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" || req.Password == "" {
		respond.Error(w, http.StatusBadRequest, "username and password required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "hash error")
		return
	}

	user, err := h.users.Create(req.Username, string(hash), "admin")
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "create user: "+err.Error())
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Username, user.Role, h.jwtSecret)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "token error")
		return
	}
	respond.JSON(w, http.StatusCreated, map[string]any{"token": token, "user": user})
}

// Login handles POST /api/auth/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" || req.Password == "" {
		respond.Error(w, http.StatusBadRequest, "username and password required")
		return
	}

	user, err := h.users.GetByUsername(req.Username)
	if err != nil || user == nil {
		respond.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		respond.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Username, user.Role, h.jwtSecret)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "token error")
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

// Logout handles POST /api/auth/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	respond.JSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// Me handles GET /api/auth/me.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromCtx(r.Context())
	if claims == nil {
		respond.Error(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	user, err := h.users.GetByID(claims.UserID)
	if err != nil || user == nil {
		respond.Error(w, http.StatusNotFound, "user not found")
		return
	}
	respond.JSON(w, http.StatusOK, user)
}
