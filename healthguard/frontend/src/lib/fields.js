// Mirrors schema/core_schema.yaml.
// If you change the schema, change this file in the same commit.
// (Review 2: generate this file from the YAML at build time so it cannot drift.)

export const CORE = [
  { name: 'age', label: 'Age', unit: 'years', type: 'number', min: 18, max: 100, step: 1, def: 45 },
  { name: 'sex', label: 'Sex', type: 'select', options: ['female', 'male'], def: 'female' },
  { name: 'systolic_bp', label: 'Systolic blood pressure', unit: 'mmHg', type: 'number', min: 80, max: 220, step: 1, def: 120 },
  { name: 'bmi', label: 'Body mass index', unit: 'kg/m²', type: 'number', min: 12, max: 60, step: 0.1, def: 24 },
  { name: 'glucose', label: 'Blood glucose', unit: 'mg/dL', type: 'number', min: 50, max: 350, step: 1, def: 95 },
  { name: 'smoking', label: 'Smoking status', type: 'select', options: ['never', 'former', 'current'], def: 'never' },
]

export const EXTENSIONS = {
  heart: {
    title: 'Heart Disease',
    fields: [
      { name: 'cholesterol_total', label: 'Total cholesterol', unit: 'mg/dL', type: 'number', min: 100, max: 600, step: 1 },
      { name: 'chest_pain_type', label: 'Chest pain type', type: 'select', options: ['typical_angina', 'atypical_angina', 'non_anginal', 'asymptomatic'] },
      { name: 'max_heart_rate', label: 'Max heart rate achieved', unit: 'bpm', type: 'number', min: 60, max: 220, step: 1 },
      { name: 'exercise_angina', label: 'Exercise-induced angina', type: 'select', options: ['no', 'yes'] },
      { name: 'st_depression', label: 'ST depression (oldpeak)', unit: 'mm', type: 'number', min: 0, max: 7, step: 0.1 },
      { name: 'resting_ecg', label: 'Resting ECG', type: 'select', options: ['normal', 'st_t_abnormality', 'lv_hypertrophy'] },
    ],
  },
  diabetes: {
    title: 'Diabetes',
    fields: [
      { name: 'diastolic_bp', label: 'Diastolic blood pressure', unit: 'mmHg', type: 'number', min: 40, max: 130, step: 1 },
      { name: 'pregnancies', label: 'Number of pregnancies', type: 'number', min: 0, max: 20, step: 1 },
      { name: 'insulin', label: '2-hour serum insulin', unit: 'mu U/mL', type: 'number', min: 0, max: 900, step: 1 },
      { name: 'skin_thickness', label: 'Triceps skinfold', unit: 'mm', type: 'number', min: 5, max: 100, step: 1 },
      { name: 'diabetes_pedigree', label: 'Diabetes pedigree function', type: 'number', min: 0.05, max: 2.5, step: 0.01 },
    ],
  },
  kidney: {
    title: 'Chronic Kidney Disease',
    fields: [
      { name: 'serum_creatinine', label: 'Serum creatinine', unit: 'mg/dL', type: 'number', min: 0.4, max: 15, step: 0.1 },
      { name: 'blood_urea', label: 'Blood urea', unit: 'mg/dL', type: 'number', min: 5, max: 250, step: 1 },
      { name: 'hemoglobin', label: 'Haemoglobin', unit: 'g/dL', type: 'number', min: 4, max: 18, step: 0.1 },
      { name: 'albumin', label: 'Urine albumin grade', type: 'select', options: ['0', '1', '2', '3', '4', '5'] },
      { name: 'specific_gravity', label: 'Urine specific gravity', type: 'select', options: ['1.005', '1.010', '1.015', '1.020', '1.025'] },
    ],
  },
  stroke: {
    title: 'Stroke',
    fields: [
      { name: 'hypertension', label: 'Diagnosed hypertension', type: 'select', options: ['no', 'yes'] },
      { name: 'heart_disease', label: 'Existing heart disease', type: 'select', options: ['no', 'yes'] },
      { name: 'ever_married', label: 'Ever married', type: 'select', options: ['no', 'yes'] },
      { name: 'work_type', label: 'Work type', type: 'select', options: ['private', 'self_employed', 'govt_job', 'children', 'never_worked'] },
      { name: 'residence_type', label: 'Residence', type: 'select', options: ['urban', 'rural'] },
    ],
  },
}

// Fields exposed as what-if sliders. Age and sex are excluded on purpose:
// a recommendation you cannot act on is not a recommendation.
export const MUTABLE = [
  { name: 'bmi', label: 'Body mass index', unit: 'kg/m²', min: 15, max: 45, step: 0.1 },
  { name: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', min: 90, max: 200, step: 1 },
  { name: 'glucose', label: 'Blood glucose', unit: 'mg/dL', min: 60, max: 300, step: 1 },
  { name: 'cholesterol_total', label: 'Total cholesterol', unit: 'mg/dL', min: 120, max: 400, step: 1 },
]

export const BAND_COLOR = {
  Low: '#3d6b5c', Moderate: '#b08828', High: '#a8593a', Critical: '#8f2f24',
}

export const BAND_MAX = [
  { name: 'Low', max: 0.20 }, { name: 'Moderate', max: 0.45 },
  { name: 'High', max: 0.70 }, { name: 'Critical', max: 1.0 },
]

export const pretty = (s) =>
  String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const DEMO_PATIENTS = {
  'Elevated risk (male, 58)': {
    age: 58, sex: 'male', systolic_bp: 152, bmi: 31.4, glucose: 168, smoking: 'current',
    cholesterol_total: 255, chest_pain_type: 'asymptomatic', max_heart_rate: 128,
    exercise_angina: 'yes', st_depression: 2.1, resting_ecg: 'lv_hypertrophy',
    serum_creatinine: 1.6, hemoglobin: 11.2, blood_urea: 68, albumin: '3',
    hypertension: 'yes', heart_disease: 'no', ever_married: 'yes',
    work_type: 'private', residence_type: 'urban',
  },
  'Low risk (female, 34)': {
    age: 34, sex: 'female', systolic_bp: 112, bmi: 22.1, glucose: 88, smoking: 'never',
    cholesterol_total: 172, chest_pain_type: 'non_anginal', max_heart_rate: 178,
    exercise_angina: 'no', st_depression: 0.0, resting_ecg: 'normal',
    serum_creatinine: 0.8, hemoglobin: 13.6, blood_urea: 22, albumin: '0',
    diastolic_bp: 72, pregnancies: 1, diabetes_pedigree: 0.21,
    hypertension: 'no', heart_disease: 'no', ever_married: 'yes',
    work_type: 'private', residence_type: 'rural',
  },
  'Sparse input (core fields only)': {
    age: 61, sex: 'male', systolic_bp: 138, bmi: 27.8, glucose: 121, smoking: 'former',
  },
}
