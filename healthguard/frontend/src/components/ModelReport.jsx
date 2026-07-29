import { useEffect, useRef, useState } from 'react'
import { getMetrics } from '../lib/api'
import { pretty } from '../lib/fields'

const f3  = v => v == null ? '—' : Number(v).toFixed(3)
const pct = v => v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`

/* Animated reliability diagram ──────────────────────────────────────────── */
function CalibrationCurve({ before, after, width = 240, height = 180 }) {
  const pad = 30
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 150); return () => clearTimeout(t) }, [])

  const pt = (x, y) => [pad + x * (width - 2 * pad), height - pad - y * (height - 2 * pad)]

  const toPath = (rel) => {
    if (!rel?.mean_predicted?.length) return ''
    return rel.mean_predicted
      .map((x, i) => {
        const [px, py] = pt(x, rel.fraction_positive[i])
        return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`
      }).join(' ')
  }

  const [x0, y0] = pt(0, 0)
  const [x1, y1] = pt(1, 1)
  const beforePath = toPath(before)
  const afterPath  = toPath(after)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: width, display: 'block' }}>
      {/* BG */}
      <rect x={pad} y={pad} width={width - 2 * pad} height={height - 2 * pad}
        fill="var(--bg-sunken)" stroke="var(--border)" strokeWidth="1" />
      {/* Grid lines */}
      {[.25, .5, .75].map(v => {
        const [px] = pt(v, 0); const [, py] = pt(0, v)
        return <g key={v}>
          <line x1={px} y1={pad} x2={px} y2={height - pad} stroke="var(--border)" strokeWidth=".5" />
          <line x1={pad} y1={py} x2={width - pad} y2={py} stroke="var(--border)" strokeWidth=".5" />
          <text x={px} y={height - 14} textAnchor="middle" fontSize="8" fill="var(--text-faint)">{(v * 100).toFixed(0)}%</text>
          <text x={pad - 4} y={py + 3} textAnchor="end" fontSize="8" fill="var(--text-faint)">{(v * 100).toFixed(0)}%</text>
        </g>
      })}
      {/* Perfect diagonal */}
      <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--border-med)" strokeDasharray="3 3" strokeWidth="1.2" />
      {/* Before */}
      <path d={beforePath} fill="none" stroke="var(--risk-high)" strokeWidth="2"
        strokeDasharray={drawn ? undefined : 500}
        strokeDashoffset={drawn ? 0 : 500}
        style={{ transition: 'stroke-dashoffset 1s ease .2s', opacity: .8 }} />
      {/* After */}
      <path d={afterPath} fill="none" stroke="var(--teal)" strokeWidth="2.2"
        strokeDasharray={drawn ? undefined : 500}
        strokeDashoffset={drawn ? 0 : 500}
        style={{ transition: 'stroke-dashoffset 1s ease .5s' }} />
      {/* Axis labels */}
      <text x={(pad + width - pad) / 2} y={height - 2} textAnchor="middle" fontSize="8.5" fill="var(--text-faint)">Predicted probability →</text>
      <text x="8" y={(pad + height - pad) / 2} textAnchor="middle" fontSize="8.5" fill="var(--text-faint)"
        transform={`rotate(-90, 8, ${(pad + height - pad) / 2})`}>Observed rate</text>
    </svg>
  )
}

function MetricPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 14px', background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

