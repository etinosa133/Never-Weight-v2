/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Clock, 
  History, 
  Plus, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  TrendingUp, 
  Target, 
  Utensils,
  Dumbbell,
  Users,
  Calendar,
  Trash2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { format, addMinutes, isWithinInterval, setHours, setMinutes, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type MachineStatus = 'Available' | 'In Use' | 'Reserved';
type GymName = 'SPAC' | 'Blomquist';

interface Machine {
  id: string;
  name: string;
  type: 'Cardio' | 'Strength' | 'Free Weights';
  status: MachineStatus;
}

interface GymData {
  machines: Machine[];
  crowdData: { hour: string; traffic: number }[];
}

interface Exercise {
  id: string;
  machineName: string;
  sets: number;
  reps: number;
  weight: number;
}

interface WorkoutSession {
  id: string;
  title: string;
  date: string;
  exercises: Exercise[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'alert';
}

// --- Mock Data ---

const GYM_DATA: Record<GymName, GymData> = {
  SPAC: {
    machines: [
      { id: 's1', name: 'Treadmill', type: 'Cardio', status: 'In Use' },
      { id: 's2', name: 'Treadmill', type: 'Cardio', status: 'Available' },
      { id: 's3', name: 'Treadmill', type: 'Cardio', status: 'In Use' },
      { id: 's4', name: 'Treadmill', type: 'Cardio', status: 'Available' },
      { id: 's5', name: 'Elliptical', type: 'Cardio', status: 'In Use' },
      { id: 's6', name: 'Elliptical', type: 'Cardio', status: 'Available' },
      { id: 's7', name: 'Squat Rack', type: 'Strength', status: 'Available' },
      { id: 's8', name: 'Squat Rack', type: 'Strength', status: 'In Use' },
      { id: 's9', name: 'Squat Rack', type: 'Strength', status: 'Reserved' },
      { id: 's10', name: 'Squat Rack', type: 'Strength', status: 'In Use' },
      { id: 's11', name: 'Leg Press', type: 'Strength', status: 'Available' },
      { id: 's12', name: 'Chest Press', type: 'Strength', status: 'In Use' },
    ],
    crowdData: [
      { hour: '6am', traffic: 20 }, { hour: '7am', traffic: 45 }, { hour: '8am', traffic: 70 },
      { hour: '9am', traffic: 60 }, { hour: '10am', traffic: 40 }, { hour: '11am', traffic: 30 },
      { hour: '12pm', traffic: 55 }, { hour: '1pm', traffic: 50 }, { hour: '2pm', traffic: 40 },
      { hour: '3pm', traffic: 65 }, { hour: '4pm', traffic: 85 }, { hour: '5pm', traffic: 95 },
      { hour: '6pm', traffic: 90 }, { hour: '7pm', traffic: 75 }, { hour: '8pm', traffic: 50 },
      { hour: '9pm', traffic: 30 }, { hour: '10pm', traffic: 15 },
    ]
  },
  Blomquist: {
    machines: [
      { id: 'b1', name: 'Treadmill', type: 'Cardio', status: 'Available' },
      { id: 'b2', name: 'Treadmill', type: 'Cardio', status: 'In Use' },
      { id: 'b3', name: 'Squat Rack', type: 'Strength', status: 'In Use' },
      { id: 'b4', name: 'Squat Rack', type: 'Strength', status: 'Available' },
      { id: 'b5', name: 'Dumbbell Bench', type: 'Free Weights', status: 'Available' },
      { id: 'b6', name: 'Lat Pulldown', type: 'Strength', status: 'In Use' },
    ],
    crowdData: [
      { hour: '6am', traffic: 10 }, { hour: '7am', traffic: 25 }, { hour: '8am', traffic: 40 },
      { hour: '9am', traffic: 35 }, { hour: '10am', traffic: 20 }, { hour: '11am', traffic: 15 },
      { hour: '12pm', traffic: 30 }, { hour: '1pm', traffic: 25 }, { hour: '2pm', traffic: 20 },
      { hour: '3pm', traffic: 45 }, { hour: '4pm', traffic: 60 }, { hour: '5pm', traffic: 75 },
      { hour: '6pm', traffic: 70 }, { hour: '7pm', traffic: 55 }, { hour: '8pm', traffic: 35 },
      { hour: '9pm', traffic: 20 }, { hour: '10pm', traffic: 10 },
    ]
  }
};

const INITIAL_SESSIONS: WorkoutSession[] = [
  { 
    id: 's1', 
    title: 'Push Day', 
    date: '2024-03-01', 
    exercises: [
      { id: 'e1', machineName: 'Chest Press', sets: 3, reps: 12, weight: 100 },
      { id: 'e2', machineName: 'Shoulder Press', sets: 3, reps: 10, weight: 60 }
    ]
  },
  { 
    id: 's2', 
    title: 'Leg Day', 
    date: '2024-02-28', 
    exercises: [
      { id: 'e3', machineName: 'Leg Press', sets: 4, reps: 10, weight: 250 }
    ]
  },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Machine Available', message: 'Squat Rack 01 is now free!', time: '2m ago', type: 'success' },
  { id: 'n2', title: 'Goal Update', message: 'You are on a 5-day streak! Keep it up.', time: '1h ago', type: 'info' },
];

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'status' | 'notifications' | 'log' | 'goals'>('status');
  const [selectedGym, setSelectedGym] = useState<GymName>('SPAC');
  const [machines, setMachines] = useState<Machine[]>(GYM_DATA.SPAC.machines);
  const [sessions, setSessions] = useState<WorkoutSession[]>(INITIAL_SESSIONS);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userGoals, setUserGoals] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newExercises, setNewExercises] = useState<Exercise[]>([]);

  // Update machines when gym changes
  useEffect(() => {
    setMachines(GYM_DATA[selectedGym].machines);
  }, [selectedGym]);

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Central Time Zone Logic
  const timeZone = 'America/Chicago';
  const zonedTime = useMemo(() => toZonedTime(currentTime, timeZone), [currentTime]);
  const currentHour = zonedTime.getHours();
  const currentMinute = zonedTime.getMinutes();
  const dayOfWeek = zonedTime.getDay(); // 0 = Sunday, 6 = Saturday

  // Gym Status Logic
  const gymStatus = useMemo(() => {
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const openHour = isWeekend ? 8 : 6;
    const closeHour = isWeekend ? 21 : 23;

    const nowMinutes = currentHour * 60 + currentMinute;
    const openMinutes = openHour * 60;
    const closeMinutes = closeHour * 60;

    if (nowMinutes < openMinutes - 15) return 'Closed';
    if (nowMinutes >= openMinutes - 15 && nowMinutes < openMinutes) return 'Opening in 15m';
    if (nowMinutes >= openMinutes && nowMinutes < closeMinutes - 15) return 'Open';
    if (nowMinutes >= closeMinutes - 15 && nowMinutes < closeMinutes) return 'Closing in 15m';
    return 'Closed';
  }, [currentHour, currentMinute, dayOfWeek]);

  const handleNotifyMe = (machineName: string) => {
    // Find the first machine of this name that isn't available
    const machineToNotify = machines.find(m => m.name === machineName && m.status !== 'Available');
    if (!machineToNotify) return;

    setMachines(prev => prev.map(m => {
      if (m.id === machineToNotify.id) {
        const newStatus = m.status === 'Reserved' ? 'In Use' : 'Reserved';
        if (newStatus === 'Reserved') {
          setNotifications(prevN => [
            { 
              id: Date.now().toString(), 
              title: 'Notification Set', 
              message: `You'll be notified when a ${machineName} is available.`, 
              time: 'Just now', 
              type: 'info' 
            },
            ...prevN
          ]);
        }
        return { ...m, status: newStatus };
      }
      return m;
    }));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const generateAiSuggestion = async () => {
    if (!userGoals.trim()) return;
    
    setIsGenerating(true);
    try {
      const workoutHistory = sessions.map(s => 
        `${s.date} - ${s.title}:\n` + s.exercises.map(e => `  ${e.machineName} (${e.sets}x${e.reps} @ ${e.weight}lb)`).join('\n')
      ).join('\n\n');
      
      const prompt = `Based on the following gym goals: "${userGoals}" and workout history:\n${workoutHistory}\n\nProvide 3 specific, actionable workout suggestions or adjustments to help reach these goals. Keep it concise and encouraging.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      
      setAiSuggestion(response.text || 'No suggestion available at this time.');
    } catch (error) {
      console.error('AI Generation Error:', error);
      setAiSuggestion('Failed to generate suggestions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const startNewSession = () => {
    setNewSessionTitle('');
    setNewExercises([{ id: Date.now().toString(), machineName: '', sets: 0, reps: 0, weight: 0 }]);
    setIsAddingSession(true);
  };

  const addExerciseToNewSession = () => {
    setNewExercises([...newExercises, { id: Date.now().toString(), machineName: '', sets: 0, reps: 0, weight: 0 }]);
  };

  const updateNewExercise = (id: string, field: keyof Exercise, value: string | number) => {
    setNewExercises(prev => prev.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const saveSession = () => {
    if (!newSessionTitle.trim()) return;
    
    const newSession: WorkoutSession = {
      id: Date.now().toString(),
      title: newSessionTitle,
      date: format(zonedTime, 'yyyy-MM-dd'),
      exercises: newExercises.filter(e => e.machineName.trim() !== ''),
    };
    
    setSessions([newSession, ...sessions]);
    setIsAddingSession(false);
    
    setNotifications(prev => [
      {
        id: Date.now().toString(),
        title: 'Workout Saved',
        message: `Your session "${newSessionTitle}" has been logged.`,
        time: 'Just now',
        type: 'success'
      },
      ...prev
    ]);
  };

  // Group machines for summary display
  const groupedMachines = useMemo(() => {
    const groups: Record<string, { type: string; available: number; total: number; status: MachineStatus }> = {};
    machines.forEach(m => {
      if (!groups[m.name]) {
        groups[m.name] = { type: m.type, available: 0, total: 0, status: 'In Use' };
      }
      groups[m.name].total++;
      if (m.status === 'Available') groups[m.name].available++;
      
      // If any machine of this type is reserved by user, mark group as reserved
      if (m.status === 'Reserved') groups[m.name].status = 'Reserved';
    });
    return Object.entries(groups).map(([name, data]) => ({
      name,
      ...data,
      displayStatus: data.available > 0 ? 'Available' : (data.status === 'Reserved' ? 'Reserved' : 'In Use')
    }));
  }, [machines]);

  return (
    <div className="min-h-screen bg-[#F3F0FF] text-[#1A1A1A] font-sans pb-32">
      {/* Header Section */}
      <header className="bg-white border-b border-purple-100 px-6 py-8 sticky top-0 z-50 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-light tracking-tight text-purple-900">
              <span className="font-bold">N</span>ever<span className="font-bold">W</span>eight
            </h1>
            <p className="text-sm text-purple-400 mt-1 uppercase tracking-widest font-medium">Reach your Gym Goals • Northwestern</p>
            
            {/* Gym Switcher */}
            <div className="flex bg-purple-50 p-1 rounded-xl mt-4 w-fit border border-purple-100">
              {(['SPAC', 'Blomquist'] as GymName[]).map((gym) => (
                <button
                  key={gym}
                  onClick={() => setSelectedGym(gym)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    selectedGym === gym 
                      ? "bg-purple-600 text-white shadow-md" 
                      : "text-purple-400 hover:text-purple-600"
                  )}
                >
                  {gym}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
              <span className="text-xl">🔥</span>
              <span className="text-lg font-bold font-mono text-purple-700">5</span>
            </div>
            <div className="text-2xl font-sans font-medium uppercase tracking-widest text-purple-900">
              {format(zonedTime, 'h:mm a')}
            </div>
            <div className={cn(
              "text-xs font-bold uppercase tracking-wider mt-1 px-3 py-1 rounded-full inline-block shadow-sm",
              gymStatus === 'Open' ? "bg-purple-600 text-white" : 
              gymStatus.includes('15m') ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
            )}>
              {gymStatus}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 pt-8 space-y-10">
        
        {/* Tab Content */}
        {activeTab === 'status' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {/* Crowd Forecast Section */}
            <section id="crowd-forecast">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-xl font-medium text-purple-900">Crowd Forecast</h2>
                  <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">
                    Status: <span className={cn(
                      gymStatus === 'Open' ? "text-purple-600" : 
                      gymStatus.includes('15m') ? "text-amber-500" : "text-rose-500"
                    )}>{gymStatus}</span>
                  </p>
                </div>
                <span className="text-xs text-purple-400 font-mono uppercase">Live Traffic</span>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-purple-50 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={GYM_DATA[selectedGym].crowdData}>
                    <XAxis 
                      dataKey="hour" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#A78BFA' }}
                      interval={2}
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-purple-900 text-white px-3 py-1 rounded-full text-xs font-mono shadow-lg">
                              {payload[0].value}% capacity
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="traffic" radius={[4, 4, 4, 4]}>
                      {GYM_DATA[selectedGym].crowdData.map((entry, index) => {
                        const hourNum = parseInt(entry.hour);
                        const isPM = entry.hour.includes('pm');
                        const adjustedHour = isPM && hourNum !== 12 ? hourNum + 12 : (!isPM && hourNum === 12 ? 0 : hourNum);
                        const isCurrent = adjustedHour === currentHour;
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={isCurrent ? '#7C3AED' : '#F3E8FF'} 
                            className={isCurrent ? "animate-pulse" : ""}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Machine Tracking Section */}
            <section id="machine-tracking">
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-xl font-medium text-purple-900">Floor Status</h2>
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span> Available
                  <span className="w-2 h-2 rounded-full bg-rose-500 ml-2"></span> Busy
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {groupedMachines.map((group) => (
                  <div 
                    key={group.name}
                    className="bg-white p-4 rounded-2xl border border-purple-50 flex items-center justify-between group hover:border-purple-200 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        group.available > 0 ? "bg-purple-50 text-purple-600" : 
                        group.displayStatus === 'Reserved' ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {group.type === 'Cardio' ? <Activity size={20} /> : <Dumbbell size={20} />}
                      </div>
                      <div>
                        <h3 className="font-medium text-sm text-purple-900">{group.name}</h3>
                        <p className="text-xs text-purple-400 font-mono">{group.available}/{group.total} Available</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        group.available > 0 ? "text-purple-500" : 
                        group.displayStatus === 'Reserved' ? "text-indigo-500" : "text-rose-500"
                      )}>
                        {group.available > 0 ? 'Available' : (group.displayStatus === 'Reserved' ? 'Reserved' : 'Busy')}
                      </span>
                      {group.available === 0 && (
                        <button 
                          onClick={() => handleNotifyMe(group.name)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                            group.displayStatus === 'Reserved' ? "bg-purple-600 text-white shadow-md" : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                          )}
                        >
                          <Bell size={12} />
                          {group.displayStatus === 'Reserved' ? 'Notifying' : 'Notify Me'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-medium text-purple-900">Notifications</h2>
              {notifications.length > 0 && (
                <button 
                  onClick={clearNotifications}
                  className="flex items-center gap-2 text-xs text-rose-500 font-bold uppercase tracking-widest hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Trash2 size={14} />
                  Clear All
                </button>
              )}
            </div>
            
            {notifications.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-purple-50 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
                <div className="bg-purple-50 p-4 rounded-2xl text-purple-200">
                  <Bell size={48} />
                </div>
                <div>
                  <h3 className="font-medium text-purple-900">All caught up!</h3>
                  <p className="text-sm text-purple-400">No new notifications at the moment.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="bg-white p-4 rounded-2xl border border-purple-50 flex gap-4 items-start shadow-sm">
                    <div className={cn(
                      "mt-1",
                      n.type === 'success' ? "text-purple-500" : n.type === 'alert' ? "text-rose-500" : "text-purple-400"
                    )}>
                      {n.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-purple-900">{n.title}</h4>
                        <span className="text-[10px] text-purple-300 font-mono">{n.time}</span>
                      </div>
                      <p className="text-xs text-purple-600/70 mt-0.5">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'log' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-medium text-purple-900">Workout Sessions</h2>
              <button 
                onClick={startNewSession}
                className="bg-purple-600 text-white px-4 py-2 rounded-2xl flex items-center gap-2 hover:scale-105 transition-transform shadow-md font-bold text-xs uppercase tracking-widest"
              >
                <Plus size={16} />
                New Session
              </button>
            </div>

            <div className="space-y-6">
              {sessions.map((session) => (
                <div key={session.id} className="bg-white p-6 rounded-3xl border border-purple-50 space-y-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-purple-900">{session.title}</h3>
                      <p className="text-xs text-purple-400 font-mono">{session.date}</p>
                    </div>
                    <div className="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-purple-100">
                      {session.exercises.length} Exercises
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {session.exercises.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between py-2 border-t border-purple-50 first:border-t-0">
                        <div>
                          <p className="text-sm font-medium text-purple-900">{ex.machineName}</p>
                          <p className="text-[10px] text-purple-400 font-mono uppercase">
                            {ex.sets} Sets • {ex.reps} Reps
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-purple-600 font-mono">{ex.weight}lb</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Streak Feature */}
            <div className="bg-purple-600 p-6 rounded-3xl text-white flex items-center justify-between shadow-lg">
              <div>
                <h3 className="text-lg font-medium">5 Day Streak!</h3>
                <p className="text-purple-100 text-sm">You're in the top 10% of SPAC members this week.</p>
              </div>
              <div className="bg-white/20 p-3 rounded-2xl">
                <TrendingUp size={24} />
              </div>
            </div>
          </motion.div>
        )}

        {/* New Session Modal */}
        <AnimatePresence>
          {isAddingSession && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddingSession(false)}
                className="absolute inset-0 bg-purple-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="relative bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-8 space-y-6 overflow-y-auto">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-purple-900">Log Session</h2>
                    <button 
                      onClick={() => setIsAddingSession(false)}
                      className="text-purple-300 hover:text-purple-600"
                    >
                      <Plus size={24} className="rotate-45" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-2 block">Session Name</label>
                      <input 
                        type="text" 
                        value={newSessionTitle}
                        onChange={(e) => setNewSessionTitle(e.target.value)}
                        placeholder="e.g., Upper Body, Leg Day..."
                        className="w-full bg-purple-50 border border-purple-100 rounded-2xl px-4 py-3 text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Exercises</label>
                        <button 
                          onClick={addExerciseToNewSession}
                          className="text-purple-600 text-xs font-bold flex items-center gap-1"
                        >
                          <Plus size={14} /> Add Exercise
                        </button>
                      </div>

                      {newExercises.map((ex, index) => (
                        <div key={ex.id} className="bg-purple-50/50 p-4 rounded-3xl border border-purple-100 space-y-3">
                          <input 
                            type="text" 
                            placeholder="Machine / Exercise Name"
                            value={ex.machineName}
                            onChange={(e) => updateNewExercise(ex.id, 'machineName', e.target.value)}
                            className="w-full bg-white border border-purple-100 rounded-xl px-3 py-2 text-sm text-purple-900 focus:outline-none"
                          />
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 mb-1 block">Sets</label>
                              <input 
                                type="number" 
                                value={ex.sets}
                                onChange={(e) => updateNewExercise(ex.id, 'sets', parseInt(e.target.value) || 0)}
                                className="w-full bg-white border border-purple-100 rounded-xl px-3 py-2 text-sm text-purple-900 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 mb-1 block">Reps</label>
                              <input 
                                type="number" 
                                value={ex.reps}
                                onChange={(e) => updateNewExercise(ex.id, 'reps', parseInt(e.target.value) || 0)}
                                className="w-full bg-white border border-purple-100 rounded-xl px-3 py-2 text-sm text-purple-900 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-bold uppercase tracking-widest text-purple-400 mb-1 block">Weight (lb)</label>
                              <input 
                                type="number" 
                                value={ex.weight}
                                onChange={(e) => updateNewExercise(ex.id, 'weight', parseInt(e.target.value) || 0)}
                                className="w-full bg-white border border-purple-100 rounded-xl px-3 py-2 text-sm text-purple-900 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-purple-50 border-t border-purple-100">
                  <button 
                    onClick={saveSession}
                    disabled={!newSessionTitle.trim() || newExercises.length === 0}
                    className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50"
                  >
                    Save Workout Session
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {activeTab === 'goals' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-medium text-purple-900">Gym Goals</h2>
            
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-purple-50 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-50 text-purple-600 p-2 rounded-xl">
                    <Target size={20} />
                  </div>
                  <h3 className="font-medium text-purple-900">What are you working towards?</h3>
                </div>
                <div className="space-y-4">
                  <textarea 
                    value={userGoals}
                    onChange={(e) => setUserGoals(e.target.value)}
                    placeholder="e.g., Increase bench press by 20lb, run a 5k under 25 mins, or build more upper body strength..."
                    className="w-full h-32 bg-purple-50/50 border border-purple-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none placeholder:text-purple-300"
                  />
                  <button 
                    onClick={generateAiSuggestion}
                    disabled={isGenerating || !userGoals.trim()}
                    className="w-full bg-purple-600 text-white py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Generating Suggestions...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        Get AI Suggestions
                      </>
                    )}
                  </button>
                </div>
              </div>

              {aiSuggestion && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-purple-900 p-6 rounded-3xl text-white space-y-4 shadow-xl border border-purple-800"
                >
                  <div className="flex items-center gap-2 text-purple-300">
                    <Sparkles size={18} />
                    <h3 className="font-bold uppercase tracking-widest text-[10px]">AI Recommendations</h3>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <p className="text-purple-100 leading-relaxed whitespace-pre-wrap">
                      {aiSuggestion}
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-purple-100 px-6 py-4 flex justify-between items-center z-50 shadow-[0_-4px_20px_rgba(124,58,237,0.1)]">
        <button 
          onClick={() => setActiveTab('status')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'status' ? "text-purple-600 scale-110" : "text-purple-300 hover:text-purple-400"
          )}
        >
          <Users size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Status</span>
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'notifications' ? "text-purple-600 scale-110" : "text-purple-300 hover:text-purple-400"
          )}
        >
          <div className="relative">
            <Bell size={24} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white shadow-sm"></span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Alerts</span>
        </button>
        <button 
          onClick={() => setActiveTab('log')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'log' ? "text-purple-600 scale-110" : "text-purple-300 hover:text-purple-400"
          )}
        >
          <Calendar size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Log</span>
        </button>
        <button 
          onClick={() => setActiveTab('goals')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'goals' ? "text-purple-600 scale-110" : "text-purple-300 hover:text-purple-400"
          )}
        >
          <Target size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
        </button>
      </nav>
    </div>
  );
}
