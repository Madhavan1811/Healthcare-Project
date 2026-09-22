import { useState } from 'react';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';

export default function TrajectoryPage() {
  const { assessment } = useAssessment();
  const [followPlan, setFollowPlan] = useState(false);

  if (!assessment) return null;

  // Generate 12 months of projection data using the baseline risks
  const data = [];
  const currentDate = new Date();
  
  const hdBase = assessment.risks.heart?.riskPercentage || 20;
  const kdBase = assessment.risks.kidney?.riskPercentage || 20;
  const stBase = assessment.risks.stroke?.riskPercentage || 20;

  for (let i = 0; i <= 12; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const monthStr = d.toLocaleString('default', { month: 'short' });
    
    // Heuristic: If following plan, risk drops by 0.5 - 1% per month. 
    // If NOT following plan, risk goes up by 0.2% - 0.5% per month.
    const modifier = followPlan ? (i * -0.8) : (i * 0.3);
    
    data.push({
      name: monthStr,
      heart_disease: Math.max(1, hdBase + modifier + (Math.random() * 0.5)).toFixed(1),
      kidney_disease: Math.max(1, kdBase + (modifier * 0.7) + (Math.random() * 0.5)).toFixed(1),
      stroke: Math.max(1, stBase + (modifier * 1.1) + (Math.random() * 0.5)).toFixed(1),
    });
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Risk Trajectory
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          See how your estimated risk profile may change over the next 12 months based on your actions.
        </p>
      </header>

      <div className="flex justify-end items-center gap-4">
         <span className="text-sm font-medium">Scenario:</span>
         <div className="bg-slate-100 p-1 rounded-md flex">
           <Button 
             variant={!followPlan ? "default" : "ghost"} 
             size="sm" 
             onClick={() => setFollowPlan(false)}
           >
             No Lifestyle Changes
           </Button>
           <Button 
             variant={followPlan ? "default" : "ghost"} 
             size="sm"
             onClick={() => setFollowPlan(true)}
             className={followPlan ? "bg-green-600 hover:bg-green-700 text-white" : ""}
           >
             Following Care Plan
           </Button>
         </div>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-3 bg-accent/10">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">12-Month Projected Risk Trajectory</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip 
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Legend iconType="circle" />
                <Line 
                  type="monotone" 
                  name="Heart Disease" 
                  dataKey="heart_disease" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6 }} 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  name="Kidney Disease" 
                  dataKey="kidney_disease" 
                  stroke="#eab308" 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6 }} 
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  name="Stroke" 
                  dataKey="stroke" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4 }} 
                  activeDot={{ r: 6 }} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 p-4 bg-blue-50 text-blue-800 rounded-md border border-blue-200 text-sm">
            <strong>Simulation Note:</strong> This is a heuristic projection calculated in the browser based on your initial ML assessment. It estimates that consistently following the recommended care plan (Diet, Exercise, Medication adherence) can reduce disease probabilities by ~8-12% over a year.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
