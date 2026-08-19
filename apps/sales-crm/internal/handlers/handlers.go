package handlers

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/salespulse/crm/internal/db"
	"github.com/salespulse/crm/internal/middleware"
	"github.com/salespulse/crm/internal/models"
)

type Server struct {
	Store      *db.Store
	Tmpl       *template.Template
	UIPassword string
	UISecret   string
}

func New(store *db.Store, tmpl *template.Template) *Server {
	return &Server{Store: store, Tmpl: tmpl}
}

// ---------- helpers ----------

func (s *Server) writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

func (s *Server) writeError(w http.ResponseWriter, status int, msg string) {
	s.writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) parseID(r *http.Request, key string) (int64, error) {
	return strconv.ParseInt(r.PathValue(key), 10, 64)
}

func formatINR(v float64) string {
	if v >= 10000000 {
		return fmt.Sprintf("₹%.2f Cr", v/10000000)
	}
	if v >= 100000 {
		return fmt.Sprintf("₹%.2f L", v/100000)
	}
	return fmt.Sprintf("₹%.0f", v)
}

func formatDate(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.Format("02 Jan 2006")
}

func formatDateTime(t time.Time) string {
	return t.Format("02 Jan 2006 15:04")
}

func isOverdue(d models.Deal) bool {
	if d.DueAt == nil || d.Stage == "won" || d.Stage == "lost" {
		return false
	}
	return d.DueAt.Before(time.Now())
}

// ---------- Health ----------

func (s *Server) Healthz(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) Readyz(w http.ResponseWriter, r *http.Request) {
	// simple check – could ping DB
	s.writeJSON(w, 200, map[string]string{"status": "ready"})
}

// ---------- UI pages ----------

func (s *Server) Dashboard(w http.ResponseWriter, r *http.Request) {
	stats, err := s.Store.GetStats()
	if err != nil {
		http.Error(w, "internal error", 500)
		log.Println(err)
		return
	}
	overdue, _ := s.Store.ListDeals(db.DealFilter{Filter: "overdue", Limit: 8})
	stale, _ := s.Store.ListDeals(db.DealFilter{Filter: "stale", Limit: 8})
	hot, _ := s.Store.ListDeals(db.DealFilter{Filter: "hot", Limit: 8})
	sla, _ := s.Store.ListDeals(db.DealFilter{Filter: "sla", Limit: 8})
	recent, _ := s.Store.ListDeals(db.DealFilter{Limit: 8})

	data := map[string]any{
		"Title":   "Dashboard",
		"Stats":   stats,
		"Overdue": overdue,
		"Stale":   stale,
		"Hot":     hot,
		"SLA":     sla,
		"Recent":  recent,
		"Format":  formatINR,
		"Date":    formatDate,
		"AuthOn":  s.UIPassword != "",
	}
	s.render(w, "dashboard.html", data)
}

func (s *Server) Pipeline(w http.ResponseWriter, r *http.Request) {
	deals, err := s.Store.ListDeals(db.DealFilter{Limit: 200})
	if err != nil {
		http.Error(w, "internal error", 500)
		return
	}
	byStage := map[string][]models.Deal{}
	for _, st := range models.ValidStages {
		byStage[st] = []models.Deal{}
	}
	for _, d := range deals {
		byStage[d.Stage] = append(byStage[d.Stage], d)
	}
	s.render(w, "pipeline.html", map[string]any{
		"Title":    "Pipeline",
		"ByStage":  byStage,
		"Stages":   models.ValidStages,
		"Labels":   models.StageLabels,
		"Format":   formatINR,
		"Date":     formatDate,
		"Overdue":  isOverdue,
	})
}

func (s *Server) DealsPage(w http.ResponseWriter, r *http.Request) {
	f := db.DealFilter{
		Stage:  r.URL.Query().Get("stage"),
		Source: r.URL.Query().Get("source"),
		Filter: r.URL.Query().Get("filter"),
		Q:      r.URL.Query().Get("q"),
		Limit:  100,
	}
	deals, err := s.Store.ListDeals(f)
	if err != nil {
		http.Error(w, "internal error", 500)
		return
	}
	s.render(w, "deals.html", map[string]any{
		"Title":   "Deals",
		"Deals":   deals,
		"Filter":  f,
		"Stages":  models.ValidStages,
		"Labels":  models.StageLabels,
		"Sources": models.LeadSources,
		"Format":  formatINR,
		"Date":    formatDate,
		"Overdue": isOverdue,
	})
}

