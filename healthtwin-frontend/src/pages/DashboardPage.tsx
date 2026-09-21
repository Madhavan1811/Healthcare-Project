import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowRight, AlertCircle, HeartPulse, Dna, ArrowUpRight, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { assessment } = useAssessment();
  const navigate = useNavigate();

  if (!assessment) return null;

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Good morning, {assessment.patient.name}
        </h1>
        <p className="text-muted-foreground text-lg">
          Here's an overview of your current Health Twin.
          <span className="ml-2 text-sm">Last updated: {assessment.patient.lastUpdated}</span>
        </p>
      </header>

      {/* Hero Card */}
      <Card className="border-border shadow-md bg-gradient-to-br from-card to-accent/20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <h2 className="text-2xl font-bold">Your Health Snapshot</h2>
            <div className="flex items-center space-x-3">
              <Badge severity={assessment.overallRisk} className="text-sm px-3 py-1 capitalize">
                {assessment.overallRisk} overall risk
              </Badge>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {assessment.overallRiskSummary}
            </p>
            <Button className="mt-2 text-primary" variant="link" onClick={() => navigate('/predictions')}>
              View detailed disease predictions <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-shrink-0 relative w-40 h-40 flex items-center justify-center">
            {/* Abstract Health Twin Visualization */}
            <div className="absolute inset-0 bg-primary/10 rounded-full animate-pulse opacity-50"></div>
            <div className="absolute inset-4 bg-primary/20 rounded-full animate-pulse opacity-50 delay-75"></div>
            <div className="absolute inset-8 bg-primary/30 rounded-full animate-pulse opacity-50 delay-150"></div>
            <div className="z-10 bg-card rounded-full p-4 shadow-sm">
              <Dna className="h-10 w-10 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Disease Risk Factors</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {Object.entries(assessment.risks).map(([key, risk], idx) => {
            
            let colorClass = "bg-primary";
            if (risk.riskLevel === 'low') colorClass = "bg-risk-low";
            else if (risk.riskLevel === 'moderate') colorClass = "bg-risk-moderate";
            else if (risk.riskLevel === 'elevated') colorClass = "bg-risk-elevated";
            else if (risk.riskLevel === 'high') colorClass = "bg-risk-high";

            return (
              <Card 
                key={key} 
                className={`flex flex-col hover:shadow-md transition-shadow animate-in fade-in zoom-in duration-500`}
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{risk.disease}</CardTitle>
                    {risk.trend === 'increasing' ? (
                      <ArrowUpRight className="h-5 w-5 text-risk-elevated" />
                    ) : (
                      <Minus className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-baseline space-x-2 pt-2">
                    <span className="text-3xl font-bold">{risk.riskPercentage}%</span>
                    <Badge severity={risk.riskLevel} className="capitalize">{risk.riskLevel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <Progress value={risk.riskPercentage} indicatorColor={colorClass} />
                  
                  <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Contributing factors:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {risk.factors.slice(0, 3).map((f) => (
                        <li key={f.name}>{f.name}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="ghost" className="w-full justify-between" onClick={() => navigate('/predictions')}>
                    View details <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
