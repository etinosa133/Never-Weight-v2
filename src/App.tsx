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
  Calendar
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type MachineStatus = 'Available' | 'In Use' | 'Reserved';

interface Machine {
  id: string;
  name: string;
  type: 'Cardio' | 'Strength' | 'Free Weights';
  status: MachineStatus;
  lastUsed?: string;
}

interface WorkoutLog {
  id: string;
  date: string;
  machineName: string;
  sets: number;
  reps: number;
  weight: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'alert';
}

// --- Mock Data ---

const INITIAL_MACHINES: Machine[] = [
  { id: '1', name: 'Treadmill 01', type: 'Cardio', status: 'In Use' },
  { id: '2', name: 'Treadmill 02', type: 'Cardio', status: 'Available' },
  { id: '3', name: 'Elliptical 01', type: 'Cardio', status: 'In Use' },
  { id: '4', name: 'Leg Press', type: 'Strength', status: 'Available' },
  { id: '5', name: 'Chest Press', type: 'Strength', status: 'In Use' },
  { id: '6', name: 'Squat Rack 01', type: 'Strength', status: 'Reserved' },
  { id: '7', name: 'Dumbbell Bench 01', type: 'Free Weights', status: 'Available' },
  { id: '8', name: 'Lat Pulldown', type: 'Strength', status: 'In Use' },
];

const CROWD_FORECAST_DATA = [
  { hour: '6am', traffic: 20 },
  { hour: '7am', traffic: 45 },
  { hour: '8am', traffic: 70 },
  { hour: '9am', traffic: 60 },
  { hour: '10am', traffic: 40 },
  { hour: '11am', traffic: 30 },
  { hour: '12pm', traffic: 55 },
  { hour: '1pm', traffic: 50 },
  { hour: '2pm', traffic: 40 },
  { hour: '3pm', traffic: 65 },
  { hour: '4pm', traffic: 85 },
  { hour: '5pm', traffic: 95 },
  { hour: '6pm', traffic: 90 },
  { hour: '7pm', traffic: 75 },
  { hour: '8pm', traffic: 50 },
  { hour: '9pm', traffic: 30 },
  { hour: '10pm', traffic: 15 },
];

