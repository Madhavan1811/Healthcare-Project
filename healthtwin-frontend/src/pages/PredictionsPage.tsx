import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, Info, AlertTriangle, TrendingUp, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PredictionsPage() {
  const { assessment } = useAssessment();
  const navigate = useNavigate();

  if (!assessment) return null;

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Disease Risk Assessment
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Understand your estimated risk across the conditions evaluated by HealthTwin based on your profile and laboratory data.
        </p>
      </header>

      <div className="space-y-6">
        {Object.entries(assessment.risks).map(([key, risk]) => {
          let colorClass = "bg-primary";
          if (risk.riskLevel === 'low') colorClass = "bg-risk-low";
          else if (risk.riskLevel === 'moderate') colorClass = "bg-risk-moderate";
          else if (risk.riskLevel === 'elevated') colorClass = "bg-risk-elevated";
          else if (risk.riskLevel === 'high') colorClass = "bg-risk-high";

          return (
            <Card key={key} className="overflow-hidden border-border transition-all hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="md:grid md:grid-cols-3">
                
                {/* Visual Overview */}
                <div className="p-6 md:border-r border-border bg-card">
                  <h3 className="text-xl font-bold mb-4">{risk.disease}</h3>
                  <div className="flex items-end space-x-2 mb-2">
                    <span className="text-5xl font-black">{risk.riskPercentage}%</span>
                    <Badge severity={risk.riskLevel} className="mb-2 capitalize px-3 py-1 text-sm">{risk.riskLevel}</Badge>
                  </div>
                  <Progress value={risk.riskPercentage} indicatorColor={colorClass} className="mb-6 h-3" />
                  
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <span className="text-muted-foreground w-24">Trend:</span>
                      <span className="font-medium flex items-center">
                        {risk.trend === 'increasing' ? (
                          <><TrendingUp className="h-4 w-4 mr-1 text-risk-elevated" /> Increasing</>
                        ) : (
                          <><Minus className="h-4 w-4 mr-1 text-muted-foreground" /> Stable</>
                        )}
                      </span>
                    </div>

                  </div>
                </div>

                {/* Analytical details */}
                <div className="p-6 md:col-span-2 flex flex-col bg-accent/10">
                  <div className="flex-1 space-y-6">
                    <div>
                      <h4 className="font-semibold text-lg mb-2 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-2 text-muted-foreground" />
                        Main contributors
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {risk.factors.slice(0, 4).map(f => (
                          <div key={f.name} className="px-3 py-1.5 bg-background border border-border rounded-md text-sm font-medium">
                            {f.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-lg mb-2">Model Context</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {risk.riskContext || risk.shortExplanation || 'The estimate reflects the combination of factors the model identified in your profile.'}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-2 italic">
                        This summary is based only on verified model factors and does not constitute a medical diagnosis.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-border flex flex-wrap gap-4 items-center justify-between">
                    <Button variant="outline" onClick={() => navigate('/explainability')}>
                      <Info className="h-4 w-4 mr-2" /> Why am I seeing this?
                    </Button>
                    <Button className="bg-primary hover:bg-primary/95 text-white shadow-sm" onClick={() => navigate('/simulation')}>
                      Simulate lifestyle changes <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
