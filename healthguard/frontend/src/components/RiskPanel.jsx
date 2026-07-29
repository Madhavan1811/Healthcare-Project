const ABSTAIN_THRESHOLD = 0.40   // completeness at or below this → abstain

const BAND = {
  Low:      { color: 'var(--risk-low)',  bg: 'var(--risk-low-bg)',  border: 'var(--risk-low-border)',  cls: 'risk-low'      },
  Moderate: { color: 'var(--risk-mod)',  bg: 'var(--risk-mod-bg)',  border: 'var(--risk-mod-border)',  cls: 'risk-moderate'  },
  High:     { color: 'var(--risk-high)', bg: 'var(--risk-high-bg)', border: 'var(--risk-high-border)', cls: 'risk-high'     },
  Critical: { color: 'var(--risk-crit)', bg: 'var(--risk-crit-bg)', border: 'var(--risk-crit-border)', cls: 'risk-critical' },
}

const BAND_THRESHOLDS = [
  { name: 'Low',      max: 0.20, color: 'var(--risk-low)'  },
  { name: 'Moderate', max: 0.45, color: 'var(--risk-mod)'  },
  { name: 'High',     max: 0.70, color: 'var(--risk-high)' },
  { name: 'Critical', max: 1.00, color: 'var(--risk-crit)' },
]

/* ── Abstention card (insufficient data) ─────────────────────────────────── */
function AbstentionCard({ r, index }) {
  const pct     = Math.round(r.completeness * 100)
  const imputed = r.fields_total - r.fields_supplied

  return (
    <article className="animate-fade-up"
      style={{
        background: 'var(--risk-abstain-bg)',
        border: '1.5px solid var(--risk-abstain-border)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(15,28,46,.04)',
        animationDelay: `${index * 0.07}s`,
      }}>
      {/* Gray top strip */}
      <div style={{ height: 4, background: 'var(--risk-abstain)' }} />

      <div style={{ padding: 18 }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>{r.display_name}</div>
            <span className="badge risk-abstain">Insufficient Data</span>
          </div>
          {/* Question mark icon */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: '#e2e8f0',
            border: '2px solid var(--risk-abstain-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--risk-abstain)', lineHeight: 1 }}>?</span>
          </div>
        </div>

        {/* Main message */}
        <div style={{
          background: 'white',
          border: '1px solid var(--risk-abstain-border)',
          borderLeft: '3px solid var(--risk-abstain)',
          borderRadius: 6,
          padding: '12px 14px',
          marginBottom: 12,
        }}>
          <p style={{ fontSize: 12, color: 'var(--risk-abstain)', fontWeight: 700, marginBottom: 4 }}>
            Prediction unsafe — refer to clinician
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.65 }}>
            Only <strong>{pct}%</strong> of inputs were measured directly. {imputed} value{imputed !== 1 ? 's' : ''} were
            imputed by the model. At this level of missing data, the output cannot be reliably interpreted.
          </p>
        </div>

        {/* Certainty strip showing the problem visually */}
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--risk-abstain-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Input certainty</span>
            <span className="num" style={{ color: 'var(--risk-abstain)', fontWeight: 700 }}>
              {r.fields_supplied}/{r.fields_total} measured
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-sunken)', border: '1px solid var(--risk-abstain-border)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: 'var(--risk-abstain)',
              borderRadius: '3px 0 0 3px',
            }} />
            <div className="hatch" style={{ flex: 1, opacity: .4 }} />
          </div>
          <p style={{ fontSize: 10, color: 'var(--risk-abstain)', marginTop: 5, fontWeight: 500 }}>
            Fill optional fields above to enable this prediction.
          </p>
        </div>
      </div>
    </article>
  )
}

