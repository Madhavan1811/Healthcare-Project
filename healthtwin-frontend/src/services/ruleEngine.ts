/**
 * HealthTwin AI — Deterministic Rule-Based Assessment Engine
 *
 * This engine is the EMERGENCY FALLBACK used when the ML backend is unavailable.
 * It is NOT a trained machine-learning model.
 *
 * - Same inputs ALWAYS produce the same outputs (deterministic).
 * - Changing any answer changes the result.
 * - No random numbers. No fixed percentages. No mock data.
 * - Disease outputs: Heart Disease, Chronic Kidney Disease, Stroke ONLY.
 * - Diabetes is an INPUT factor, never an output disease.
 *
 * All outputs are clearly labelled "rule-based estimate".
 */

import { PatientInput } from '@/services/api';
import { AssessmentData, CarePlanAction, DiseaseRisk, Factor, RiskLevel } from '@/data/mockData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcBmi(weightKg: number, heightCm: number): number {
  const h = heightCm / 100;
  return h > 0 ? weightKg / (h * h) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreToRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'low';
  if (score < 50) return 'moderate';
  if (score < 70) return 'elevated';
  return 'high';
}

interface FiredRule {
  key: string;
  label: string;
  delta: number;
}

// ---------------------------------------------------------------------------
// Age factor — continuous, disease-specific
// ---------------------------------------------------------------------------

function ageDeltaHeart(age: number): number {
  if (age < 35) return -4;
  if (age < 45) return 0;
  if (age < 55) return 4;
  if (age < 65) return 9;
  if (age < 75) return 14;
  return 18;
}

function ageDeltaKidney(age: number): number {
  if (age < 40) return -3;
  if (age < 55) return 2;
  if (age < 65) return 6;
  if (age < 75) return 10;
  return 14;
}

function ageDeltaStroke(age: number): number {
  if (age < 35) return -4;
  if (age < 45) return 1;
  if (age < 55) return 5;
  if (age < 65) return 10;
  if (age < 75) return 15;
  return 20;
}

// ---------------------------------------------------------------------------
// BMI factor
// ---------------------------------------------------------------------------

function bmiDelta(bmi: number): number {
  if (bmi < 18.5) return -2;
  if (bmi < 25) return 0;
  if (bmi < 30) return 4;
  if (bmi < 35) return 8;
  return 12;
}

// ---------------------------------------------------------------------------
// Core rule runners
// ---------------------------------------------------------------------------

