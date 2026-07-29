/* PrintReport.jsx
 * Hidden on screen (display:none), shown only during window.print().
 * The @media print block in index.css hides #app-main and reveals #print-report.
 */

const BAND_COLOR = {
  Low:      '#059669',
  Moderate: '#d97706',
  High:     '#dc2626',
  Critical: '#7c0a0a',
}

function PrintRiskCard({ disease, r }) {
  const isAbstained = r.completeness <= 0.40
  const pct         = Math.round(r.completeness * 100)
  const bandColor   = isAbstained ? '#64748b' : (BAND_COLOR[r.band] || '#059669')

  return (
    <div className="print-card" style={{ borderTop: `4px solid ${bandColor}` }}>
      {/* Disease name + band */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f1c2e' }}>{r.display_name}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
          color: bandColor, background: '#f8fafc',
          border: `1.5px solid ${bandColor}`,
          padding: '2px 10px', borderRadius: 20,
        }}>
          {isAbstained ? 'Insufficient Data' : r.band}
        </span>
      </div>

      {isAbstained ? (
        /* Abstained */
        <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '8px 12px' }}>
          <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
            <strong>Prediction withheld.</strong> Only {pct}% of inputs were measured.
            Too many values were imputed to give a reliable estimate.
            Please refer to a clinician for assessment.
          </p>
        </div>
      ) : (
        /* Normal risk */
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: bandColor, fontFamily: 'monospace' }}>
              {(r.probability * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: 11, color: '#6b7f94' }}>predicted risk</span>
          </div>

          {/* Certainty bar (print-safe, no gradients) */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7f94', marginBottom: 3 }}>
              <span>Input certainty</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.fields_supplied}/{r.fields_total} measured</span>
            </div>
            <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: pct > 60 ? '#0a7c7c' : '#d97706',
                borderRadius: 3,
              }} />
            </div>
          </div>

          {/* Core-only comparison */}
          {r.core_only_probability != null && (
            <p style={{ fontSize: 10, color: '#6b7f94' }}>
              Core-only estimate:{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f1c2e' }}>
                {(r.core_only_probability * 100).toFixed(1)}%
              </span>
            </p>
          )}
        </>
      )}
    </div>
  )
}