func (s *Server) DealView(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	deal, err := s.Store.GetDeal(id)
	if err != nil || deal == nil {
		http.NotFound(w, r)
		return
	}
	acts, _ := s.Store.ListActivities(id)
	s.render(w, "deal_view.html", map[string]any{
		"Title":      deal.Title,
		"Deal":       deal,
		"Activities": acts,
		"Stages":     models.ValidStages,
		"Labels":     models.StageLabels,
		"ActTypes":   models.ActivityTypes,
		"LostReasons": models.LostReasons,
		"Format":     formatINR,
		"Date":       formatDate,
		"DateTime":   formatDateTime,
		"Overdue":    isOverdue(*deal),
	})
}

func (s *Server) ContactsPage(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	contacts, err := s.Store.ListContacts(q, 100, 0)
	if err != nil {
		http.Error(w, "internal error", 500)
		return
	}
	s.render(w, "contacts.html", map[string]any{
		"Title":    "Contacts",
		"Contacts": contacts,
		"Q":        q,
	})
}

func (s *Server) ReportsPage(w http.ResponseWriter, r *http.Request) {
	stats, err := s.Store.GetStats()
	if err != nil {
		http.Error(w, "internal error", 500)
		return
	}
	s.render(w, "reports.html", map[string]any{
		"Title":  "Reports",
		"Stats":  stats,
		"Labels": models.StageLabels,
		"Format": formatINR,
	})
}

func (s *Server) NewDealPage(w http.ResponseWriter, r *http.Request) {
	contacts, _ := s.Store.ListContacts("", 200, 0)
	s.render(w, "deal_form.html", map[string]any{
		"Title":     "New Deal",
		"Deal":      &models.Deal{Stage: "lead"},
		"Contacts":  contacts,
		"Stages":    models.ValidStages,
		"Labels":    models.StageLabels,
		"Sources":   models.LeadSources,
		"IsNew":     true,
	})
}

func (s *Server) EditDealPage(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	deal, err := s.Store.GetDeal(id)
	if err != nil || deal == nil {
		http.NotFound(w, r)
		return
	}
	contacts, _ := s.Store.ListContacts("", 200, 0)
	s.render(w, "deal_form.html", map[string]any{
		"Title":    "Edit Deal",
		"Deal":     deal,
		"Contacts": contacts,
		"Stages":   models.ValidStages,
		"Labels":   models.StageLabels,
		"Sources":  models.LeadSources,
		"IsNew":    false,
	})
}

func (s *Server) NewContactPage(w http.ResponseWriter, r *http.Request) {
	s.render(w, "contact_form.html", map[string]any{
		"Title":   "New Contact",
		"Contact": &models.Contact{},
		"IsNew":   true,
	})
}

func (s *Server) EditContactPage(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	c, err := s.Store.GetContact(id)
	if err != nil || c == nil {
		http.NotFound(w, r)
		return
	}
	s.render(w, "contact_form.html", map[string]any{
		"Title":   "Edit Contact",
		"Contact": c,
		"IsNew":   false,
	})
}

func (s *Server) render(w http.ResponseWriter, name string, data any) {
	if err := s.Tmpl.ExecuteTemplate(w, name, data); err != nil {
		log.Printf("template error %s: %v", name, err)
		http.Error(w, "template error", 500)
	}
}

// ---------- Form actions (POST) ----------

func (s *Server) CreateDealForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", 400)
		return
	}
	deal := parseDealForm(r)
	if deal.Title == "" {
		http.Error(w, "title required", 400)
		return
	}
	if !models.IsValidStage(deal.Stage) {
		deal.Stage = "lead"
	}
	id, err := s.Store.CreateDeal(deal)
	if err != nil {
		log.Println(err)
		http.Error(w, "could not create deal", 500)
		return
	}
	http.Redirect(w, r, fmt.Sprintf("/deals/%d", id), http.StatusSeeOther)
}