function heartRules(inp: PatientInput): { score: number; rules: FiredRule[] } {
  const rules: FiredRule[] = [];
  let s = 10; // baseline

  const bmi = calcBmi(inp.weight_kg, inp.height_cm);
  const age = inp.age;
  const isSmoker = inp.smoking_status === 'current';
  const isFormerSmoker = inp.smoking_status === 'former';
  const hasBp = inp.high_bp;
  const hasChol = inp.high_chol;
  const hasDiabetes = inp.diabetes_status === 'diabetes';
  const hasPrediabetes = inp.diabetes_status === 'prediabetes';
  const hasKidney = inp.kidney_disease;
  const hasCopd = inp.copd;
  const noExercise = inp.exercise_frequency === 'never';
  const lowExercise = inp.exercise_frequency === '1_2';
  const goodExercise = inp.exercise_frequency === '5_plus';
  const lowSleep = inp.sleep_hours < 6;
  const frequentAlcohol = inp.alcohol_use === 'frequent';
  const poorHealth = inp.general_health === 'poor' || inp.general_health === 'fair';
  const excellentHealth = inp.general_health === 'excellent' || inp.general_health === 'very_good';
  const unwell = inp.physical_unwell_days;
  const male = inp.sex === 'male';

  // Age
  const ageDelta = ageDeltaHeart(age);
  s += ageDelta;
  if (ageDelta > 0) rules.push({ key: 'age', label: `Age ${age} (elevated heart risk in older patients)`, delta: ageDelta });

  // BMI
  const bDelta = bmiDelta(bmi);
  if (bDelta > 0) {
    s += bDelta;
    rules.push({ key: 'bmi', label: `BMI ${bmi.toFixed(1)} (${bmi >= 30 ? 'obese' : 'overweight'} range)`, delta: bDelta });
  } else if (bDelta < 0) {
    s += bDelta;
    rules.push({ key: 'bmi_low', label: 'Low BMI (minor protective effect)', delta: bDelta });
  }

  // Smoking
  if (isSmoker) {
    s += 10;
    rules.push({ key: 'smoking_current', label: 'Current smoking', delta: 10 });
  } else if (isFormerSmoker) {
    s += 4;
    rules.push({ key: 'smoking_former', label: 'Former smoking history', delta: 4 });
  } else {
    s -= 3;
    rules.push({ key: 'smoking_never', label: 'Never smoked (protective)', delta: -3 });
  }

  // High BP
  if (hasBp) {
    s += 9;
    rules.push({ key: 'high_bp', label: 'High blood pressure', delta: 9 });
  }

  // High Cholesterol
  if (hasChol) {
    s += 7;
    rules.push({ key: 'high_chol', label: 'High cholesterol', delta: 7 });
  }

  // Diabetes
  if (hasDiabetes) {
    s += 9;
    rules.push({ key: 'diabetes', label: 'Diabetes status', delta: 9 });
  } else if (hasPrediabetes) {
    s += 4;
    rules.push({ key: 'prediabetes', label: 'Prediabetes status', delta: 4 });
  }

  // Kidney disease
  if (hasKidney) {
    s += 7;
    rules.push({ key: 'kidney', label: 'Chronic kidney disease history', delta: 7 });
  }

  // COPD
  if (hasCopd) {
    s += 6;
    rules.push({ key: 'copd', label: 'COPD', delta: 6 });
  }

  // Exercise
  if (noExercise) {
    s += 6;
    rules.push({ key: 'no_exercise', label: 'No regular physical activity', delta: 6 });
  } else if (lowExercise) {
    s += 2;
    rules.push({ key: 'low_exercise', label: 'Low exercise frequency (1–2 days)', delta: 2 });
  } else if (goodExercise) {
    s -= 5;
    rules.push({ key: 'good_exercise', label: 'Regular exercise ≥5 days/week (protective)', delta: -5 });
  }

  // Male sex — modestly independent risk
  if (male) {
    s += 2;
    rules.push({ key: 'male', label: 'Male sex (modestly elevated baseline)', delta: 2 });
  }

  // Frequent alcohol
  if (frequentAlcohol) {
    s += 4;
    rules.push({ key: 'alcohol', label: 'Frequent alcohol use', delta: 4 });
  }

  // Low sleep
  if (lowSleep) {
    s += 3;
    rules.push({ key: 'low_sleep', label: 'Consistently low sleep (<6 hours)', delta: 3 });
  }

  // Poor general health
  if (poorHealth) {
    s += 5;
    rules.push({ key: 'poor_health', label: 'Self-reported fair/poor general health', delta: 5 });
  } else if (excellentHealth) {
    s -= 4;
    rules.push({ key: 'excellent_health', label: 'Self-reported excellent/very good health (protective)', delta: -4 });
  }

  // Unwell days
  if (unwell >= 15) {
    s += 4;
    rules.push({ key: 'unwell_days', label: `High physical unwell days (${unwell}/30)`, delta: 4 });
  }

  // -------- INTERACTION EFFECTS --------

  if (isSmoker && hasBp) {
    s += 6;
    rules.push({ key: 'smoke_bp', label: 'Smoking combined with high blood pressure (interaction)', delta: 6 });
  }

  if (isSmoker && hasDiabetes) {
    s += 5;
    rules.push({ key: 'smoke_diabetes', label: 'Smoking combined with diabetes (interaction)', delta: 5 });
  }

  if (hasBp && hasChol) {
    s += 5;
    rules.push({ key: 'bp_chol', label: 'High blood pressure combined with high cholesterol (interaction)', delta: 5 });
  }

  if (hasBp && hasDiabetes) {
    s += 5;
    rules.push({ key: 'bp_diabetes', label: 'High blood pressure combined with diabetes (interaction)', delta: 5 });
  }

  if (hasDiabetes && hasKidney) {
    s += 5;
    rules.push({ key: 'diabetes_kidney', label: 'Diabetes combined with kidney disease (interaction)', delta: 5 });
  }

  if (bmi >= 30 && hasDiabetes) {
    s += 4;
    rules.push({ key: 'bmi_diabetes', label: 'Obesity combined with diabetes (interaction)', delta: 4 });
  }

  if (bmi >= 30 && hasBp) {
    s += 4;
    rules.push({ key: 'bmi_bp', label: 'Obesity combined with high blood pressure (interaction)', delta: 4 });
  }

  if (hasCopd && isSmoker) {
    s += 4;
    rules.push({ key: 'copd_smoking', label: 'COPD combined with current smoking (interaction)', delta: 4 });
  }

  if (age >= 55 && isSmoker) {
    s += 4;
    rules.push({ key: 'age_smoking', label: 'Age ≥55 combined with current smoking (interaction)', delta: 4 });
  }

  if (age >= 55 && hasBp) {
    s += 3;
    rules.push({ key: 'age_bp', label: 'Age ≥55 combined with high blood pressure (interaction)', delta: 3 });
  }

  if (frequentAlcohol && hasBp) {
    s += 3;
    rules.push({ key: 'alcohol_bp', label: 'Frequent alcohol combined with high blood pressure (interaction)', delta: 3 });
  }

  if (lowSleep && isSmoker) {
    s += 2;
    rules.push({ key: 'sleep_smoking', label: 'Low sleep combined with smoking (interaction)', delta: 2 });
  }

  if (noExercise && hasDiabetes) {
    s += 3;
    rules.push({ key: 'exercise_diabetes', label: 'Physical inactivity combined with diabetes (interaction)', delta: 3 });
  }

  // Multiple chronic conditions bonus
  const chronicCount = [hasBp, hasChol, hasDiabetes, hasKidney, hasCopd].filter(Boolean).length;
  if (chronicCount >= 3) {
    s += 6;
    rules.push({ key: 'multi_chronic', label: `Multiple chronic conditions (${chronicCount} present)`, delta: 6 });
  }

  return { score: clamp(Math.round(s), 2, 97), rules };
}

