import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, SlidersHorizontal, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const mockPatientsList = [
  { id: 'PT-8429', name: 'Shebin', age: 45, lastAssessment: 'Today', overall: 'moderate', mainRisk: 'Heart Disease', status: 'Stable', triage: 'routine' },
  { id: 'PT-8430', name: 'Maria G.', age: 62, lastAssessment: 'Yesterday', overall: 'high', mainRisk: 'Stroke', status: 'Action Required', triage: 'urgent' },
  { id: 'PT-8431', name: 'David L.', age: 38, lastAssessment: 'Oct 12', overall: 'low', mainRisk: 'None', status: 'Stable', triage: 'routine' },
  { id: 'PT-8432', name: 'Sarah K.', age: 55, lastAssessment: 'Oct 10', overall: 'elevated', mainRisk: 'Diabetes', status: 'Reviewed', triage: 'watch' },
  { id: 'PT-8433', name: 'James W.', age: 71, lastAssessment: 'Oct 05', overall: 'high', mainRisk: 'Heart Disease', status: 'Action Required', triage: 'urgent' }
];

export default function AdminPatients() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Patient Directory
          </h1>
          <p className="text-muted-foreground text-lg">
            Search and review individual patient profiles and digital twin assessments.
          </p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">Add Patient</Button>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search patients by name or ID..." 
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:ring-2 focus:ring-blue-600 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto"><SlidersHorizontal className="w-4 h-4 mr-2" /> Filter</Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Triage</th>
                <th className="px-6 py-4">Age</th>
                <th className="px-6 py-4">Last Assessment</th>
                <th className="px-6 py-4">Overall Risk</th>
                <th className="px-6 py-4">Primary Risk</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {mockPatientsList.map((p) => (
                <tr 
                  key={p.id} 
                  onClick={() => navigate(`/admin/patients/${p.id}`)}
                  className="border-b border-border/5last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    {p.triage === 'urgent' && <span className="flex items-center text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full w-fit"><AlertCircle className="w-3 h-3 mr-1"/> Urgent</span>}
                    {p.triage === 'watch' && <span className="flex items-center text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded-full w-fit">Watch</span>}
                    {p.triage === 'routine' && <span className="flex items-center text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full w-fit">Routine</span>}
                  </td>
                  <td className="px-6 py-4">{p.age} yrs</td>
                  <td className="px-6 py-4">{p.lastAssessment}</td>
                  <td className="px-6 py-4">
                    <Badge severity={p.overall as any} className="capitalize px-2 py-0.5">{p.overall}</Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{p.mainRisk}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${p.status === 'Action Required' ? 'bg-red-100/50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="icon" className="hover:bg-slate-200/50">
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Showing 1 to 5 of 1,248 entries</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm">Next</Button>
        </div>
      </div>
    </div>
  );
}
