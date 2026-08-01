'use client';

interface Profile {
  summary?: string;
  features?: string[];
  technical_stack?: string[];
  industry?: string;
  target_personas?: string[];
  competitors?: string[];
  pricing?: string | null;
  use_cases?: string[];
  pain_points?: string[];
  value_propositions?: string[];
  architecture?: string;
  field_status?: Record<string, string>;
}

function TagList({ items, accent }: { items: string[]; accent?: boolean }) {
  if (!items?.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className={`px-2.5 py-1 rounded-full text-xs ${
            accent ? 'bg-gtm-accent/15 text-gtm-accent' : 'bg-gtm-bg border border-gtm-border text-[var(--text-secondary)]'
          }`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gtm-accent">{title}</h4>
      {children}
    </section>
  );
}

export default function ProductProfileView({ profile }: { profile: Profile | Record<string, unknown> }) {
  const p = profile as Profile;
  const isEmpty = !p.summary && !p.features?.length && !p.industry;

  if (isEmpty) {
    return (
      <p className="text-[var(--text-secondary)] text-sm">
        No profile data yet. Run <span className="text-white">Crawl &amp; Ingest</span>, then{' '}
        <span className="text-white">Build Product Profile</span>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {p.summary && (
        <Section title="Summary">
          <p className="text-sm leading-relaxed text-[var(--text-primary)]">{p.summary}</p>
        </Section>
      )}
      {p.industry && (
        <Section title="Industry">
          <p className="text-sm">{p.industry}</p>
        </Section>
      )}
      {p.features?.length ? (
        <Section title="Key features">
          <TagList items={p.features} accent />
        </Section>
      ) : null}
      {p.technical_stack?.length ? (
        <Section title="Technical stack">
          <TagList items={p.technical_stack} />
        </Section>
      ) : null}
      {p.target_personas?.length ? (
        <Section title="Target personas">
          <TagList items={p.target_personas} />
        </Section>
      ) : null}
      {p.use_cases?.length ? (
        <Section title="Use cases">
          <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-1">
            {p.use_cases.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {p.pain_points?.length ? (
        <Section title="Pain points addressed">
          <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-1">
            {p.pain_points.map((pt) => (
              <li key={pt}>{pt}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {p.value_propositions?.length ? (
        <Section title="Value propositions">
          <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] space-y-1">
            {p.value_propositions.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {p.competitors?.length ? (
        <Section title="Competitors mentioned">
          <TagList items={p.competitors} />
        </Section>
      ) : null}
      {p.pricing && (
        <Section title="Pricing">
          <p className="text-sm">{p.pricing}</p>
        </Section>
      )}
      {p.architecture && (
        <Section title="Architecture">
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{p.architecture}</p>
        </Section>
      )}
    </div>
  );
}