function PrintShapFactors({ disease, explanations }) {
  const exp = explanations?.[disease]
  if (!exp?.attributions?.length) return null

  // Top 3 by absolute value
  const top3 = [...exp.attributions]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3)

  return (
    <div style={{ marginTop: 6 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7f94', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
        Top contributing factors
      </p>
      {top3.map((attr, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
          <span style={{ color: '#3d5166' }}>{attr.feature}</span>
          <span style={{
            fontFamily: 'monospace', fontWeight: 700,
            color: attr.value > 0 ? '#dc2626' : '#059669',
          }}>
            {attr.value > 0 ? '+' : ''}{attr.value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function PrintReport({ result }) {
  if (!result) return null

  const now    = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
  const order  = ['heart', 'diabetes', 'kidney', 'stroke']
  const { risks, triage, plan, explanations } = result

  const actions   = plan?.layer_2_actions  || []
  const referrals = plan?.layer_3_referral || []

  return (
    <div id="print-report" style={{ display: 'none', padding: '0', fontFamily: 'Inter, sans-serif', color: '#0f1c2e' }}>

      {/* ── Report header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0a7c7c', paddingBottom: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0a7c7c', letterSpacing: '-.02em' }}>
            HealthGuard <span style={{ color: '#0f1c2e' }}>AI</span>
          </div>
          <div style={{ fontSize: 10, color: '#6b7f94', fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase' }}>
            Patient Risk Assessment Report
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#6b7f94' }}>Generated</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#3d5166' }}>{now}</div>
        </div>
      </div>

      {/* ── Triage summary ── */}
      <div className="print-section print-card" style={{ borderLeft: `4px solid ${BAND_COLOR[triage.tier] || '#059669'}` }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7f94', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 2 }}>Triage Tier</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: BAND_COLOR[triage.tier] || '#059669', letterSpacing: '-.02em' }}>
              {triage.tier}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7f94', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 2 }}>Driven By</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{triage.driven_by}</div>
            <div style={{ fontSize: 10, color: '#6b7f94', marginTop: 2, lineHeight: 1.6 }}>{triage.basis}</div>
          </div>
          <div style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            border: `1.5px solid ${BAND_COLOR[triage.tier] || '#059669'}`,
            color: BAND_COLOR[triage.tier] || '#059669',
          }}>
            {triage.diseases_elevated} of 4 elevated
          </div>
        </div>
      </div>

      {/* ── Disease risk cards ── */}
      <div className="print-section">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7f94', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 10 }}>
          Disease Risk Estimates
        </div>
        <div className="print-risk-grid">
          {order.filter(d => risks[d]).map(d => (
            <div key={d}>
              <PrintRiskCard disease={d} r={risks[d]} />
              {risks[d].completeness > 0.40 && (
                <PrintShapFactors disease={d} explanations={explanations} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Action plan (top 6 actions) ── */}
      {actions.length > 0 && (
        <div className="print-section">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7f94', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 10 }}>
            Recommended Actions
          </div>
          <div className="print-card" style={{ paddingTop: 8 }}>
            {actions.slice(0, 6).map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '8px 0',
                borderBottom: i < Math.min(actions.length, 6) - 1 ? '1px solid #dde3ec' : 'none',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#e0f5f5', border: '1.5px solid #b2e3e3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0a7c7c' }} />
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#0f1c2e', lineHeight: 1.6, marginBottom: 2 }}>{a.text}</p>
                  <span style={{ fontSize: 9, color: '#0a7c7c', fontWeight: 700 }}>
                    {a.source.organisation} — {a.source.document}
                  </span>
                </div>
              </div>
            ))}
            {actions.length > 6 && (
              <p style={{ fontSize: 10, color: '#6b7f94', marginTop: 8 }}>
                + {actions.length - 6} more actions. See full report on screen.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Referral summary ── */}
      {referrals.length > 0 && (
        <div className="print-section">
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7f94', textTransform: 'uppercase', letterSpacing: '.10em', marginBottom: 10 }}>
            Clinical Referrals
          </div>
          <div className="print-card" style={{ paddingTop: 4 }}>
            {referrals.map((r, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '7px 0',
                borderBottom: i < referrals.length - 1 ? '1px solid #dde3ec' : 'none',
              }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: BAND_COLOR[r.band] || '#6b7f94', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {r.disease}
                  </span>
                  <p style={{ fontSize: 12, color: '#0f1c2e', marginTop: 2, lineHeight: 1.5 }}>{r.action}</p>
                  <span style={{ fontSize: 9, color: '#6b7f94' }}>{r.source.organisation}</span>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                  color: BAND_COLOR[r.band] || '#6b7f94',
                  border: `1px solid ${BAND_COLOR[r.band] || '#6b7f94'}`,
                  padding: '2px 8px', borderRadius: 10, flexShrink: 0, marginLeft: 12,
                }}>
                  {r.band}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div style={{
        marginTop: 20, padding: '10px 14px',
        background: '#f8fafc', border: '1px solid #dde3ec', borderRadius: 6,
      }}>
        <p style={{ fontSize: 9, color: '#9aaab8', lineHeight: 1.7 }}>
          <strong>DECISION SUPPORT ONLY — NOT A DIAGNOSIS.</strong> HealthGuard AI is a statistical risk estimation tool
          trained on public research datasets. It is not a substitute for assessment by a qualified clinician and must not
          be used as the sole basis for any clinical decision, prescription, or diagnosis. Risk estimates may not be
          representative of the patient's population. All recommendations cite published guidelines and do not constitute
          individualised medical advice.
        </p>
      </div>
    </div>
  )
}
