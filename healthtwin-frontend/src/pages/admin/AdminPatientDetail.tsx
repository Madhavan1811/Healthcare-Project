import { useParams, useNavigate } from 'react-router-dom';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Save, Activity, Heart, Brain, FileText, Send, Printer } from 'lucide-react';
import { useState } from 'react';

export default function AdminPatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assessment } = useAssessment();
  
  const [notes, setNotes] = useState('Patient discussed experiencing slight fatigue in the evenings. Blood pressure medication adhereance is good. Recommended continuing current exercise regimen but avoid high-intensity workouts immediately after meals.');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Use the global assessment data for this mockup
  if (!assessment) return null;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <button onClick={() => navigate('/admin/patients')} className="hover:text-primary flex items-center transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
        </button>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {assessment.patient.name}
            </h1>
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Urgent Triage</Badge>
          </div>
          <p className="text-muted-foreground">
            ID: {id} | {assessment.patient.age} yrs | {assessment.patient.gender} | Last Updated: {assessment.patient.lastUpdated}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Send className="w-4 h-4" /> Message Patient
          </Button>
          <Button variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Generate Referral
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2 text-white">
            <Save className="w-4 h-4" /> Save Changes
          </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Column: Vitals & Notes */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Clinical Vitals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Height</div>
                  <div className="font-semibold">{assessment.patient.height} cm</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Weight</div>
                  <div className="font-semibold">{assessment.patient.weight} kg</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">BMI</div>
                  <div className="font-semibold">{((assessment.patient.weight) / ((assessment.patient.height/100) * (assessment.patient.height/100))).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Smoker</div>
                  <div className="font-semibold">{assessment.patient.smoking ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[300px]">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600"/> Clinical Notes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsEditingNotes(!isEditingNotes)}>
                {isEditingNotes ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              {isEditingNotes ? (
                <textarea 
                  className="w-full h-full p-3 border rounded-md resize-none focus:ring-2 focus:ring-blue-600 outline-none"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-md h-full text-sm text-slate-700 leading-relaxed overflow-y-auto">
                  {notes}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Middle & Right Column: Risk & Care Plan */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Risk Overview */}
          <div className="grid md:grid-cols-3 gap-4">
            {Object.values(assessment.risks).map((risk) => (
               <Card key={risk.disease} className="border-border">
                <CardContent className="p-5 flex flex-col items-center text-center">
                   <div className={`p-3 rounded-full mb-3 ${risk.disease === 'Heart Disease' ? 'bg-red-100 text-red-600' : risk.disease === 'Stroke' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                     {risk.disease === 'Heart Disease' ? <Heart className="w-6 h-6" /> : risk.disease === 'Stroke' ? <Brain className="w-6 h-6" /> : <Activity className="w-6 h-6" />}
                   </div>
                   <h3 className="font-semibold mb-1">{risk.disease}</h3>
                   <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-slate-800 to-slate-500 mb-2">
                     {risk.riskPercentage}%
                   </div>
                   <Badge severity={risk.riskLevel} className="capitalize text-xs px-2 py-0.5">{risk.riskLevel} Risk</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

           {/* Care Plan Override */}
           <Card>
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Care Plan Override</CardTitle>
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-md">Patient Visibility: Pending</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {assessment.carePlan.map((action) => (
                <div key={action.id} className="flex items-start gap-4 p-3 border border-border/50 rounded-lg bg-slate-50/50">
                  <div className="pt-1">
                     <input type="checkbox" defaultChecked={action.type === 'doctor-reviewed'} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-slate-900">{action.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{action.description}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${action.type === 'ai-generated' ? 'text-purple-600 bg-purple-50 border-purple-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>
                    {action.type === 'ai-generated' ? 'AI Proposed' : 'Approved'}
                  </Badge>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full border-dashed"><span className="mr-2">+</span> Add Custom Recommendation</Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
