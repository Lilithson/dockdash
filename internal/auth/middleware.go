package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/Lilithson/dockdash/internal/respond"
)

type contextKey string

const claimsKey contextKey = "claims"

// Authenticator returns a middleware that validates Bearer JWTs.
func Authenticator(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				respond.Error(w, http.StatusUnauthorized, "missing or invalid authorization header")
				return
			}
			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := ValidateToken(tokenStr, secret)
			if err != nil {
				respond.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRole returns a middleware that ensures the user has one of the given roles.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromCtx(r.Context())
			if claims == nil {
				respond.Error(w, http.StatusUnauthorized, "not authenticated")
				return
			}
			if !allowed[claims.Role] {
				respond.Error(w, http.StatusForbidden, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClaimsFromCtx extracts Claims from the request context.
func ClaimsFromCtx(ctx context.Context) *Claims {
	v := ctx.Value(claimsKey)
	if v == nil {
		return nil
	}
	c, _ := v.(*Claims)
	return c
}
