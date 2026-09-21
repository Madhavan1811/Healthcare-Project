import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HeartPulse, Stethoscope, User } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<'patient' | 'doctor' | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'doctor') {
      navigate('/admin');
    } else if (role === 'patient') {
      navigate('/welcome');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="absolute top-8 left-8 flex items-center">
        <HeartPulse className="h-8 w-8 text-blue-600 mr-2" />
        <span className="font-bold text-xl text-slate-800 tracking-tight">HealthTwin</span>
      </div>

      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h1>
          <p className="text-slate-500">Please select your profile type to continue.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card 
            className={`cursor-pointer transition-all ${role === 'patient' ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-blue-300'}`}
            onClick={() => setRole('patient')}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className={`p-3 rounded-full ${role === 'patient' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <User className="w-6 h-6" />
              </div>
              <span className="font-medium text-slate-800">Patient</span>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${role === 'doctor' ? 'border-slate-900 bg-slate-900 text-white ring-2 ring-slate-900/20' : 'border-slate-200 hover:border-slate-300'}`}
            onClick={() => setRole('doctor')}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className={`p-3 rounded-full ${role === 'doctor' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
                <Stethoscope className="w-6 h-6" />
              </div>
              <span className={`font-medium ${role === 'doctor' ? 'text-white' : 'text-slate-800'}`}>Doctor</span>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <input 
              type="email" 
              value={role === 'doctor' ? 'dr.smith@hospital.org' : role === 'patient' ? 'shebin@example.com' : ''}
              readOnly
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-600"
            />
          </div>
          <div className="space-y-2">
             <label className="text-sm font-medium text-slate-700">Password</label>
            <input 
              type="password" 
              value="********"
              readOnly
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-600"
            />
          </div>
          
          <Button 
            type="submit" 
            className={`w-full py-6 text-lg mt-4 ${role === 'doctor' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'}`}
            disabled={!role}
          >
            Sign In securely
          </Button>
        </form>
      </div>
    </div>
  );
}
