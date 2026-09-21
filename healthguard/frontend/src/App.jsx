import { useCallback, useEffect, useRef, useState } from 'react'
import PatientForm from './components/PatientForm'
import RiskPanel from './components/RiskPanel'
import Explanation from './components/Explanation'
import ActionPlan from './components/ActionPlan'
import ModelReport from './components/ModelReport'
import PrintReport from './components/PrintReport'
import { assess } from './lib/api'

const STEPS = [
  { id: 'risk',  label: 'Risk Assessment', icon: '◈' },
  { id: 'why',   label: 'Explanations',    icon: '◉' },
  { id: 'plan',  label: 'Action Plan',     icon: '◎' },
]

function LiveIndicator({ busy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, background: busy ? 'rgba(201,124,0,.12)' : 'rgba(26,138,90,.12)', padding: '4px 12px', borderRadius: 20, border: `1px solid ${busy ? 'rgba(201,124,0,.25)' : 'rgba(26,138,90,.25)'}` }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: busy ? 'var(--risk-mod)' : 'var(--risk-low)',
        display: 'inline-block',
        animation: 'pulse-dot 1.4s ease-in-out infinite',
      }} />
      <span style={{ color: busy ? 'var(--risk-mod)' : 'var(--risk-low)', fontWeight: 700, fontSize: 11 }}>
        {busy ? 'Recomputing…' : 'Live'}
      </span>
    </div>
  )
}

