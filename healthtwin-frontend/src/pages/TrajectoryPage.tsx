import { useState } from 'react';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function TrajectoryPage() {
  const { assessment } = useAssessment();
  const [selectedCondition, setSelectedCondition] = useState<'heart' | 'diabetes' | 'stroke'>('heart');

  if (!assessment) return null;

  const data = assessment.trajectory.map(t => ({
    name: t.month === 0 ? 'Now' : `${t.month} mo`,
    Heart: t.heart,
    Diabetes: t.diabetes,
    Stroke: t.stroke
  }));

  const conditionColors = {
    heart: '#e11d48',
    diabetes: '#0284c7',
    stroke: '#8b5cf6'
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Risk Trajectory
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Observe how your risk is projected to change over time based on current trajectory models.
        </p>
      </header>

      <div className="flex space-x-2 border-b border-border pb-px overflow-x-auto">
        {(['heart', 'diabetes', 'stroke'] as const).map(condition => (
          <button
            key={condition}
            onClick={() => setSelectedCondition(condition)}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors capitalize ${
              selectedCondition === condition
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {condition} Disease
          </button>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="capitalize">{selectedCondition} Risk Projection (12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'currentColor', opacity: 0.5 }} 
                  dy={10} 
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: 'currentColor', opacity: 0.5 }}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }} 
                />
                <Legend iconType="circle" />
                <Line 
                  type="monotone" 
                  dataKey={selectedCondition.charAt(0).toUpperCase() + selectedCondition.slice(1)} 
                  stroke={conditionColors[selectedCondition]} 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: conditionColors[selectedCondition], strokeWidth: 2, stroke: 'hsl(var(--card))' }} 
                  activeDot={{ r: 8, stroke: 'hsl(var(--primary))', strokeWidth: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-8 bg-accent/20 p-4 rounded-lg flex items-start">
            <div className="mr-4 mt-1 bg-background p-2 rounded-full shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Clinical Assumption</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This projection assumes no significant changes in your current lifestyle and medical interventions. 
                Implementing the care plan recommendations can alter this trajectory, promoting stability or reduction.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
