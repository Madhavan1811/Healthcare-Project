import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AssessmentProvider } from '@/hooks/useAssessment';
import PatientLayout from '@/layouts/PatientLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import PatientWelcomePage from '@/pages/PatientWelcomePage';
import AssessmentPage from '@/pages/AssessmentPage';
import DashboardPage from '@/pages/DashboardPage';
import PredictionsPage from '@/pages/PredictionsPage';
import SimulationPage from '@/pages/SimulationPage';
import TrajectoryPage from '@/pages/TrajectoryPage';
import ExplainabilityPage from '@/pages/ExplainabilityPage';
import CarePlanPage from '@/pages/CarePlanPage';
import ReportsPage from '@/pages/ReportsPage';
import HealthJournalPage from '@/pages/HealthJournalPage';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminPatients from '@/pages/admin/AdminPatients';
import AdminPatientDetail from '@/pages/admin/AdminPatientDetail';
import AdminSettings from '@/pages/admin/AdminSettings';

function App() {
  return (
    <AssessmentProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/welcome" element={<PatientWelcomePage />} />
          
          {/* Patient Onboarding / Assessment */}
          <Route path="/assessment" element={<AssessmentPage />} />

          {/* Patient Authenticated Area */}
          <Route element={<PatientLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/journal" element={<HealthJournalPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/trajectory" element={<TrajectoryPage />} />
            <Route path="/explainability" element={<ExplainabilityPage />} />
            <Route path="/care-plan" element={<CarePlanPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          {/* Admin Area */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="patients" element={<AdminPatients />} />
            <Route path="patients/:id" element={<AdminPatientDetail />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AssessmentProvider>
  );
}

export default App;