export default function App() {
  const [patient, setPatient] = useState({ age: 45, sex: 'female' })
  const [result,  setResult]  = useState(null)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState(null)
  const [view,    setView]    = useState('patient')
  const [step,    setStep]    = useState('risk')
  const timer = useRef(null)

  const run = useCallback(async (p) => {
    setBusy(true); setError(null)
    try { setResult(await assess(p)) }
    catch (e) { setError(e.message) }
    finally   { setBusy(false) }
  }, [])

  useEffect(() => {
    if (!result) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => run(patient), 220)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient])

  const prov = result?.data_provenance

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>

      {/* ── Top nav bar ── */}
      <header style={{
        background: 'var(--bg-header)',
        boxShadow: '0 2px 12px rgba(13,29,54,.25)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', gap: 24 }}>

          {/* Logo + wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 4, flexShrink: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg, #4a9eff 0%, #1565c0 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(74,158,255,.30)',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="8" y="3" width="4" height="14" rx="2" fill="white"/>
                <rect x="3" y="8" width="14" height="4" rx="2" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-.02em', lineHeight: 1 }}>
                HealthGuard <span style={{ color: '#4a9eff' }}>AI</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.5)', fontWeight: 600, letterSpacing: '.10em', textTransform: 'uppercase', marginTop: 2 }}>
                Clinical Decision Support
              </div>
            </div>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,.12)', flexShrink: 0 }} />

          {/* View tabs — header style */}
          <nav style={{ display: 'flex', gap: 2 }}>
            {[
              { id: 'patient',   label: 'Patient Assessment' },
              { id: 'clinician', label: 'Clinician Report' },
            ].map(v => (
              <button key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  padding: '6px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: view === v.id ? 'rgba(255,255,255,.15)' : 'transparent',
                  color: view === v.id ? 'white' : 'rgba(255,255,255,.55)',
                  fontSize: 13, fontWeight: view === v.id ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  fontFamily: 'var(--font-sans)',
                  letterSpacing: '.01em',
                }}
                onMouseEnter={e => { if (view !== v.id) e.currentTarget.style.color = 'rgba(255,255,255,.85)' }}
                onMouseLeave={e => { if (view !== v.id) e.currentTarget.style.color = 'rgba(255,255,255,.55)' }}
              >
                {v.label}
              </button>
            ))}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Download Report button */}
          {result && (
            <button
              id="btn-download-report"
              className="no-print"
              onClick={() => window.print()}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '8px 18px',
                background: 'rgba(255,255,255,.13)',
                border: '1.5px solid rgba(255,255,255,.22)',
                borderRadius: 8,
                color: 'white',
                fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all .15s',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.22)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.13)' }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v7M4 6l2.5 2.5L9 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 10h11v1.5a.5.5 0 01-.5.5h-10a.5.5 0 01-.5-.5V10z" fill="white" opacity=".7"/>
              </svg>
              Download Report
            </button>
          )}

        </div>
      </header>

      {/* ── Sub-header strip (page title + breadcrumb) ── */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 4px rgba(13,29,54,.04)',
      }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <circle cx="7.5" cy="7.5" r="5.5" stroke="var(--blue)" strokeWidth="1.5"/>
                <path d="M7.5 5v3.5l2 1.5" stroke="var(--blue)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {view === 'patient' ? 'Patient Assessment' : 'Clinician Report'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {view === 'patient' ? 'Enter patient data and get real-time multi-disease risk predictions' : 'Detailed model performance and methodology'}
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Disease Quick Tags */}
          {view === 'patient' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { name: 'Heart',    icon: '❤️' },
                { name: 'Diabetes', icon: '🩸' },
                { name: 'Kidney',   icon: '🫘' },
                { name: 'Stroke',   icon: '🧠' },
              ].map(d => (
                <span key={d.name} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px',
                  background: 'var(--bg-sunken)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}>
                  <span style={{ fontSize: 12 }}>{d.icon}</span> {d.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stand-in data notice ── */}
      {prov?.is_standin && (
        <div id="standin-banner" style={{
          background: 'var(--amber-bg, #fffbeb)',
          borderBottom: '1.5px solid var(--amber-border, #fcd34d)',
        }}>
          <div style={{ maxWidth: 1360, margin: '0 auto', padding: '9px 28px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="hatch" style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>
              <strong>Stand-in synthetic data</strong> — the training pipeline is real; these numbers are properties of the generator.
              See Clinician Report for full caveats.
            </span>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div id="error-banner" style={{ background: 'var(--risk-high-bg)', borderBottom: '1.5px solid var(--risk-high-border)', padding: '9px 28px', color: 'var(--risk-high)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── Main layout ── */}
      <main id="app-main" style={{
        maxWidth: 1360, margin: '0 auto', padding: '28px',
        display: 'grid', gap: 24,
        gridTemplateColumns: view === 'clinician' ? '1fr' : '300px 1fr',
      }}>

        {view === 'clinician' ? (
          <ModelReport />
        ) : (
          <>
            {/* Left sidebar */}
            <aside className="animate-fade-in">
              <PatientForm
                patient={patient} setPatient={setPatient}
                onSubmit={() => run(patient)} busy={busy}
                live={!!result}
              />
            </aside>

            {/* Right panel */}
            <section>
              {!result ? (
                <div className="card animate-fade-in" style={{ padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 460, textAlign: 'center' }}>
                  {/* Decorative icon */}
                  <div style={{
                    width: 88, height: 88, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--blue-light) 0%, #dceeff 100%)',
                    border: '2px solid var(--blue-mid)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 24,
                    boxShadow: '0 4px 20px rgba(21,101,192,.12)',
                  }}>
                    <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                      <circle cx="21" cy="21" r="14" stroke="var(--blue)" strokeWidth="2" strokeOpacity=".2"/>
                      <path d="M21 8 C13.3 8 7 14.3 7 22 C7 29.7 13.3 36 21 36" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round"/>
                      <path d="M21 14v8l5 3.5" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round"/>
                      <circle cx="30" cy="11" r="4" fill="var(--blue)" opacity=".6"/>
                    </svg>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--blue-light)', border: '1px solid var(--blue-mid)', borderRadius: 20, padding: '4px 14px', marginBottom: 18, fontSize: 11, color: 'var(--blue)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    Ready to Assess
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-.02em' }}>
                    Start a Patient Assessment
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 400 }}>
                    Enter patient data in the form on the left, or load one of the demo patients,
                    then click <strong style={{ color: 'var(--blue)' }}>Run Assessment</strong>.
                    Get real-time risk scores across four conditions — Heart Disease, Diabetes, Kidney Disease, and Stroke.
                  </p>

                  {/* Disease quick-view */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 36, width: '100%', maxWidth: 440 }}>
                    {[
                      { name: 'Heart',    emoji: '❤️',  color: 'var(--risk-crit)' },
                      { name: 'Diabetes', emoji: '🩸',  color: 'var(--risk-mod)' },
                      { name: 'Kidney',   emoji: '🫘',  color: 'var(--risk-high)' },
                      { name: 'Stroke',   emoji: '🧠',  color: '#7c3aed' },
                    ].map(d => (
                      <div key={d.name} style={{
                        padding: '14px 8px',
                        background: 'var(--bg-raised)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      }}>
                        <span style={{ fontSize: 24 }}>{d.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '.02em' }}>{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  {/* Step tabs + live indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <nav style={{ display: 'flex', gap: 6, background: 'white', padding: '6px', borderRadius: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                      {STEPS.map(s => (
                        <button key={s.id}
                          className={`btn-tab ${step === s.id ? 'active' : ''}`}
                          onClick={() => setStep(s.id)}
                          style={{ padding: '6px 18px', borderRadius: 8 }}>
                          {s.label}
                        </button>
                      ))}
                    </nav>
                    <LiveIndicator busy={busy} />
                  </div>

                  {step === 'risk'  && <RiskPanel risks={result.risks} triage={result.triage} warnings={result.scope_warnings} />}
                  {step === 'why'   && <Explanation explanations={result.explanations} />}
                  {step === 'plan'  && <ActionPlan plan={result.plan} />}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'white', padding: '16px 28px', marginTop: 12 }}>
        <div style={{ maxWidth: 1360, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="4.5" y="1" width="2" height="9" rx="1" fill="white"/>
              <rect x="1" y="4.5" width="9" height="2" rx="1" fill="white"/>
            </svg>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-muted)' }}>HealthGuard AI</strong> is a decision support tool only — not a diagnosis, prescription, or substitute for assessment by a qualified clinician.
            Risk estimates are produced by statistical models trained on public research datasets that may not represent your population.
          </p>
        </div>
      </footer>

      {/* Hidden print-only report — revealed by @media print */}
      <PrintReport result={result} />
    </div>
  )
}
