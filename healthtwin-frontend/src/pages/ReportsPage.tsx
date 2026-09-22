import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileDown, Printer, FileText, CheckCircle2, Zap, Brain } from 'lucide-react';

export default function ReportsPage() {
  const { assessment, assessmentMode } = useAssessment();

  if (!assessment) return null;

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Health Reports
          </h1>
          <p className="text-muted-foreground text-lg">
            Printable summaries of your generated HealthTwin profile.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Printer className="w-4 h-4 mr-2" /> Print</Button>
          <Button><FileDown className="w-4 h-4 mr-2" /> Download PDF</Button>
        </div>
      </header>
      
      {/* Printable Area - We style it like a real medical report document */}
      <div className="bg-white border text-black border-border shadow-sm max-w-4xl rounded-sm">
        
        {/* Report Header */}
        <div className="p-8 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              HealthTwin <span className="text-blue-600 ml-2">Clinical Report</span>
              {(assessmentMode === 'rule_based' || assessment.assessmentMode === 'rule_based') ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-2 py-0.5">
                  <Zap className="w-3 h-3" /> Rule-based estimate
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 rounded-full px-2 py-0.5">
                  <Brain className="w-3 h-3" /> ML estimate
                </span>
              )}
            </h2>
            <p className="text-slate-500 mt-1">Generated: {assessment.patient.lastUpdated}</p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p className="font-semibold text-slate-700">Patient ID</p>
            <p>{assessment.patient.id}</p>
          </div>
        </div>

        <div className="p-8 space-y-10">
          
          {/* Patient Overview */}
          <section>
            <h3 className="text-lg font-semibold uppercase tracking-wider text-slate-800 mb-4 border-b pb-2">Patient Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-slate-500 text-sm">Name</p>
                <p className="font-medium text-slate-900">{assessment.patient.name}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Age</p>
                <p className="font-medium text-slate-900">{assessment.patient.age}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">Gender</p>
                <p className="font-medium text-slate-900">{assessment.patient.gender}</p>
              </div>
              <div>
                <p className="text-slate-500 text-sm">BMI Metrics</p>
                <p className="font-medium text-slate-900">{assessment.patient.height}cm / {assessment.patient.weight}kg</p>
              </div>
            </div>
          </section>

          {/* Assessment Summary */}
          <section>
            <h3 className="text-lg font-semibold uppercase tracking-wider text-slate-800 mb-4 border-b pb-2">Risk Assessment Summary</h3>
            <div className="mb-6 p-4 bg-slate-50 rounded border border-slate-100 flex items-center">
              <span className="font-semibold mr-4">Overall Score:</span>
              <span className="capitalize font-bold text-slate-800 mr-2">{assessment.overallRisk}</span> Risk Profile
            </div>
            
            <div className="space-y-4">
              {Object.entries(assessment.risks).map(([key, risk]) => (
                <div key={key} className="flex flex-col md:flex-row justify-between py-3 border-b border-slate-100 border-dashed">
                  <div className="md:w-1/3">
                    <p className="font-semibold text-slate-800">{risk.disease}</p>
                  </div>
                  <div className="md:w-1/3 font-mono flex items-center">
                    <span className="w-12">{risk.riskPercentage}%</span>
                    <span className="text-sm text-slate-500 ml-4 capitalize">({risk.riskLevel})</span>
                  </div>
                  <div className="md:w-1/3 text-sm text-slate-600">
                    <p>Primarily driven by: {risk.factors[0]?.name}, {risk.factors[1]?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          {/* Action Plan */}
          <section>
            <h3 className="text-lg font-semibold uppercase tracking-wider text-slate-800 mb-4 border-b pb-2">Top Recommended Actions</h3>
            <ul className="space-y-3">
              {assessment.carePlan.slice(0,3).map(action => (
                <li key={action.id} className="flex">
                  <CheckCircle2 className="w-5 h-5 text-slate-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">{action.title}</p>
                    <p className="text-slate-600 text-sm">{action.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50 text-slate-400 text-xs text-center rounded-b-sm">
          <p>HealthTwin AI output is generated for informational purposes. Clinical correlation required.</p>
          <p className="mt-1">
            {(assessmentMode === 'rule_based' || assessment.assessmentMode === 'rule_based')
              ? 'Generated by deterministic rule-based fallback engine. Not a trained ML model output.'
              : 'Generated by HealthTwin ML pipeline (XGBoost + SHAP + Health Agent).'}
          </p>
        </div>
      </div>
    </div>
  );
}
