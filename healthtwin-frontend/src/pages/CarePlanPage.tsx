import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, AlertCircle, Stethoscope, Sparkles } from 'lucide-react';
import { useState } from 'react';

export default function CarePlanPage() {
  const { assessment } = useAssessment();
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});

  if (!assessment) return null;

  const toggleAction = (id: string) => {
    setCompletedActions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const sortedPlan = [...assessment.carePlan].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Your Personalized Care Plan
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Actionable, prioritized steps designed to mitigate your calculated health risks.
        </p>
      </header>
      
      <div className="bg-accent/30 border border-border p-4 rounded-lg flex items-start text-sm text-muted-foreground mb-8">
        <AlertCircle className="w-5 h-5 min-w-5 mr-3 mt-0.5 text-primary" />
        <p>
          HealthTwin AI provides estimated risk insights for informational and preventive purposes and is not a medical diagnosis. 
          Clinical decisions should be made with a qualified healthcare professional.
        </p>
      </div>

      <div className="space-y-6">
        {sortedPlan.map((action, idx) => {
          const isCompleted = completedActions[action.id];
          
          return (
            <Card 
              key={action.id} 
              className={`transition-all duration-300 ${isCompleted ? 'bg-muted/50 border-muted opacity-60' : 'border-border shadow-sm'}`}
            >
              <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                
                <div className="flex-shrink-0 flex items-start">
                  <button onClick={() => toggleAction(action.id)} className="focus:outline-none focus:ring-2 focus:ring-primary rounded-full">
                    {isCompleted ? (
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    ) : (
                      <Circle className="w-8 h-8 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Priority {action.priority}</span>
                    
                    {action.type === 'doctor-reviewed' ? (
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                        <Stethoscope className="w-3 h-3 mr-1" />
                        Doctor reviewed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-accent-foreground/20 text-muted-foreground bg-accent">
                        <Sparkles className="w-3 h-3 mr-1 text-primary" />
                        AI-generated recommendation
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className={`text-xl font-semibold ${isCompleted ? 'line-through' : ''}`}>
                    {action.title}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed max-w-3xl">
                    {action.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  );
}
