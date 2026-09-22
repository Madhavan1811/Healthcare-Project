export type Sex = 'male' | 'female';
export type SmokingStatus = 'never' | 'former' | 'current';
export type ExerciseFrequency = 'never' | '1_2' | '3_4' | '5_plus';
export type AlcoholUse = 'never' | 'occasional' | 'frequent';
export type DiabetesStatus = 'none' | 'prediabetes' | 'diabetes';
export type GeneralHealth = 'excellent' | 'very_good' | 'good' | 'fair' | 'poor';

export interface PatientInput {
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  smoking_status: SmokingStatus;
  exercise_frequency: ExerciseFrequency;
  sleep_hours: number;
  alcohol_use: AlcoholUse;
  high_bp: boolean;
  high_chol: boolean;
  diabetes_status: DiabetesStatus;
  kidney_disease: boolean;
  copd: boolean;
  depression: boolean;
  difficulty_walking: boolean;
  general_health: GeneralHealth;
  physical_unwell_days: number;
}

export interface BackendRiskOverviewItem {
  disease: string;
  probability: number;
  risk_percent: number;
  risk_level: 'Low' | 'Moderate' | 'Elevated' | 'High';
  headline: string;
  short_explanation: string;
  risk_context: string;
}

export interface BackendKeyFactor {
  disease: 'heart_disease' | 'kidney_disease' | 'stroke';
  feature: string;
  label: string;
  direction: 'increases_risk' | 'decreases_risk';
  importance: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface BackendLabInsight {
  test: string;
  value: string;
  unit: string | null;
  status: 'normal' | 'review' | 'important' | 'unverified';
  explanation: string;
}

export interface BackendRecommendation {
  priority: number;
  title: string;
  description: string;
  type: 'lifestyle' | 'monitoring' | 'follow_up' | 'specialist';
}

export interface BackendShapFactor {
  feature: string;
  label: string;
  shap_value: number;
  direction: 'increases_risk' | 'decreases_risk';
  abs_impact?: number;
}

export interface BackendShapExplanation {
  disease: 'heart_disease' | 'kidney_disease' | 'stroke';
  raw_probability: number;
  probability: number;
  risk_percent: number;
  risk_level: 'Low' | 'Moderate' | 'Elevated' | 'High';
  shap_space: 'xgboost_raw_margin';
  base_value: number;
  model_margin: number;
  shap_sum: number;
  shap_consistency_error: number;
  shap_consistency: 'ok' | 'warning';
  base_model_count: number;
  top_positive_factors: BackendShapFactor[];
  top_negative_factors: BackendShapFactor[];
  all_factors: BackendShapFactor[];
  model_features: string[];
}

export interface BackendAssessmentResponse {
  overall_summary: string;
  risk_overview: BackendRiskOverviewItem[];
  key_factors: BackendKeyFactor[];
  lab_insights: BackendLabInsight[];
  recommendations: BackendRecommendation[];
  specialist_follow_up: {
    recommended: boolean;
    reason: string;
  };
  patient_report: {
    summary: string;
    risk_explanation: string;
    lab_summary: string;
    next_steps: string;
  };
  doctor_summary: {
    clinical_overview: string;
    risk_summary: string;
    important_factors: string[];
    lab_points: string[];
    follow_up_points: string[];
  };
  ui: {
    overall_severity: 'Low' | 'Moderate' | 'Elevated' | 'High';
    headline: string;
    show_attention_banner: boolean;
    priority_count: number;
  };
  shap: Record<string, BackendShapExplanation>;
  request_id?: string;
}

export class AssessmentApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly stage: string | undefined;

  constructor(
    message: string,
    status: number,
    code?: string,
    requestId?: string,
    stage?: string,
  ) {
    super(message);
    this.name = 'AssessmentApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.stage = stage;
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

function parseErrorPayload(payload: unknown, status: number): AssessmentApiError {
  if (!payload || typeof payload !== 'object') {
    return new AssessmentApiError(
      status === 422
        ? 'Please check your assessment details and try again.'
        : 'The HealthTwin assessment service is temporarily unavailable. Please try again.',
      status,
    );
  }

  const body = payload as {
    detail?: unknown;
    error?: { message?: unknown; code?: unknown };
    message?: unknown;
    code?: unknown;
    request_id?: unknown;
    stage?: unknown;
  };

  const detail = body.detail;
  const source = detail && typeof detail === 'object'
    ? detail as { message?: unknown; code?: unknown; request_id?: unknown; stage?: unknown }
    : body;

  const rawMessage = source.message ?? body.message;
  const code = typeof source.code === 'string'
    ? source.code
    : typeof body.code === 'string'
      ? body.code
      : undefined;
  const requestId = typeof source.request_id === 'string'
    ? source.request_id
    : typeof body.request_id === 'string'
      ? body.request_id
      : undefined;
  const stage = typeof source.stage === 'string'
    ? source.stage
    : typeof body.stage === 'string'
      ? body.stage
      : undefined;

  let message = typeof rawMessage === 'string' ? rawMessage : '';

  if (code === 'pdf_processing_failed') {
    message = 'The uploaded lab PDF could not be processed. You can remove it and continue without a lab report.';
  } else if (status === 502) {
    message = 'The HealthTwin AI assessment service is temporarily unavailable. Please try again in a few moments.';
  } else if (status === 422 && !message) {
    message = 'Please check your assessment details and try again.';
  } else if (!message) {
    message = 'Unable to complete the HealthTwin assessment.';
  }

  return new AssessmentApiError(message, status, code, requestId, stage);
}

export async function assessPatient(
  patientData: PatientInput,
  pdfFile?: File | null,
): Promise<BackendAssessmentResponse> {
  const formData = new FormData();
  formData.append('patient_json', JSON.stringify(patientData));

  if (pdfFile) {
    formData.append('pdf', pdfFile);
  }

  const requestId = crypto.randomUUID();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/assessment`, {
      method: 'POST',
      headers: {
        'X-Request-Id': requestId,
      },
      body: formData,
    });
  } catch {
    throw new AssessmentApiError(
      'Unable to reach the HealthTwin backend server. Please make sure the backend is running.',
      0,
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw parseErrorPayload(payload, response.status);
  }

  if (!payload || typeof payload !== 'object') {
    throw new AssessmentApiError(
      'The backend returned an invalid assessment response.',
      502,
    );
  }

  return payload as BackendAssessmentResponse;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
