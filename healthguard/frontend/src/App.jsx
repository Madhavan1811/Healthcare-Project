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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: busy ? 'var(--risk-mod)' : 'var(--risk-low)',
        display: 'inline-block',
        animation: 'pulse-dot 1.4s ease-in-out infinite',
        boxShadow: busy
          ? '0 0 0 2px rgba(217,119,6,.2)'
          : '0 0 0 2px rgba(5,150,105,.2)',
      }} />
      <span style={{ color: busy ? 'var(--risk-mod)' : 'var(--risk-low)', fontWeight: 600 }}>
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
        background: 'var(--bg-surface)',
        borderBottom: '1.5px solid var(--border)',
        boxShadow: '0 1px 6px rgba(15,28,46,.06)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', gap: 20 }}>

          {/* Logo + wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'var(--teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {/* Medical cross-ish SVG */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="7" y="2" width="4" height="14" rx="2" fill="white"/>
                <rect x="2" y="7" width="14" height="4" rx="2" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.02em', lineHeight: 1 }}>
                HealthGuard <span style={{ color: 'var(--teal)' }}>AI</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Clinical Decision Support
              </div>
            </div>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, height: 32, background: 'var(--border)', flexShrink: 0 }} />

          {/* View tabs */}
          <nav style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'patient',   label: 'Patient Assessment' },
              { id: 'clinician', label: 'Clinician Report' },
            ].map(v => (
              <button key={v.id}
                className={`btn-tab ${view === v.id ? 'active' : ''}`}
                onClick={() => setView(v.id)}
                style={{ padding: '5px 14px' }}>
                {v.label}
              </button>
            ))}
          </nav>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Download Report button — only when assessment exists */}
          {result && (
            <button
              id="btn-download-report"
              className="btn btn-primary no-print"
              onClick={() => window.print()}
              style={{ padding: '7px 14px', fontSize: 11 }}
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

      {/* ── Stand-in data notice ── */}
      {prov?.is_standin && (
        <div id="standin-banner" style={{
          background: 'var(--amber-bg, #fffbeb)',
          borderBottom: '1.5px solid var(--amber-border, #fcd34d)',
        }}>
          <div style={{ maxWidth: 1300, margin: '0 auto', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
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
        <div id="error-banner" style={{ background: 'var(--risk-high-bg)', borderBottom: '1.5px solid var(--risk-high-border)', padding: '8px 24px', color: 'var(--risk-high)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── Main layout ── */}
      <main id="app-main" style={{ maxWidth: 1300, margin: '0 auto', padding: '24px', display: 'grid', gap: 24,
        gridTemplateColumns: view === 'clinician' ? '1fr' : '300px 1fr' }}>

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
                <div className="card animate-fade-in" style={{ padding: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 420, textAlign: 'center' }}>
                  {/* Large medical icon */}
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'var(--teal-light)',
                    border: '2px solid var(--teal-mid)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 24,
                  }}>
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <path d="M18 6 C11.4 6 6 11.4 6 18 C6 24.6 11.4 30 18 30 C24.6 30 30 24.6 30 18" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round"/>
                      <path d="M18 12v6l4 3" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round"/>
                      <circle cx="25" cy="9" r="3" fill="var(--teal)" opacity=".5"/>
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                    No Assessment Started
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 380 }}>
                    Enter patient data in the form, or load one of the demo patients,
                    then click <strong style={{ color: 'var(--teal)' }}>Run Assessment</strong>.
                    The certainty strip on each result card shows how much
                    of the prediction rests on imputed values.
                  </p>
                </div>
              ) : (
                <div className="animate-fade-in">
                  {/* Step tabs + live indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <nav style={{ display: 'flex', gap: 6 }}>
                      {STEPS.map(s => (
                        <button key={s.id}
                          className={`btn-tab ${step === s.id ? 'active' : ''}`}
                          onClick={() => setStep(s.id)}>
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
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '14px 24px', marginTop: 20 }}>
        <p style={{ maxWidth: 1300, margin: '0 auto', fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          HealthGuard AI is a decision support tool only — not a diagnosis, prescription, or substitute for assessment by a qualified clinician.
          Risk estimates are produced by statistical models trained on public research datasets that may not represent your population.
        </p>
      </footer>

      {/* Hidden print-only report — revealed by @media print */}
      <PrintReport result={result} />
    </div>
  )
}
