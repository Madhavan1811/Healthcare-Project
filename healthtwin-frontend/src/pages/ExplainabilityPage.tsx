import { useState } from 'react';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';

export default function ExplainabilityPage() {
  const { assessment } = useAssessment();
  const [selectedDisease, setSelectedDisease] = useState<string>('heart');
  const [showTechDetails, setShowTechDetails] = useState(false);

  if (!assessment) return null;

  const currentRisk = (assessment.risks as Record<string, any>)[selectedDisease];
  
  // Separate positive (increasing risk) and negative (decreasing risk) factors
  const increasingFactors = currentRisk.factors.filter((f: any) => f.contribution > 0).sort((a: any, b: any) => b.contribution - a.contribution);
  const decreasingFactors = currentRisk.factors.filter((f: any) => f.contribution < 0).sort((a: any, b: any) => a.contribution - b.contribution);

  const maxContribution = Math.max(...currentRisk.factors.map((f: any) => Math.abs(f.contribution)));

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Explainable AI Insights
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Deep dive into the specific clinical and lifestyle factors contributing to your estimated medical risk.
        </p>
      </header>

      <div className="flex space-x-2 border-b border-border pb-px overflow-x-auto">
        {Object.entries(assessment.risks).map(([key, risk]) => (
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
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                Why this risk?
              </CardTitle>
              <CardDescription>Visualizing factors driving your HealthTwin analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Increasing Factors */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-risk-elevated">Factors increasing estimated risk</h4>
                <div className="space-y-3">
                  {increasingFactors.map((f: any) => (
                    <div key={f.name} className="flex justify-between items-center group">
                      <span className="w-1/3 text-sm font-medium">{f.name}</span>
                      <div className="w-1/2 bg-accent/30 rounded-full h-4 overflow-hidden relative">
                        <div 
                          className="h-full bg-risk-elevated/70 transition-all duration-1000 group-hover:bg-risk-elevated"
                          style={{ width: `${(f.contribution / maxContribution) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-xs font-mono text-muted-foreground">+{f.contribution.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decreasing Factors */}
              {decreasingFactors.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-risk-low">Factors reducing estimated risk</h4>
                  <div className="space-y-3">
                    {decreasingFactors.map((f: any) => (
                      <div key={f.name} className="flex justify-between items-center group">
                        <span className="w-1/3 text-sm font-medium">{f.name}</span>
                        <div className="w-1/2 bg-accent/30 rounded-full h-4 overflow-hidden relative flex justify-end">
                          <div 
                            className="h-full bg-risk-low/70 transition-all duration-1000 group-hover:bg-risk-low"
                            style={{ width: `${(Math.abs(f.contribution) / maxContribution) * 100}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs font-mono text-muted-foreground">{f.contribution.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="bg-accent/30 pb-4">
              <CardTitle className="text-lg">Model Confidence</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-accent" />
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="transparent" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      strokeDasharray="251.2" 
                      strokeDashoffset={251.2 - (251.2 * currentRisk.confidence) / 100}
                      className="text-primary transition-all duration-1000" 
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{currentRisk.confidence}%</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Confidence reflects how strongly the available health information supports this estimate.
              </p>
            </CardContent>
          </Card>

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
                <div className="flex justify-between"><span className="font-semibold">Model / agent</span> <span>Ensemble (LLM Agent + XAI)</span></div>
                <div className="flex justify-between"><span className="font-semibold">Baseline probability</span> <span>{currentRisk.riskPercentage}%</span></div>
                <div className="flex justify-between"><span className="font-semibold">Calibration factor</span> <span>0.94</span></div>
                <div className="flex justify-between"><span className="font-semibold">SHAP method</span> <span>TreeExplainer Appx.</span></div>
                <div className="flex justify-between"><span className="font-semibold">Data completeness</span> <span>89%</span></div>
                <div className="flex justify-between"><span className="font-semibold">Generated timestamp</span> <span>{assessment.patient.lastUpdated}</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