function kidneyRules(inp: PatientInput): { score: number; rules: FiredRule[] } {
  const rules: FiredRule[] = [];
  let s = 8;

  const bmi = calcBmi(inp.weight_kg, inp.height_cm);
  const age = inp.age;
  const hasBp = inp.high_bp;
  const hasChol = inp.high_chol;
  const hasDiabetes = inp.diabetes_status === 'diabetes';
  const hasPrediabetes = inp.diabetes_status === 'prediabetes';
  const hasKidney = inp.kidney_disease;
  const isSmoker = inp.smoking_status === 'current';
  const noExercise = inp.exercise_frequency === 'never';
  const goodExercise = inp.exercise_frequency === '5_plus';
  const frequentAlcohol = inp.alcohol_use === 'frequent';
  const poorHealth = inp.general_health === 'poor' || inp.general_health === 'fair';
  const excellentHealth = inp.general_health === 'excellent' || inp.general_health === 'very_good';
  const unwell = inp.physical_unwell_days;
  const hasCopd = inp.copd;
  const lowSleep = inp.sleep_hours < 6;

  // Age
  const ageDelta = ageDeltaKidney(age);
  s += ageDelta;
  if (ageDelta > 0) rules.push({ key: 'age', label: `Age ${age} (risk increases with age)`, delta: ageDelta });

  // Existing kidney disease (very strong)
  if (hasKidney) {
    s += 20;
    rules.push({ key: 'kidney_history', label: 'Chronic kidney disease history (strong factor)', delta: 20 });
  }

  // Diabetes — strongest modifiable driver for CKD
  if (hasDiabetes) {
    s += 14;
    rules.push({ key: 'diabetes', label: 'Diabetes status (leading CKD risk factor)', delta: 14 });
  } else if (hasPrediabetes) {
    s += 6;
    rules.push({ key: 'prediabetes', label: 'Prediabetes status', delta: 6 });
  }

  // High BP
  if (hasBp) {
    s += 10;
    rules.push({ key: 'high_bp', label: 'High blood pressure (second leading CKD driver)', delta: 10 });
  }

  // BMI
  const bDelta = bmiDelta(bmi);
  if (bDelta !== 0) {
    s += bDelta;
    if (bDelta > 0) rules.push({ key: 'bmi', label: `BMI ${bmi.toFixed(1)} (elevated weight increases kidney burden)`, delta: bDelta });
    else rules.push({ key: 'bmi_low', label: 'Healthy BMI range (protective)', delta: bDelta });
  }

  // High cholesterol — contributes to kidney damage
  if (hasChol) {
    s += 4;
    rules.push({ key: 'high_chol', label: 'High cholesterol', delta: 4 });
  }

  // Smoking
  if (isSmoker) {
    s += 5;
    rules.push({ key: 'smoking', label: 'Current smoking (impairs kidney function)', delta: 5 });
  }

  // Exercise
  if (noExercise) {
    s += 5;
    rules.push({ key: 'no_exercise', label: 'No regular physical activity', delta: 5 });
  } else if (goodExercise) {
    s -= 5;
    rules.push({ key: 'good_exercise', label: 'Regular exercise ≥5 days/week (protective)', delta: -5 });
  }

  // General health
  if (poorHealth) {
    s += 6;
    rules.push({ key: 'poor_health', label: 'Self-reported fair/poor general health', delta: 6 });
  } else if (excellentHealth) {
    s -= 4;
    rules.push({ key: 'excellent_health', label: 'Self-reported excellent/very good health (protective)', delta: -4 });
  }

  // Physical unwell days
  if (unwell >= 15) {
    s += 5;
    rules.push({ key: 'unwell_days', label: `High physical unwell days (${unwell}/30)`, delta: 5 });
  } else if (unwell >= 8) {
    s += 2;
    rules.push({ key: 'unwell_days_mod', label: `Moderate physical unwell days (${unwell}/30)`, delta: 2 });
  }

  // Frequent alcohol
  if (frequentAlcohol) {
    s += 4;
    rules.push({ key: 'alcohol', label: 'Frequent alcohol use (nephrotoxic risk)', delta: 4 });
  }

  // COPD / depression
  if (hasCopd) {
    s += 3;
    rules.push({ key: 'copd', label: 'COPD (chronic hypoxia affects kidney perfusion)', delta: 3 });
  }

  // Low sleep
  if (lowSleep) {
    s += 2;
    rules.push({ key: 'low_sleep', label: 'Consistently low sleep (<6 hours)', delta: 2 });
  }

  // -------- INTERACTIONS --------

  if (hasDiabetes && hasBp) {
    s += 8;
    rules.push({ key: 'diabetes_bp', label: 'Diabetes combined with high blood pressure (strong CKD interaction)', delta: 8 });
  }

  if (hasDiabetes && hasKidney) {
    s += 6;
    rules.push({ key: 'diabetes_kidney', label: 'Diabetes combined with kidney disease history (interaction)', delta: 6 });
  }

  if (hasBp && hasKidney) {
    s += 5;
    rules.push({ key: 'bp_kidney', label: 'High blood pressure combined with kidney history (interaction)', delta: 5 });
  }

  if (bmi >= 30 && hasDiabetes) {
    s += 5;
    rules.push({ key: 'bmi_diabetes', label: 'Obesity combined with diabetes (interaction)', delta: 5 });
  }

  if (bmi >= 30 && hasBp) {
    s += 3;
    rules.push({ key: 'bmi_bp', label: 'Obesity combined with high blood pressure (interaction)', delta: 3 });
  }

  if (noExercise && hasDiabetes) {
    s += 4;
    rules.push({ key: 'exercise_diabetes', label: 'Physical inactivity combined with diabetes (interaction)', delta: 4 });
  }

  if (frequentAlcohol && hasBp) {
    s += 3;
    rules.push({ key: 'alcohol_bp', label: 'Frequent alcohol combined with high blood pressure (interaction)', delta: 3 });
  }

  if (poorHealth && unwell >= 10) {
    s += 3;
    rules.push({ key: 'health_unwell', label: 'Poor health combined with high unwell days (interaction)', delta: 3 });
  }

  const chronicCount = [hasBp, hasChol, hasDiabetes, hasKidney, hasCopd].filter(Boolean).length;
  if (chronicCount >= 3) {
    s += 5;
    rules.push({ key: 'multi_chronic', label: `Multiple chronic conditions (${chronicCount} present)`, delta: 5 });
  }

  return { score: clamp(Math.round(s), 2, 97), rules };
}

