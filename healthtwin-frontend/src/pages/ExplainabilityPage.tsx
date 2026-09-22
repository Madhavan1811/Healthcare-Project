import { useState } from 'react';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Zap, Brain } from 'lucide-react';
import { DiseaseRisk } from '@/data/mockData';

export default function ExplainabilityPage() {
  const { assessment, assessmentMode } = useAssessment();
  const [selectedDisease, setSelectedDisease] = useState<string>('heart');
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [showInteractions, setShowInteractions] = useState(false);

  if (!assessment) return null;

  const risks = assessment.risks as Record<string, DiseaseRisk>;
  const currentRisk = risks[selectedDisease];

  if (!currentRisk) return null;

  // Separate positive (increasing risk) and negative (decreasing risk) factors
  const increasingFactors = currentRisk.factors
    .filter((f) => f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);

  const decreasingFactors = currentRisk.factors
    .filter((f) => f.contribution < 0)
    .sort((a, b) => a.contribution - b.contribution);

  const maxContribution = Math.max(
    ...currentRisk.factors.map((f) => Math.abs(f.contribution)),
    0.001, // prevent divide-by-zero for empty lists
  );

  const riskLevelColor = {
    low: 'text-risk-low',
    moderate: 'text-risk-moderate',
    elevated: 'text-risk-elevated',
    high: 'text-risk-high',
  }[currentRisk.riskLevel] ?? 'text-primary';

  const isRuleBased = assessmentMode === 'rule_based' || assessment.assessmentMode === 'rule_based';
  const interactionRules = (currentRisk as DiseaseRisk & { interactionRules?: string[] }).interactionRules ?? [];

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Explainable AI Insights
          </h1>
          {isRuleBased ? (
            <span className="flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-3 py-1">
              <Zap className="w-3 h-3" /> Rule-based estimate
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300 rounded-full px-3 py-1">
              <Brain className="w-3 h-3" /> ML estimate
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Deep dive into the specific lifestyle and health factors the model weighted for each estimated risk.
        </p>
      </header>

      {/* Disease tabs */}
      <div className="flex space-x-2 border-b border-border pb-px overflow-x-auto">
        {Object.entries(risks).map(([key, risk]) => (
          <button
            key={key}
            onClick={() => setSelectedDisease(key)}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors whitespace-nowrap ${
              selectedDisease === key
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {risk.disease}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main factor chart */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                Why this estimate?
              </CardTitle>
              <CardDescription>
                Each bar shows how strongly a factor contributed to the model's estimate in SHAP
                (log-odds) space. Larger bars have greater influence. SHAP values are not
                percentage-point changes in risk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

              {/* Increasing Factors */}
              {increasingFactors.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-risk-elevated flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" /> Factors pushing the estimate higher
                  </h4>
                  <div className="space-y-3">
                    {increasingFactors.map((f) => (
                      <div key={f.name} className="flex justify-between items-center group" title={f.explanation}>
                        <span className="w-1/3 text-sm font-medium truncate pr-2">{f.name}</span>
                        <div className="w-1/2 bg-accent/30 rounded-full h-4 overflow-hidden relative">
                          <div
                            className="h-full bg-risk-elevated/70 transition-all duration-1000 group-hover:bg-risk-elevated"
                            style={{ width: `${(f.contribution / maxContribution) * 100}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs font-mono text-muted-foreground">
                          +{f.contribution.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decreasing Factors */}
              {decreasingFactors.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-risk-low flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" /> Factors pushing the estimate lower
                  </h4>
                  <div className="space-y-3">
                    {decreasingFactors.map((f) => (
                      <div key={f.name} className="flex justify-between items-center group" title={f.explanation}>
                        <span className="w-1/3 text-sm font-medium truncate pr-2">{f.name}</span>
                        <div className="w-1/2 bg-accent/30 rounded-full h-4 overflow-hidden relative flex justify-end">
                          <div
                            className="h-full bg-risk-low/70 transition-all duration-1000 group-hover:bg-risk-low"
                            style={{ width: `${(Math.abs(f.contribution) / maxContribution) * 100}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs font-mono text-muted-foreground">
                          {f.contribution.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentRisk.factors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {isRuleBased ? 'No rules fired for this estimate.' : 'No SHAP factor data available for this estimate.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Risk summary + technical details */}
        <div className="space-y-6">
          {/* Risk summary card replacing the old fake "Model Confidence" card */}
          <Card className="border-border">
            <CardHeader className="bg-accent/30 pb-4">
              <CardTitle className="text-lg">Estimated Risk</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <span className={`text-5xl font-black ${riskLevelColor}`}>
                  {currentRisk.riskPercentage}%
                </span>
                <div className="mt-2">
                  <Badge severity={currentRisk.riskLevel} className="capitalize px-3 py-1 text-sm">
                    {currentRisk.riskLevel}
                  </Badge>
                </div>
              </div>

              {currentRisk.riskContext && (
                <p className="text-sm text-muted-foreground text-center leading-relaxed">
                  {currentRisk.riskContext}
                </p>
              )}

              <p className="text-xs text-muted-foreground/60 text-center italic">
                This is a model estimate, not a medical diagnosis. Values are corrected for
                population prevalence using a BRFSS logit prior shift.
              </p>
            </CardContent>
          </Card>

          {/* Interaction rules accordion — rule_based mode only */}
          {isRuleBased && interactionRules.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-xl">
              <button
                className="w-full px-5 py-4 flex items-center justify-between text-sm font-medium text-amber-800"
                onClick={() => setShowInteractions(!showInteractions)}
              >
                <span className="flex items-center"><Zap className="w-4 h-4 mr-2" /> Triggered Interaction Rules</span>
                {showInteractions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showInteractions && (
                <div className="px-5 pb-5 text-xs text-amber-900 space-y-1.5 border-t border-amber-200 pt-4">
                  {interactionRules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">⬡</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Technical details accordion */}
          <div className="border border-border rounded-xl">
            <button
              className="w-full px-5 py-4 flex items-center justify-between text-sm font-medium"
              onClick={() => setShowTechDetails(!showTechDetails)}
            >
              <span className="flex items-center"><Info className="w-4 h-4 mr-2" /> Technical Details</span>
              {showTechDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTechDetails && (
              <div className="px-5 pb-5 text-xs text-muted-foreground space-y-2 border-t border-border pt-4">
                <div className="flex justify-between"><span className="font-semibold">Assessment mode</span> <span className="capitalize">{isRuleBased ? 'Rule-based fallback' : 'ML model (XGBoost)'}</span></div>
                <div className="flex justify-between"><span className="font-semibold">Estimated risk</span> <span>{currentRisk.riskPercentage}%</span></div>
                <div className="flex justify-between"><span className="font-semibold">Risk level</span> <span className="capitalize">{currentRisk.riskLevel}</span></div>
                {isRuleBased ? (
                  <>
                    <div className="flex justify-between"><span className="font-semibold">Method</span> <span>Deterministic rule engine</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Factors shown</span> <span>Rules that fired (not SHAP)</span></div>
                    <p className="pt-2 text-muted-foreground/70">
                      Bar contributions reflect rule delta values (not log-odds SHAP). This is a
                      deterministic fallback — the same inputs always produce the same output.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="font-semibold">SHAP method</span> <span>TreeExplainer (raw margin)</span></div>
                    <div className="flex justify-between"><span className="font-semibold">SHAP space</span> <span>Log-odds (not probability)</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Prior correction</span> <span>BRFSS prevalence logit shift</span></div>
                    <p className="pt-2 text-muted-foreground/70">
                      SHAP values are in raw model log-odds space. They indicate which features the
                      model weighed most heavily, not percentage-point risk changes.
                    </p>
                  </>
                )}
                <div className="flex justify-between"><span className="font-semibold">Generated</span> <span>{assessment.patient.lastUpdated}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
