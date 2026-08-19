package db

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/salespulse/crm/internal/models"
	_ "modernc.org/sqlite"
)

type Store struct {
	db       *sql.DB
	SLAHours int      // max hours to first real contact (0 = off)
	Owners   []string // round-robin pool
}

func Open(path string) (*Store, error) {
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // SQLite is single-writer
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	if err := db.Ping(); err != nil {
		return nil, err
	}

	s := &Store{db: db, SLAHours: 2}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS contacts (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT NOT NULL,
		company    TEXT DEFAULT '',
		email      TEXT DEFAULT '',
		phone      TEXT DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email != '';

	CREATE TABLE IF NOT EXISTS deals (
		id            INTEGER PRIMARY KEY AUTOINCREMENT,
		title         TEXT NOT NULL,
		contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
		value         REAL NOT NULL DEFAULT 0,
		stage         TEXT NOT NULL DEFAULT 'lead',
		owner         TEXT DEFAULT '',
		source        TEXT DEFAULT '',
		campaign      TEXT DEFAULT '',
		next_action   TEXT DEFAULT '',
		due_at        DATETIME,
		score         INTEGER NOT NULL DEFAULT 0,
		lost_reason   TEXT DEFAULT '',
		notes         TEXT DEFAULT '',
		created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		last_activity DATETIME
	);
	CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
	CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);
	CREATE INDEX IF NOT EXISTS idx_deals_due ON deals(due_at);
	CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source);

	CREATE TABLE IF NOT EXISTS activities (
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		deal_id    INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
		type       TEXT NOT NULL DEFAULT 'note',
		content    TEXT NOT NULL,
		created_by TEXT DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);

	CREATE TABLE IF NOT EXISTS meta (
		key   TEXT PRIMARY KEY,
		value TEXT NOT NULL DEFAULT ''
	);
	INSERT OR IGNORE INTO meta (key, value) VALUES ('rr_index', '0');
	`
	_, err := s.db.Exec(schema)
	return err
}

// NextOwner returns the next owner from the round-robin pool (or fallback).
func (s *Store) NextOwner(fallback string) string {
	if len(s.Owners) == 0 {
		if fallback != "" {
			return fallback
		}
		return "Unassigned"
	}
	var idx int
	_ = s.db.QueryRow(`SELECT CAST(value AS INTEGER) FROM meta WHERE key='rr_index'`).Scan(&idx)
	owner := s.Owners[idx%len(s.Owners)]
	next := (idx + 1) % (len(s.Owners) * 1000) // keep small
	_, _ = s.db.Exec(`UPDATE meta SET value=? WHERE key='rr_index'`, fmt.Sprintf("%d", next))
	return owner
}

func (s *Store) SeedIfEmpty() error {
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM deals`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	log.Println("Seeding sample data...")

	// Contacts
	contacts := []models.Contact{
		{Name: "Anita Desai", Company: "BrightTech", Email: "anita@brighttech.in", Phone: "+91 98765 43210"},
		{Name: "Rahul Mehta", Company: "NovaSoft", Email: "rahul@novasoft.io", Phone: "+91 91234 56789"},
		{Name: "Priya Nair", Company: "CloudPeak", Email: "priya@cloudpeak.com", Phone: "+91 99887 76655"},
		{Name: "Vikram Shah", Company: "DataForge", Email: "vikram@dataforge.ai", Phone: "+91 97654 32109"},
	}
	for i := range contacts {
		id, err := s.CreateContact(&contacts[i])
		if err != nil {
			return err
		}
		contacts[i].ID = id
	}

	now := time.Now()
	deals := []struct {
		title, stage, owner, source, campaign, next, notes string
		value                                              float64
		contactIdx                                         int
		dueDays                                            int
		lastActDays                                        int
	}{
		{"Enterprise plan – BrightTech", "lead", "Website", "Website", "pricing-page", "Call to qualify budget", "Interested in annual discount", 250000, 0, 1, 0},
		{"NovaSoft – API integration", "qualified", "Sales", "LinkedIn", "outbound-q3", "Send proposal", "Budget confirmed ~3L", 320000, 1, 2, 1},
		{"CloudPeak – Multi-seat license", "proposal", "Sales", "Referral", "", "Follow up on proposal", "Waiting for legal review", 180000, 2, -1, 3},
		{"DataForge – Pilot project", "negotiation", "Sales", "Event", "tech-summit", "Negotiate final price", "Discount request 15%", 450000, 3, 0, 1},
		{"Old lead – no response", "lead", "Sales", "Cold Call", "", "Try WhatsApp again", "Called 3 times, no answer", 75000, -1, -5, 12},
		{"Won deal – Acme", "won", "Sales", "Website", "demo-request", "", "Closed after demo", 210000, -1, 0, 20},
		{"Lost – competitor", "lost", "Sales", "Ads", "google-search", "", "Chose cheaper alternative", 95000, -1, 0, 15},
	}

	for _, d := range deals {
		var contactID *int64
		if d.contactIdx >= 0 {
			id := contacts[d.contactIdx].ID
			contactID = &id
		}
		var due *time.Time
		if d.dueDays != 0 || d.stage == "lead" || d.stage == "qualified" {
			t := now.AddDate(0, 0, d.dueDays)
			due = &t
		}
		var lastAct *time.Time
		if d.lastActDays >= 0 {
			t := now.AddDate(0, 0, -d.lastActDays)
			lastAct = &t
		}
		deal := &models.Deal{
			Title:        d.title,
			ContactID:    contactID,
			Value:        d.value,
			Stage:        d.stage,
			Owner:        d.owner,
			Source:       d.source,
			Campaign:     d.campaign,
			NextAction:   d.next,
			DueAt:        due,
			Notes:        d.notes,
			LastActivity: lastAct,
		}
		deal.Score = CalculateScore(deal)
		id, err := s.CreateDeal(deal)
		if err != nil {
			return err
		}
		// sample activity
		if d.lastActDays < 10 {
			_, _ = s.AddActivity(&models.Activity{
				DealID:    id,
				Type:      "note",
				Content:   "Initial contact logged",
				CreatedBy: d.owner,
			})
		}
	}
	return nil
}

