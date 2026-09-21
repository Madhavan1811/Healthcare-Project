import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, PlusCircle, ArrowRight, Activity, Calendar, AlertCircle } from 'lucide-react';
import { useAssessment } from '@/hooks/useAssessment';
import { useState } from 'react';

export default function PatientWelcomePage() {
  const navigate = useNavigate();
  const { assessment } = useAssessment();
  const [errorMsg, setErrorMsg] = useState('');

  const handleViewReports = () => {
    if (!assessment) {
      setErrorMsg('No past computing reports found on file. Please generate a new Health Twin report to begin.');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 md:p-8">
      <div className="max-w-4xl mx-auto w-full space-y-10 mt-12">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-2">Welcome back, {assessment ? assessment.patient.name : 'Patient'}</h1>
          <p className="text-lg text-slate-500">What would you like to do today?</p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Option 1: New Assessment */}
          <Card className="hover:border-blue-400 group transition-all duration-300">
            <CardContent className="p-8 flex flex-col h-full">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl w-fit mb-6">
                <PlusCircle className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Generate New Report</h2>
              <p className="text-slate-500 mb-8 flex-1">
                Take a new assessment to update your digital twin with recent vitals, lab results, and lifestyle changes.
              </p>
              <Button onClick={() => navigate('/assessment')} className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700">
                Start Assessment <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: View Dashboard / Past Reports */}
          <Card className="hover:border-amber-400 group transition-all duration-300">
            <CardContent className="p-8 flex flex-col h-full">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit mb-6">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">View Past Reports</h2>
              <p className="text-slate-500 mb-4 flex-1">
                Access your existing HealthTwin dashboard, view your latest risk predictions, and review your actionable care plan.
              </p>
              
              {assessment ? (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center gap-3 mb-6">
                   <Calendar className="text-slate-400 w-5 h-5"/>
                   <div>
                     <p className="text-sm font-semibold text-slate-800">Last Assessment: {assessment.patient.lastUpdated}</p>
                     <p className="text-xs text-slate-500">Includes Heart, Stroke, & Diabetes Risk</p>
                   </div>
                </div>
              ) : errorMsg ? (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex items-start gap-3 mb-6">
                   <AlertCircle className="text-red-500 w-5 h-5 mt-0.5 min-w-5"/>
                   <p className="text-sm font-medium text-red-800">{errorMsg}</p>
                </div>
              ) : null}

              <Button 
                onClick={handleViewReports} 
                variant="outline" 
                className={`w-full text-lg py-6 border-2 transition-all ${!assessment ? 'hover:border-red-200 hover:text-red-600' : 'group-hover:border-slate-300 group-hover:bg-slate-50'}`}
              >
                Open Dashboard <Activity className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
