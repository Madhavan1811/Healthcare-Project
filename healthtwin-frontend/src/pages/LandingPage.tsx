import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, BrainCircuit, Activity } from 'lucide-react';
import { useAssessment } from '@/hooks/useAssessment';
import { useEffect } from 'react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { assessment } = useAssessment();

  // If already assessed, go to dashboard
  useEffect(() => {
    if (assessment) {
      navigate('/dashboard');
    }
  }, [assessment, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex justify-center mb-8">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
            <HeartPulse className="h-10 w-10 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
          Build your <span className="text-primary">Health Twin</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Let's understand your health profile and create a personalized digital representation to predict, visualize, and improve your future health risks.
        </p>

        <div className="pt-8">
          <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all" onClick={() => navigate('/login')}>
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-16 text-left">
          <Card className="border-none shadow-none bg-accent/50">
            <CardHeader>
              <Activity className="h-8 w-8 text-primary mb-3" />
              <CardTitle>Personalized Risk</CardTitle>
              <CardDescription>Get estimates across multiple clinical conditions based on your actual data.</CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="border-none shadow-none bg-accent/50">
            <CardHeader>
              <BrainCircuit className="h-8 w-8 text-primary mb-3" />
              <CardTitle>Explainable AI</CardTitle>
              <CardDescription>Understand exactly why certain risks exist and how they are calculated.</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-none bg-accent/50">
            <CardHeader>
              <HeartPulse className="h-8 w-8 text-primary mb-3" />
              <CardTitle>Preventive Steps</CardTitle>
              <CardDescription>Simulate lifestyle changes and see the estimated impact on your health trajectory.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
