import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Clock } from 'lucide-react';

export default function TrajectoryPage() {
  const { assessment } = useAssessment();

  if (!assessment) return null;

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Risk Trajectory
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          See how your estimated risk profile may change over time.
        </p>
      </header>

      <Card className="border-border max-w-2xl mx-auto">
        <CardHeader className="flex flex-row items-center gap-3 bg-accent/30 rounded-t-xl">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Trajectory Forecasting Temporarily Disabled</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/20 border border-border">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Longitudinal forecasting requires a separate time-series model.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The current HealthTwin ML models are <strong>point-in-time cross-sectional</strong> models.
                They produce a single estimate based on your current profile snapshot. They do not
                forecast how risk will change over months or years.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Displaying fabricated 3-month, 6-month or 12-month projections would misrepresent
                the underlying models. This feature will be enabled once a longitudinal trajectory
                model is trained and validated.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-border">
            <h4 className="text-sm font-semibold mb-2">What the current assessment does provide</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Point-in-time risk estimates for heart disease, kidney disease and stroke</li>
              <li>SHAP factor explanations showing what the model weighted</li>
              <li>AI-generated care recommendations tied to your profile</li>
              <li>Lab report analysis (when a PDF is uploaded)</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground/70 italic text-center">
            Your current assessment results remain available on the Dashboard and Disease Risk
            Assessment pages.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
