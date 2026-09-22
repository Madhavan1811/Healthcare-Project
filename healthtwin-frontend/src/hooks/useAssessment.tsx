import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AssessmentData } from '@/data/mockData';
import {
  AssessmentApiError,
  PatientInput,
  assessPatient,
} from '@/services/api';
import { mapBackendToFrontend } from '@/services/adapter';
import { ruleBasedAssessment } from '@/services/ruleEngine';

const SESSION_KEY = 'healthtwin_assessment';
const PATIENT_KEY = 'healthtwin_patient_input';

/** Safely read and parse a sessionStorage value. Returns null on any failure. */
function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Safely write a value to sessionStorage. Silently ignores quota errors. */
function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable in some privacy-restricted contexts.
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PATIENT_KEY);
  } catch {
    // ignore
  }
}

interface AssessmentContextType {
  assessment: AssessmentData | null;
  setAssessment: (data: AssessmentData | null) => void;
  isLoading: boolean;
  error: AssessmentApiError | null;
  clearError: () => void;
  lastPatientInput: PatientInput | null;
  assessmentMode: 'ml' | 'rule_based' | null;
  generateAssessment: (
    patientData: PatientInput,
    pdfFile?: File | null
  ) => Promise<boolean>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(
  undefined
);

export function AssessmentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [assessment, _setAssessment] = useState<AssessmentData | null>(
    () => readSession<AssessmentData>(SESSION_KEY)
  );
  const [lastPatientInput, setLastPatientInput] = useState<PatientInput | null>(
    () => readSession<PatientInput>(PATIENT_KEY)
  );
  const [assessmentMode, setAssessmentMode] = useState<'ml' | 'rule_based' | null>(
    () => {
      const stored = readSession<AssessmentData>(SESSION_KEY);
      return stored ? ((stored as AssessmentData & { assessmentMode?: string }).assessmentMode === 'rule_based' ? 'rule_based' : 'ml') : null;
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AssessmentApiError | null>(null);

  const setAssessment = (data: AssessmentData | null) => {
    _setAssessment(data);
    if (data) {
      writeSession(SESSION_KEY, data);
    } else {
      clearSession();
    }
  };

  const clearError = () => {
    setError(null);
  };

  const generateAssessment = async (
    patientData: PatientInput,
    pdfFile?: File | null
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    // Persist questionnaire immediately so it survives a failure.
    setLastPatientInput(patientData);
    writeSession(PATIENT_KEY, patientData);

    // -------------------------------------------------------
    // Step 1: Try the real ML backend
    // -------------------------------------------------------
    try {
      const backendResponse = await assessPatient(patientData, pdfFile);

      console.log('BACKEND RESPONSE:', backendResponse.risk_overview);

      const frontendAssessment = mapBackendToFrontend(backendResponse, patientData);

      console.log('FRONTEND ASSESSMENT (ML):', frontendAssessment.risks);

      setAssessmentMode('ml');
      setAssessment(frontendAssessment);
      setIsLoading(false);
      return true;

    } catch (mlError) {
      // -------------------------------------------------------
      // Step 2: Backend failed — activate rule-based fallback
      // -------------------------------------------------------
      console.warn(
        'ML backend unavailable — activating rule-based fallback.',
        mlError instanceof Error ? mlError.message : mlError
      );

      try {
        const fallbackResult = ruleBasedAssessment(patientData);

        console.log('RULE ENGINE RESULT:', fallbackResult.risks);

        setAssessmentMode('rule_based');
        setAssessment(fallbackResult);

        // Surface a non-blocking info banner (status 0 = network failure).
        const info = new AssessmentApiError(
          'The ML backend is currently unavailable. Showing a rule-based estimate instead.',
          0,
          'backend_unavailable',
        );
        setError(info);

        setIsLoading(false);
        return true; // still navigates to dashboard — rule engine succeeded

      } catch (ruleError) {
        // Rule engine itself failed (should not happen in practice)
        const apiError = new AssessmentApiError(
          'Unable to generate the assessment. Please check your inputs and try again.',
          0
        );
        console.error('RULE ENGINE ERROR:', ruleError);
        setError(apiError);
        setIsLoading(false);
        return false;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AssessmentContext.Provider
      value={{
        assessment,
        setAssessment,
        isLoading,
        error,
        clearError,
        lastPatientInput,
        assessmentMode,
        generateAssessment,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const context = useContext(AssessmentContext);

  if (context === undefined) {
    throw new Error(
      'useAssessment must be used within an AssessmentProvider'
    );
  }

  return context;
}