/* Semi-circular clinical gauge ──────────────────────────────────────────── */
function RiskGauge({ probability, band }) {
  const b    = BAND[band] || BAND.Low
  const pct  = Math.min(probability, 1)
  const r    = 48
  const circ = 2 * Math.PI * r
  const arc  = circ * 0.65        // 65% of full circle (234°)
  const offset = arc - pct * arc

  return (
    <div style={{ position: 'relative', width: 116, height: 90, flexShrink: 0 }}>
      <svg width="116" height="90" viewBox="0 0 116 90"
        style={{ transform: 'rotate(153deg)', transformOrigin: '50% 55%' }}>
        {/* Track */}
        <circle cx="58" cy="55" r={r} fill="none"
          stroke={b.border} strokeWidth="9"
          strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
        {/* Fill */}
        <circle cx="58" cy="55" r={r} fill="none"
          stroke={b.color} strokeWidth="9"
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      {/* Center label */}
      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 800, color: b.color, lineHeight: 1 }}>
          {(probability * 100).toFixed(1)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>%</span>
      </div>
    </div>
  )
}

/* Reference range bar (like a lab report) ───────────────────────────────── */
function ReferenceRangeBar({ probability }) {
  const pct = probability * 100
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 8, display: 'flex', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
        {BAND_THRESHOLDS.map((b, i) => {
          const prev = i === 0 ? 0 : BAND_THRESHOLDS[i - 1].max
          const w    = (b.max - prev) * 100
          return (
            <div key={b.name} style={{ width: `${w}%`, background: b.color, opacity: .18 }} />
          )
        })}
        {/* Patient marker */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${pct}%`,
          width: 2.5,
          background: 'var(--text-primary)',
          borderRadius: 1,
          transition: 'left .7s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        {BAND_THRESHOLDS.map(b => (
          <span key={b.name} style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: b.color, opacity: .7 }}>
            {b.name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* Certainty / completeness strip ────────────────────────────────────────── */
function CertaintyStrip({ completeness, supplied, total }) {
  const pct = Math.round(completeness * 100)
  const imp = 100 - pct
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
          Input certainty
        </span>
        <span className="num" style={{ color: pct < 50 ? 'var(--risk-mod)' : 'var(--teal)', fontWeight: 700 }}>
          {supplied}/{total} measured
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: pct > 60 ? 'var(--teal)' : 'var(--risk-mod)',
          borderRadius: '3px 0 0 3px',
          transition: 'width .7s ease',
        }} />
        {imp > 0 && (
          <div className="hatch" style={{ flex: 1, opacity: .5 }} />
        )}
      </div>
      {pct < 50 && (
        <p style={{ fontSize: 10, color: 'var(--risk-mod)', marginTop: 4 }}>
          Most inputs were imputed — fill optional fields for a firmer estimate.
        </p>
      )}
    </div>
  )
}

function RiskCard({ r, index }) {
  const b     = BAND[r.band] || BAND.Low
  const corePct = r.core_only_probability != null ? (r.core_only_probability * 100).toFixed(1) : null
  const delta   = corePct != null ? (r.probability * 100 - Number(corePct)).toFixed(1) : null

  return (
    <article className="animate-fade-up"
      style={{
        background: 'var(--bg-surface)',
        border: `1.5px solid ${b.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(15,28,46,.06), 0 4px 14px rgba(15,28,46,.05)',
        animationDelay: `${index * 0.07}s`,
      }}>
      {/* Colored top strip */}
      <div style={{ height: 4, background: b.color }} />

      <div style={{ padding: 18 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>{r.display_name}</div>
            <span className={`badge ${b.cls}`}>{r.band}</span>
          </div>
          <RiskGauge probability={r.probability} band={r.band} />
        </div>

        <ReferenceRangeBar probability={r.probability} />
        <CertaintyStrip completeness={r.completeness} supplied={r.fields_supplied} total={r.fields_total} />

        {/* Core-only delta */}
        {corePct != null && (
          <div style={{
            marginTop: 10, padding: '7px 10px',
            background: 'var(--bg-sunken)', borderRadius: 6,
            fontSize: 11, color: 'var(--text-muted)',
          }}>
            Core-only estimate: <span className="num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{corePct}%</span>
            {delta !== null && (
              <span style={{ marginLeft: 6, color: Number(delta) > 0 ? 'var(--teal)' : 'var(--risk-mod)' }}>
                ({Number(delta) > 0 ? '+' : ''}{delta} pts from optional fields)
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

/* Smart card dispatcher — abstain or show result ────────────────────────── */
function SmartRiskCard({ r, index }) {
  if (r.completeness <= ABSTAIN_THRESHOLD) {
    return <AbstentionCard r={r} index={index} />
  }
  return <RiskCard r={r} index={index} />
}

export default function RiskPanel({ risks, triage, warnings }) {
  const order     = ['heart', 'diabetes', 'kidney', 'stroke']
  const tierBand  = BAND[triage.tier] || BAND.Low

  // Count abstained diseases for triage header notice
  const abstained = order.filter(d => risks[d] && risks[d].completeness <= ABSTAIN_THRESHOLD)
  const hasAbstained = abstained.length > 0

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Triage summary card */}
      <div className="card animate-fade-up"
        style={{ padding: 24, borderLeft: `4px solid ${tierBand.color}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
          {/* Tier */}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Triage Tier</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                fontSize: 36, fontWeight: 900, color: tierBand.color,
                letterSpacing: '-.02em', lineHeight: 1,
              }}>
                {triage.tier}
              </span>
              <span className={`badge ${tierBand.cls}`} style={{ fontSize: 11 }}>
                {triage.diseases_elevated} of 4 elevated
              </span>
            </div>
          </div>

          <div style={{ width: 1, height: 48, background: 'var(--border)', alignSelf: 'center' }} />

          {/* Driver */}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Driven By</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{triage.driven_by}</div>
          </div>

          <div style={{ width: 1, height: 48, background: 'var(--border)', alignSelf: 'center' }} />

          {/* Basis text */}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 440, flex: 1 }}>
            {triage.basis}
          </p>
        </div>

        {/* Abstention notice in triage header */}
        {hasAbstained && (
          <div style={{
            marginTop: 16,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'var(--risk-abstain-bg)',
            border: '1px solid var(--risk-abstain-border)',
            borderLeft: '3px solid var(--risk-abstain)',
            borderRadius: 6, padding: '10px 14px',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
              <circle cx="7" cy="7" r="6" stroke="var(--risk-abstain)" strokeWidth="1.5"/>
              <path d="M7 4v4" stroke="var(--risk-abstain)" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="10.5" r=".75" fill="var(--risk-abstain)"/>
            </svg>
            <p style={{ fontSize: 11, color: 'var(--risk-abstain)', lineHeight: 1.6 }}>
              <strong>{abstained.length} disease{abstained.length > 1 ? 's' : ''} abstained</strong> ({abstained.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}) due to
              insufficient input data. Triage tier reflects only diseases with enough data to predict reliably.
            </p>
          </div>
        )}
      </div>

      {/* Scope warnings */}
      {warnings?.length > 0 && warnings.map((w, i) => (
        <div key={i} className="animate-fade-up"
          style={{
            display: 'flex', gap: 14, alignItems: 'flex-start',
            background: 'var(--amber-bg, #fffbeb)',
            border: '1.5px solid var(--amber-border, #fcd34d)',
            borderLeft: '4px solid var(--amber, #b45309)',
            borderRadius: 8, padding: 16,
            animationDelay: `${i * .06}s`,
          }}>
          <span className="hatch" style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1, display: 'inline-block' }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--amber, #b45309)', marginBottom: 4 }}>
              Model Scope Warning · {w.disease} · {w.severity}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-primary)' }}>{w.message}</p>
          </div>
        </div>
      ))}

      {/* Risk cards 2×2 */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {order.filter(d => risks[d]).map((d, i) => <SmartRiskCard key={d} r={risks[d]} index={i} />)}
      </div>
    </section>
  )
}
