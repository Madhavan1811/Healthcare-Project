import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AssessmentData } from '@/data/mockData';
import {
  AssessmentApiError,
  PatientInput,
  assessPatient,
} from '@/services/api';
import { mapBackendToFrontend } from '@/services/adapter';

interface AssessmentContextType {
  assessment: AssessmentData | null;
  setAssessment: (data: AssessmentData | null) => void;
  isLoading: boolean;
  error: AssessmentApiError | null;
  clearError: () => void;
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
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AssessmentApiError | null>(null);

  const clearError = () => {
    setError(null);
  };

  const generateAssessment = async (
    patientData: PatientInput,
    pdfFile?: File | null
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Send the real patient data to FastAPI
      const backendResponse = await assessPatient(patientData, pdfFile);

      console.log(
        'BACKEND RESPONSE:',
        backendResponse.risk_overview
      );

      // 2. Convert backend response into the frontend state shape
      const frontendAssessment = mapBackendToFrontend(
        backendResponse,
        patientData
      );

      console.log(
        'FRONTEND ASSESSMENT:',
        frontendAssessment.risks
      );

      // 3. Store the live assessment in React context
      setAssessment(frontendAssessment);

      return true;
    } catch (cause) {
      const apiError =
        cause instanceof AssessmentApiError
          ? cause
          : new AssessmentApiError(
            'Unable to complete the HealthTwin assessment.',
            0
          );

      console.error('HEALTHTWIN ASSESSMENT ERROR:', apiError);

      setError(apiError);
      return false;
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