function strokeRules(inp: PatientInput): { score: number; rules: FiredRule[] } {
  const rules: FiredRule[] = [];
  let s = 8;

  const bmi = calcBmi(inp.weight_kg, inp.height_cm);
  const age = inp.age;
  const isSmoker = inp.smoking_status === 'current';
  const isFormerSmoker = inp.smoking_status === 'former';
  const hasBp = inp.high_bp;
  const hasChol = inp.high_chol;
  const hasDiabetes = inp.diabetes_status === 'diabetes';
  const hasPrediabetes = inp.diabetes_status === 'prediabetes';
  const hasKidney = inp.kidney_disease;
  const hasDiffWalking = inp.difficulty_walking;
  const hasCopd = inp.copd;
  const hasDepression = inp.depression;
  const noExercise = inp.exercise_frequency === 'never';
  const lowExercise = inp.exercise_frequency === '1_2';
  const goodExercise = inp.exercise_frequency === '5_plus';
  const lowSleep = inp.sleep_hours < 6;
  const frequentAlcohol = inp.alcohol_use === 'frequent';
  const poorHealth = inp.general_health === 'poor' || inp.general_health === 'fair';
  const excellentHealth = inp.general_health === 'excellent' || inp.general_health === 'very_good';
  const unwell = inp.physical_unwell_days;

  // Age
  const ageDelta = ageDeltaStroke(age);
  s += ageDelta;
  if (ageDelta > 0) rules.push({ key: 'age', label: `Age ${age} (stroke risk rises steeply with age)`, delta: ageDelta });

  // High BP — strongest single stroke factor
  if (hasBp) {
    s += 13;
    rules.push({ key: 'high_bp', label: 'High blood pressure (primary stroke risk factor)', delta: 13 });
  }

  // Smoking
  if (isSmoker) {
    s += 10;
    rules.push({ key: 'smoking_current', label: 'Current smoking', delta: 10 });
  } else if (isFormerSmoker) {
    s += 4;
    rules.push({ key: 'smoking_former', label: 'Former smoking history', delta: 4 });
  } else {
    s -= 3;
    rules.push({ key: 'smoking_never', label: 'Never smoked (protective)', delta: -3 });
  }

  // Diabetes
  if (hasDiabetes) {
    s += 8;
    rules.push({ key: 'diabetes', label: 'Diabetes status', delta: 8 });
  } else if (hasPrediabetes) {
    s += 3;
    rules.push({ key: 'prediabetes', label: 'Prediabetes status', delta: 3 });
  }

  // High cholesterol
  if (hasChol) {
    s += 5;
    rules.push({ key: 'high_chol', label: 'High cholesterol', delta: 5 });
  }

  // Kidney disease
  if (hasKidney) {
    s += 6;
    rules.push({ key: 'kidney', label: 'Chronic kidney disease history', delta: 6 });
  }

  // Difficulty walking — proxy for functional impairment / frailty
  if (hasDiffWalking) {
    s += 7;
    rules.push({ key: 'diff_walking', label: 'Difficulty walking or climbing stairs', delta: 7 });
  }

  // COPD
  if (hasCopd) {
    s += 4;
    rules.push({ key: 'copd', label: 'COPD (hypoxia increases stroke risk)', delta: 4 });
  }

  // Depression
  if (hasDepression) {
    s += 3;
    rules.push({ key: 'depression', label: 'Depression (independently associated with stroke)', delta: 3 });
  }

  // BMI
  const bDelta = bmiDelta(bmi);
  if (bDelta !== 0) {
    s += bDelta;
    if (bDelta > 0) rules.push({ key: 'bmi', label: `BMI ${bmi.toFixed(1)} (overweight/obese range)`, delta: bDelta });
    else rules.push({ key: 'bmi_low', label: 'Healthy BMI (protective)', delta: bDelta });
  }

  // Exercise
  if (noExercise) {
    s += 6;
    rules.push({ key: 'no_exercise', label: 'No regular physical activity', delta: 6 });
  } else if (lowExercise) {
    s += 2;
    rules.push({ key: 'low_exercise', label: 'Low exercise frequency (1–2 days)', delta: 2 });
  } else if (goodExercise) {
    s -= 5;
    rules.push({ key: 'good_exercise', label: 'Regular exercise ≥5 days/week (protective)', delta: -5 });
  }

  // General health
  if (poorHealth) {
    s += 5;
    rules.push({ key: 'poor_health', label: 'Self-reported fair/poor general health', delta: 5 });
  } else if (excellentHealth) {
    s -= 4;
    rules.push({ key: 'excellent_health', label: 'Self-reported excellent/very good health (protective)', delta: -4 });
  }

  // Unwell days
  if (unwell >= 15) {
    s += 4;
    rules.push({ key: 'unwell_days', label: `High physical unwell days (${unwell}/30)`, delta: 4 });
  }

  // Frequent alcohol
  if (frequentAlcohol) {
    s += 4;
    rules.push({ key: 'alcohol', label: 'Frequent alcohol use', delta: 4 });
  }

  // Low sleep
  if (lowSleep) {
    s += 3;
    rules.push({ key: 'low_sleep', label: 'Consistently low sleep (<6 hours)', delta: 3 });
  }

  // -------- INTERACTIONS --------

  if (isSmoker && hasBp) {
    s += 7;
    rules.push({ key: 'smoke_bp', label: 'Smoking combined with high blood pressure (major stroke interaction)', delta: 7 });
  }

  if (hasBp && hasDiabetes) {
    s += 6;
    rules.push({ key: 'bp_diabetes', label: 'High blood pressure combined with diabetes (interaction)', delta: 6 });
  }

  if (hasBp && hasChol) {
    s += 4;
    rules.push({ key: 'bp_chol', label: 'High blood pressure combined with high cholesterol (interaction)', delta: 4 });
  }

  if (isSmoker && hasDiabetes) {
    s += 4;
    rules.push({ key: 'smoke_diabetes', label: 'Smoking combined with diabetes (interaction)', delta: 4 });
  }

  if (hasDiffWalking && noExercise) {
    s += 4;
    rules.push({ key: 'walking_exercise', label: 'Difficulty walking combined with physical inactivity (interaction)', delta: 4 });
  }

  if (age >= 55 && hasBp) {
    s += 4;
    rules.push({ key: 'age_bp', label: 'Age ≥55 combined with high blood pressure (interaction)', delta: 4 });
  }

  if (age >= 55 && isSmoker) {
    s += 3;
    rules.push({ key: 'age_smoking', label: 'Age ≥55 combined with current smoking (interaction)', delta: 3 });
  }

  if (hasKidney && hasBp) {
    s += 4;
    rules.push({ key: 'kidney_bp', label: 'Kidney disease combined with high blood pressure (interaction)', delta: 4 });
  }

  if (frequentAlcohol && hasBp) {
    s += 3;
    rules.push({ key: 'alcohol_bp', label: 'Frequent alcohol combined with high blood pressure (interaction)', delta: 3 });
  }

  if (lowSleep && hasDiabetes) {
    s += 2;
    rules.push({ key: 'sleep_diabetes', label: 'Low sleep combined with diabetes (interaction)', delta: 2 });
  }

  const chronicCount = [hasBp, hasChol, hasDiabetes, hasKidney, hasCopd].filter(Boolean).length;
  if (chronicCount >= 3) {
    s += 6;
    rules.push({ key: 'multi_chronic', label: `Multiple chronic conditions (${chronicCount} present)`, delta: 6 });
  }

  return { score: clamp(Math.round(s), 2, 97), rules };
}

