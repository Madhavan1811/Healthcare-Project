import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sliders, Clock } from 'lucide-react';

export default function SimulationPage() {
  const { assessment } = useAssessment();

  if (!assessment) return null;

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Simulate Lifestyle Changes
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Explore how changes in lifestyle factors may affect your estimated health risks.
        </p>
      </header>

      <Card className="border-border max-w-2xl mx-auto">
        <CardHeader className="flex flex-row items-center gap-3 bg-accent/30 rounded-t-xl">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sliders className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Simulation Temporarily Unavailable</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/20 border border-border">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Counterfactual simulation requires a real ML backend endpoint.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The simulation feature will call <code className="bg-accent/40 px-1 rounded text-xs font-mono">/api/simulate</code> with your
                modified patient profile and re-run the actual trained ML models to compute
                new probabilities. This is not yet available in the current backend.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Showing heuristic arithmetic as if it were real ML output would be misleading.
                This page will be enabled once the backend counterfactual endpoint is implemented.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-border">
            <h4 className="text-sm font-semibold mb-2">Planned Simulation Architecture</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>User adjusts lifestyle variables (weight, exercise, smoking, etc.)</li>
              <li>Modified profile is sent to <code className="bg-accent/40 px-1 rounded text-xs font-mono">POST /api/simulate</code></li>
              <li>Backend runs the actual heart, kidney and stroke ML models</li>
              <li>New probabilities are returned alongside the baseline</li>
              <li>Difference is displayed as a genuine model-derived change</li>
            </ol>
          </div>

          <p className="text-xs text-muted-foreground/70 italic text-center">
            Your current baseline results are still available on the Disease Risk Assessment and
            Explainability pages.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