func (s *Server) UpdateDealForm(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", 400)
		return
	}
	deal := parseDealForm(r)
	deal.ID = id
	if !models.IsValidStage(deal.Stage) {
		http.Error(w, "invalid stage", 400)
		return
	}
	if err := s.Store.UpdateDeal(deal); err != nil {
		log.Println(err)
		http.Error(w, "could not update", 500)
		return
	}
	http.Redirect(w, r, fmt.Sprintf("/deals/%d", id), http.StatusSeeOther)
}

func (s *Server) DeleteDealForm(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := s.Store.DeleteDeal(id); err != nil {
		log.Println(err)
		http.Error(w, "could not delete", 500)
		return
	}
	http.Redirect(w, r, "/deals", http.StatusSeeOther)
}

func (s *Server) MoveStageForm(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", 400)
		return
	}
	stage := r.FormValue("stage")
	reason := r.FormValue("lost_reason")
	if !models.IsValidStage(stage) {
		http.Error(w, "invalid stage", 400)
		return
	}
	if stage == "lost" && reason == "" {
		reason = "Other"
	}
	if err := s.Store.UpdateDealStage(id, stage, reason); err != nil {
		log.Println(err)
		http.Error(w, "could not update stage", 500)
		return
	}
	http.Redirect(w, r, fmt.Sprintf("/deals/%d", id), http.StatusSeeOther)
}

func (s *Server) AddActivityForm(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", 400)
		return
	}
	typ := r.FormValue("type")
	content := strings.TrimSpace(r.FormValue("content"))
	if content == "" {
		http.Error(w, "content required", 400)
		return
	}
	if !models.IsValidActivityType(typ) {
		typ = "note"
	}
	_, err = s.Store.AddActivity(&models.Activity{
		DealID:    id,
		Type:      typ,
		Content:   content,
		CreatedBy: r.FormValue("created_by"),
	})
	if err != nil {
		log.Println(err)
		http.Error(w, "could not add activity", 500)
		return
	}
	http.Redirect(w, r, fmt.Sprintf("/deals/%d", id), http.StatusSeeOther)
}

func (s *Server) CreateContactForm(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", 400)
		return
	}
	c := &models.Contact{
		Name:    strings.TrimSpace(r.FormValue("name")),
		Company: strings.TrimSpace(r.FormValue("company")),
		Email:   strings.TrimSpace(r.FormValue("email")),
		Phone:   strings.TrimSpace(r.FormValue("phone")),
	}
	if c.Name == "" {
		http.Error(w, "name required", 400)
		return
	}
	_, err := s.Store.CreateContact(c)
	if err != nil {
		log.Println(err)
		http.Error(w, "could not create contact", 500)
		return
	}
	http.Redirect(w, r, "/contacts", http.StatusSeeOther)
}

func (s *Server) UpdateContactForm(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", 400)
		return
	}
	c := &models.Contact{
		ID:      id,
		Name:    strings.TrimSpace(r.FormValue("name")),
		Company: strings.TrimSpace(r.FormValue("company")),
		Email:   strings.TrimSpace(r.FormValue("email")),
		Phone:   strings.TrimSpace(r.FormValue("phone")),
	}
	if c.Name == "" {
		http.Error(w, "name required", 400)
		return
	}
	if err := s.Store.UpdateContact(c); err != nil {
		log.Println(err)
		http.Error(w, "could not update contact", 500)
		return
	}
	http.Redirect(w, r, "/contacts", http.StatusSeeOther)
}

func (s *Server) DeleteContactForm(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if err := s.Store.DeleteContact(id); err != nil {
		log.Println(err)
		http.Error(w, "could not delete", 500)
		return
	}
	http.Redirect(w, r, "/contacts", http.StatusSeeOther)
}

func parseDealForm(r *http.Request) *models.Deal {
	d := &models.Deal{
		Title:      strings.TrimSpace(r.FormValue("title")),
		Stage:      r.FormValue("stage"),
		Owner:      strings.TrimSpace(r.FormValue("owner")),
		Source:     r.FormValue("source"),
		Campaign:   strings.TrimSpace(r.FormValue("campaign")),
		NextAction: strings.TrimSpace(r.FormValue("next_action")),
		LostReason: r.FormValue("lost_reason"),
		Notes:      strings.TrimSpace(r.FormValue("notes")),
	}
	if v := r.FormValue("value"); v != "" {
		d.Value, _ = strconv.ParseFloat(v, 64)
	}
	if cid := r.FormValue("contact_id"); cid != "" {
		if id, err := strconv.ParseInt(cid, 10, 64); err == nil {
			d.ContactID = &id
		}
	}
	if due := r.FormValue("due_at"); due != "" {
		if t, err := time.Parse("2006-01-02", due); err == nil {
			d.DueAt = &t
		}
	}
	return d
}

