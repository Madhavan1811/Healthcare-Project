import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAssessment } from '@/hooks/useAssessment';
import { Activity, ArrowRight, ArrowLeft } from 'lucide-react';

const STEPS = [
  'Personal Information',
  'Lifestyle & Habits',
  'Health History',
  'General Health',
  'Review & Generate'
];

export default function AssessmentPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const { generateAssessment, isLoading } = useAssessment();
  const navigate = useNavigate();
  const [loadingStage, setLoadingStage] = useState('');

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const handleGenerate = async () => {
    const stages = [
      'Organizing health information...',
      'Analyzing risk factors...',
      'Generating explanations...',
      'Building your health trajectory...',
      'Preparing your personalized report...'
    ];
    
    let stageIndex = 0;
    setLoadingStage(stages[0]);
    
    const interval = setInterval(() => {
      stageIndex++;
      if (stageIndex < stages.length) {
        setLoadingStage(stages[stageIndex]);
      }
    }, 600);

    await generateAssessment();
    clearInterval(interval);
    navigate('/dashboard');
  };

  const progressPercentage = ((currentStep) / (STEPS.length - 1)) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative flex justify-center mx-auto w-24 h-24">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <Activity className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <h2 className="text-2xl font-semibold">Building your Health Twin</h2>
          <p className="text-muted-foreground min-h-[1.5rem] animate-pulse">{loadingStage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Progress header map */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">Health Assessment</h2>
          <p className="text-muted-foreground text-sm">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
          </p>
          <Progress value={progressPercentage} className="h-2" />
          
          <div className="flex justify-between text-base md:text-sm text-xs text-muted-foreground font-medium px-1">
            {STEPS.map((step, idx) => (
              <span key={step} className={`hidden sm:inline ${idx <= currentStep ? 'text-primary' : ''}`}>
                {String(idx + 1).padStart(2, '0')} {step.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>

        <Card className="border-border shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>{STEPS[currentStep]}</CardTitle>
            <CardDescription>
              {currentStep === 4 
                ? "Review your entered information before generating your continuous health profile."
                : "Please provide accurate information for the best clinical assessment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-[400px]">
            {/* Step 1: Personal */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Age</label>
                    <input type="number" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none" defaultValue="45" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gender</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none">
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Height (cm)</label>
                    <input type="number" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none" defaultValue="175" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Weight (kg)</label>
                    <input type="number" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none" defaultValue="72" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">* BMI is automatically calculated by the system.</p>
              </div>
            )}

            {/* Step 2: Lifestyle */}
            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-base font-semibold">Smoking Status</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Never', 'Former', 'Current'].map(opt => (
                      <div key={opt} className={`p-4 border rounded-xl text-center cursor-pointer transition-all hover:border-primary/50 text-sm`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <label className="text-base font-semibold">Exercise Frequency</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['Never', '1–2 days', '3–4 days', '5+ days'].map(opt => (
                      <div key={opt} className={`p-4 border rounded-xl text-center cursor-pointer transition-all hover:border-primary/50 text-sm`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-base font-semibold">Sleep (hours/day)</label>
                    <input type="number" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none" placeholder="e.g. 7" defaultValue="7" />
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-base font-semibold">Alcohol Consumption</label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none">
                      <option>Never</option>
                      <option>Occasional</option>
                      <option>Frequent</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Health History */}
            {currentStep === 2 && (
              <div className="space-y-6">
                 {/* Yes/No block mapping */}
                 {[
                   { id: 'bp', label: 'High blood pressure?' },
                   { id: 'chol', label: 'High cholesterol?' },
                   { id: 'kidney', label: 'Kidney disease?' },
                   { id: 'copd', label: 'COPD?' },
                   { id: 'dep', label: 'Depression?' },
                   { id: 'walk', label: 'Difficulty walking/climbing stairs?' }
                 ].map((item) => (
                   <div key={item.id} className="flex justify-between items-center pb-2 border-b border-border/50">
                     <span className="font-medium text-sm">{item.label}</span>
                     <div className="flex gap-2">
                       <Button variant="outline" size="sm" className="w-16">Yes</Button>
                       <Button variant="outline" size="sm" className="w-16">No</Button>
                     </div>
                   </div>
                 ))}

                 <div className="flex justify-between items-center pt-2">
                     <span className="font-medium text-sm">Diabetes / Prediabetes status?</span>
                     <select className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none">
                       <option>No</option>
                       <option>Prediabetes</option>
                       <option>Diabetes</option>
                     </select>
                 </div>
              </div>
            )}

            {/* Step 4: General Health */}
            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-base font-semibold">How would you describe your overall health?</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {['Excellent', 'Very good', 'Good', 'Fair', 'Poor'].map(opt => (
                      <div key={opt} className={`p-4 border rounded-xl text-center cursor-pointer transition-all hover:border-primary/50 text-xs font-semibold`}>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <label className="text-base font-semibold">Days physical health was not good in last 30 days:</label>
                  <div className="flex items-center gap-4">
                    <input type="number" min="0" max="30" className="flex h-12 w-24 rounded-md border border-input bg-transparent px-3 py-2 text-lg text-center font-bold focus-visible:ring-2 focus-visible:ring-primary outline-none" defaultValue="0" />
                    <span className="text-muted-foreground font-medium">Days</span>
                  </div>
                  <input type="range" min="0" max="30" defaultValue="0" className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="p-10 border-2 border-dashed border-primary/20 rounded-xl bg-primary/5 text-center space-y-4">
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <Activity className="w-8 h-8 text-primary" />
                   </div>
                   <h3 className="text-xl font-bold">17 Data Points Captured</h3>
                   <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                     Your profile strictly conforms to the BRFSS standard schema. We are ready to run the Heart Disease, Stroke, and Diabetes prediction models using these constraints.
                   </p>
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-between border-t p-6">
            <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleGenerate} className="bg-primary hover:bg-primary/95 text-white">
                Generate Health Twin
              </Button>
            ) : (
              <Button onClick={nextStep}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