export default function ModelReport() {
  const [m, setM]     = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { getMetrics().then(setM).catch(e => setErr(e.message)) }, [])

  if (err) return <div className="card" style={{ padding: 32, color: 'var(--risk-high)' }}>{err}</div>
  if (!m)  return (
    <div className="card" style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <span style={{ width: 20, height: 20, border: '2.5px solid var(--border-med)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin .8s linear infinite', display: 'inline-block' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading model metrics…</span>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )

  const prov  = m.data_provenance || {}
  const proto = m.protocol || {}

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>




      {/* Protocol */}
      <div className="card animate-fade-up" style={{ padding: 24, animationDelay: '.04s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 3, height: 16, background: 'var(--teal)', borderRadius: 2 }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Evaluation Protocol</h2>
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {Object.entries(proto).map(([k, v]) => (
            <div key={k} style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10 }}>
              <div style={{ width: 3, background: 'var(--teal)', borderRadius: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 3 }}>{pretty(k)}</div>
                <div className="num" style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{String(v)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-disease panels */}
      {Object.entries(m.diseases || {}).map(([d, e], di) => {
        const full = e.variants?.full
        if (!full) return null
        const cal = full.calibration
        const base = full.clinical_baseline
        const th   = full.test_metrics?.thresholds
        const beforeEce = cal?.before?.reliability?.ece
        const afterEce  = cal?.after?.reliability?.ece
        const improvement = beforeEce && afterEce ? (beforeEce / afterEce).toFixed(0) : null

        return (
          <div key={d} className="card animate-fade-up" style={{ overflow: 'hidden', animationDelay: `${.1 + di * .07}s` }}>
            {/* Teal header stripe */}
            <div style={{ background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%)', padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.65)', marginBottom: 2 }}>
                  {e.source}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: '-.01em' }}>{e.display_name}</h3>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', letterSpacing: '.10em', textTransform: 'uppercase', marginBottom: 2 }}>Rows</div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{e.n_rows}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', letterSpacing: '.10em', textTransform: 'uppercase', marginBottom: 2 }}>Positive rate</div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>{pct(e.positive_rate)}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,.25)', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.8)', letterSpacing: '.10em', textTransform: 'uppercase', marginBottom: 2 }}>Selected</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{full.selected_model?.replace(/_/g, ' ')}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Model comparison table */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Candidate Comparison — 5×5 Repeated Stratified CV
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="clin-table">
                    <thead>
                      <tr>
                        {['Candidate', 'CV ROC-AUC', 'CV PR-AUC', 'CV Recall', 'CV F1', 'Fit (s)'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(full.model_comparison).map(([name, c]) => {
                        const sel = name === full.selected_model
                        return (
                          <tr key={name} style={{ background: sel ? 'var(--teal-light)' : undefined }}>
                            <td style={{ fontWeight: sel ? 700 : 400, color: sel ? 'var(--teal-deep)' : 'var(--text-secondary)' }}>
                              {pretty(name)}
                              {sel && (
                                <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'var(--teal)', color: 'white', padding: '2px 6px', borderRadius: 10 }}>
                                  selected
                                </span>
                              )}
                            </td>
                            <td className="num" style={{ color: sel ? 'var(--text-primary)' : undefined, fontWeight: sel ? 700 : 400 }}>
                              {f3(c.roc_auc.mean)}<span style={{ color: 'var(--text-faint)', fontSize: 10 }}> ±{f3(c.roc_auc.std)}</span>
                            </td>
                            <td className="num" style={{ color: sel ? 'var(--text-primary)' : undefined, fontWeight: sel ? 700 : 400 }}>
                              {f3(c.pr_auc.mean)}<span style={{ color: 'var(--text-faint)', fontSize: 10 }}> ±{f3(c.pr_auc.std)}</span>
                            </td>
                            <td className="num">{f3(c.recall.mean)}</td>
                            <td className="num">{f3(c.f1.mean)}</td>
                            <td className="num" style={{ color: 'var(--text-faint)' }}>{c.cv_seconds}</td>
                          </tr>
                        )
                      })}
                      {/* Clinical baseline row */}
                      {base && (
                        <tr style={{ background: 'var(--risk-mod-bg)' }}>
                          <td style={{ color: 'var(--risk-mod)', fontWeight: 600, fontSize: 12 }}>
                            {base.name}
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              Clinical baseline · {pct(base.item_report?.completeness)} of inputs available
                            </div>
                          </td>
                          <td className="num" style={{ color: 'var(--risk-mod)', fontWeight: 700 }}>{f3(base.roc_auc)}</td>
                          <td className="num" style={{ color: 'var(--risk-mod)', fontWeight: 700 }}>{f3(base.pr_auc)}</td>
                          <td colSpan={3} style={{ color: 'var(--text-faint)' }}>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {base?.caveat && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.65 }}>{base.caveat}</p>
                )}
              </div>

              {/* Calibration */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16 }}>
                  Calibration — Reliability Diagram
                </div>
                <div style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <CalibrationCurve before={cal.before?.reliability} after={cal.after?.reliability} />
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 14, height: 2, background: 'var(--risk-high)', display: 'inline-block' }} /> Raw
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 14, height: 2, background: 'var(--teal)', display: 'inline-block' }} /> Calibrated
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 14, height: 2, background: 'var(--border-med)', borderTop: '1px dashed', display: 'inline-block' }} /> Perfect
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <MetricPill label="ECE Before" value={f3(beforeEce)} color="var(--risk-high)" />
                      <MetricPill label="ECE After"  value={f3(afterEce)}  color="var(--risk-low)" />
                    </div>
                    {improvement && (
                      <div style={{ background: 'var(--teal-light)', border: '1.5px solid var(--teal-mid)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 4 }}>Improvement</div>
                        <div className="num" style={{ fontSize: 26, fontWeight: 900, color: 'var(--teal)' }}>{improvement}×</div>
                      </div>
                    )}
                    <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Method: </strong>
                      <span className="num" style={{ color: 'var(--teal)' }}>{cal.method_chosen}</span>
                      {' '} · Test ROC-AUC{' '}
                      <span className="num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{f3(full.test_metrics?.roc_auc)}</span>
                      {' · '} Brier{' '}
                      <span className="num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{f3(full.test_metrics?.brier)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating points */}
              {th && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Operating Points
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                    <MetricPill label="Recall @ 0.5" value={f3(th['default_0.5']?.recall)} />
                    <MetricPill label={`Max-F1 @ ${f3(th.max_f1?.threshold)}`}
                      value={`${f3(th.max_f1?.recall)} recall`} color="var(--teal)" />
                    {th.recall_at_least_90pct && (
                      <MetricPill label="≥90% Recall threshold"
                        value={f3(th.recall_at_least_90pct?.threshold)} />
                    )}
                  </div>
                </div>
              )}

              {/* Core-only cost */}
              {e.core_only_auc_cost != null && (
                <div style={{ padding: '10px 14px', background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  Core-only feature set costs{' '}
                  <span className="num" style={{ color: 'var(--risk-mod)', fontWeight: 800 }}>{e.core_only_auc_cost.toFixed(3)}</span>
                  {' '}ROC-AUC vs full feature set
                  {' '}({full.n_features} → {e.variants?.core?.n_features} features)
                </div>
              )}
            </div>
          </div>
        )
      })}
    </section>
  )
}
