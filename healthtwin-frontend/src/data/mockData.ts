export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'high';

export interface PatientProfile {
  id: string;
  name: string;
  age: number;
  gender: string;
  height: number;
  weight: number;
  smoking: boolean;
  exerciseDaysPerWeek: number;
  lastUpdated: string;
}

export interface Factor {
  name: string;
  contribution: number; 
  value?: string | number;
}

export interface DiseaseRisk {
  disease: string;
  riskPercentage: number;
  riskLevel: RiskLevel;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: Factor[];
  recommendations: string[];
}

export interface CarePlanAction {
  id: string;
  title: string;
  description: string;
  priority: 1 | 2 | 3;
  type: 'doctor-reviewed' | 'ai-generated';
  completed: boolean;
}

export interface TrajectoryPoint {
  month: number;
  heart: number;
  diabetes: number;
  stroke: number;
}

export interface AssessmentData {
  patient: PatientProfile;
  overallRisk: RiskLevel;
  overallRiskSummary: string;
  risks: {
    heart: DiseaseRisk;
    diabetes: DiseaseRisk;
    stroke: DiseaseRisk;
  };
  trajectory: TrajectoryPoint[];
  carePlan: CarePlanAction[];
}

export const mockAssessment: AssessmentData = {
  patient: {
    id: "PT-8429",
    name: "Shebin",
    age: 45,
    gender: "Male",
    height: 175,
    weight: 72,
    smoking: true,
    exerciseDaysPerWeek: 2,
    lastUpdated: new Date().toLocaleDateString(),
  },
  overallRisk: "moderate",
  overallRiskSummary: "Your current profile shows several manageable risk factors. Small lifestyle improvements could meaningfully change your estimated risk.",
  risks: {
    heart: {
      disease: "Heart Disease",
      riskPercentage: 74,
      riskLevel: "high",
      confidence: 82,
      trend: "increasing",
      factors: [
        { name: "Smoking", contribution: 0.21 },
        { name: "BMI", contribution: 0.16 },
        { name: "Blood pressure", contribution: 0.11 },
        { name: "Low activity", contribution: 0.07 },
        { name: "Regular exercise", contribution: -0.06 },
        { name: "Healthy HDL", contribution: -0.03 },
      ],
      recommendations: ["Increase weekly physical activity", "Consider a smoking cessation program"],
    },
    diabetes: {
      disease: "Diabetes",
      riskPercentage: 48,
      riskLevel: "moderate",
      confidence: 88,
      trend: "stable",
      factors: [
        { name: "HbA1c", contribution: 0.15, value: "6.2%" },
        { name: "Family History", contribution: 0.10 },
        { name: "Weight", contribution: 0.08 },
      ],
      recommendations: ["Monitor blood sugar", "Reduce simple carbohydrates"],
    },
    stroke: {
      disease: "Stroke",
      riskPercentage: 51,
      riskLevel: "moderate",
      confidence: 76,
      trend: "stable",
      factors: [
        { name: "Blood Pressure", contribution: 0.18 },
        { name: "Age", contribution: 0.05 },
        { name: "Smoking", contribution: 0.12 },
      ],
      recommendations: ["Manage blood pressure", "Increase cardiovascular exercise"],
    }
  },
  trajectory: [
    { month: 0, heart: 74, diabetes: 48, stroke: 51 },
    { month: 3, heart: 76, diabetes: 49, stroke: 52 },
    { month: 6, heart: 79, diabetes: 50, stroke: 53 },
    { month: 12, heart: 83, diabetes: 54, stroke: 56 },
  ],
  carePlan: [
    {
      id: "cp-1",
      title: "Increase weekly physical activity",
      description: "Aim for 150 minutes of moderate exercise per week.",
      priority: 1,
      type: "ai-generated",
      completed: false,
    },
    {
      id: "cp-2",
      title: "Review elevated blood pressure",
      description: "Discuss recent readings with your primary care physician.",
      priority: 2,
      type: "doctor-reviewed",
      completed: false,
    },
    {
      id: "cp-3",
      title: "Improve weight management",
      description: "Consider gradual reduction based on clinician guidance.",
      priority: 3,
      type: "ai-generated",
      completed: false,
    }
  ]
};
