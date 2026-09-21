import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Users, BarChart, Settings, Stethoscope, LogOut } from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const navItems = [
    { name: 'Population Analytics', path: '/admin', icon: BarChart },
    { name: 'Patient Directory', path: '/admin/patients', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Admin Sidebar - darker theme for admin */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-slate-300 border-r border-slate-800">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Stethoscope className="h-6 w-6 text-blue-400 mr-2" />
          <span className="font-semibold text-lg text-white tracking-tight">HealthTwin Pro</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  end={item.path === '/admin'}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                      isActive
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => navigate('/login')}
            className="flex w-full items-center px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="h-16 border-b border-border bg-card flex items-center px-8 justify-between">
          <h2 className="font-semibold">Provider Portal</h2>
          <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-sm font-bold">
            DR
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
