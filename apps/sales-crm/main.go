package main

import (
	"context"
	"embed"
	"fmt"
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/salespulse/crm/internal/db"
	"github.com/salespulse/crm/internal/handlers"
	"github.com/salespulse/crm/internal/middleware"
)

//go:embed all:web
var webFS embed.FS

func main() {
	port := env("PORT", "8080")
	dbPath := env("CRM_DB", "crm.db")
	apiKey := env("CRM_API_KEY", "")
	corsOrigins := env("CRM_CORS_ORIGINS", "")
	seed := env("CRM_SEED", "true") == "true"
	uiPassword := env("CRM_UI_PASSWORD", "")
	uiSecret := env("CRM_UI_SECRET", "")
	slaHours := envInt("CRM_SLA_HOURS", 2)
	owners := splitCSV(env("CRM_OWNERS", ""))

	if dir := filepath.Dir(dbPath); dir != "." && dir != "" {
		_ = os.MkdirAll(dir, 0o755)
	}

	store, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer store.Close()
	store.SLAHours = slaHours
	store.Owners = owners

	if seed {
		if err := store.SeedIfEmpty(); err != nil {
			log.Printf("seed warning: %v", err)
		}
	}

	tmpl, err := loadTemplates()
	if err != nil {
		log.Fatalf("templates: %v", err)
	}

	if uiSecret == "" && uiPassword != "" {
		uiSecret = uiPassword + "-crm-ui-secret"
	}
	srv := handlers.New(store, tmpl)
	srv.UIPassword = uiPassword
	srv.UISecret = uiSecret
	mux := http.NewServeMux()

	// health
	mux.HandleFunc("GET /healthz", srv.Healthz)
	mux.HandleFunc("GET /readyz", srv.Readyz)

	// auth
	mux.HandleFunc("GET /login", srv.LoginPage)
	mux.HandleFunc("POST /login", srv.LoginSubmit)
	mux.HandleFunc("POST /logout", srv.Logout)
	mux.HandleFunc("GET /logout", srv.Logout)

	// UI pages
	mux.HandleFunc("GET /{$}", srv.Dashboard)
	mux.HandleFunc("GET /pipeline", srv.Pipeline)
	mux.HandleFunc("GET /deals", srv.DealsPage)
	mux.HandleFunc("GET /deals/new", srv.NewDealPage)
	mux.HandleFunc("GET /deals/{id}", srv.DealView)
	mux.HandleFunc("GET /deals/{id}/edit", srv.EditDealPage)
	mux.HandleFunc("POST /deals", srv.CreateDealForm)
	mux.HandleFunc("POST /deals/{id}", srv.UpdateDealForm)
	mux.HandleFunc("POST /deals/{id}/delete", srv.DeleteDealForm)
	mux.HandleFunc("POST /deals/{id}/stage", srv.MoveStageForm)
	mux.HandleFunc("POST /deals/{id}/activities", srv.AddActivityForm)

	mux.HandleFunc("GET /contacts", srv.ContactsPage)
	mux.HandleFunc("GET /contacts/new", srv.NewContactPage)
	mux.HandleFunc("GET /contacts/{id}/edit", srv.EditContactPage)
	mux.HandleFunc("POST /contacts", srv.CreateContactForm)
	mux.HandleFunc("POST /contacts/{id}", srv.UpdateContactForm)
	mux.HandleFunc("POST /contacts/{id}/delete", srv.DeleteContactForm)

	mux.HandleFunc("GET /reports", srv.ReportsPage)
	mux.HandleFunc("GET /export/deals.csv", srv.ExportDealsCSV)

	// API
	api := http.NewServeMux()
	api.HandleFunc("GET /api/stats", srv.APIStats)
	api.HandleFunc("GET /api/deals", srv.APIListDeals)
	api.HandleFunc("GET /api/deals/{id}", srv.APIGetDeal)
	api.HandleFunc("POST /api/deals", srv.APICreateDeal)
	api.HandleFunc("PUT /api/deals/{id}", srv.APIUpdateDeal)
	api.HandleFunc("PUT /api/deals/{id}/stage", srv.APIUpdateStage)
	api.HandleFunc("DELETE /api/deals/{id}", srv.APIDeleteDeal)
	api.HandleFunc("GET /api/contacts", srv.APIListContacts)
	api.HandleFunc("GET /api/contacts/{id}", srv.APIGetContact)
	api.HandleFunc("POST /api/contacts", srv.APICreateContact)
	api.HandleFunc("PUT /api/contacts/{id}", srv.APIUpdateContact)
	api.HandleFunc("DELETE /api/contacts/{id}", srv.APIDeleteContact)
	api.HandleFunc("POST /api/leads", srv.APIIngestLead)
	api.HandleFunc("GET /api/deals/{id}/activities", srv.APIListActivities)
	api.HandleFunc("POST /api/deals/{id}/activities", srv.APIAddActivity)

	mux.Handle("/api/", middleware.APIKey(apiKey)(api))

	// static
	staticFS, err := fs.Sub(webFS, "web/static")
	if err != nil {
		log.Fatalf("static fs: %v", err)
	}
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

	handler := middleware.Logging(
		middleware.CORS(corsOrigins)(
			middleware.UIAuth(uiPassword, uiSecret)(
				middleware.MaxBody(1<<20)(mux),
			),
		),
	)

	httpSrv := &http.Server{
		Addr:              ":" + port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Printf("SalesPulse CRM listening on :%s  (db=%s)", port, dbPath)
		if apiKey != "" {
			log.Printf("API key protection: enabled")
		} else {
			log.Printf("API key protection: disabled (set CRM_API_KEY in production)")
		}
		if uiPassword != "" {
			log.Printf("UI auth: enabled (login required)")
		} else {
			log.Printf("UI auth: disabled (set CRM_UI_PASSWORD to protect the UI)")
		}
		log.Printf("SLA: %d hours to first contact", slaHours)
		if len(owners) > 0 {
			log.Printf("Owners (round-robin): %v", owners)
		}
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("bye")
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func loadTemplates() (*template.Template, error) {
	sub, err := fs.Sub(webFS, "web/templates")
	if err != nil {
		return nil, err
	}
	return template.New("").Funcs(template.FuncMap{
		"formatINR": func(v float64) string {
			if v >= 10000000 {
				return fmt.Sprintf("₹%.2f Cr", v/10000000)
			}
			if v >= 100000 {
				return fmt.Sprintf("₹%.2f L", v/100000)
			}
			return fmt.Sprintf("₹%.0f", v)
		},
		"formatDate": func(t *time.Time) string {
			if t == nil {
				return "—"
			}
			return t.Format("02 Jan 2006")
		},
		"formatDateTime": func(t time.Time) string {
			return t.Format("02 Jan 2006 15:04")
		},
		"dict": func(values ...any) (map[string]any, error) {
			if len(values)%2 != 0 {
				return nil, fmt.Errorf("dict requires even args")
			}
			m := make(map[string]any, len(values)/2)
			for i := 0; i < len(values); i += 2 {
				key, ok := values[i].(string)
				if !ok {
					return nil, fmt.Errorf("dict keys must be strings")
				}
				m[key] = values[i+1]
			}
			return m, nil
		},
	}).ParseFS(sub, "*.html")
}