const INITIAL_LOGS: WorkoutLog[] = [
  { id: 'l1', date: '2024-03-01', machineName: 'Chest Press', sets: 3, reps: 12, weight: 100 },
  { id: 'l2', date: '2024-03-01', machineName: 'Leg Press', sets: 4, reps: 10, weight: 250 },
  { id: 'l3', date: '2024-02-28', machineName: 'Treadmill 01', sets: 1, reps: 1, weight: 0 },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'Machine Available', message: 'Squat Rack 01 is now free!', time: '2m ago', type: 'success' },
  { id: 'n2', title: 'Goal Update', message: 'You are on a 5-day streak! Keep it up.', time: '1h ago', type: 'info' },
];

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'status' | 'notifications' | 'log' | 'goals'>('status');
  const [machines, setMachines] = useState<Machine[]>(INITIAL_MACHINES);
  const [logs, setLogs] = useState<WorkoutLog[]>(INITIAL_LOGS);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [currentTime, setCurrentTime] = useState(new Date());

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

  const handleReserve = (id: string) => {
    setMachines(prev => prev.map(m => {
      if (m.id === id) {
        const newStatus = m.status === 'Reserved' ? 'Available' : 'Reserved';
        if (newStatus === 'Reserved') {
          setNotifications(prevN => [
            { 
              id: Date.now().toString(), 
              title: 'Reservation Set', 
              message: `You'll be notified when ${m.name} is available.`, 
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

  const addLog = () => {
    const newLog: WorkoutLog = {
      id: Date.now().toString(),
      date: format(zonedTime, 'yyyy-MM-dd'),
      machineName: 'New Machine',
      sets: 0,
      reps: 0,
      weight: 0,
    };
    setLogs([newLog, ...logs]);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans pb-32">
      {/* Header Section */}
      <header className="bg-white border-b border-black/5 px-6 py-8 sticky top-0 z-50">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-light tracking-tight">
              <span className="font-bold">N</span>ever<span className="font-bold">W</span>eight
            </h1>
            <p className="text-sm text-black/40 mt-1 uppercase tracking-widest font-medium">Reach your Gym Goals • Northwestern</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🔥</span>
              <span className="text-lg font-bold font-mono">5</span>
            </div>
            <div className="text-2xl font-mono font-medium tracking-tighter">
              {format(zonedTime, 'h:mm a')}
            </div>
            <div className={cn(
              "text-xs font-bold uppercase tracking-wider mt-1 px-2 py-1 rounded-full inline-block",
              gymStatus === 'Open' ? "bg-purple-100 text-purple-700" : 
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
                  <h2 className="text-xl font-medium">Crowd Forecast</h2>
                  <p className="text-[10px] text-black/40 font-bold uppercase tracking-widest mt-1">
                    Status: <span className={cn(
                      gymStatus === 'Open' ? "text-emerald-500" : 
                      gymStatus.includes('15m') ? "text-amber-500" : "text-rose-500"
                    )}>{gymStatus}</span>
                  </p>
                </div>
                <span className="text-xs text-black/40 font-mono uppercase">Live Traffic</span>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={CROWD_FORECAST_DATA}>
                    <XAxis 
                      dataKey="hour" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#A3A3A3' }}
                      interval={2}
                    />
                    <Tooltip 
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-black text-white px-3 py-1 rounded-full text-xs font-mono">
                              {payload[0].value}% capacity
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="traffic" radius={[4, 4, 4, 4]}>
                      {CROWD_FORECAST_DATA.map((entry, index) => {
                        const hourNum = parseInt(entry.hour);
                        const isPM = entry.hour.includes('pm');
                        const adjustedHour = isPM && hourNum !== 12 ? hourNum + 12 : (!isPM && hourNum === 12 ? 0 : hourNum);
                        const isCurrent = adjustedHour === currentHour;
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={isCurrent ? '#8B5CF6' : '#E5E5E5'} 
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
                <h2 className="text-xl font-medium">Floor Status</h2>
                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-black/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available
                  <span className="w-2 h-2 rounded-full bg-rose-500 ml-2"></span> Busy
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {machines.map((machine) => (
                  <div 
                    key={machine.id}
                    className="bg-white p-4 rounded-2xl border border-black/5 flex items-center justify-between group hover:border-black/20 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        machine.status === 'Available' ? "bg-emerald-50 text-emerald-600" : 
                        machine.status === 'Reserved' ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {machine.type === 'Cardio' ? <Activity size={20} /> : <Dumbbell size={20} />}
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{machine.name}</h3>
                        <p className="text-xs text-black/40">{machine.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        machine.status === 'Available' ? "text-emerald-500" : 
                        machine.status === 'Reserved' ? "text-indigo-500" : "text-rose-500"
                      )}>
                        {machine.status}
                      </span>
                      <button 
                        onClick={() => handleReserve(machine.id)}
                        className={cn(
                          "p-2 rounded-full transition-colors",
                          machine.status === 'Reserved' ? "bg-indigo-600 text-white" : "bg-black/5 text-black/40 hover:bg-black/10"
                        )}
                      >
                        <Bell size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'log' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-medium">Workout History</h2>
              <button 
                onClick={addLog}
                className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="bg-white p-5 rounded-3xl border border-black/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{log.machineName}</h3>
                      <p className="text-xs text-black/40 font-mono">{log.date}</p>
                    </div>
                    <div className="bg-black/5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter">
                      Completed
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-black/5">
                    <div>
                      <p className="text-[10px] uppercase text-black/40 font-bold">Sets</p>
                      <p className="text-lg font-mono">{log.sets}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-black/40 font-bold">Reps</p>
                      <p className="text-lg font-mono">{log.reps}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-black/40 font-bold">Weight</p>
                      <p className="text-lg font-mono">{log.weight}lb</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Streak Feature */}
            <div className="bg-indigo-600 p-6 rounded-3xl text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">5 Day Streak!</h3>
                <p className="text-indigo-100 text-sm">You're in the top 10% of SPAC members this week.</p>
              </div>
              <div className="bg-white/20 p-3 rounded-2xl">
                <TrendingUp size={24} />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'goals' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-medium">Health & Nutrition</h2>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-black/5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                    <Target size={20} />
                  </div>
                  <h3 className="font-medium">Daily Goals</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Protein</span>
                    <span className="font-mono">120g / 160g</span>
                  </div>
                  <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[75%]"></div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Calories</span>
                    <span className="font-mono">1,850 / 2,400</span>
                  </div>
                  <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 w-[60%]"></div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-black/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <h3 className="font-medium">Dining Hall Sync</h3>
                    <p className="text-xs text-black/40">Connected to Allison Hall</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-black/20" />
              </div>
            </div>

            <div className="bg-black p-6 rounded-3xl text-white space-y-4">
              <h3 className="font-medium">Recommended for You</h3>
              <p className="text-white/60 text-sm">Based on your chest press log, we suggest adding Incline Dumbbell Press to your next session.</p>
              <button className="w-full bg-white text-black py-3 rounded-2xl font-medium text-sm">View Workout Plan</button>
            </div>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-medium">Notifications</h2>
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">2</span>
            </div>
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="bg-white p-4 rounded-2xl border border-black/5 flex gap-4 items-start">
                  <div className={cn(
                    "mt-1",
                    n.type === 'success' ? "text-emerald-500" : n.type === 'alert' ? "text-rose-500" : "text-indigo-500"
                  )}>
                    {n.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-semibold">{n.title}</h4>
                      <span className="text-[10px] text-black/40 font-mono">{n.time}</span>
                    </div>
                    <p className="text-xs text-black/60 mt-0.5">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-black/5 px-6 py-4 flex justify-between items-center z-50">
        <button 
          onClick={() => setActiveTab('status')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'status' ? "text-black" : "text-black/30"
          )}
        >
          <Users size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Status</span>
        </button>
        <button 
          onClick={() => setActiveTab('notifications')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'notifications' ? "text-black" : "text-black/30"
          )}
        >
          <div className="relative">
            <Bell size={24} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Alerts</span>
        </button>
        <button 
          onClick={() => setActiveTab('log')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'log' ? "text-black" : "text-black/30"
          )}
        >
          <Calendar size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Log</span>
        </button>
        <button 
          onClick={() => setActiveTab('goals')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'goals' ? "text-black" : "text-black/30"
          )}
        >
          <Target size={24} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Goals</span>
        </button>
      </nav>
    </div>
  );
}
