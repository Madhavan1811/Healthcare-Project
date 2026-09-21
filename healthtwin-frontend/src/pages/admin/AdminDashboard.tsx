import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, AlertTriangle, FileText } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Population Analytics
        </h1>
        <p className="text-muted-foreground text-lg">
          Overview of clinical analytics across all connected HealthTwin profiles.
        </p>
      </header>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Patients</p>
              <h3 className="text-2xl font-bold text-foreground">1,248</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-full">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Recently Assessed</p>
              <h3 className="text-2xl font-bold text-foreground">156</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-full">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">High Risk Flagged</p>
              <h3 className="text-2xl font-bold text-foreground">84</h3>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">Pending Review</p>
              <h3 className="text-2xl font-bold text-foreground">23</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="min-h-[400px]">
          <CardHeader>
            <CardTitle>Risk Distribution (Overall)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground border-2 border-dashed border-border rounded-xl mx-6 mb-6">
            Chart Placeholder: Distribution (Low/Med/Elevated/High)
          </CardContent>
        </Card>
        
        <Card className="min-h-[400px]">
          <CardHeader>
            <CardTitle>Disease Prevalence Trends</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground border-2 border-dashed border-border rounded-xl mx-6 mb-6">
            Chart Placeholder: Heart vs Diabetes vs Stroke
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
