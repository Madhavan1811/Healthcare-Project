import { useState, useMemo } from 'react';
import { useAssessment } from '@/hooks/useAssessment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sliders, Activity, Heart, Brain, Scale } from 'lucide-react';

export default function SimulationPage() {
  const { assessment } = useAssessment();
  
  // Base weights for the sliders based on the patient's actual inputs, default to average if missing
  const [weightOffset, setWeightOffset] = useState(0);      // -20kg to +20kg
  const [exerciseLevel, setExerciseLevel] = useState(2);    // 0 to 4 (frequency)
  const [sleepHours, setSleepHours] = useState(7);          // 4 to 12 hours
  const [smokingOffset, setSmokingOffset] = useState(0);    // -100 to 100 on an abstract scale

  if (!assessment) return null;

  const hdBase = assessment.risks.heart?.riskPercentage || 20;
  const kdBase = assessment.risks.kidney?.riskPercentage || 20;
  const stBase = assessment.risks.stroke?.riskPercentage || 20;

  // Calculate heuristic modifiers based on sliders
  const modHd = useMemo(() => {
    return (weightOffset * 0.3) + ((2 - exerciseLevel) * 2.5) + (Math.abs(7 - sleepHours) * 0.8) + (smokingOffset * 0.1);
  }, [weightOffset, exerciseLevel, sleepHours, smokingOffset]);

  const modKd = useMemo(() => {
    return (weightOffset * 0.4) + ((2 - exerciseLevel) * 1.5) + (Math.abs(7 - sleepHours) * 0.4) + (smokingOffset * 0.05);
  }, [weightOffset, exerciseLevel, sleepHours, smokingOffset]);

  const modSt = useMemo(() => {
    return (weightOffset * 0.35) + ((2 - exerciseLevel) * 2.0) + (Math.abs(7 - sleepHours) * 1.0) + (smokingOffset * 0.15);
  }, [weightOffset, exerciseLevel, sleepHours, smokingOffset]);

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Simulate Lifestyle Changes
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl">
          Adjust the sliders below to see how hypothetical lifestyle choices could affect your estimated risk percent.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Controls Section */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="bg-slate-50 border-b pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-500" />
                Lifestyle Variables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
              
              {/* Weight Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold flex items-center gap-2">
                     <Scale className="w-4 h-4 text-slate-500" /> Weight Change
                  </label>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                    {weightOffset > 0 ? '+' : ''}{weightOffset} kg
                  </span>
                </div>
                <input 
                  type="range" min="-20" max="20" step="1" 
                  value={weightOffset} 
                  onChange={(e) => setWeightOffset(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                />
              </div>

              {/* Exercise Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold flex items-center gap-2">
                     <Activity className="w-4 h-4 text-slate-500" /> Exercise Frequency
                  </label>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                    {['None', 'Rarely', '1-2 Days', '3-4 Days', '5+ Days'][exerciseLevel]}
                  </span>
                </div>
                <input 
                  type="range" min="0" max="4" step="1" 
                  value={exerciseLevel} 
                  onChange={(e) => setExerciseLevel(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                />
              </div>

              {/* Sleep Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    Sleep 
                  </label>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                    {sleepHours} hrs
                  </span>
                </div>
                <input 
                  type="range" min="3" max="12" step="0.5" 
                  value={sleepHours} 
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                />
              </div>
              
              {/* Smoking Severity Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    Smoking / Vaping Exposure
                  </label>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                    {smokingOffset > 0 ? 'Increased' : smokingOffset < 0 ? 'Decreased' : 'Baseline'}
                  </span>
                </div>
                <input 
                  type="range" min="-30" max="30" step="1" 
                  value={smokingOffset} 
                  onChange={(e) => setSmokingOffset(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer" 
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button 
                  onClick={() => { setWeightOffset(0); setExerciseLevel(2); setSleepHours(7); setSmokingOffset(0); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium w-full text-center py-2"
                >
                  Reset to Baseline
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-7 space-y-4">
           {/* Heart Disease */}
           <Card className="border-red-100 shadow-sm relative overflow-hidden">
             <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400"></div>
             <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-50 p-3 rounded-full">
                      <Heart className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-slate-800">Heart Disease</p>
                      <p className="text-sm text-slate-500">Estimated probability</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-slate-800 flex items-center gap-2">
                      {Math.max(0.1, hdBase + modHd).toFixed(1)}%
                      {modHd !== 0 && (
                        <span className={`text-sm ${modHd > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({modHd > 0 ? '+' : ''}{modHd.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
             </CardContent>
           </Card>

           {/* Kidney Disease */}
           <Card className="border-amber-100 shadow-sm relative overflow-hidden">
             <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
             <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-50 p-3 rounded-full">
                      <Activity className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-slate-800">Kidney Disease</p>
                      <p className="text-sm text-slate-500">Estimated probability</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-slate-800 flex items-center gap-2">
                      {Math.max(0.1, kdBase + modKd).toFixed(1)}%
                      {modKd !== 0 && (
                        <span className={`text-sm ${modKd > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({modKd > 0 ? '+' : ''}{modKd.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
             </CardContent>
           </Card>

           {/* Stroke */}
           <Card className="border-blue-100 shadow-sm relative overflow-hidden">
             <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>
             <CardContent className="p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-3 rounded-full">
                      <Brain className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-slate-800">Stroke</p>
                      <p className="text-sm text-slate-500">Estimated probability</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold font-mono text-slate-800 flex items-center gap-2">
                      {Math.max(0.1, stBase + modSt).toFixed(1)}%
                      {modSt !== 0 && (
                        <span className={`text-sm ${modSt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                          ({modSt > 0 ? '+' : ''}{modSt.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
             </CardContent>
           </Card>

           <div className="mt-4 p-4 bg-indigo-50 text-indigo-800 text-sm rounded-lg border border-indigo-100">
             <strong>Disclaimer:</strong> This simulation is a heuristic demonstration computed locally on your device based on your initial verified ML assessment. It does not actively invoke the backend XGBoost model. 
           </div>

        </div>
      </div>
    </div>
  );
}