// ---------------------------------------------------------------------------
// Build DiseaseRisk from raw rule output
// ---------------------------------------------------------------------------

function rulesToFactors(rules: FiredRule[]): Factor[] {
  return rules
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .map((r) => ({
      name: r.label,
      contribution: parseFloat((r.delta / 10).toFixed(3)),
      direction: r.delta >= 0 ? 'increases_risk' : 'decreases_risk',
      importance: Math.abs(r.delta) >= 6 ? 'high' : Math.abs(r.delta) >= 3 ? 'medium' : 'low',
      explanation: r.delta >= 0
        ? `${r.label} contributed positively to the rule-based score.`
        : `${r.label} had a protective effect on the rule-based score.`,
    } as Factor));
}

function buildRiskContext(rules: FiredRule[]): string {
  const topPositive = rules.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const topNegative = rules.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 2);

  let ctx = '';
  if (topPositive.length > 0) {
    ctx += `The rule-based estimate is mainly associated with: ${topPositive.map((r) => r.label).join('; ')}.`;
  }
  if (topNegative.length > 0) {
    ctx += ` Protective factors: ${topNegative.map((r) => r.label).join('; ')}.`;
  }
  return ctx || 'The estimate reflects the combined effect of the entered health and lifestyle factors.';
}

function buildDiseaseRisk(
  disease: string,
  key: string,
  result: { score: number; rules: FiredRule[] },
): DiseaseRisk {
  const riskLevel = scoreToRiskLevel(result.score);
  const interactionRules = result.rules.filter((r) => r.key.includes('_') && r.delta > 0);

  return {
    disease,
    riskPercentage: result.score,
    riskLevel,
    factors: rulesToFactors(result.rules),
    recommendations: [],
    headline: `${disease} — ${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} estimated risk (${result.score}%)`,
    shortExplanation: `Based on the entered profile, the rule-based system assigned a ${result.score}% score for ${disease}, placing it in the ${riskLevel} category.`,
    riskContext: buildRiskContext(result.rules),
    interactionRules: interactionRules.map((r) => r.label),
  } as DiseaseRisk & { interactionRules: string[] };
}

