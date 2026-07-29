import { useState } from 'react'
import { pretty } from '../lib/fields'

const DISEASE_COLOR = {
  heart:    'var(--risk-crit)',
  diabetes: 'var(--risk-mod)',
  kidney:   'var(--risk-high)',
  stroke:   '#7c3aed',
}

function SHAPBar({ c, scale, index }) {
  const w   = scale > 0 ? (Math.abs(c.shap) / scale) * 100 : 0
  const up  = c.shap > 0
  const col = up ? 'var(--risk-high)' : 'var(--risk-low)'

  return (
    <div className="animate-fade-up"
      style={{
        display: 'grid',
        gridTemplateColumns: '170px 1fr 60px',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        borderBottom: '1px solid var(--border)',
        animationDelay: `${index * 0.04}s`,
      }}>
      {/* Feature label */}
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: c.was_imputed ? 'var(--amber, #b45309)' : 'var(--text-primary)',
        }}>
          {pretty(c.feature)}
        </div>
        {c.value != null && !c.was_imputed && (
          <div className="num" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{c.value}</div>
        )}
        {c.was_imputed && (
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber, #b45309)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            imputed
          </div>
        )}
      </div>

      {/* Bar chart area */}
      <div style={{ position: 'relative', height: 22 }}>
        {/* Center line */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, background: 'var(--border-med)' }} />
        {/* Bar */}
        <div style={{
          position: 'absolute',
          top: 4, bottom: 4,
          left: up ? '50%' : `calc(50% - ${w / 2}%)`,
          width: `${w / 2}%`,
          background: c.was_imputed
            ? 'repeating-linear-gradient(-45deg, #b45309 0 1.5px, transparent 1.5px 5px)'
            : col,
          borderRadius: up ? '0 3px 3px 0' : '3px 0 0 3px',
          transition: 'width .55s cubic-bezier(.4,0,.2,1)',
          opacity: c.was_imputed ? .6 : 1,
        }} />
      </div>

      {/* Value */}
      <div className="num" style={{ fontSize: 11, fontWeight: 700, color: up ? 'var(--risk-high)' : 'var(--risk-low)', textAlign: 'right' }}>
        {c.shap > 0 ? '+' : ''}{c.shap.toFixed(3)}
      </div>
    </div>
  )
}

export default function Explanation({ explanations }) {
  const keys   = Object.keys(explanations)
  const [active, setActive] = useState(keys[0])
  const e       = explanations[active]
  if (!e) return null

  const scale      = Math.max(...e.contributions.map(c => Math.abs(c.shap)), 0.001)
  const anyImputed = e.contributions.some(c => c.was_imputed)
  const dColor     = DISEASE_COLOR[active] || 'var(--teal)'

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card animate-fade-up" style={{ padding: 24 }}>

        {/* Header row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Why This Prediction
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Top SHAP contributions for
              {' '}<span style={{ color: dColor, fontWeight: 700 }}>{pretty(active)}</span>
              {' '}risk model
            </p>
          </div>

          {/* Disease selector tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {keys.map(k => (
              <button key={k}
                className={`btn-tab ${active === k ? 'active' : ''}`}
                onClick={() => setActive(k)}
                style={{
                  fontSize: 11, padding: '5px 12px',
                  borderColor: active === k ? (DISEASE_COLOR[k] || 'var(--teal)') : undefined,
                  color: active === k ? (DISEASE_COLOR[k] || 'var(--teal)') : undefined,
                  background: active === k ? `${DISEASE_COLOR[k] || 'var(--teal)'}14` : undefined,
                }}>
                {pretty(k)}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-muted)',
          padding: '8px 12px', background: 'var(--bg-sunken)',
          borderRadius: 6, marginBottom: 16, flexWrap: 'wrap',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 3, background: 'var(--risk-high)', display: 'inline-block', borderRadius: 2 }} />
            Raises risk
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 3, background: 'var(--risk-low)', display: 'inline-block', borderRadius: 2 }} />
            Lowers risk
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="hatch" style={{ width: 16, height: 10, display: 'inline-block', borderRadius: 2 }} />
            Imputed value (uncertain)
          </span>
        </div>

        {/* SHAP bars */}
        <div>
          {e.contributions.map((c, i) => <SHAPBar key={c.feature} c={c} scale={scale} index={i} />)}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: 'var(--bg-sunken)', borderRadius: 6,
          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7,
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Model: </span>
          <span className="num">{e.model}</span>
          {' — '}{e.note}
          {anyImputed && (
            <span style={{ color: 'var(--amber, #b45309)' }}>
              {' '}Amber bars rest on imputed values — fill those fields for a firmer explanation.
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
