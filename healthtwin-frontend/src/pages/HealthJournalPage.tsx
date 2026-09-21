import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, Calendar } from 'lucide-react';

export default function HealthJournalPage() {
  const [entries] = useState([
    { id: 1, date: 'Sept 20, 2026', time: '08:30 AM', title: 'Morning Blood Pressure', notes: 'Reading was 120/80. Feeling energized.' },
    { id: 2, date: 'Sept 19, 2026', time: '07:00 PM', title: 'Evening Walk', notes: 'Completed 5km walk as suggested in the care plan.' }
  ]);

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Health Journal
          </h1>
          <p className="text-muted-foreground text-lg">
            Track daily symptoms, vitals, and lifestyle changes to keep your digital twin updated.
          </p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4"/> New Entry</Button>
      </header>

      <div className="space-y-4">
        {entries.map(entry => (
          <Card key={entry.id} className="border-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary"/> {entry.title}</CardTitle>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {entry.date} at {entry.time}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 text-slate-700">
              {entry.notes}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