// ---------------------------------------------------------------------------
// Care plan generator — tied to the rules that actually fired
// ---------------------------------------------------------------------------

function buildCarePlan(inp: PatientInput, heartRuleList: FiredRule[], kidneyRuleList: FiredRule[], strokeRuleList: FiredRule[]): CarePlanAction[] {
  const plan: CarePlanAction[] = [];
  let priority = 1;

  const allKeys = new Set([
    ...heartRuleList.map((r) => r.key),
    ...kidneyRuleList.map((r) => r.key),
    ...strokeRuleList.map((r) => r.key),
  ]);

  if (inp.smoking_status === 'current') {
    plan.push({
      id: 'cp-smoking',
      title: 'Smoking cessation program',
      description: 'Current smoking was identified as an active risk factor for heart disease, stroke, and kidney burden. Evidence-based cessation programs (pharmacotherapy, counselling, or combination approaches) significantly reduce cardiovascular risk within months of stopping.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.high_bp) {
    plan.push({
      id: 'cp-bp',
      title: 'Blood pressure monitoring and management',
      description: 'High blood pressure is the leading modifiable risk factor for stroke and a major driver of heart and kidney disease. Discuss medication review, sodium restriction, and regular monitoring with a qualified clinician.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.high_chol) {
    plan.push({
      id: 'cp-chol',
      title: 'Cholesterol management follow-up',
      description: 'High cholesterol contributes to arterial plaque formation and was factored into the heart and stroke estimates. A lipid panel review and dietary/statin discussion with your clinician is recommended.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.diabetes_status === 'diabetes' || inp.diabetes_status === 'prediabetes') {
    plan.push({
      id: 'cp-diabetes',
      title: 'Diabetes/glycaemic management review',
      description: `${inp.diabetes_status === 'diabetes' ? 'Diabetes' : 'Prediabetes'} was used as an input factor that elevated kidney, heart, and stroke scores. Regular HbA1c monitoring, dietary adjustments, and medication review are key to slowing progression.`,
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.exercise_frequency === 'never' || inp.exercise_frequency === '1_2') {
    plan.push({
      id: 'cp-exercise',
      title: 'Increase physical activity',
      description: 'Physical inactivity was flagged as an active risk contributor. Aim for at least 150 minutes of moderate aerobic activity per week, e.g. brisk walking, cycling, or swimming, broken into manageable sessions.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  const bmi = calcBmi(inp.weight_kg, inp.height_cm);
  if (bmi >= 30) {
    plan.push({
      id: 'cp-weight',
      title: 'Weight management plan',
      description: `BMI of ${bmi.toFixed(1)} was entered as an active factor across multiple disease scores. A structured nutrition review and incremental weight-loss goal (5–10% body weight) can reduce heart, kidney, and metabolic risk.`,
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.kidney_disease) {
    plan.push({
      id: 'cp-kidney',
      title: 'Nephrology follow-up',
      description: 'Existing kidney disease history was the strongest single factor in the kidney risk estimate. Specialist review (nephrology), renal function monitoring (eGFR, creatinine), and medication review are recommended.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (allKeys.has('multi_chronic')) {
    plan.push({
      id: 'cp-holistic',
      title: 'Comprehensive multi-condition health review',
      description: 'Three or more chronic conditions were identified, triggering interaction penalties across all three disease scores. A coordinated review by your primary-care team, with consideration of integrated care planning, is strongly advised.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.sleep_hours < 6) {
    plan.push({
      id: 'cp-sleep',
      title: 'Sleep hygiene improvements',
      description: 'Sleep below 6 hours per night contributed to cardiovascular and metabolic risk factors. Consistent sleep schedules, screen-time reduction, and clinical evaluation for sleep apnoea are recommended.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  if (inp.alcohol_use === 'frequent') {
    plan.push({
      id: 'cp-alcohol',
      title: 'Alcohol reduction review',
      description: 'Frequent alcohol use contributed to elevated blood-pressure and cardiac risk rules. Clinician-guided strategies for reduction (alcohol diary, counselling, medication-assisted) are recommended.',
      priority: priority++,
      type: 'ai-generated',
      completed: false,
    });
  }

  // Fallback if nothing fired
  if (plan.length === 0) {
    plan.push({
      id: 'cp-baseline',
      title: 'Maintain current healthy habits',
      description: 'Your entered profile shows few active risk factors. Continue regular preventive health screenings, maintain a balanced diet, and stay physically active. Discuss your results with a clinician for personalised guidance.',
      priority: 1,
      type: 'ai-generated',
      completed: false,
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Overall summary
// ---------------------------------------------------------------------------

function overallRisk(heartLevel: RiskLevel, kidneyLevel: RiskLevel, strokeLevel: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ['low', 'moderate', 'elevated', 'high'];
  return [heartLevel, kidneyLevel, strokeLevel].reduce((worst, current) =>
    order.indexOf(current) > order.indexOf(worst) ? current : worst, 'low');
}

function buildSummary(heartScore: number, kidneyScore: number, strokeScore: number, inp: PatientInput): string {
  const bmi = calcBmi(inp.weight_kg, inp.height_cm);
  const bmiStr = bmi > 0 ? ` (BMI ${bmi.toFixed(1)})` : '';
  return (
    `Rule-based estimate based on the information provided. ` +
    `Heart Disease: ${heartScore}% (${scoreToRiskLevel(heartScore)}), ` +
    `Chronic Kidney Disease: ${kidneyScore}% (${scoreToRiskLevel(kidneyScore)}), ` +
    `Stroke: ${strokeScore}% (${scoreToRiskLevel(strokeScore)}). ` +
    `Profile: age ${inp.age}, ${inp.sex}${bmiStr}, ` +
    `smoking: ${inp.smoking_status}, exercise: ${inp.exercise_frequency}. ` +
    `This is a rule-based fallback estimate, not a trained ML model output. Clinical correlation required.`
  );
}

// ---------------------------------------------------------------------------
// Public: main entry point
// ---------------------------------------------------------------------------

export function ruleBasedAssessment(inp: PatientInput): AssessmentData {
  const heart = heartRules(inp);
  const kidney = kidneyRules(inp);
  const stroke = strokeRules(inp);

  const heartRisk = buildDiseaseRisk('Heart Disease', 'heart', heart);
  const kidneyRisk = buildDiseaseRisk('Chronic Kidney Disease', 'kidney', kidney);
  const strokeRisk = buildDiseaseRisk('Stroke', 'stroke', stroke);

  const overall = overallRisk(heartRisk.riskLevel, kidneyRisk.riskLevel, strokeRisk.riskLevel);
  const bmi = calcBmi(inp.weight_kg, inp.height_cm);

  const carePlan = buildCarePlan(inp, heart.rules, kidney.rules, stroke.rules);

  const now = new Date().toLocaleString();

  return {
    patient: {
      id: `RB-${Date.now()}`,
      name: 'Patient',
      age: inp.age,
      gender: inp.sex === 'male' ? 'Male' : 'Female',
      height: inp.height_cm,
      weight: inp.weight_kg,
      smoking: inp.smoking_status === 'current',
      exerciseDaysPerWeek:
        inp.exercise_frequency === 'never' ? 0
          : inp.exercise_frequency === '1_2' ? 1
          : inp.exercise_frequency === '3_4' ? 3
          : 5,
      lastUpdated: now,
    },
    overallRisk: overall,
    overallRiskSummary: buildSummary(heart.score, kidney.score, stroke.score, inp),
    risks: {
      heart: heartRisk,
      kidney: kidneyRisk,
      stroke: strokeRisk,
    },
    trajectory: [],
    carePlan,
    labInsights: [],
    patientReport: {
      summary: `Rule-based assessment generated at ${now}.`,
      risk_explanation: buildSummary(heart.score, kidney.score, stroke.score, inp),
      lab_summary: 'No lab report was provided.',
      next_steps: carePlan.slice(0, 3).map((c) => c.title).join('; ') + '.',
    },
    doctorSummary: {
      clinical_overview: `Rule-based emergency assessment. Age ${inp.age}, BMI ${bmi.toFixed(1)}, smoking: ${inp.smoking_status}.`,
      risk_summary: buildSummary(heart.score, kidney.score, stroke.score, inp),
      important_factors: [
        ...heart.rules.filter((r) => r.delta >= 6).map((r) => `[Heart] ${r.label}`),
        ...kidney.rules.filter((r) => r.delta >= 6).map((r) => `[Kidney] ${r.label}`),
        ...stroke.rules.filter((r) => r.delta >= 6).map((r) => `[Stroke] ${r.label}`),
      ].slice(0, 8),
      lab_points: [],
      follow_up_points: carePlan.slice(0, 3).map((c) => c.title),
    },
    specialistFollowUp: {
      recommended: overall === 'elevated' || overall === 'high',
      reason: overall === 'elevated' || overall === 'high'
        ? 'Elevated or High overall rule-based risk estimate detected. Specialist follow-up is recommended.'
        : 'No immediate specialist follow-up indicated based on current rule-based estimates.',
    },
    ui: {
      overall_severity: overall,
      headline: `Rule-based estimate: ${overall.charAt(0).toUpperCase() + overall.slice(1)} overall risk`,
      show_attention_banner: overall === 'elevated' || overall === 'high',
      priority_count: carePlan.length,
    },
    requestId: undefined,
    assessmentMode: 'rule_based',
  } as AssessmentData & { assessmentMode: string };
}
