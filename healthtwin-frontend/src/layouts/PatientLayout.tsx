import { Outlet, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { useAssessment } from '@/hooks/useAssessment';
import { Activity, LayoutDashboard, BrainCog, Sliders, TrendingUp, ShieldCheck, HeartPulse, FileText, Bell, BookOpen, LogOut } from 'lucide-react';

export default function PatientLayout() {
  const navigate = useNavigate();
  const { assessment } = useAssessment();

  // If no assessment exists (the patient hasn't completed onboarding), redirect.
  // We allow rendering if we have it.
  if (!assessment) {
    return <Navigate to="/" replace />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Health Journal', path: '/journal', icon: BookOpen },
    { name: 'Disease Prediction', path: '/predictions', icon: Activity },
    { name: 'Explainable AI', path: '/explainability', icon: BrainCog },
    { name: 'Risk Simulation', path: '/simulation', icon: Sliders },
    { name: 'Risk Trajectory', path: '/trajectory', icon: TrendingUp },
    { name: 'Care Plan', path: '/care-plan', icon: ShieldCheck },
    { name: 'Health Reports', path: '/reports', icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <HeartPulse className="h-6 w-6 text-primary mr-2" />
          <span className="font-semibold text-lg text-foreground tracking-tight">HealthTwin</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-border flex flex-col gap-3">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
              {assessment.patient.name.charAt(0)}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-foreground">{assessment.patient.name}</p>
              <p className="text-xs text-muted-foreground">Patient Profile</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/login')}
            className="flex w-full items-center px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors mt-2"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center px-4">
          <HeartPulse className="h-6 w-6 text-primary mr-2" />
          <span className="font-semibold text-lg">HealthTwin</span>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
