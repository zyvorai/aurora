package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
	"time"
)

const sessionCookie = "crm_session"
const sessionTTL = 7 * 24 * time.Hour

// UIAuth protects HTML routes when password is non-empty.
// /login, /healthz, /readyz, /static/, /api/ remain reachable as configured.
func UIAuth(password, secret string) func(http.Handler) http.Handler {
	if password == "" {
		return func(next http.Handler) http.Handler { return next }
	}
	if secret == "" {
		secret = password + "-crm-ui-secret"
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path
			// public paths
			if path == "/login" || path == "/healthz" || path == "/readyz" ||
				strings.HasPrefix(path, "/static/") || strings.HasPrefix(path, "/api/") {
				next.ServeHTTP(w, r)
				return
			}
			if validSession(r, secret) {
				next.ServeHTTP(w, r)
				return
			}
			http.Redirect(w, r, "/login?next="+path, http.StatusSeeOther)
		})
	}
}

func validSession(r *http.Request, secret string) bool {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return false
	}
	return verifyToken(c.Value, secret)
}

// MakeSessionCookie creates a signed session cookie value.
func MakeSessionCookie(secret string) *http.Cookie {
	tok := signToken(secret, time.Now().Add(sessionTTL).Unix())
	return &http.Cookie{
		Name:     sessionCookie,
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionTTL.Seconds()),
	}
}

// ClearSessionCookie expires the session.
func ClearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	}
}

func signToken(secret string, exp int64) string {
	payload := base64.RawURLEncoding.EncodeToString([]byte(time.Unix(exp, 0).UTC().Format(time.RFC3339)))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload + "." + sig
}

func verifyToken(token, secret string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	payload, sig := parts[0], parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(payload)
	if err != nil {
		return false
	}
	exp, err := time.Parse(time.RFC3339, string(raw))
	if err != nil {
		return false
	}
	return time.Now().Before(exp)
}

// CheckPassword constant-time-ish compare.
func CheckPassword(got, want string) bool {
	if len(got) != len(want) {
		return false
	}
	var v byte
	for i := 0; i < len(got); i++ {
		v |= got[i] ^ want[i]
	}
	return v == 0
}