// ---------- JSON API ----------

func (s *Server) APIStats(w http.ResponseWriter, r *http.Request) {
	stats, err := s.Store.GetStats()
	if err != nil {
		s.writeError(w, 500, "internal error")
		log.Println(err)
		return
	}
	s.writeJSON(w, 200, stats)
}

func (s *Server) APIListDeals(w http.ResponseWriter, r *http.Request) {
	f := db.DealFilter{
		Stage:  r.URL.Query().Get("stage"),
		Source: r.URL.Query().Get("source"),
		Filter: r.URL.Query().Get("filter"),
		Q:      r.URL.Query().Get("q"),
		Limit:  100,
	}
	if lim := r.URL.Query().Get("limit"); lim != "" {
		if n, err := strconv.Atoi(lim); err == nil {
			f.Limit = n
		}
	}
	if off := r.URL.Query().Get("offset"); off != "" {
		if n, err := strconv.Atoi(off); err == nil {
			f.Offset = n
		}
	}
	deals, err := s.Store.ListDeals(f)
	if err != nil {
		s.writeError(w, 500, "internal error")
		return
	}
	s.writeJSON(w, 200, deals)
}

func (s *Server) APIGetDeal(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	deal, err := s.Store.GetDeal(id)
	if err != nil {
		s.writeError(w, 500, "internal error")
		return
	}
	if deal == nil {
		s.writeError(w, 404, "not found")
		return
	}
	s.writeJSON(w, 200, deal)
}

func (s *Server) APICreateDeal(w http.ResponseWriter, r *http.Request) {
	var d models.Deal
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	d.Title = strings.TrimSpace(d.Title)
	if d.Title == "" {
		s.writeError(w, 400, "title required")
		return
	}
	if d.Stage == "" {
		d.Stage = "lead"
	}
	if !models.IsValidStage(d.Stage) {
		s.writeError(w, 400, "invalid stage")
		return
	}
	if strings.TrimSpace(d.Owner) == "" {
		d.Owner = s.Store.NextOwner("Unassigned")
	}
	id, err := s.Store.CreateDeal(&d)
	if err != nil {
		log.Println(err)
		s.writeError(w, 500, "could not create")
		return
	}
	created, err := s.Store.GetDeal(id)
	if err != nil || created == nil {
		s.writeJSON(w, 201, map[string]any{"id": id})
		return
	}
	s.writeJSON(w, 201, created)
}

func (s *Server) APIUpdateDeal(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	var d models.Deal
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	d.ID = id
	if d.Title == "" {
		s.writeError(w, 400, "title required")
		return
	}
	if !models.IsValidStage(d.Stage) {
		s.writeError(w, 400, "invalid stage")
		return
	}
	if err := s.Store.UpdateDeal(&d); err != nil {
		log.Println(err)
		s.writeError(w, 500, "could not update")
		return
	}
	updated, err := s.Store.GetDeal(id)
	if err != nil || updated == nil {
		s.writeJSON(w, 200, d)
		return
	}
	s.writeJSON(w, 200, updated)
}

func (s *Server) APIDeleteDeal(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	if err := s.Store.DeleteDeal(id); err != nil {
		s.writeError(w, 500, "could not delete")
		return
	}
	s.writeJSON(w, 200, map[string]string{"status": "deleted"})
}

func (s *Server) APIListContacts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	list, err := s.Store.ListContacts(q, 100, 0)
	if err != nil {
		s.writeError(w, 500, "internal error")
		return
	}
	s.writeJSON(w, 200, list)
}

func (s *Server) APIGetContact(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	c, err := s.Store.GetContact(id)
	if err != nil {
		s.writeError(w, 500, "internal error")
		return
	}
	if c == nil {
		s.writeError(w, 404, "not found")
		return
	}
	s.writeJSON(w, 200, c)
}

