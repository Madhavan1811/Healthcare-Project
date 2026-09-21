import { useState } from 'react'
import { CORE, EXTENSIONS, MUTABLE, DEMO_PATIENTS, pretty } from '../lib/fields'

/* ─── Demo patient icon map ──────────────────────────────────────────────── */
const DEMO_ICONS = { '👩': 1, '👴': 1, '🧑': 1, '🙍': 1 }
const DEMO_COLORS = ['#1565c0', '#0d47a1', '#1976d2', '#1a8a5a']

function Field({ f, value, onChange }) {
  const id = `f-${f.name}`
  const filled = value != null && value !== ''
  return (
    <label htmlFor={id} style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: filled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {f.label}
        </span>
        {f.unit && <span className="num" style={{ fontSize: 10, color: 'var(--text-faint)', background: 'var(--bg-sunken)', padding: '1px 6px', borderRadius: 4 }}>{f.unit}</span>}
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

function AccordionSection({ title, count, total, open, onToggle, children }) {
  const pct = total > 0 ? count / total : 0
  const color = pct === 0 ? 'var(--text-faint)' : pct > .6 ? 'var(--blue)' : 'var(--risk-mod)'
  return (
    <div style={{
      background: 'white',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 6,
      overflow: 'hidden',
      transition: 'box-shadow .15s',
      ...(open ? { boxShadow: '0 2px 8px rgba(21,101,192,.08)', borderColor: 'var(--blue-mid)' } : {}),
    }}>
      <button type="button" onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          background: open ? 'var(--blue-light)' : 'none', border: 'none',
          transition: 'background .15s',
        }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'white',
          background: color, padding: '2px 8px', borderRadius: 10,
          minWidth: 36, textAlign: 'center',
        }}>{count}/{total}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform .2s', color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="animate-fade-in" style={{ padding: '14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, background: 'var(--blue-light)', borderRadius: 6, padding: '2px 9px' }}>
          <span className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)' }}>{value ?? '—'}</span>
          <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 500 }}>{m.unit}</span>
        </span>
      </div>
      <input type="range" min={m.min} max={m.max} step={m.step}
        value={value ?? (m.min + m.max) / 2}
        onChange={e => onChange(m.name, Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--blue) ${pct}%, var(--border) ${pct}%)`,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-faint)', marginTop: 2 }}>
        <span>{m.min}</span><span>{m.max}</span>
      </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Demo patients */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 3, height: 16, background: 'var(--blue)', borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Demo Patients
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(DEMO_PATIENTS).map(([name, p], idx) => (
            <button key={name} type="button" onClick={() => setPatient(p)}
              style={{
                textAlign: 'left', padding: '9px 14px', borderRadius: 8,
                border: '1.5px solid var(--border)',
                background: 'var(--bg-raised)',
                color: 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.background = 'var(--blue-light)'; e.currentTarget.style.color = 'var(--blue)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${DEMO_COLORS[idx % DEMO_COLORS.length]}18`,
                border: `1.5px solid ${DEMO_COLORS[idx % DEMO_COLORS.length]}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>👤</div>
              {name}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', opacity: .4 }}>
                <path d="M4 2l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Core fields */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <div style={{ width: 3, height: 16, background: 'var(--blue)', borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)', flex: 1 }}>
            Core Fields
          </span>
          <span style={{ fontSize: 10, background: 'var(--blue)', color: 'white', padding: '2px 9px', borderRadius: 10, fontWeight: 700 }}>
            Required
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CORE.map(f => <Field key={f.name} f={f} value={patient[f.name]} onChange={set} />)}
        </div>
      </div>

      {/* Optional completeness progress */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Optional Fields
          </span>
          <span className="num" style={{ fontSize: 11, fontWeight: 700, color: optPct > 60 ? 'var(--blue)' : 'var(--text-muted)', background: 'var(--bg-sunken)', padding: '2px 8px', borderRadius: 6 }}>
            {optFilled}/{optTotal}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 4, marginBottom: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{
            height: '100%',
            width: `${optPct}%`,
            background: optPct > 60
              ? 'linear-gradient(90deg, var(--blue), #4a9eff)'
              : 'linear-gradient(90deg, var(--risk-mod), #f59e0b)',
            borderRadius: 4,
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
        className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14, borderRadius: 10 }}>
        {busy ? (
          <>
            <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
            Assessing…
          </>
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke="white" strokeWidth="1.5"/>
              <path d="M7.5 4.5v3.5l2.5 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Run Assessment
          </>
        )}
      </button>
      {!coreReady && (
        <p style={{ fontSize: 11, color: 'var(--risk-mod)', textAlign: 'center', marginTop: -6, fontWeight: 600 }}>
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
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.65 }}>
            Drag to see all four risk scores update live.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {MUTABLE.map(m => <SliderField key={m.name} m={m} value={patient[m.name]} onChange={set} />)}
          </div>
          <div style={{ marginTop: 14, padding: '9px 12px', background: 'var(--bg-sunken)', borderRadius: 8, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
            Age and sex excluded — a target you cannot act on is not a recommendation.
          </div>
        </div>
      )}
    </div>
  )
}
