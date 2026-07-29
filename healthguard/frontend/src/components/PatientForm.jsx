import { useState } from 'react'
import { CORE, EXTENSIONS, MUTABLE, DEMO_PATIENTS, pretty } from '../lib/fields'

/* ─── Risk colour lookup ─────────────────────────────────────────────────── */
const BAND_COLOR = {
  Low:      'var(--risk-low)',
  Moderate: 'var(--risk-mod)',
  High:     'var(--risk-high)',
  Critical: 'var(--risk-crit)',
}

function Field({ f, value, onChange }) {
  const id = `f-${f.name}`
  const filled = value != null && value !== ''
  return (
    <label htmlFor={id} style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: filled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {f.label}
        </span>
        {f.unit && <span className="num" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{f.unit}</span>}
      </span>
      {f.type === 'select' ? (
        <select id={id} value={value ?? ''} onChange={e => onChange(f.name, e.target.value || null)}>
          <option value="">— not provided —</option>
          {f.options.map(o => <option key={o} value={o}>{pretty(o)}</option>)}
        </select>
      ) : (
        <input id={id} type="number" inputMode="decimal"
          min={f.min} max={f.max} step={f.step}
          value={value ?? ''} placeholder="not provided"
          onChange={e => onChange(f.name, e.target.value === '' ? null : Number(e.target.value))}
        />
      )}
    </label>
  )
}

function AccordionSection({ title, icon, count, total, open, onToggle, children }) {
  const pct = total > 0 ? count / total : 0
  const color = pct === 0 ? 'var(--text-faint)' : pct > .6 ? 'var(--teal)' : 'var(--risk-mod)'
  return (
    <div className="card-flat" style={{ marginBottom: 8, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          background: 'none', border: 'none',
        }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        <span className="num" style={{ fontSize: 10, color, fontWeight: 700 }}>{count}/{total}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform .2s', color: 'var(--text-faint)' }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="animate-fade-in" style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
        </div>
      )}
    </div>
  )
}

function SliderField({ m, value, onChange }) {
  const pct = value != null ? ((value - m.min) / (m.max - m.min)) * 100 : 50
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{m.label}</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span className="num" style={{ fontSize: 15, fontWeight: 700, color: 'var(--teal)' }}>{value ?? '—'}</span>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{m.unit}</span>
        </span>
      </div>
      <input type="range" min={m.min} max={m.max} step={m.step}
        value={value ?? (m.min + m.max) / 2}
        onChange={e => onChange(m.name, Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--teal) ${pct}%, var(--border) ${pct}%)`,
        }}
      />
    </div>
  )
}

export default function PatientForm({ patient, setPatient, onSubmit, busy, live }) {
  const [open, setOpen] = useState({})
  const set    = (k, v) => setPatient(p => ({ ...p, [k]: v }))
  const filled = fields => fields.filter(f => patient[f.name] != null).length
  const coreReady = patient.age != null && patient.sex != null

  const optTotal  = Object.values(EXTENSIONS).reduce((n, e) => n + e.fields.length, 0)
  const optFilled = Object.values(EXTENSIONS).reduce((n, e) => n + filled(e.fields), 0)
  const optPct    = optTotal > 0 ? (optFilled / optTotal) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Demo patients */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
          Demo Patients
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(DEMO_PATIENTS).map(([name, p]) => (
            <button key={name} type="button" onClick={() => setPatient(p)}
              style={{
                textAlign: 'left', padding: '8px 12px', borderRadius: 6,
                border: '1.5px solid var(--border)',
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal)'; e.currentTarget.style.color = 'var(--teal)'; e.currentTarget.style.background = 'var(--teal-light)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-raised)' }}>
              <span style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 800 }}>→</span>
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Core fields */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 3, height: 16, background: 'var(--teal)', borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Core Fields
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--teal-light)', color: 'var(--teal)', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
            Required
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CORE.map(f => <Field key={f.name} f={f} value={patient[f.name]} onChange={set} />)}
        </div>
      </div>

      {/* Optional completeness progress */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Optional Fields
          </span>
          <span className="num" style={{ fontSize: 11, fontWeight: 600, color: optPct > 60 ? 'var(--teal)' : 'var(--text-muted)' }}>
            {optFilled}/{optTotal} filled
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 5, background: 'var(--bg-sunken)', borderRadius: 3, marginBottom: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${optPct}%`,
            background: optPct > 60
              ? 'linear-gradient(90deg, var(--teal), #0bbfbf)'
              : 'linear-gradient(90deg, var(--risk-mod), #f59e0b)',
            borderRadius: 3,
            transition: 'width .4s ease',
          }} />
        </div>
        {Object.entries(EXTENSIONS).map(([k, e]) => (
          <AccordionSection key={k} title={e.title} count={filled(e.fields)} total={e.fields.length}
            open={!!open[k]} onToggle={() => setOpen(o => ({ ...o, [k]: !o[k] }))}>
            {e.fields.map(f => <Field key={f.name} f={f} value={patient[f.name]} onChange={set} />)}
          </AccordionSection>
        ))}
      </div>

      {/* Assess button */}
      <button type="button" onClick={onSubmit} disabled={!coreReady || busy}
        className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 13 }}>
        {busy ? (
          <>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.5)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
            Assessing…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5"/>
              <path d="M7 4v3l2 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Run Assessment
          </>
        )}
      </button>
      {!coreReady && (
        <p style={{ fontSize: 11, color: 'var(--risk-mod)', textAlign: 'center', marginTop: -4 }}>
          Age and sex are required
        </p>
      )}

      {/* What-if sliders */}
      {live && (
        <div className="card animate-fade-in" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 3, height: 16, background: 'var(--navy)', borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              What-If Sliders
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
            Drag to see all four risk scores update live.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {MUTABLE.map(m => <SliderField key={m.name} m={m} value={patient[m.name]} onChange={set} />)}
          </div>
          <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--bg-sunken)', borderRadius: 6, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
            Age and sex excluded — a target you cannot act on is not a recommendation.
          </div>
        </div>
      )}
    </div>
  )
}
