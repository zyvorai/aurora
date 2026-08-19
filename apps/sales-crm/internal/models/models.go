package models

import (
	"time"
)

// Stages whitelist – used for validation everywhere
var ValidStages = []string{
	"lead", "qualified", "proposal", "negotiation", "won", "lost",
}

var StageLabels = map[string]string{
	"lead":        "Lead",
	"qualified":   "Qualified",
	"proposal":    "Proposal",
	"negotiation": "Negotiation",
	"won":         "Closed Won",
	"lost":        "Closed Lost",
}

var ActivityTypes = []string{
	"call", "email", "whatsapp", "meeting", "note", "other",
}

var LostReasons = []string{
	"No response",
	"Budget",
	"Competitor",
	"Timing",
	"Not a fit",
	"Other",
}

var LeadSources = []string{
	"Website",
	"LinkedIn",
	"Referral",
	"Ads",
	"Cold Call",
	"Event",
	"Partner",
	"Other",
}

type Contact struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Company   string    `json:"company"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DealCount int       `json:"deal_count,omitempty"`
}

type Deal struct {
	ID           int64      `json:"id"`
	Title        string     `json:"title"`
	ContactID    *int64     `json:"contact_id,omitempty"`
	ContactName  string     `json:"contact_name,omitempty"`
	Company      string     `json:"company,omitempty"`
	Value        float64    `json:"value"`
	Stage        string     `json:"stage"`
	Owner        string     `json:"owner"`
	Source       string     `json:"source"`
	Campaign     string     `json:"campaign"`
	NextAction   string     `json:"next_action"`
	DueAt        *time.Time `json:"due_at,omitempty"`
	Score        int        `json:"score"`
	Stale        bool       `json:"stale"`
	LostReason   string     `json:"lost_reason,omitempty"`
	Notes        string     `json:"notes"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	LastActivity *time.Time `json:"last_activity,omitempty"`
	// Computed (not stored)
	DaysIdle    int  `json:"days_idle"`
	Hot         bool `json:"hot,omitempty"`
	SLABreached bool `json:"sla_breached,omitempty"`
}

// Enrich fills computed fields (DaysIdle, Hot). SLABreached is set by the store when listing.
func (d *Deal) Enrich() {
	ref := d.CreatedAt
	if d.LastActivity != nil {
		ref = *d.LastActivity
	}
	d.DaysIdle = int(time.Since(ref).Hours() / 24)
	if d.DaysIdle < 0 {
		d.DaysIdle = 0
	}
	d.Hot = d.Score >= 70 && d.Stage != "won" && d.Stage != "lost"
}

type Activity struct {
	ID        int64     `json:"id"`
	DealID    int64     `json:"deal_id"`
	Type      string    `json:"type"`
	Content   string    `json:"content"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

type Stats struct {
	PipelineValue  float64               `json:"pipeline_value"`
	WonThisMonth   float64               `json:"won_this_month"`
	WinRate        float64               `json:"win_rate"`
	OpenDeals      int                   `json:"open_deals"`
	WonCount       int                   `json:"won_count"`
	LostCount      int                   `json:"lost_count"`
	OverdueCount   int                   `json:"overdue_count"`
	StaleCount     int                   `json:"stale_count"`
	NewToday       int                   `json:"new_today"`
	SLABreachCount int                   `json:"sla_breach_count"`
	SLAHours       int                   `json:"sla_hours"`
	ByStage        map[string]StageStat  `json:"by_stage"`
	BySource       map[string]SourceStat `json:"by_source"`
}

type StageStat struct {
	Count int     `json:"count"`
	Value float64 `json:"value"`
}

type SourceStat struct {
	Count     int     `json:"count"`
	Value     float64 `json:"value"`
	WonCount  int     `json:"won_count"`
	WonValue  float64 `json:"won_value"`
}

// LeadIngest is the payload for POST /api/leads
type LeadIngest struct {
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	Company  string  `json:"company"`
	Phone    string  `json:"phone"`
	Title    string  `json:"title"`
	Value    float64 `json:"value"`
	Source   string  `json:"source"`
	Campaign string  `json:"campaign"`
	Owner    string  `json:"owner"`
	Notes    string  `json:"notes"`
}

func IsValidStage(s string) bool {
	for _, v := range ValidStages {
		if v == s {
			return true
		}
	}
	return false
}

func IsValidActivityType(t string) bool {
	for _, v := range ActivityTypes {
		if v == t {
			return true
		}
	}
	return false
}
