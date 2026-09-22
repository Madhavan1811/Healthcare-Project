import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAssessment } from '@/hooks/useAssessment';
import {
  AlcoholUse,
  DiabetesStatus,
  ExerciseFrequency,
  GeneralHealth,
  PatientInput,
  Sex,
  SmokingStatus,
} from '@/services/api';
import { Activity, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

const STEPS = [
  'Personal Information',
  'Lifestyle & Habits',
  'Health History',
  'General Health',
  'Review & Generate',
];

interface AssessmentFormState {
  age: string;
  sex: Sex | '';
  height_cm: string;
  weight_kg: string;
  smoking_status: SmokingStatus | '';
  exercise_frequency: ExerciseFrequency | '';
  sleep_hours: string;
  alcohol_use: AlcoholUse | '';
  high_bp: boolean | null;
  high_chol: boolean | null;
  diabetes_status: DiabetesStatus | '';
  kidney_disease: boolean | null;
  copd: boolean | null;
  depression: boolean | null;
  difficulty_walking: boolean | null;
  general_health: GeneralHealth | '';
  physical_unwell_days: string;
}

const initialForm: AssessmentFormState = {
  age: '',
  sex: '',
  height_cm: '',
  weight_kg: '',
  smoking_status: '',
  exercise_frequency: '',
  sleep_hours: '',
  alcohol_use: '',
  high_bp: null,
  high_chol: null,
  diabetes_status: '',
  kidney_disease: null,
  copd: null,
  depression: null,
  difficulty_walking: null,
  general_health: '',
  physical_unwell_days: '',
};

function numberInRange(value: string, min: number, max: number): boolean {
  if (value.trim() === '') return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

function buildPatientInput(form: AssessmentFormState): PatientInput {
  const values: PatientInput = {
    age: Number(form.age),
    sex: form.sex as Sex,
    height_cm: Number(form.height_cm),
    weight_kg: Number(form.weight_kg),
    smoking_status: form.smoking_status as SmokingStatus,
    exercise_frequency: form.exercise_frequency as ExerciseFrequency,
    sleep_hours: Number(form.sleep_hours),
    alcohol_use: form.alcohol_use as AlcoholUse,
    high_bp: form.high_bp as boolean,
    high_chol: form.high_chol as boolean,
    diabetes_status: form.diabetes_status as DiabetesStatus,
    kidney_disease: form.kidney_disease as boolean,
    copd: form.copd as boolean,
    depression: form.depression as boolean,
    difficulty_walking: form.difficulty_walking as boolean,
    general_health: form.general_health as GeneralHealth,
    physical_unwell_days: Number(form.physical_unwell_days),
  };

  return values;
}

function choiceLabel(value: string | boolean | null): string {
  if (value === null || value === '') return 'Not selected';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value.replace('_', ' ');
}

export default function AssessmentPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [form, setForm] = useState<AssessmentFormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const { generateAssessment, isLoading, error, clearError } = useAssessment();
  const navigate = useNavigate();

  const updateField = <K extends keyof AssessmentFormState>(
    field: K,
    value: AssessmentFormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormError(null);
    clearError();
  };

  const validateCurrentStep = (): boolean => {
    setFormError(null);
    clearError();

    if (currentStep === 0) {
      if (!numberInRange(form.age, 18, 120)) {
        setFormError('Age must be between 18 and 120 years.');
        return false;
      }
      if (!form.sex) {
        setFormError('Please select your gender.');
        return false;
      }
      if (!numberInRange(form.height_cm, 100, 250)) {
        setFormError('Height must be between 100 and 250 cm.');
        return false;
      }
      if (!numberInRange(form.weight_kg, 25, 350)) {
        setFormError('Weight must be between 25 and 350 kg.');
        return false;
      }
    }

    if (currentStep === 1) {
      if (!form.smoking_status) {
        setFormError('Please select your smoking status.');
        return false;
      }
      if (!form.exercise_frequency) {
        setFormError('Please select your exercise frequency.');
        return false;
      }
      if (!numberInRange(form.sleep_hours, 0, 24)) {
        setFormError('Sleep must be between 0 and 24 hours per day.');
        return false;
      }
      if (!form.alcohol_use) {
        setFormError('Please select your alcohol use.');
        return false;
      }
    }

    if (currentStep === 2) {
      const booleanFields = [
        form.high_bp,
        form.high_chol,
        form.kidney_disease,
        form.copd,
        form.depression,
        form.difficulty_walking,
      ];

      if (booleanFields.some((value) => value === null)) {
        setFormError('Please answer every Yes/No health-history question.');
        return false;
      }
      if (!form.diabetes_status) {
        setFormError('Please select your diabetes/prediabetes status.');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!form.general_health) {
        setFormError('Please select your overall health.');
        return false;
      }
      if (!numberInRange(form.physical_unwell_days, 0, 30)) {
        setFormError('Physical-health days must be between 0 and 30.');
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) return;
    setCurrentStep((previous) => Math.min(previous + 1, STEPS.length - 1));
  };

  const prevStep = () => {
    setFormError(null);
    clearError();
    setCurrentStep((previous) => Math.max(previous - 1, 0));
  };

  const handleGenerate = async () => {
    for (const step of [0, 1, 2, 3]) {
      if (step === 0) {
        if (!numberInRange(form.age, 18, 120) || !form.sex || !numberInRange(form.height_cm, 100, 250) || !numberInRange(form.weight_kg, 25, 350)) {
          setCurrentStep(0);
          setFormError('Please complete the personal information before generating your Health Twin.');
          return;
        }
      }
      if (step === 1) {
        if (!form.smoking_status || !form.exercise_frequency || !numberInRange(form.sleep_hours, 0, 24) || !form.alcohol_use) {
          setCurrentStep(1);
          setFormError('Please complete the lifestyle section before generating your Health Twin.');
          return;
        }
      }
      if (step === 2) {
        if (
          form.high_bp === null ||
          form.high_chol === null ||
          form.kidney_disease === null ||
          form.copd === null ||
          form.depression === null ||
          form.difficulty_walking === null ||
          !form.diabetes_status
        ) {
          setCurrentStep(2);
          setFormError('Please complete the health-history section before generating your Health Twin.');
          return;
        }
      }
      if (step === 3) {
        if (!form.general_health || !numberInRange(form.physical_unwell_days, 0, 30)) {
          setCurrentStep(3);
          setFormError('Please complete the general-health section before generating your Health Twin.');
          return;
        }
      }
    }

    const patientInput = buildPatientInput(form);
    const stages = [
      'Validating your health information...',
      'Running the Heart, Kidney, and Stroke models...',
      'Computing patient-level SHAP explanations...',
      'Synthesizing personalized health insights...',
      'Preparing your Health Twin dashboard...',
    ];

    let stageIndex = 0;
    setLoadingStage(stages[0]);
    setFormError(null);
    clearError();

    const interval = window.setInterval(() => {
      stageIndex += 1;
      if (stageIndex < stages.length) {
        setLoadingStage(stages[stageIndex]);
      }
    }, 1200);

    try {
      const success = await generateAssessment(patientInput);
      if (success) {
        // Navigate on both ML success and rule-based fallback success
        navigate('/dashboard');
      }
    } finally {
      window.clearInterval(interval);
      setLoadingStage('');
    }
  };

  const progressPercentage = (currentStep / (STEPS.length - 1)) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative flex justify-center mx-auto w-24 h-24">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <Activity className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Building your Health Twin</h2>
            <p className="text-muted-foreground mt-2 min-h-[1.5rem] animate-pulse">{loadingStage}</p>
          </div>
        </div>
      </div>
    );
  }

  const serviceError = error?.message ?? null;

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
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

        {(formError || serviceError) && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p>{formError ?? serviceError}</p>
              {error && error.status > 0 && (
                <p className="text-xs text-muted-foreground">
                  Request could not be completed. Your entered information is still available on this page.
                </p>
              )}
            </div>
            {error && !formError && (
              <Button variant="outline" size="sm" onClick={handleGenerate}>
                Retry
              </Button>
            )}
          </div>
        )}

        <Card className="border-border shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>{STEPS[currentStep]}</CardTitle>
            <CardDescription>
              {currentStep === 4
                ? 'Review your entered information before generating your continuous health profile.'
                : 'Please provide accurate information for the best clinical assessment.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="min-h-[400px]">
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Age</label>
                    <input
                      type="number"
                      min="18"
                      max="120"
                      value={form.age}
                      onChange={(event) => updateField('age', event.target.value)}
                      placeholder="e.g. 45"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Gender</label>
                    <select
                      value={form.sex}
                      onChange={(event) => updateField('sex', event.target.value as Sex | '')}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Height (cm)</label>
                    <input
                      type="number"
                      min="100"
                      max="250"
                      value={form.height_cm}
                      onChange={(event) => updateField('height_cm', event.target.value)}
                      placeholder="e.g. 175"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Weight (kg)</label>
                    <input
                      type="number"
                      min="25"
                      max="350"
                      value={form.weight_kg}
                      onChange={(event) => updateField('weight_kg', event.target.value)}
                      placeholder="e.g. 72"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">* BMI is automatically calculated from height and weight.</p>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-base font-semibold">Smoking Status</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      ['never', 'Never'],
                      ['former', 'Former'],
                      ['current', 'Current'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateField('smoking_status', value)}
                        className={`p-4 border rounded-xl text-center cursor-pointer transition-all text-sm ${form.smoking_status === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-semibold">Exercise Frequency</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([
                      ['never', 'Never'],
                      ['1_2', '1–2 days'],
                      ['3_4', '3–4 days'],
                      ['5_plus', '5+ days'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateField('exercise_frequency', value)}
                        className={`p-4 border rounded-xl text-center cursor-pointer transition-all text-sm ${form.exercise_frequency === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-base font-semibold">Sleep (hours/day)</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={form.sleep_hours}
                      onChange={(event) => updateField('sleep_hours', event.target.value)}
                      placeholder="e.g. 7"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-base font-semibold">Alcohol Consumption</label>
                    <select
                      value={form.alcohol_use}
                      onChange={(event) => updateField('alcohol_use', event.target.value as AlcoholUse | '')}
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    >
                      <option value="">Select use</option>
                      <option value="never">Never</option>
                      <option value="occasional">Occasional</option>
                      <option value="frequent">Frequent</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                {([
                  ['high_bp', 'High blood pressure?'],
                  ['high_chol', 'High cholesterol?'],
                  ['kidney_disease', 'Kidney disease?'],
                  ['copd', 'COPD?'],
                  ['depression', 'Depression?'],
                  ['difficulty_walking', 'Difficulty walking/climbing stairs?'],
                ] as const).map(([field, label]) => (
                  <div key={field} className="flex justify-between items-center pb-3 border-b border-border/50 gap-4">
                    <span className="font-medium text-sm">{label}</span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={form[field] === true ? 'default' : 'outline'}
                        size="sm"
                        className="w-16"
                        onClick={() => updateField(field, true)}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={form[field] === false ? 'default' : 'outline'}
                        size="sm"
                        className="w-16"
                        onClick={() => updateField(field, false)}
                      >
                        No
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2 gap-4">
                  <span className="font-medium text-sm">Diabetes / Prediabetes status?</span>
                  <select
                    value={form.diabetes_status}
                    onChange={(event) => updateField('diabetes_status', event.target.value as DiabetesStatus | '')}
                    className="h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none"
                  >
                    <option value="">Select status</option>
                    <option value="none">No diabetes</option>
                    <option value="prediabetes">Prediabetes</option>
                    <option value="diabetes">Diabetes</option>
                  </select>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-base font-semibold">How would you describe your overall health?</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {([
                      ['excellent', 'Excellent'],
                      ['very_good', 'Very good'],
                      ['good', 'Good'],
                      ['fair', 'Fair'],
                      ['poor', 'Poor'],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateField('general_health', value)}
                        className={`p-4 border rounded-xl text-center cursor-pointer transition-all text-xs font-semibold ${form.general_health === value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50'
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <label className="text-base font-semibold">Days physical health was not good in last 30 days:</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={form.physical_unwell_days}
                      onChange={(event) => updateField('physical_unwell_days', event.target.value)}
                      className="flex h-12 w-24 rounded-md border border-input bg-transparent px-3 py-2 text-lg text-center font-bold focus-visible:ring-2 focus-visible:ring-primary outline-none"
                    />
                    <span className="text-muted-foreground font-medium">Days</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={form.physical_unwell_days || 0}
                    onChange={(event) => updateField('physical_unwell_days', event.target.value)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="p-8 border border-border rounded-xl bg-primary/5 space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                    <div>
                      <h3 className="text-lg font-bold">Assessment ready</h3>
                      <p className="text-sm text-muted-foreground">Review the values that will be sent to the HealthTwin backend.</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div>Age: <strong>{form.age}</strong></div>
                    <div>Gender: <strong>{choiceLabel(form.sex)}</strong></div>
                    <div>Height: <strong>{form.height_cm} cm</strong></div>
                    <div>Weight: <strong>{form.weight_kg} kg</strong></div>
                    <div>Smoking: <strong>{choiceLabel(form.smoking_status)}</strong></div>
                    <div>Exercise: <strong>{choiceLabel(form.exercise_frequency)}</strong></div>
                    <div>Sleep: <strong>{form.sleep_hours} h/day</strong></div>
                    <div>Alcohol: <strong>{choiceLabel(form.alcohol_use)}</strong></div>
                    <div>High BP: <strong>{choiceLabel(form.high_bp)}</strong></div>
                    <div>High cholesterol: <strong>{choiceLabel(form.high_chol)}</strong></div>
                    <div>Diabetes status: <strong>{choiceLabel(form.diabetes_status)}</strong></div>
                    <div>Kidney disease: <strong>{choiceLabel(form.kidney_disease)}</strong></div>
                    <div>COPD: <strong>{choiceLabel(form.copd)}</strong></div>
                    <div>Depression: <strong>{choiceLabel(form.depression)}</strong></div>
                    <div>Difficulty walking: <strong>{choiceLabel(form.difficulty_walking)}</strong></div>
                    <div>Overall health: <strong>{choiceLabel(form.general_health)}</strong></div>
                    <div>Unwell days: <strong>{form.physical_unwell_days}</strong></div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Your assessment runs three disease models: Heart Disease, Chronic Kidney Disease, and Stroke. Diabetes status is used as an input factor, not as a predicted disease.
                </p>
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
