import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AssessmentData, mockAssessment } from '@/data/mockData';

interface AssessmentContextType {
  assessment: AssessmentData | null;
  setAssessment: (data: AssessmentData | null) => void;
  isLoading: boolean;
  generateAssessment: () => Promise<void>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Simulating an API call to generate assessment
  const generateAssessment = async () => {
    setIsLoading(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setAssessment(mockAssessment);
        setIsLoading(false);
        resolve();
      }, 3000);
    });
  };

  return (
    <AssessmentContext.Provider value={{ assessment, setAssessment, isLoading, generateAssessment }}>
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
}