func (s *Server) APICreateContact(w http.ResponseWriter, r *http.Request) {
	var c models.Contact
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	c.Name = strings.TrimSpace(c.Name)
	if c.Name == "" {
		s.writeError(w, 400, "name required")
		return
	}
	id, err := s.Store.CreateContact(&c)
	if err != nil {
		log.Println(err)
		s.writeError(w, 500, "could not create")
		return
	}
	created, err := s.Store.GetContact(id)
	if err != nil || created == nil {
		c.ID = id
		s.writeJSON(w, 201, c)
		return
	}
	s.writeJSON(w, 201, created)
}

func (s *Server) APIUpdateContact(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	var c models.Contact
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	c.ID = id
	if c.Name == "" {
		s.writeError(w, 400, "name required")
		return
	}
	if err := s.Store.UpdateContact(&c); err != nil {
		s.writeError(w, 500, "could not update")
		return
	}
	updated, err := s.Store.GetContact(id)
	if err != nil || updated == nil {
		s.writeJSON(w, 200, c)
		return
	}
	s.writeJSON(w, 200, updated)
}

func (s *Server) APIDeleteContact(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	if err := s.Store.DeleteContact(id); err != nil {
		s.writeError(w, 500, "could not delete")
		return
	}
	s.writeJSON(w, 200, map[string]string{"status": "deleted"})
}

// POST /api/leads – one-shot ingest (contact + deal + first activity)
func (s *Server) APIIngestLead(w http.ResponseWriter, r *http.Request) {
	var in models.LeadIngest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Email = strings.TrimSpace(in.Email)
	in.Title = strings.TrimSpace(in.Title)
	if in.Name == "" && in.Email == "" {
		s.writeError(w, 400, "name or email required")
		return
	}
	if in.Title == "" {
		in.Title = "Website inquiry"
		if in.Company != "" {
			in.Title = in.Company + " – inquiry"
		}
	}
	if in.Source == "" {
		in.Source = "Website"
	}
	if in.Owner == "" {
		in.Owner = s.Store.NextOwner("Website")
	}

	// dedupe by email
	var contactID *int64
	if in.Email != "" {
		existing, err := s.Store.FindContactByEmail(in.Email)
		if err != nil {
			log.Println(err)
			s.writeError(w, 500, "internal error")
			return
		}
		if existing != nil {
			contactID = &existing.ID
			// soft-update name/company/phone if provided
			if in.Name != "" {
				existing.Name = in.Name
			}
			if in.Company != "" {
				existing.Company = in.Company
			}
			if in.Phone != "" {
				existing.Phone = in.Phone
			}
			_ = s.Store.UpdateContact(existing)
		}
	}
	if contactID == nil {
		c := &models.Contact{
			Name:    in.Name,
			Company: in.Company,
			Email:   in.Email,
			Phone:   in.Phone,
		}
		if c.Name == "" {
			c.Name = in.Email
		}
		id, err := s.Store.CreateContact(c)
		if err != nil {
			log.Println(err)
			s.writeError(w, 500, "could not create contact")
			return
		}
		contactID = &id
	}

	due := time.Now().AddDate(0, 0, 1) // default due tomorrow
	deal := &models.Deal{
		Title:      in.Title,
		ContactID:  contactID,
		Value:      in.Value,
		Stage:      "lead",
		Owner:      in.Owner,
		Source:     in.Source,
		Campaign:   in.Campaign,
		NextAction: "First contact / qualify",
		DueAt:      &due,
		Notes:      in.Notes,
	}
	deal.Score = db.CalculateScore(deal)
	dealID, err := s.Store.CreateDeal(deal)
	if err != nil {
		log.Println(err)
		s.writeError(w, 500, "could not create deal")
		return
	}

	// first activity
	note := "Lead ingested"
	if in.Notes != "" {
		note = in.Notes
	}
	_, _ = s.Store.AddActivity(&models.Activity{
		DealID:    dealID,
		Type:      "note",
		Content:   note,
		CreatedBy: in.Owner,
	})

	created, err := s.Store.GetDeal(dealID)
	if err != nil || created == nil {
		s.writeJSON(w, 201, map[string]any{
			"deal_id":    dealID,
			"contact_id": *contactID,
		})
		return
	}
	s.writeJSON(w, 201, map[string]any{
		"deal_id":    dealID,
		"contact_id": *contactID,
		"deal":       created,
	})
}