// ---------- Contacts ----------

func (s *Store) CreateContact(c *models.Contact) (int64, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(
		`INSERT INTO contacts (name, company, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		c.Name, c.Company, c.Email, c.Phone, now, now,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetContact(id int64) (*models.Contact, error) {
	c := &models.Contact{}
	err := s.db.QueryRow(
		`SELECT id, name, company, email, phone, created_at, updated_at FROM contacts WHERE id = ?`, id,
	).Scan(&c.ID, &c.Name, &c.Company, &c.Email, &c.Phone, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return c, err
}

func (s *Store) FindContactByEmail(email string) (*models.Contact, error) {
	if email == "" {
		return nil, nil
	}
	c := &models.Contact{}
	err := s.db.QueryRow(
		`SELECT id, name, company, email, phone, created_at, updated_at FROM contacts WHERE lower(email) = lower(?)`, email,
	).Scan(&c.ID, &c.Name, &c.Company, &c.Email, &c.Phone, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return c, err
}

func (s *Store) UpdateContact(c *models.Contact) error {
	_, err := s.db.Exec(
		`UPDATE contacts SET name=?, company=?, email=?, phone=?, updated_at=? WHERE id=?`,
		c.Name, c.Company, c.Email, c.Phone, time.Now().UTC(), c.ID,
	)
	return err
}

func (s *Store) DeleteContact(id int64) error {
	_, err := s.db.Exec(`DELETE FROM contacts WHERE id = ?`, id)
	return err
}

func (s *Store) ListContacts(q string, limit, offset int) ([]models.Contact, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	query := `
		SELECT c.id, c.name, c.company, c.email, c.phone, c.created_at, c.updated_at,
		       (SELECT COUNT(*) FROM deals d WHERE d.contact_id = c.id) as deal_count
		FROM contacts c
	`
	args := []any{}
	if q != "" {
		query += ` WHERE c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR c.phone LIKE ?`
		like := "%" + q + "%"
		args = append(args, like, like, like, like)
	}
	query += ` ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Contact, 0)
	for rows.Next() {
		var c models.Contact
		if err := rows.Scan(&c.ID, &c.Name, &c.Company, &c.Email, &c.Phone, &c.CreatedAt, &c.UpdatedAt, &c.DealCount); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

// ---------- Deals ----------

func (s *Store) CreateDeal(d *models.Deal) (int64, error) {
	now := time.Now().UTC()
	if d.Score == 0 {
		d.Score = CalculateScore(d)
	}
	res, err := s.db.Exec(
		`INSERT INTO deals (title, contact_id, value, stage, owner, source, campaign, next_action, due_at, score, lost_reason, notes, created_at, updated_at, last_activity)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		d.Title, d.ContactID, d.Value, d.Stage, d.Owner, d.Source, d.Campaign, d.NextAction, d.DueAt, d.Score, d.LostReason, d.Notes, now, now, d.LastActivity,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetDeal(id int64) (*models.Deal, error) {
	d := &models.Deal{}
	var contactID sql.NullInt64
	var due, lastAct sql.NullTime
	err := s.db.QueryRow(`
		SELECT d.id, d.title, d.contact_id, COALESCE(c.name,''), COALESCE(c.company,''),
		       d.value, d.stage, d.owner, d.source, d.campaign, d.next_action, d.due_at,
		       d.score, d.lost_reason, d.notes, d.created_at, d.updated_at, d.last_activity
		FROM deals d
		LEFT JOIN contacts c ON c.id = d.contact_id
		WHERE d.id = ?`, id,
	).Scan(
		&d.ID, &d.Title, &contactID, &d.ContactName, &d.Company,
		&d.Value, &d.Stage, &d.Owner, &d.Source, &d.Campaign, &d.NextAction, &due,
		&d.Score, &d.LostReason, &d.Notes, &d.CreatedAt, &d.UpdatedAt, &lastAct,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if contactID.Valid {
		d.ContactID = &contactID.Int64
	}
	if due.Valid {
		d.DueAt = &due.Time
	}
	if lastAct.Valid {
		d.LastActivity = &lastAct.Time
	}
	d.Stale = isStale(d)
	d.Enrich()
	s.markSLA(d)
	return d, nil
}

func (s *Store) UpdateDeal(d *models.Deal) error {
	d.Score = CalculateScore(d)
	_, err := s.db.Exec(`
		UPDATE deals SET title=?, contact_id=?, value=?, stage=?, owner=?, source=?, campaign=?,
		               next_action=?, due_at=?, score=?, lost_reason=?, notes=?, updated_at=?
		WHERE id=?`,
		d.Title, d.ContactID, d.Value, d.Stage, d.Owner, d.Source, d.Campaign,
		d.NextAction, d.DueAt, d.Score, d.LostReason, d.Notes, time.Now().UTC(), d.ID,
	)
	return err
}

func (s *Store) UpdateDealStage(id int64, stage, lostReason string) error {
	if !models.IsValidStage(stage) {
		return fmt.Errorf("invalid stage")
	}
	_, err := s.db.Exec(
		`UPDATE deals SET stage=?, lost_reason=?, updated_at=? WHERE id=?`,
		stage, lostReason, time.Now().UTC(), id,
	)
	return err
}

func (s *Store) DeleteDeal(id int64) error {
	_, err := s.db.Exec(`DELETE FROM deals WHERE id = ?`, id)
	return err
}

type DealFilter struct {
	Stage   string
	Source  string
	Filter  string // overdue | stale | new_today
	Q       string
	Limit   int
	Offset  int
}

func (s *Store) ListDeals(f DealFilter) ([]models.Deal, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 100
	}
	query := `
		SELECT d.id, d.title, d.contact_id, COALESCE(c.name,''), COALESCE(c.company,''),
		       d.value, d.stage, d.owner, d.source, d.campaign, d.next_action, d.due_at,
		       d.score, d.lost_reason, d.notes, d.created_at, d.updated_at, d.last_activity
		FROM deals d
		LEFT JOIN contacts c ON c.id = d.contact_id
		WHERE 1=1
	`
	args := []any{}

	if f.Stage != "" {
		query += ` AND d.stage = ?`
		args = append(args, f.Stage)
	}
	if f.Source != "" {
		query += ` AND d.source = ?`
		args = append(args, f.Source)
	}
	if f.Q != "" {
		query += ` AND (d.title LIKE ? OR c.name LIKE ? OR c.company LIKE ? OR d.notes LIKE ?)`
		like := "%" + f.Q + "%"
		args = append(args, like, like, like, like)
	}
	switch f.Filter {
	case "overdue":
		query += ` AND d.due_at IS NOT NULL AND d.due_at < datetime('now') AND d.stage NOT IN ('won','lost')`
	case "stale":
		query += ` AND d.stage NOT IN ('won','lost') AND (
			(d.last_activity IS NOT NULL AND d.last_activity < datetime('now','-7 days'))
			OR (d.last_activity IS NULL AND d.created_at < datetime('now','-7 days'))
		)`
	case "new_today":
		query += ` AND date(d.created_at) = date('now')`
	case "hot":
		query += ` AND d.score >= 70 AND d.stage NOT IN ('won','lost')`
	case "sla":
		// open deals older than SLA hours with no real contact activity
		if s.SLAHours > 0 {
			query += fmt.Sprintf(` AND d.stage NOT IN ('won','lost')
				AND d.created_at < datetime('now', '-%d hours')
				AND NOT EXISTS (
					SELECT 1 FROM activities a
					WHERE a.deal_id = d.id AND a.type IN ('call','email','whatsapp','meeting')
				)`, s.SLAHours)
		} else {
			query += ` AND 0` // disabled
		}
	}

	query += ` ORDER BY d.score DESC, d.updated_at DESC LIMIT ? OFFSET ?`
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Deal, 0)
	for rows.Next() {
		var d models.Deal
		var contactID sql.NullInt64
		var due, lastAct sql.NullTime
		if err := rows.Scan(
			&d.ID, &d.Title, &contactID, &d.ContactName, &d.Company,
			&d.Value, &d.Stage, &d.Owner, &d.Source, &d.Campaign, &d.NextAction, &due,
			&d.Score, &d.LostReason, &d.Notes, &d.CreatedAt, &d.UpdatedAt, &lastAct,
		); err != nil {
			return nil, err
		}
		if contactID.Valid {
			d.ContactID = &contactID.Int64
		}
		if due.Valid {
			d.DueAt = &due.Time
		}
		if lastAct.Valid {
			d.LastActivity = &lastAct.Time
		}
		d.Stale = isStale(&d)
		d.Enrich()
		s.markSLA(&d)
		list = append(list, d)
	}
	return list, rows.Err()
}

// markSLA sets SLABreached when a lead has no real contact within SLAHours.
func (s *Store) markSLA(d *models.Deal) {
	if s.SLAHours <= 0 || d.Stage == "won" || d.Stage == "lost" {
		return
	}
	deadline := d.CreatedAt.Add(time.Duration(s.SLAHours) * time.Hour)
	if time.Now().Before(deadline) {
		return
	}
	// Real contact = call / email / whatsapp / meeting
	var n int
	_ = s.db.QueryRow(`
		SELECT COUNT(*) FROM activities
		WHERE deal_id=? AND type IN ('call','email','whatsapp','meeting')`, d.ID).Scan(&n)
	if n == 0 {
		d.SLABreached = true
	}
}

// ---------- Activities ----------

func (s *Store) AddActivity(a *models.Activity) (int64, error) {
	now := time.Now().UTC()
	res, err := s.db.Exec(
		`INSERT INTO activities (deal_id, type, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
		a.DealID, a.Type, a.Content, a.CreatedBy, now,
	)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	// bump last_activity + rescore
	_, _ = s.db.Exec(`UPDATE deals SET last_activity=?, updated_at=? WHERE id=?`, now, now, a.DealID)
	d, err := s.GetDeal(a.DealID)
	if err == nil && d != nil {
		d.Score = CalculateScore(d)
		_, _ = s.db.Exec(`UPDATE deals SET score=? WHERE id=?`, d.Score, a.DealID)
	}
	return id, nil
}

func (s *Store) ListActivities(dealID int64) ([]models.Activity, error) {
	rows, err := s.db.Query(
		`SELECT id, deal_id, type, content, created_by, created_at FROM activities WHERE deal_id=? ORDER BY created_at DESC`,
		dealID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.Activity, 0)
	for rows.Next() {
		var a models.Activity
		if err := rows.Scan(&a.ID, &a.DealID, &a.Type, &a.Content, &a.CreatedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

// ---------- Stats ----------

func (s *Store) GetStats() (*models.Stats, error) {
	st := &models.Stats{
		ByStage:  make(map[string]models.StageStat),
		BySource: make(map[string]models.SourceStat),
	}

	// open pipeline value + counts
	rows, err := s.db.Query(`
		SELECT stage, COUNT(*), COALESCE(SUM(value),0)
		FROM deals GROUP BY stage`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var wonVal, lostVal float64
	for rows.Next() {
		var stage string
		var cnt int
		var val float64
		if err := rows.Scan(&stage, &cnt, &val); err != nil {
			return nil, err
		}
		st.ByStage[stage] = models.StageStat{Count: cnt, Value: val}
		if stage == "won" {
			st.WonCount = cnt
			wonVal = val
		} else if stage == "lost" {
			st.LostCount = cnt
			lostVal = val
		} else {
			st.OpenDeals += cnt
			st.PipelineValue += val
		}
	}

	totalClosed := st.WonCount + st.LostCount
	if totalClosed > 0 {
		st.WinRate = float64(st.WonCount) / float64(totalClosed) * 100
	}

	// won this month
	_ = s.db.QueryRow(`
		SELECT COALESCE(SUM(value),0) FROM deals
		WHERE stage='won' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')`).Scan(&st.WonThisMonth)

	// overdue
	_ = s.db.QueryRow(`
		SELECT COUNT(*) FROM deals
		WHERE due_at IS NOT NULL AND due_at < datetime('now') AND stage NOT IN ('won','lost')`).Scan(&st.OverdueCount)

	// stale
	_ = s.db.QueryRow(`
		SELECT COUNT(*) FROM deals
		WHERE stage NOT IN ('won','lost') AND (
			(last_activity IS NOT NULL AND last_activity < datetime('now','-7 days'))
			OR (last_activity IS NULL AND created_at < datetime('now','-7 days'))
		)`).Scan(&st.StaleCount)

	// new today
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM deals WHERE date(created_at) = date('now')`).Scan(&st.NewToday)

	// SLA breaches
	st.SLAHours = s.SLAHours
	if s.SLAHours > 0 {
		_ = s.db.QueryRow(fmt.Sprintf(`
			SELECT COUNT(*) FROM deals d
			WHERE d.stage NOT IN ('won','lost')
			  AND d.created_at < datetime('now', '-%d hours')
			  AND NOT EXISTS (
			    SELECT 1 FROM activities a
			    WHERE a.deal_id = d.id AND a.type IN ('call','email','whatsapp','meeting')
			  )`, s.SLAHours)).Scan(&st.SLABreachCount)
	}

	// by source
	rows2, err := s.db.Query(`
		SELECT COALESCE(source,'Other'), COUNT(*), COALESCE(SUM(value),0),
		       SUM(CASE WHEN stage='won' THEN 1 ELSE 0 END),
		       COALESCE(SUM(CASE WHEN stage='won' THEN value ELSE 0 END),0)
		FROM deals GROUP BY COALESCE(source,'Other')`)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var src string
		var ss models.SourceStat
		if err := rows2.Scan(&src, &ss.Count, &ss.Value, &ss.WonCount, &ss.WonValue); err != nil {
			return nil, err
		}
		if src == "" {
			src = "Other"
		}
		st.BySource[src] = ss
	}

	_ = wonVal
	_ = lostVal
	return st, nil
}

// ---------- Helpers ----------

func isStale(d *models.Deal) bool {
	if d.Stage == "won" || d.Stage == "lost" {
		return false
	}
	cutoff := time.Now().AddDate(0, 0, -7)
	if d.LastActivity != nil {
		return d.LastActivity.Before(cutoff)
	}
	return d.CreatedAt.Before(cutoff)
}

// CalculateScore – simple 0-100 score for prioritisation
func CalculateScore(d *models.Deal) int {
	score := 20 // base

	// value contribution (max 30)
	if d.Value >= 500000 {
		score += 30
	} else if d.Value >= 200000 {
		score += 20
	} else if d.Value >= 50000 {
		score += 10
	} else if d.Value > 0 {
		score += 5
	}

	// source quality (max 20)
	switch strings.ToLower(d.Source) {
	case "referral", "partner":
		score += 20
	case "linkedin", "event":
		score += 15
	case "website":
		score += 10
	case "ads":
		score += 8
	default:
		score += 5
	}

	// recency of activity (max 20)
	if d.LastActivity != nil {
		days := int(time.Since(*d.LastActivity).Hours() / 24)
		if days <= 1 {
			score += 20
		} else if days <= 3 {
			score += 12
		} else if days <= 7 {
			score += 5
		}
	}

	// has next action + due soon (max 10)
	if d.NextAction != "" {
		score += 5
		if d.DueAt != nil && d.DueAt.After(time.Now()) && d.DueAt.Before(time.Now().AddDate(0, 0, 3)) {
			score += 5
		}
	}

	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}
	return score
}
