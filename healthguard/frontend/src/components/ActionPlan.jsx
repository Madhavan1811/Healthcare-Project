const BAND_COLOR = {
  Low:      'var(--risk-low)',
  Moderate: 'var(--risk-mod)',
  High:     'var(--risk-high)',
  Critical: 'var(--risk-crit)',
}
const BAND_CLS = {
  Low: 'risk-low', Moderate: 'risk-moderate', High: 'risk-high', Critical: 'risk-critical',
}

function SectionHeader({ label, title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ width: 3, height: 16, background: 'var(--teal)', borderRadius: 2 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--teal)' }}>
          {label}
        </span>
      </div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</p>}
    </div>
  )
}

function TargetCard({ t, index }) {
  const current  = Number(t.current)
  const goal     = Number(t.goal)
  const isNum    = !isNaN(current) && !isNaN(goal)
  const overshoot = isNum && current > goal
  const min    = isNum ? Math.min(current, goal) * 0.85 : 0
  const max    = isNum ? Math.max(current, goal) * 1.10  : 1
  const curPct  = isNum ? Math.min(((current - min) / (max - min)) * 100, 96) : 50
  const goalPct = isNum ? Math.min(((goal - min) / (max - min)) * 100, 96) : 30

  return (
    <div className="card-flat animate-fade-up"
      style={{
        padding: 16,
        borderLeft: `3px solid ${overshoot ? 'var(--risk-high)' : 'var(--risk-mod)'}`,
        animationDelay: `${index * .07}s`,
      }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t.label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
          <span className="num" style={{ fontWeight: 800, color: overshoot ? 'var(--risk-high)' : 'var(--text-primary)' }}>
            {String(t.current)}{t.unit}
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>→</span>
          <span className="num" style={{ fontWeight: 800, color: 'var(--risk-low)' }}>
            {String(t.goal)}{t.unit}
          </span>
        </span>
      </div>

      {isNum && (
        <div style={{ position: 'relative', height: 10, background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 5, marginBottom: 8, overflow: 'visible' }}>
          {/* Current marker */}
          <div style={{
            position: 'absolute', top: -3, left: `${curPct}%`,
            width: 3, height: 16,
            background: overshoot ? 'var(--risk-high)' : 'var(--risk-mod)',
            borderRadius: 2, zIndex: 2,
            transition: 'left .6s ease',
          }} />
          {/* Goal marker */}
          <div style={{
            position: 'absolute', top: -3, left: `${goalPct}%`,
            width: 3, height: 16,
            background: 'var(--risk-low)',
            borderRadius: 2, zIndex: 2,
          }} />
          {/* Fill */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${curPct}%`, height: '100%',
            background: overshoot
              ? 'linear-gradient(90deg, var(--risk-low-bg), var(--risk-high))'
              : 'linear-gradient(90deg, var(--risk-low), #34d399)',
            borderRadius: 5, transition: 'width .8s ease',
          }} />
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.65 }}>{t.rationale}</p>
    </div>
  )
}

function ActionItem({ a, index }) {
  return (
    <li className="animate-fade-up"
      style={{
        display: 'flex', gap: 14, padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        animationDelay: `${index * .05}s`,
      }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--teal-light)', border: '1.5px solid var(--teal-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M2 4.5l2 2 3.5-3.5" stroke="var(--teal)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 5 }}>{a.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--teal)',
            background: 'var(--teal-light)', border: '1px solid var(--teal-mid)',
            padding: '2px 8px', borderRadius: 10, letterSpacing: '.06em',
          }}>
            {a.source.organisation}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{a.source.document}</span>
        </div>
      </div>
    </li>
  )
}

function ReferralCard({ r, index }) {
  const col = BAND_COLOR[r.band] || 'var(--text-muted)'
  return (
    <div className="card-flat animate-fade-up"
      style={{
        padding: 16,
        borderTop: `3px solid ${col}`,
        animationDelay: `${index * .06}s`,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.10em', textTransform: 'uppercase', color: col, marginBottom: 3 }}>
            {r.disease}
          </div>
          <span className="num" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(r.probability * 100).toFixed(1)}% risk</span>
        </div>
        <span className={`badge ${BAND_CLS[r.band]}`}>{r.band}</span>
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.5 }}>{r.action}</p>
      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{r.source.organisation}</span>
    </div>
  )
}

export default function ActionPlan({ plan }) {
  const { layer_1_targets: targets, layer_2_actions: actions, layer_3_referral: referral, emergency, disclaimer, note } = plan

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Layer 1: Personalised Targets */}
      <div className="card animate-fade-up" style={{ padding: 24 }}>
        <SectionHeader label="Layer 1 — Targets" title="Personalised Goals" subtitle="Your submitted values compared against published guideline thresholds." />
        {targets.length === 0 ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--risk-low-bg)', border: '1.5px solid var(--risk-low-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--risk-low)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 13, color: 'var(--risk-low)', fontWeight: 500 }}>
              All submitted values are within their guideline ranges.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {targets.map((t, i) => <TargetCard key={t.field} t={t} index={i} />)}
          </div>
        )}
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 14, lineHeight: 1.6 }}>{note}</p>
      </div>

      {/* Layer 2: Actions */}
      <div className="card animate-fade-up" style={{ padding: 24, animationDelay: '.08s' }}>
        <SectionHeader label="Layer 2 — Actions" title="Guideline Recommendations" subtitle="Evidence-based actions with citations." />
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {actions.map((a, i) => <ActionItem key={i} a={a} index={i} />)}
        </ul>
      </div>

      {/* Layer 3: Referral */}
      <div className="card animate-fade-up" style={{ padding: 24, animationDelay: '.16s' }}>
        <SectionHeader label="Layer 3 — Referral" title="Next Clinical Steps" />
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {referral.map((r, i) => <ReferralCard key={r.disease} r={r} index={i} />)}
        </div>
      </div>

      {/* Emergency signs */}
      <div className="animate-fade-up" style={{
        background: 'var(--risk-high-bg)',
        border: '1.5px solid var(--risk-high-border)',
        borderLeft: '4px solid var(--risk-high)',
        borderRadius: 10, padding: 20,
        animationDelay: '.24s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--risk-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 3v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="6.5" cy="10" r="1" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--risk-high)' }}>
            {emergency.title}
          </span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {emergency.signs.map((s, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--risk-high)', marginTop: 7, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65 }}>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '12px 16px', background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.7 }}>{disclaimer}</p>
      </div>
    </section>
  )
}