func (s *Server) APIListActivities(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	list, err := s.Store.ListActivities(id)
	if err != nil {
		s.writeError(w, 500, "internal error")
		return
	}
	s.writeJSON(w, 200, list)
}

func (s *Server) APIAddActivity(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	var a models.Activity
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	a.DealID = id
	a.Content = strings.TrimSpace(a.Content)
	if a.Content == "" {
		s.writeError(w, 400, "content required")
		return
	}
	if !models.IsValidActivityType(a.Type) {
		a.Type = "note"
	}
	aid, err := s.Store.AddActivity(&a)
	if err != nil {
		s.writeError(w, 500, "could not add")
		return
	}
	a.ID = aid
	a.CreatedAt = time.Now().UTC()
	s.writeJSON(w, 201, a)
}

// APIUpdateStage – for drag-and-drop Kanban
func (s *Server) APIUpdateStage(w http.ResponseWriter, r *http.Request) {
	id, err := s.parseID(r, "id")
	if err != nil {
		s.writeError(w, 400, "invalid id")
		return
	}
	var body struct {
		Stage      string `json:"stage"`
		LostReason string `json:"lost_reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		s.writeError(w, 400, "invalid json")
		return
	}
	if !models.IsValidStage(body.Stage) {
		s.writeError(w, 400, "invalid stage")
		return
	}
	if body.Stage == "lost" && body.LostReason == "" {
		body.LostReason = "Other"
	}
	if err := s.Store.UpdateDealStage(id, body.Stage, body.LostReason); err != nil {
		log.Println(err)
		s.writeError(w, 500, "could not update stage")
		return
	}
	deal, _ := s.Store.GetDeal(id)
	s.writeJSON(w, 200, deal)
}

// ExportDealsCSV – download deals as CSV
func (s *Server) ExportDealsCSV(w http.ResponseWriter, r *http.Request) {
	f := db.DealFilter{
		Stage:  r.URL.Query().Get("stage"),
		Source: r.URL.Query().Get("source"),
		Filter: r.URL.Query().Get("filter"),
		Q:      r.URL.Query().Get("q"),
		Limit:  5000,
	}
	deals, err := s.Store.ListDeals(f)
	if err != nil {
		http.Error(w, "internal error", 500)
		return
	}
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=deals.csv")
	fmt.Fprintln(w, "id,title,contact,company,value,stage,score,source,campaign,owner,next_action,due_at,stale,days_idle,lost_reason,created_at")
	for _, d := range deals {
		due := ""
		if d.DueAt != nil {
			due = d.DueAt.Format("2006-01-02")
		}
		fmt.Fprintf(w, "%d,%q,%q,%q,%.2f,%s,%d,%q,%q,%q,%q,%s,%t,%d,%q,%s\n",
			d.ID, d.Title, d.ContactName, d.Company, d.Value, d.Stage, d.Score,
			d.Source, d.Campaign, d.Owner, d.NextAction, due, d.Stale, d.DaysIdle,
			d.LostReason, d.CreatedAt.Format(time.RFC3339),
		)
	}
}

// ---------- Auth ----------

func (s *Server) LoginPage(w http.ResponseWriter, r *http.Request) {
	if s.UIPassword == "" {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	next := r.URL.Query().Get("next")
	if next == "" {
		next = "/"
	}
	_ = s.Tmpl.ExecuteTemplate(w, "login.html", map[string]any{
		"Title": "Login",
		"Next":  next,
		"Error": r.URL.Query().Get("error"),
	})
}

func (s *Server) LoginSubmit(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Redirect(w, r, "/login?error=1", http.StatusSeeOther)
		return
	}
	pass := r.FormValue("password")
	next := r.FormValue("next")
	if next == "" {
		next = "/"
	}
	if !middleware.CheckPassword(pass, s.UIPassword) {
		http.Redirect(w, r, "/login?error=1&next="+next, http.StatusSeeOther)
		return
	}
	http.SetCookie(w, middleware.MakeSessionCookie(s.UISecret))
	http.Redirect(w, r, next, http.StatusSeeOther)
}

func (s *Server) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, middleware.ClearSessionCookie())
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}
