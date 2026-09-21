import { useState } from 'react';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sliders, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SimulationPage() {
  const { assessment } = useAssessment();
  
  if (!assessment) return null;

  // Initial values from assessment
  const [weight, setWeight] = useState(assessment.patient.weight);
  const [exercise, setExercise] = useState(assessment.patient.exerciseDaysPerWeek);
  const [smoking, setSmoking] = useState(assessment.patient.smoking);
  
  const resetSimulation = () => {
    setWeight(assessment.patient.weight);
    setExercise(assessment.patient.exerciseDaysPerWeek);
    setSmoking(assessment.patient.smoking);
  };

  // Simple pure client-side simulation logic (Mocking LLM/ML Agent)
  const calculateSimulatedRisks = () => {
    const origHeart = assessment.risks.heart.riskPercentage;
    const origDiabetes = assessment.risks.diabetes.riskPercentage;
    const origStroke = assessment.risks.stroke.riskPercentage;

    const weightDiff = assessment.patient.weight - weight; // positive = weight loss
    const exerciseDiff = exercise - assessment.patient.exerciseDaysPerWeek; // positive = more exercise
    const quitSmoking = assessment.patient.smoking && !smoking;

    let heartSim = origHeart;
    let diabetesSim = origDiabetes;
    let strokeSim = origStroke;

    // Apply modifiers
    if (weightDiff > 0) {
      heartSim -= weightDiff * 0.5;
      diabetesSim -= weightDiff * 1.5;
    }
    
    if (exerciseDiff > 0) {
      heartSim -= exerciseDiff * 1.5;
      diabetesSim -= exerciseDiff * 1.0;
      strokeSim -= exerciseDiff * 1.2;
    }

    if (quitSmoking) {
      heartSim -= 15;
      strokeSim -= 12;
    }

    return {
      heart: Math.max(5, Math.floor(heartSim)),
      diabetes: Math.max(5, Math.floor(diabetesSim)),
      stroke: Math.max(5, Math.floor(strokeSim))
    };
  };

  const simRisks = calculateSimulatedRisks();

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Simulate Your Future
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Explore how changes in lifestyle factors may affect your estimated health risks.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Controls */}
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl flex items-center">
                <Sliders className="w-5 h-5 mr-2 text-primary" />
                Adjustable Factors
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={resetSimulation}>
                <RefreshCw className="w-4 h-4 mr-2" /> Reset
              </Button>
            </CardHeader>
            <CardContent className="space-y-8 pb-8">
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Weight (kg)</span>
                  <span className="text-primary font-mono">{weight} kg</span>
                </div>
                <input 
                  type="range" 
                  min="50" max="150" 
                  value={weight} 
                  onChange={(e) => setWeight(parseInt(e.target.value))}
                  className="w-full accent-primary h-2 bg-accent rounded-lg appearance-none cursor-pointer" 
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current: {assessment.patient.weight} kg</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Exercise (Days / Week)</span>
                  <span className="text-primary font-mono">{exercise} days</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="7" 
                  value={exercise} 
                  onChange={(e) => setExercise(parseInt(e.target.value))}
                  className="w-full accent-primary h-2 bg-accent rounded-lg appearance-none cursor-pointer" 
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current: {assessment.patient.exerciseDaysPerWeek} days</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Currently Smoking</span>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setSmoking(true)}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${smoking ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                  >
                    Yes
                  </button>
                  <button 
                    onClick={() => setSmoking(false)}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${!smoking ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                  >
                    No
                  </button>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <Card className="border-border bg-gradient-to-br from-card to-primary/5">
            <CardHeader>
              <CardTitle className="text-xl">Projected Change</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center border-b border-border pb-4">
                  <div className="text-muted-foreground font-medium">Current Baseline</div>
                  <div className="text-primary font-semibold">After Simulation</div>
                </div>

                <div className="space-y-4">
                  {/* Heart */}
                  <div className="flex items-center justify-between">
                    <div className="w-1/3">
                      <div className="font-semibold text-sm">Heart Disease</div>
                      <div className="text-2xl font-bold">{assessment.risks.heart.riskPercentage}%</div>
                    </div>
                    <div className="w-1/3 flex justify-center">
                      <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <div className="w-1/3 text-right">
                      <div className="font-semibold text-sm text-primary">Simulated</div>
                      <div className="text-3xl font-black text-primary">{simRisks.heart}%</div>
                    </div>
                  </div>

                  {/* Diabetes */}
                  <div className="flex items-center justify-between">
                    <div className="w-1/3">
                      <div className="font-semibold text-sm">Diabetes</div>
                      <div className="text-2xl font-bold">{assessment.risks.diabetes.riskPercentage}%</div>
                    </div>
                    <div className="w-1/3 flex justify-center">
                      <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <div className="w-1/3 text-right">
                      <div className="font-semibold text-sm text-primary">Simulated</div>
                      <div className="text-3xl font-black text-primary">{simRisks.diabetes}%</div>
                    </div>
                  </div>

                  {/* Stroke */}
                  <div className="flex items-center justify-between">
                    <div className="w-1/3">
                      <div className="font-semibold text-sm">Stroke</div>
                      <div className="text-2xl font-bold">{assessment.risks.stroke.riskPercentage}%</div>
                    </div>
                    <div className="w-1/3 flex justify-center">
                      <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <div className="w-1/3 text-right">
                      <div className="font-semibold text-sm text-primary">Simulated</div>
                      <div className="text-3xl font-black text-primary">{simRisks.stroke}%</div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 mt-8 rounded-lg bg-accent/50 text-sm text-muted-foreground text-center">
                  Projected change based on the current simulation. Not a guaranteed medical outcome.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
