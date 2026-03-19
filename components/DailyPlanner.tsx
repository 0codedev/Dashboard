
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { StudyGoal, QuestionLog, DailyTask, UserProfile } from '../types';
import { TaskType, SyllabusStatus, TaskEffort } from '../types';
import { getDailyQuote, generateEndOfDaySummary, generateTasksFromGoal, generateSmartTasks, generateSmartTaskOrder } from '../services/geminiService';
import { JEE_SYLLABUS } from '../constants';
import Modal from './common/Modal';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { audioEngine, playTTS } from '../services/audioEngine';
import { formatDateFull, formatDuration } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';

import { MarkdownRenderer } from './common/MarkdownRenderer';

interface DailyPlannerProps {
  goals: StudyGoal[];
  setGoals: React.Dispatch<React.SetStateAction<StudyGoal[]>>;
  apiKey: string;
  logs: QuestionLog[];
  proactiveInsight: { subject: 'physics' | 'chemistry' | 'maths'; visible: boolean; } | null;
  onAcceptPlan: () => void;
  onDismissInsight: () => void;
  addXp: (event: 'completeTask') => void;
  userProfile: UserProfile;
  prefilledTask: Partial<DailyTask> | null;
  setPrefilledTask: (task: Partial<DailyTask> | null) => void;
  dailyTasks: DailyTask[];
  setDailyTasks: React.Dispatch<React.SetStateAction<DailyTask[]>>;
  modelName?: string;
}

// --- NEW COMPONENT: Morning Readiness Widget ---
const MorningReadinessWidget: React.FC<{
    onSave: (data: { sleep: number; stress: number; energy: number }) => void;
    onSkip: () => void;
    onSnooze: () => void;
}> = ({ onSave, onSkip, onSnooze }) => {
    const [sleep, setSleep] = useState(7);
    const [stress, setStress] = useState(5);
    const [energy, setEnergy] = useState(7);

    return (
        <div className="bg-slate-800/30 backdrop-blur-md border border-white/10 rounded-2xl p-6 mb-8 animate-fade-in shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span className="text-xl">🌿</span> Morning Readiness
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Calibrate your day. Honesty maximizes efficiency.</p>
                </div>
                <button onClick={onSnooze} className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors">
                    Snooze
                </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Sleep */}
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <label className="text-sm font-medium text-blue-300 flex items-center gap-2">
                            <span>🌙</span> Sleep
                        </label>
                        <span className="text-sm text-white font-mono">{sleep}h</span>
                    </div>
                    <input type="range" min="3" max="12" step="0.5" value={sleep} onChange={e => setSleep(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>

                {/* Stress */}
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <label className="text-sm font-medium text-red-300 flex items-center gap-2">
                            <span>🤯</span> Stress
                        </label>
                        <span className="text-sm text-white font-mono">{stress}/10</span>
                    </div>
                    <input type="range" min="1" max="10" step="1" value={stress} onChange={e => setStress(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg appearance-none cursor-pointer accent-red-500" />
                </div>

                {/* Energy */}
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <label className="text-sm font-medium text-yellow-300 flex items-center gap-2">
                            <span>⚡️</span> Energy
                        </label>
                        <span className="text-sm text-white font-mono">{energy}/10</span>
                    </div>
                    <input type="range" min="1" max="10" step="1" value={energy} onChange={e => setEnergy(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500" />
                </div>
            </div>
            
            <div className="flex justify-end items-center gap-3 mt-8 pt-6 border-t border-white/10">
                <button onClick={onSkip} className="text-slate-400 hover:text-white px-4 py-2 text-sm transition-colors">
                    Skip for Today
                </button>
                <button onClick={() => onSave({ sleep, stress, energy })} className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-6 rounded-lg shadow-sm text-sm transition-colors">
                    Sync & Plan
                </button>
            </div>
        </div>
    );
};

// --- NEW COMPONENT: Morning Readiness Summary Widget ---
const MorningReadinessSummaryWidget: React.FC<{ stats: { sleep: number; stress: number; energy: number } }> = ({ stats }) => {
    return (
        <div className="bg-slate-800/30 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10">
            <h3 className="text-lg font-bold text-cyan-300 mb-4 text-center flex items-center justify-center gap-2">
                <span className="text-xl">🌿</span> Morning Readiness
            </h3>
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/30 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center flex flex-col items-center justify-center">
                    <div className="text-2xl mb-1">🌙</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Sleep</div>
                    <div className="text-lg font-bold text-white mt-1">{stats.sleep}h</div>
                </div>
                <div className="bg-slate-900/30 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center flex flex-col items-center justify-center">
                    <div className="text-2xl mb-1">🤯</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Stress</div>
                    <div className="text-lg font-bold text-white mt-1">{stats.stress}/10</div>
                </div>
                <div className="bg-slate-900/30 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center flex flex-col items-center justify-center">
                    <div className="text-2xl mb-1">⚡️</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">Energy</div>
                    <div className="text-lg font-bold text-white mt-1">{stats.energy}/10</div>
                </div>
            </div>
        </div>
    );
};

const taskTypeConfig: Record<TaskType, { name: string, color: string, icon: string }> = {
    [TaskType.StudySession]: { name: "Study Session", color: "border-l-blue-400", icon: "📚" },
    [TaskType.ProblemPractice]: { name: "Problem Practice", color: "border-l-green-400", icon: "✍️" },
    [TaskType.Revision]: { name: "Revision", color: "border-l-yellow-400", icon: "🔄" },
    [TaskType.MockTest]: { name: "Mock Test", color: "border-l-red-400", icon: "⏱️" },
    [TaskType.Break]: { name: "Break", color: "border-l-indigo-400", icon: "☕" },
};

const effortConfig: Record<TaskEffort, { label: string, icon: string, color: string }> = {
    [TaskEffort.Low]: { label: "Low", icon: "😌", color: "bg-green-900/30 text-green-300 border-green-700" },
    [TaskEffort.Medium]: { label: "Medium", icon: "🙂", color: "bg-yellow-900/30 text-yellow-300 border-yellow-700" },
    [TaskEffort.High]: { label: "High", icon: "🥵", color: "bg-red-900/30 text-red-300 border-red-700" },
};

const FocusAnalyticsWidget: React.FC<{ logs: QuestionLog[] }> = ({ logs }) => {
    const [heatmapData, setHeatmapData] = useState<{ hour: string; count: number }[]>([]);

    useEffect(() => {
        const counts = new Array(24).fill(0);
        logs.forEach(log => {
            if (log.timestamp) {
                const hour = new Date(log.timestamp).getHours();
                counts[hour]++;
            }
        });

        const data = [];
        for (let i = 6; i <= 23; i++) {
            data.push({ hour: `${i}:00`, count: counts[i] });
        }
        setHeatmapData(data);
    }, [logs]);

    return (
        <div className="bg-slate-800/30 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <h4 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                <span className="text-lg">🔥</span> Focus Heatmap (Best Hours)
            </h4>
            <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={heatmapData}>
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#64748b" interval={2} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '0.5rem', fontSize: '12px', backdropFilter: 'blur(8px)' }}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                            {heatmapData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.count > 4 ? '#fbbf24' : '#38bdf8'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const AccomplishmentModal: React.FC<{ task: DailyTask; onSave: (id: string, accomplishment: string) => void; onClose: () => void; interruptionCount: number }> = ({ task, onSave, onClose, interruptionCount }) => {
    const [accomplishment, setAccomplishment] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(task.id, accomplishment); };

    return (
        <Modal isOpen={true} onClose={onClose} title="Task Completed!">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-gray-300">Great job completing: <strong className="text-white">{task.text}</strong></p>
                {interruptionCount > 3 && (
                    <div className="bg-red-900/20 border border-red-800 p-3 rounded text-xs text-red-300">
                        <strong>⚠️ Context Switching Detected:</strong> You paused {interruptionCount} times. This task will be flagged as "Fragmented Focus".
                    </div>
                )}
                <div>
                    <label htmlFor="accomplishment-input" className="block text-sm text-gray-400 mb-1">What did you accomplish?</label>
                    <input id="accomplishment-input" ref={inputRef} type="text" value={accomplishment} onChange={(e) => setAccomplishment(e.target.value)} placeholder="e.g. Solved 15 PYQs from Rotational Motion" className="w-full p-2 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-md focus:ring-2 focus:ring-cyan-500 focus:outline-none text-white" />
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">Skip</button>
                    <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md font-bold">Save & Celebrate</button>
                </div>
            </form>
        </Modal>
    );
};

const TimeBlockSchedule: React.FC<{ tasks: DailyTask[]; onDropTask: (taskId: string, hour: number) => void; onRemoveTask: (taskId: string) => void; userProfile: UserProfile }> = ({ tasks, onDropTask, onRemoveTask, userProfile }) => {
    const { startHour, endHour } = useMemo(() => {
        let minH = 24, maxH = 0;
        const parseTime = (timeStr: string) => {
            const match = timeStr.match(/(\d+)(?::(\d+))?\s*(AM|PM)?/i);
            if (!match) return null;
            let h = parseInt(match[1], 10);
            const ampm = match[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            return h;
        };
        Object.values(userProfile.studyTimes).forEach((tVal) => {
            const parts = String(tVal).split('-').map(s => s.trim());
            if (parts.length > 0) {
                const start = parseTime(parts[0]);
                if (start !== null) { minH = Math.min(minH, start); maxH = Math.max(maxH, start + 3); }
                if (parts.length > 1) { const end = parseTime(parts[1]); if (end !== null) maxH = Math.max(maxH, end); }
            }
        });
        if (minH === 24) minH = 7; if (maxH === 0) maxH = 22;
        return { startHour: minH, endHour: Math.min(23, maxH + 1) };
    }, [userProfile.studyTimes]);

    const timeSlots = useMemo(() => {
        const slots = [];
        for (let i = startHour; i <= endHour; i++) slots.push(i);
        return slots;
    }, [startHour, endHour]);

    const getTaskForSlot = (hour: number) => tasks.find(t => {
        if (!t.scheduledTime) return false;
        const [h] = t.scheduledTime.split(':').map(Number);
        return h === hour;
    });

    const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);

    useEffect(() => {
        const updateLine = () => {
            const now = new Date();
            const currentH = now.getHours();
            const currentM = now.getMinutes();
            if (currentH >= startHour && currentH <= endHour) {
                // Calculate percentage through the day range
                const totalHours = endHour - startHour + 1;
                const hoursPassed = (currentH - startHour) + (currentM / 60);
                setCurrentTimePos((hoursPassed / totalHours) * 100);
            } else {
                setCurrentTimePos(null);
            }
        };
        updateLine();
        const timer = setInterval(updateLine, 60000);
        return () => clearInterval(timer);
    }, [startHour, endHour]);

    return (
        <div className="bg-slate-800/30 backdrop-blur-md p-0 rounded-2xl border border-white/10 h-[600px] overflow-y-auto custom-scrollbar animate-fade-in relative">
            <h3 className="text-sm font-bold text-cyan-300 sticky top-0 bg-slate-800/50 backdrop-blur-md z-20 px-4 py-3 border-b border-white/10 flex justify-between items-center">
                <span>Timeline</span>
                <span className="text-[10px] text-gray-500 font-normal">Drag tasks here</span>
            </h3>
            
            <div className="relative px-4 py-2">
                {currentTimePos !== null && (
                    <div 
                        className="absolute left-0 right-0 h-[2px] bg-red-500 z-10 pointer-events-none flex items-center"
                        style={{ top: `${20 + (currentTimePos / 100) * (timeSlots.length * 64)}px` }} // Approx calculation based on slot height
                    >
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                        <span className="text-[9px] text-red-500 bg-slate-900/50 backdrop-blur-sm px-1 ml-auto">Now</span>
                    </div>
                )}

                <div className="space-y-1">
                    {timeSlots.map(hour => {
                        const task = getTaskForSlot(hour);
                        const timeLabel = `${hour > 12 ? hour - 12 : (hour === 0 || hour === 24 ? 12 : hour)} ${hour >= 12 && hour < 24 ? 'PM' : 'AM'}`;
                        
                        return (
                            <div 
                                key={hour} 
                                className="flex items-start gap-3 group min-h-[4rem] border-b border-white/5 last:border-0"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const taskId = e.dataTransfer.getData('text/plain');
                                    if (taskId) onDropTask(taskId, hour);
                                }}
                            >
                                <div className="w-14 text-[10px] text-gray-500 text-right pt-2 font-mono flex-shrink-0">{timeLabel}</div>
                                <div className="flex-grow pt-1 relative h-full min-h-[3.5rem]">
                                    {task ? (
                                        <div 
                                            draggable={true}
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                                            className={`rounded-md p-2 border border-white/10 shadow-sm text-sm text-gray-200 flex justify-between items-center group-hover:border-cyan-500/50 transition-all cursor-grab active:cursor-grabbing ${task.completed ? 'bg-slate-800/30 backdrop-blur-sm opacity-60' : 'bg-slate-800/50 backdrop-blur-sm'}`}
                                            style={{ height: `${Math.max(3, (task.estimatedTime / 60) * 3.5)}rem` }}
                                        >
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="truncate font-medium text-xs">{task.text}</span>
                                                <span className="text-[9px] text-gray-400">{task.estimatedTime}m</span>
                                            </div>
                                            <button 
                                                className="ml-2 text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center"
                                                onClick={() => onRemoveTask(task.id)}
                                                title="Unschedule"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-full w-full rounded-md border-2 border-dashed border-transparent hover:border-slate-700 transition-colors flex items-center justify-center">
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export const DailyPlanner: React.FC<DailyPlannerProps> = ({ goals, setGoals, apiKey, logs, proactiveInsight, onAcceptPlan, onDismissInsight, addXp, userProfile, prefilledTask, setPrefilledTask, dailyTasks, setDailyTasks, modelName }) => {
    const [quote, setQuote] = useState<{ text: string; date: string } | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState<'tasks' | 'weekly' | 'summary' | 'history'>('tasks');
    
    const [suggestedTasks, setSuggestedTasks] = useState<{task: string, time: number}[] | null>(null);
    const [isSuggestingTasks, setIsSuggestingTasks] = useState(false);
    const [smartTasks, setSmartTasks] = useState<{ task: string; time: number; topic: string; }[] | null>(null);
    const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);
    const [accomplishmentModal, setAccomplishmentModal] = useState<{ task: DailyTask } | null>(null);
    const [isSorting, setIsSorting] = useState(false);

    // Bio Check State
    const [showBioCheck, setShowBioCheck] = useState(false);
    const [bioStats, setBioStats] = useState<{sleep: number, stress: number, energy: number} | null>(null);

    const [isHyperFocusMode, setIsHyperFocusMode] = useState(false);
    const [ambientSound, setAmbientSound] = useState<'off' | 'brown' | 'pink' | 'white' | 'alpha' | 'theta'>('off');
    const [soundVolume, setSoundVolume] = useState(0.15);
    const [interruptionCount, setInterruptionCount] = useState(0);

    const [newTaskText, setNewTaskText] = useState('');
    const [newTaskType, setNewTaskType] = useState<TaskType>(TaskType.StudySession);
    const [newTaskEffort, setNewTaskEffort] = useState<TaskEffort>(TaskEffort.Medium);
    const [newTaskTime, setNewTaskTime] = useState(30);
    const [newTaskTopic, setNewTaskTopic] = useState('');
    const [newWeeklyGoal, setNewWeeklyGoal] = useState('');
    const [isListening, setIsListening] = useState(false);

    const handleVoiceInput = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setNewTaskText(transcript);
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);

        recognition.start();
    };

    const timerModes = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
    const { timerState, setTimerState } = useAppStore();
    const { mode: timerMode, isActive: isTimerActive, timeLeft, endTime, activeTaskId } = timerState;
    
    const timerIntervalRef = useRef<number | null>(null);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customTime, setCustomTime] = useState(45);
    const [isCompleted, setIsCompleted] = useState(false);
    
    // Find active task from dailyTasks based on activeTaskId
    const activeTask = useMemo(() => dailyTasks.find(t => t.id === activeTaskId) || null, [dailyTasks, activeTaskId]);
    
    const [summary, setSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);

    const [streakData, setStreakData] = useState({ count: 0, date: '', animationKey: 0 });
    const [lastCompletedTaskId, setLastCompletedTaskId] = useState<string | null>(null);

    const [summaries, setSummaries] = useState<Record<string, string>>({});
    const [planHistory, setPlanHistory] = useState<Record<string, DailyTask[]>>({});

    // Load History
    useEffect(() => {
        const savedSummaries = localStorage.getItem('endOfDaySummaries_v1');
        if (savedSummaries) {
            try { setSummaries(JSON.parse(savedSummaries)); } catch (e) {}
        }
        const savedPlans = localStorage.getItem('dailyPlansHistory_v1');
        if (savedPlans) {
            try { setPlanHistory(JSON.parse(savedPlans)); } catch (e) {}
        }
    }, []);

    // Save Daily Plan to History
    useEffect(() => {
        if (dailyTasks.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            setPlanHistory(prev => {
                const updated = { ...prev, [todayStr]: dailyTasks };
                localStorage.setItem('dailyPlansHistory_v1', JSON.stringify(updated));
                return updated;
            });
        }
    }, [dailyTasks]);

    // Init Bio Check
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const bioLogKey = `bioLog_${today}`;
        const savedBio = localStorage.getItem(bioLogKey);
        const snoozeUntil = localStorage.getItem('bioCheckSnoozeUntil');

        if (savedBio) {
            setBioStats(JSON.parse(savedBio));
            return;
        }

        if (snoozeUntil && Date.now() < parseInt(snoozeUntil, 10)) {
            return;
        }
        
        const timer = setTimeout(() => setShowBioCheck(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    const handleBioSave = (data: { sleep: number; stress: number; energy: number }) => {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`bioLog_${today}`, JSON.stringify(data));
        setBioStats(data);
        setShowBioCheck(false);
        
        // Auto-adjust default effort based on bio-feedback
        if (data.sleep < 6 || data.stress > 7 || data.energy < 4) {
            setNewTaskEffort(TaskEffort.Low);
        } else if (data.energy > 8 && data.stress < 4) {
            setNewTaskEffort(TaskEffort.High);
        }
    };

    const handleBioSnooze = () => {
        const snoozeUntil = Date.now() + 4 * 60 * 60 * 1000;
        localStorage.setItem('bioCheckSnoozeUntil', snoozeUntil.toString());
        setShowBioCheck(false);
    };

    const handleBioSkip = () => {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem(`bioLog_${today}`, JSON.stringify({ skipped: true }));
        setShowBioCheck(false);
    };

    useEffect(() => {
        if (prefilledTask) {
            setNewTaskText(prefilledTask.text || '');
            setNewTaskType(prefilledTask.taskType || TaskType.StudySession);
            setNewTaskTime(prefilledTask.estimatedTime || 30);
            setNewTaskTopic(prefilledTask.linkedTopic || '');
            if (prefilledTask.taskType === TaskType.MockTest || prefilledTask.taskType === TaskType.ProblemPractice) {
                setNewTaskEffort(TaskEffort.High);
            }
            setPrefilledTask(null);
        }
    }, [prefilledTask, setPrefilledTask]);

    useEffect(() => {
        if (isHyperFocusMode && isTimerActive && ambientSound !== 'off') {
            if (['brown', 'pink', 'white'].includes(ambientSound)) {
                audioEngine.playNoise(ambientSound as 'brown'|'pink'|'white', soundVolume);
            } else if (ambientSound === 'alpha') {
                audioEngine.playBinaural(400, 10, soundVolume); // 10Hz Alpha Beat (Focus)
            } else if (ambientSound === 'theta') {
                audioEngine.playBinaural(400, 6, soundVolume); // 6Hz Theta Beat (Deep Focus)
            }
        } else {
            audioEngine.stop();
        }
        return () => audioEngine.stop();
    }, [isHyperFocusMode, isTimerActive, ambientSound]);

    useEffect(() => { audioEngine.setVolume(soundVolume); }, [soundVolume]);

    const prioritizedWeakTopics = useMemo(() => {
        const chapterScores: { name: string, score: number }[] = [];
        // @ts-ignore
        const allChapters = Object.values(JEE_SYLLABUS).flatMap(subject => subject.flatMap(unit => unit.chapters.map(c => c.name)));
        allChapters.forEach(chapter => {
            const progress = userProfile.syllabus[chapter];
            const chapterLogs = logs.filter(l => l.topic === chapter);
            const errorCount = chapterLogs.filter(l => l.status === 'Wrong' || l.status === 'Partially Correct').length;
            let score = 0;
            if (progress) {
                if (progress.status === SyllabusStatus.InProgress) score += 5;
                if (progress.strength === 'weakness') score += 5;
            }
            score += errorCount * 2;
            if (score > 0) chapterScores.push({ name: chapter, score });
        });
        return chapterScores.sort((a, b) => b.score - a.score).slice(0, 5).map(item => item.name);
    }, [logs, userProfile.syllabus]);
    
    useEffect(() => {
        const fetchQuote = async () => {
            const today = new Date().toISOString().split('T')[0];
            const savedQuote = localStorage.getItem('dailyQuote');
            if (savedQuote) {
                const parsedQuote = JSON.parse(savedQuote);
                if (parsedQuote.date === today) { setQuote(parsedQuote); return; }
            }
            const newQuoteText = await getDailyQuote(apiKey);
            const newQuote = { text: newQuoteText, date: today };
            setQuote(newQuote);
            localStorage.setItem('dailyQuote', JSON.stringify(newQuote));
        };
        fetchQuote();
    }, [apiKey]);

    useEffect(() => {
        const savedStreak = localStorage.getItem('streakData_v1');
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (savedStreak) {
            try {
                const data = JSON.parse(savedStreak);
                if (data.date !== todayStr && data.date !== yesterdayStr) {
                    setStreakData({ count: 0, date: '', animationKey: 0 });
                    localStorage.removeItem('streakData_v1');
                } else { 
                    setStreakData({ ...data, animationKey: 0 }); 
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    useEffect(() => {
        const allComplete = dailyTasks.length > 0 && dailyTasks.every(t => t.completed);
        if (allComplete) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (streakData.date === todayStr) return;
            
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            let newCount = 1;
            if (streakData.date === yesterdayStr) newCount = streakData.count + 1;
            
            const newStreakData = { count: newCount, date: todayStr };
            setStreakData(prev => ({ ...newStreakData, animationKey: prev.animationKey + 1 }));
            localStorage.setItem('streakData_v1', JSON.stringify(newStreakData));
        }
    }, [dailyTasks, streakData.count, streakData.date]);
    
    useEffect(() => { const timerId = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timerId); }, []);
    
    useEffect(() => {
        if (!isTimerActive) { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } return; }
        const tick = () => {
            if (endTime) {
                const remaining = endTime - Date.now();
                if (remaining <= 0) {
                    setTimerState({ timeLeft: 0, isActive: false, endTime: null }); setIsHyperFocusMode(false);
                    if (activeTask) setAccomplishmentModal({ task: activeTask });
                    else { setIsCompleted(true); const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const osc = ctx.createOscillator(); osc.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); }
                } else setTimerState({ timeLeft: Math.ceil(remaining / 1000) });
            }
        };
        tick(); timerIntervalRef.current = window.setInterval(tick, 1000);
        return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
    }, [isTimerActive, activeTask, endTime, setTimerState]);

    useEffect(() => {
        if (isCompleted) {
            const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
            let particles: any[] = []; const particleCount = 100;
            const createParticles = () => {
                particles = []; const { width, height } = canvas.getBoundingClientRect(); canvas.width = width; canvas.height = height;
                const centerX = width / 2; const centerY = height / 2;
                for (let i = 0; i < particleCount; i++) {
                    const angle = Math.random() * 2 * Math.PI; const speed = Math.random() * 5 + 2;
                    particles.push({ x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: Math.random() * 2 + 1, color: `rgba(34, 211, 238, ${Math.random()})`, life: 100, });
                }
            };
            const animate = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                particles.forEach((p, i) => {
                    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
                    if (p.life <= 0) particles.splice(i, 1);
                    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2, false); ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 100; ctx.fill(); ctx.closePath(); }
                });
                if (particles.length > 0) animationFrameId.current = requestAnimationFrame(animate); else { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
            };
            createParticles(); animate();
        }
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [isCompleted]);

    const addDailyTask = (e: React.FormEvent) => { e.preventDefault(); if (newTaskText.trim() === '') return; const task: DailyTask = { id: `task-${Date.now()}`, text: newTaskText, completed: false, taskType: newTaskType, effort: newTaskEffort, estimatedTime: newTaskTime, linkedTopic: newTaskTopic || undefined }; setDailyTasks(prev => [...prev, task]); setNewTaskText(''); setNewTaskType(TaskType.StudySession); setNewTaskTime(30); setNewTaskTopic(''); setNewTaskEffort(TaskEffort.Medium); };
    const toggleDailyTask = (id: string) => { let wasJustCompleted = false; setDailyTasks(prev => prev.map(t => { if (t.id === id) { if (!t.completed) wasJustCompleted = true; const isNowCompleted = !t.completed; if (isNowCompleted) { setLastCompletedTaskId(id); setTimeout(() => setLastCompletedTaskId(null), 600); } return { ...t, completed: isNowCompleted }; } return t; })); if (wasJustCompleted) addXp('completeTask'); };
    const deleteDailyTask = (id: string) => { setDailyTasks(prev => prev.filter(t => t.id !== id)); };
    const addWeeklyGoal = (e: React.FormEvent) => { e.preventDefault(); if (newWeeklyGoal.trim() === '') return; setGoals(prev => [...prev, { id: `weekly-${Date.now()}`, text: newWeeklyGoal, completed: false }]); setNewWeeklyGoal(''); };
    const toggleWeeklyGoal = (id: string) => { setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g)); };
    const deleteWeeklyGoal = (id: string) => { setGoals(prev => prev.filter(g => g.id !== id)); };
    
    const handleSmartReschedule = () => {
        const incompleteTasks = dailyTasks.filter(t => !t.completed);
        if (incompleteTasks.length === 0) { alert("All tasks completed! Nothing to reschedule."); return; }
        const completedTasks = dailyTasks.filter(t => t.completed);
        setDailyTasks([...completedTasks, ...incompleteTasks.map(t => ({...t, scheduledTime: undefined}))]);
        alert(`Rescheduled ${incompleteTasks.length} tasks to the backlog.`);
    };

    const handleSmartSort = async () => {
        if (dailyTasks.length < 2) return;
        setIsSorting(true);
        try {
            const orderedIds = await generateSmartTaskOrder(dailyTasks, userProfile, logs, bioStats, apiKey, modelName);
            const taskMap = new Map(dailyTasks.map(t => [t.id, t]));
            const reorderedTasks = orderedIds.map(id => taskMap.get(id)).filter(Boolean) as DailyTask[];
            const existingIds = new Set(orderedIds);
            const remainingTasks = dailyTasks.filter(t => !existingIds.has(t.id));
            setDailyTasks([...reorderedTasks, ...remainingTasks]);
        } catch (e) { console.error(e); } finally { setIsSorting(false); }
    };

    const handleScheduleDrop = (taskId: string, hour: number) => {
        const newTime = `${hour.toString().padStart(2, '0')}:00`;
        setDailyTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduledTime: newTime } : t));
    };
    const handleUnschedule = (taskId: string) => {
        setDailyTasks(prev => prev.map(t => t.id === taskId ? { ...t, scheduledTime: undefined } : t));
    };

    const handleTimerModeChange = (mode: 'focus' | 'short' | 'long' | 'custom') => { 
        setTimerState({ isActive: false, mode, endTime: null, activeTaskId: null }); 
        setIsCompleted(false); 
        if (mode === 'custom') { 
            setShowCustomInput(true); 
            setTimerState({ timeLeft: customTime * 60 }); 
        } else { 
            setShowCustomInput(false); 
            setTimerState({ timeLeft: timerModes[mode] }); 
        } 
    };
    
    const handleTimerToggle = () => { 
        audioEngine.init(); 
        setIsCompleted(false); 
        if (!isTimerActive) { 
            let newEndTime = endTime;
            if (!newEndTime) {
                 newEndTime = Date.now() + timeLeft * 1000;
            } else {
                 newEndTime = Date.now() + timeLeft * 1000;
            }
            setTimerState({ endTime: newEndTime, isActive: true });
            if (timerMode === 'focus' || activeTask) setIsHyperFocusMode(true); 
        } else { 
            setIsHyperFocusMode(false); 
            setInterruptionCount(prev => prev + 1);
            setTimerState({ isActive: false });
        } 
    };

    const handleTimerReset = () => { 
        setTimerState({ isActive: false, endTime: null, activeTaskId: null }); 
        setIsHyperFocusMode(false); 
        setIsCompleted(false); 
        setInterruptionCount(0); 
        if(timerMode === 'custom') { 
            setTimerState({ timeLeft: customTime * 60 }); 
        } else { 
            setTimerState({ timeLeft: timerModes[timerMode] }); 
        } 
    };
    
    const handleStartFocus = (task: DailyTask) => { 
        audioEngine.init(); 
        setShowCustomInput(false); 
        setIsCompleted(false); 
        setInterruptionCount(0); 
        const newTimeLeft = task.estimatedTime > 0 ? task.estimatedTime * 60 : timerModes.focus;
        setTimerState({ 
            activeTaskId: task.id, 
            isActive: false, 
            mode: 'focus', 
            endTime: null, 
            timeLeft: newTimeLeft 
        }); 
        
        setTimeout(() => { 
            setTimerState({ 
                endTime: Date.now() + newTimeLeft * 1000, 
                isActive: true 
            }); 
            setIsHyperFocusMode(true); 
        }, 100); 
    };
    
    const formatTime = (seconds: number) => { const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`; };
    
    const handleGenerateSummary = async () => { 
        setIsSummaryLoading(true); 
        setAudioUrl(null); 
        try { 
            const checklistSummary = dailyTasks.map(t => ({text: t.text, completed: t.completed})); 
            const result = await generateEndOfDaySummary(goals, checklistSummary, apiKey); 
            const todayStr = new Date().toISOString().split('T')[0];
            setSummaries(prev => {
                const updated = { ...prev, [todayStr]: result };
                localStorage.setItem('endOfDaySummaries_v1', JSON.stringify(updated));
                return updated;
            });
        } catch (error) { 
            console.error("Failed to generate summary:", error); 
        } finally { 
            setIsSummaryLoading(false); 
        } 
    };
    
    const handlePlaySummaryAudio = async (summaryText: string) => {
        if (!summaryText || isAudioLoading) return;
        setIsAudioLoading(true);
        try {
            await playTTS(summaryText, apiKey);
        } catch (e) {
            console.error(e);
            alert("Failed to play audio.");
        } finally {
            setIsAudioLoading(false);
        }
    };
    const handlePlanForGoal = async (goal: StudyGoal) => { setIsSuggestingTasks(true); setSuggestedTasks(null); try { const newTasks = await generateTasksFromGoal(goal.text, apiKey, modelName); setSuggestedTasks(newTasks); } catch(e) { console.error(e); } finally { setIsSuggestingTasks(false); } };
    const addSuggestedTask = (task: {task: string, time: number}) => { setDailyTasks(prev => [...prev, { id: `ai-${Date.now()}-${Math.random()}`, text: task.task, completed: false, taskType: TaskType.StudySession, estimatedTime: task.time, effort: TaskEffort.Medium }]); setSuggestedTasks(prev => prev ? prev.filter(t => t.task !== task.task) : null); };
    const handleGenerateSmartTasks = async () => { setIsGeneratingTasks(true); setSmartTasks(null); try { const newTasks = await generateSmartTasks(prioritizedWeakTopics, bioStats, apiKey, modelName); setSmartTasks(newTasks); } catch (e) { console.error(e); } finally { setIsGeneratingTasks(false); } };
    const addSmartTask = (task: { task: string; time: number; topic: string }) => { const newTask = { id: `smart-${Date.now()}`, text: task.task, completed: false, taskType: TaskType.ProblemPractice, estimatedTime: task.time, linkedTopic: task.topic, effort: TaskEffort.High }; setDailyTasks(p => [newTask, ...p]); setSmartTasks(p => p?.filter(t => t.task !== task.task) || null); };
    
    const handleSaveAccomplishment = (taskId: string, accomplishment: string) => { 
        const taxLabel = interruptionCount > 3 ? " (Fragmented Focus ⚠️)" : "";
        const finalAccomplishment = accomplishment + taxLabel;

        setDailyTasks(prev => prev.map(t => t.id === taskId ? { ...t, accomplishment: finalAccomplishment, completed: true } : t)); 
        setAccomplishmentModal(null); 
        setTimerState({ activeTaskId: null }); 
        setIsCompleted(true); 
        handleTimerReset(); 
    };

    const totalPlannedTime = useMemo(() => dailyTasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0), [dailyTasks]);
    
    const totalDuration = timerMode === 'custom' ? customTime * 60 : (activeTask && activeTask.estimatedTime > 0 ? activeTask.estimatedTime * 60 : timerModes[timerMode]);
    const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) : 0;
    const TabButton: React.FC<{tabName: 'tasks' | 'weekly' | 'summary' | 'history', label: string}> = ({tabName, label}) => (<button onClick={() => setActiveTab(tabName)} className={`py-2 px-4 font-semibold transition-colors text-sm rounded-t-md ${activeTab === tabName ? 'bg-slate-800/50 backdrop-blur-md text-cyan-400' : 'bg-slate-900/30 backdrop-blur-md text-gray-400 hover:bg-slate-800/50 hover:text-white'}`}>{label}</button>);

    const displayedTasks = useMemo(() => {
        if (showSchedule) {
            return dailyTasks.filter(t => !t.scheduledTime);
        }
        return dailyTasks;
    }, [dailyTasks, showSchedule]);

    const isRecoveryMode = bioStats && (bioStats.sleep < 6 || bioStats.stress > 7 || bioStats.energy < 4);

    const timerBgClass = interruptionCount >= 3 ? 'bg-red-900/30' : interruptionCount > 0 ? 'bg-yellow-900/30' : 'bg-cyan-900/30';
    const timerTextClass = interruptionCount >= 3 ? 'text-red-500' : interruptionCount > 0 ? 'text-yellow-500' : 'text-cyan-500';

    const realityCheckWarning = useMemo(() => {
        const text = newTaskText.toLowerCase();
        if ((text.includes('mock') || text.includes('test') || text.includes('exam')) && newTaskTime < 120) {
            return "Reality Check: Full tests usually take 2-3 hours. Are you sure this is enough time?";
        }
        if (newTaskEffort === TaskEffort.High && newTaskTime < 45) {
            return "Reality Check: High effort tasks typically require at least 45m of deep focus.";
        }
        return null;
    }, [newTaskText, newTaskTime, newTaskEffort]);

    return (
        <div className="space-y-6 relative">
             {showBioCheck && <MorningReadinessWidget onSave={handleBioSave} onSkip={handleBioSkip} onSnooze={handleBioSnooze} />}
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {accomplishmentModal && <AccomplishmentModal task={accomplishmentModal.task} onSave={handleSaveAccomplishment} onClose={() => setAccomplishmentModal(null)} interruptionCount={interruptionCount} />}
                 
                 {isHyperFocusMode && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-black to-slate-900 opacity-50 pointer-events-none"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                         <div className={`w-[600px] h-[600px] ${timerBgClass} rounded-full blur-3xl ${isTimerActive ? 'animate-pulse' : ''}`} style={{ animationDuration: '4s' }}></div>
                    </div>
                    <div className="absolute top-6 right-6 z-10">
                         <button onClick={() => setIsHyperFocusMode(false)} className="text-gray-500 hover:text-white text-sm border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-full transition-all">Exit Focus Mode</button>
                    </div>
                    <div className="text-center space-y-8 relative z-10">
                         <p className={`text-xl ${timerTextClass} font-medium tracking-wide uppercase`}>{activeTask ? activeTask.text : 'Deep Work Session'}</p>
                         <div className="text-[12rem] font-bold text-white tracking-tighter leading-none tabular-nums select-none drop-shadow-2xl">{formatTime(timeLeft)}</div>
                         
                         {interruptionCount > 0 && (
                             <div className={`text-sm font-medium ${interruptionCount >= 3 ? 'text-red-400' : 'text-yellow-400'} animate-pulse`}>
                                 {interruptionCount} Interruption{interruptionCount !== 1 ? 's' : ''} Detected
                             </div>
                         )}
                         
                         <div className="flex items-center gap-8 justify-center mt-8">
                            <div className="flex flex-col items-center gap-2">
                                <button onClick={() => { audioEngine.init(); setAmbientSound(prev => prev === 'off' ? 'brown' : 'off'); }} className={`p-4 rounded-full transition-all duration-300 border ${ambientSound !== 'off' ? 'bg-cyan-600 border-cyan-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.4)]' : 'bg-slate-800/50 backdrop-blur-sm border-white/10 text-gray-400 hover:border-gray-500'}`}>
                                    {ambientSound !== 'off' ? <span className="text-2xl">🔊</span> : <span className="text-2xl">🔇</span>}
                                </button>
                                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Soundscape</span>
                            </div>
                            {ambientSound !== 'off' && (
                                <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex gap-4 items-center animate-scale-in">
                                    <div className="flex gap-1">
                                        {(['brown', 'pink', 'white'].map(type => (
                                            <button key={type} onClick={() => { audioEngine.init(); setAmbientSound(type as any); }} className={`px-3 py-1 text-xs rounded-md border uppercase font-bold transition-colors ${ambientSound === type ? 'bg-slate-700/50 backdrop-blur-sm border-cyan-500 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{type}</button>
                                        )))}
                                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                                        <button onClick={() => { audioEngine.init(); setAmbientSound('alpha'); }} className={`px-3 py-1 text-xs rounded-md border uppercase font-bold transition-colors ${ambientSound === 'alpha' ? 'bg-indigo-900/50 backdrop-blur-sm border-indigo-500 text-indigo-400' : 'border-transparent text-indigo-400/50 hover:text-indigo-400'}`} title="Alpha Waves (Focus)">Alpha</button>
                                        <button onClick={() => { audioEngine.init(); setAmbientSound('theta'); }} className={`px-3 py-1 text-xs rounded-md border uppercase font-bold transition-colors ${ambientSound === 'theta' ? 'bg-purple-900/50 backdrop-blur-sm border-purple-500 text-purple-400' : 'border-transparent text-purple-400/50 hover:text-purple-400'}`} title="Theta Waves (Deep Focus)">Theta</button>
                                    </div>
                                    <div className="h-8 w-[1px] bg-white/10"></div>
                                    <input type="range" min="0" max="1" step="0.01" value={soundVolume} onChange={e => setSoundVolume(parseFloat(e.target.value))} className="w-24 h-1 bg-slate-700/50 backdrop-blur-sm rounded-lg appearance-none cursor-pointer accent-cyan-500"/>
                                </div>
                            )}
                         </div>
                         <div className="mt-12">
                             <button onClick={handleTimerToggle} className="text-gray-400 hover:text-white transition-colors">{isTimerActive ? 'Pause Timer' : 'Resume'}</button>
                         </div>
                    </div>
                </div>
             )}

            <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-800/30 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                        <div>
                            <div className="flex items-center gap-4">
                                <h2 className="text-2xl font-bold text-cyan-300">Daily Planner</h2>
                            </div>
                            <p className="text-gray-400 mt-1">{formatDateFull(currentTime.toISOString())}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-4xl font-bold text-white">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                    </div>
                    {quote && <p className="text-center italic text-xl md:text-2xl font-extrabold mt-6 border-t border-slate-700 pt-6 leading-relaxed text-transparent bg-clip-text bg-gradient-to-r from-cyan-100 to-blue-100 drop-shadow-lg tracking-wide" style={{ textShadow: '0 2px 10px rgba(34,211,238,0.3)' }}>"{quote.text}"</p>}
                </div>
                
                {proactiveInsight?.visible && (
                    <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 animate-glow backdrop-blur-sm">
                        <div>
                            <h3 className="font-bold text-yellow-300 flex items-center gap-2">📄 Proactive Insight</h3>
                            <p className="text-yellow-200/80 text-sm mt-1">
                                Accuracy in <strong className="capitalize text-yellow-100">{proactiveInsight.subject}</strong> dropped recently. Need a recovery plan?
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={onAcceptPlan} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-1.5 px-4 rounded-lg text-sm shadow-lg transition-transform hover:scale-105">Yes, create plan</button>
                            <button onClick={onDismissInsight} className="bg-transparent hover:bg-yellow-900/40 text-yellow-300 font-semibold py-1.5 px-4 rounded-lg text-sm transition-colors">Dismiss</button>
                        </div>
                    </div>
                )}

                {isRecoveryMode && (
                    <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-lg p-4 flex items-center gap-3 animate-fade-in">
                        <div className="text-2xl">🌿</div>
                        <div>
                            <h4 className="font-bold text-indigo-300">Recovery Mode Active</h4>
                            <p className="text-xs text-indigo-200/80">Bio-rhythm check detected low energy. Recommended tasks set to 'Low' effort. Avoid heavy mocks today.</p>
                        </div>
                    </div>
                )}

                <div>
                    <div className="flex justify-between items-center border-b border-slate-700 mb-4">
                        <div className="flex">
                            <TabButton tabName="tasks" label={`Today's Plan (${formatDuration(totalPlannedTime)})`} />
                            <TabButton tabName="weekly" label={`Weekly Goals (${goals.length})`} />
                            <TabButton tabName="summary" label="Summary" />
                            <TabButton tabName="history" label="History" />
                        </div>
                         <button onClick={() => setShowSchedule(p => !p)} className={`text-xs text-white font-semibold py-1 px-3 rounded-full transition-colors mb-1 flex items-center gap-2 ${showSchedule ? 'bg-indigo-600' : 'bg-slate-800/50 backdrop-blur-sm border border-white/10 hover:bg-slate-700/50'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            {showSchedule ? 'Hide' : 'Show'} Schedule
                         </button>
                    </div>

                    {activeTab === 'tasks' ? (
                        <div className={`grid gap-6 transition-all duration-300 ${showSchedule ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                            {/* Left Column: Task List */}
                            <div className="space-y-4">
                                <form onSubmit={addDailyTask} className="bg-slate-800/30 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                         <div className="flex-grow relative">
                                             <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="What needs doing?" className="w-full p-3 pr-10 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-white placeholder-gray-500"/>
                                             <button type="button" onClick={handleVoiceInput} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-gray-400 hover:text-cyan-400 hover:bg-slate-800/50'}`} title="Voice Input">
                                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                             </button>
                                         </div>
                                         <div className="w-full sm:w-24 flex-shrink-0"><input type="number" value={newTaskTime} onChange={e => setNewTaskTime(parseInt(e.target.value) || 0)} placeholder="Min" className="w-full p-3 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg text-center focus:ring-2 focus:ring-cyan-500 focus:outline-none" title="Estimated Time (minutes)"/></div>
                                    </div>
                                    <div className="flex flex-wrap gap-4 justify-between items-center">
                                        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                                            <div className="flex bg-slate-800/50 backdrop-blur-sm rounded-lg p-1 border border-white/10 w-full sm:w-auto justify-between sm:justify-start">
                                                {Object.values(TaskEffort).map((effort) => (
                                                    <button key={effort} type="button" onClick={() => setNewTaskEffort(effort)} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all flex-1 sm:flex-none justify-center ${newTaskEffort === effort ? effortConfig[effort].color : 'text-gray-400 hover:text-gray-200'}`} title={effort}><span>{effortConfig[effort].icon}</span><span className="hidden sm:inline">{effortConfig[effort].label}</span></button>
                                                ))}
                                            </div>
                                            <select value={newTaskType} onChange={e => setNewTaskType(e.target.value as TaskType)} className="bg-slate-800/50 backdrop-blur-sm text-xs text-gray-300 p-2 rounded-lg border border-white/10 focus:outline-none focus:border-cyan-500 w-full sm:w-auto">{Object.entries(taskTypeConfig).map(([key, {name}]) => <option key={key} value={key}>{name}</option>)}</select>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button type="button" onClick={handleSmartReschedule} disabled={dailyTasks.filter(t => !t.completed).length === 0} className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-300 hover:text-white border border-orange-600/50 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Move incomplete tasks to backlog">
                                                📅 Reschedule
                                            </button>
                                            <button type="button" onClick={handleGenerateSmartTasks} disabled={isGeneratingTasks} className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-white border border-purple-600/50 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                                {isGeneratingTasks ? <span className="animate-spin">↻</span> : '🤖 AI Suggest'}
                                            </button>
                                            <button type="button" onClick={handleSmartSort} disabled={isSorting || dailyTasks.length < 2} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white border border-indigo-600/50 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                                {isSorting ? <span className="animate-spin">↻</span> : '✨ Smart Sort'}
                                            </button>
                                            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all hover:shadow-cyan-500/20 w-full sm:w-auto">Add</button>
                                        </div>
                                    </div>
                                    {realityCheckWarning && (
                                        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/50 p-2 rounded-lg flex items-center gap-2 animate-fade-in">
                                            <span>⚠️</span> {realityCheckWarning}
                                        </div>
                                    )}
                                </form>
                                
                                {smartTasks && (
                                    <div className="p-4 bg-indigo-900/20 rounded-lg border border-indigo-500/30 animate-scale-in">
                                        <div className="flex justify-between mb-2"><h4 className="font-bold text-indigo-300">AI Suggestions</h4><button onClick={() => setSmartTasks(null)} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button></div>
                                        <div className="space-y-2">{smartTasks.map((task, i) => (<div key={i} className="flex justify-between items-center bg-slate-800/30 backdrop-blur-md p-3 rounded-xl border border-white/10 hover:border-indigo-500/50 transition-colors"><div><p className="text-sm text-gray-200 font-medium">{task.task}</p><p className="text-xs text-indigo-300 mt-0.5">Focus: {task.topic} • {task.time} mins</p></div><button onClick={() => addSmartTask(task)} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded font-bold shadow-lg">Add</button></div>))}</div>
                                    </div>
                                )}

                                <div className="space-y-3 min-h-[200px]">
                                    {showSchedule && displayedTasks.length === 0 && dailyTasks.length > 0 && <div className="text-center text-gray-500 py-4 border-2 border-dashed border-slate-800 rounded-lg">All tasks scheduled!</div>}
                                    {displayedTasks.map((task, index) => (
                                        <div 
                                            key={task.id} 
                                            draggable={showSchedule} 
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                                            className={`group relative p-4 bg-slate-800/30 backdrop-blur-md rounded-xl border flex items-center gap-4 transition-all hover:bg-slate-800/50 ${
                                                task.isGhost && !task.completed ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-white/10 hover:border-white/20'
                                            } ${task.completed ? 'opacity-60' : ''} ${lastCompletedTaskId === task.id ? 'animate-power-up' : ''} ${showSchedule ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                        >
                                            <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${taskTypeConfig[task.taskType].color.replace('border-l-', 'bg-')}`}></div>
                                            <div className="pl-3"><input type="checkbox" checked={task.completed} onChange={() => toggleDailyTask(task.id)} className="w-5 h-5 rounded border-white/20 text-cyan-500 bg-slate-800/50 backdrop-blur-sm focus:ring-offset-0 focus:ring-2 focus:ring-cyan-500 cursor-pointer"/></div>
                                            <div className="flex-grow min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {task.isGhost && !task.completed && <span className="text-red-400 text-sm animate-pulse" title="Unfinished from previous day">👻</span>}
                                                    <span className={`text-sm font-medium line-clamp-2 sm:line-clamp-1 ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</span>
                                                    {task.effort === TaskEffort.High && <span className="text-[10px] bg-red-900/30 text-red-300 border border-red-800 px-1.5 rounded flex-shrink-0">Deep Work</span>}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap"><span className="flex items-center gap-1">{taskTypeConfig[task.taskType].icon} {taskTypeConfig[task.taskType].name}</span><span>•</span><span>{task.estimatedTime}m</span></div>
                                                {task.accomplishment && <div className="mt-2 text-xs text-green-400 bg-green-900/20 p-1.5 rounded border border-green-900/30 inline-block">✓ {task.accomplishment}</div>}
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <button onClick={() => handleStartFocus(task)} disabled={isTimerActive && activeTask?.id !== task.id} className="p-2 bg-slate-800/50 backdrop-blur-sm border border-white/10 hover:bg-cyan-600 hover:text-white hover:border-cyan-500 rounded-lg text-gray-400 transition-colors" title="Focus on this task"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
                                                <button onClick={() => deleteDailyTask(task.id)} className="p-2 bg-slate-800/50 backdrop-blur-sm border border-white/10 hover:bg-red-600 hover:text-white hover:border-red-500 rounded-lg text-gray-400 transition-colors" title="Delete task"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right Column: Schedule */}
                            {showSchedule && (
                                <TimeBlockSchedule 
                                    tasks={dailyTasks} 
                                    onDropTask={handleScheduleDrop} 
                                    onRemoveTask={handleUnschedule}
                                    userProfile={userProfile} 
                                />
                            )}
                        </div>
                    ) : (
                        // Weekly Goals Tab
                         <div className="space-y-6">
                            <form onSubmit={addWeeklyGoal} className="flex flex-col sm:flex-row gap-3">
                                <input type="text" value={newWeeklyGoal} onChange={e => setNewWeeklyGoal(e.target.value)} placeholder="Add a goal for this week..." className="flex-grow p-3 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 text-white"/>
                                <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg">Add</button>
                            </form>
                            <div className="space-y-3">
                                {goals.map(goal => (
                                    <div key={goal.id} className="p-4 bg-slate-800/30 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-4 group">
                                        <input type="checkbox" checked={goal.completed} onChange={() => toggleWeeklyGoal(goal.id)} className="w-5 h-5 rounded border-white/20 text-cyan-500 bg-slate-800/50 backdrop-blur-sm focus:ring-offset-0"/>
                                        <div className="flex-grow"><p className={`transition-colors ${goal.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{goal.text}</p></div>
                                        <button onClick={() => handlePlanForGoal(goal)} disabled={isSuggestingTasks} className="bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white text-xs font-bold py-1 px-3 rounded transition-colors disabled:opacity-40">
                                            {isSuggestingTasks ? '...' : 'Plan Daily Tasks'}
                                        </button>
                                        <button onClick={() => deleteWeeklyGoal(goal.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-lg">×</button>
                                    </div>
                                ))}
                            </div>
                            {suggestedTasks && (
                                <div className="mt-4 p-4 bg-indigo-900/20 rounded-lg border border-indigo-500/30 animate-scale-in">
                                    <div className="flex justify-between mb-2"><h4 className="font-bold text-indigo-300">Suggested Breakdown</h4><button onClick={() => setSuggestedTasks(null)} className="text-gray-500 hover:text-white">&times;</button></div>
                                    <div className="space-y-2">
                                        {suggestedTasks.map((task, i) => (
                                            <div key={i} className="flex justify-between items-center bg-slate-800/30 backdrop-blur-md p-2 rounded-xl border border-white/10">
                                                <span className="text-sm text-gray-300">{task.task} ({task.time}m)</span>
                                                <button onClick={() => addSuggestedTask(task)} className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded">Add</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'summary' && (
                        <div className="bg-slate-800/30 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-cyan-300">End of Day Summary</h3>
                                <div className="flex gap-2">
                                    <button onClick={handleGenerateSummary} disabled={isSummaryLoading} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isSummaryLoading ? 'Analyzing...' : 'Generate Today'}
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {Object.keys(summaries).length > 0 ? (
                                    Object.entries(summaries)
                                        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                                        .map(([date, summaryText]) => (
                                            <div key={date} className="bg-slate-800/30 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                                <div className="flex justify-between items-center mb-3 border-b border-slate-700/50 pb-2">
                                                    <span className="text-sm font-semibold text-indigo-300">{date}</span>
                                                    <button 
                                                        onClick={() => handlePlaySummaryAudio(summaryText)} 
                                                        disabled={isAudioLoading}
                                                        className="text-gray-400 hover:text-indigo-300 transition-colors"
                                                        title="Play Audio"
                                                    >
                                                        🔊
                                                    </button>
                                                </div>
                                                <div className="text-gray-300 text-sm leading-relaxed markdown-body">
                                                    <MarkdownRenderer content={summaryText} title="Daily_Summary" />
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400 text-sm">No summaries yet. Generate one at the end of your day!</p>
                                    </div>
                                )}
                            </div>
                            {audioUrl && (
                                <audio controls src={audioUrl} className="w-full mt-4 h-8" autoPlay />
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'history' && (
                        <div className="bg-slate-800/30 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-cyan-300">Daily Plan History</h3>
                            </div>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {Object.keys(planHistory).length > 0 ? (
                                    <div className="space-y-6">
                                        {Object.entries(planHistory)
                                            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                                            .map(([date, tasks]) => (
                                                <div key={date} className="bg-slate-800/30 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden">
                                                    <div className="bg-slate-800/50 backdrop-blur-sm p-4 border-b border-white/10 font-bold text-indigo-300 flex justify-between items-center">
                                                        <span>{date}</span>
                                                        <span className="text-sm font-normal text-gray-400">
                                                            {tasks.filter(t => t.completed).length} / {tasks.length} Completed
                                                        </span>
                                                    </div>
                                                    <div className="p-4 space-y-2">
                                                        {tasks.map(task => (
                                                            <div key={task.id} className={`flex items-center gap-3 p-2 rounded-md ${task.completed ? 'bg-slate-900/50 backdrop-blur-sm opacity-70 border border-white/5' : 'bg-slate-800/50 backdrop-blur-sm border border-white/10'}`}>
                                                                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${task.completed ? 'bg-cyan-500' : 'border-2 border-white/20'}`}></div>
                                                                <div className="flex-grow min-w-0">
                                                                    <p className={`text-sm ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.text}</p>
                                                                </div>
                                                                <div className="text-xs text-gray-500 whitespace-nowrap">
                                                                    {task.estimatedTime}m
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-gray-400 text-lg">No daily plans saved yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                {bioStats && !(bioStats as any).skipped && !showBioCheck && (
                    <MorningReadinessSummaryWidget stats={bioStats} />
                )}
                <div className="bg-slate-800/30 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div key={streakData.animationKey} className={`text-center relative z-10 ${streakData.count > 0 ? 'streak-pop-animation' : ''}`}>
                         <h3 className="text-lg font-bold text-amber-400 uppercase tracking-wider mb-2">Daily Streak</h3>
                         <div className="flex items-center justify-center gap-3 mb-1">
                            <span className="text-6xl font-black text-white drop-shadow-md">{streakData.count}</span>
                            <span className="text-5xl">🔥</span>
                         </div>
                         <p className="text-sm text-gray-400">{streakData.count > 0 ? 'You are on fire!' : 'Complete all tasks to start.'}</p>
                    </div>
                </div>
                
                <div className="bg-slate-800/30 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/10">
                    <h3 className="text-lg font-bold text-cyan-300 mb-6 text-center">Focus Timer</h3>
                    <div className="relative w-56 h-56 mx-auto mb-8 group cursor-pointer" onClick={handleTimerToggle} title={isTimerActive ? "Click to Pause" : "Click to Start"}>
                        <svg className="w-full h-full transform -rotate-90 drop-shadow-xl" viewBox="0 0 100 100">
                            <circle className="text-slate-700" strokeWidth="4" stroke="currentColor" fill="transparent" r="46" cx="50" cy="50" />
                            <circle className={`transition-all duration-1000 ease-linear ${isTimerActive ? 'text-cyan-400' : 'text-slate-500'}`} strokeWidth="4" strokeDasharray={2 * Math.PI * 46} strokeDashoffset={(2 * Math.PI * 46) * (1 - progress)} strokeLinecap="round" stroke="currentColor" fill="transparent" r="46" cx="50" cy="50" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-bold text-white tracking-tighter tabular-nums">{formatTime(timeLeft)}</span>
                            <span className={`text-xs font-semibold uppercase tracking-widest mt-2 ${isTimerActive ? 'text-cyan-400 animate-pulse' : 'text-gray-500'}`}>{isTimerActive ? 'Focusing' : 'Paused'}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <button onClick={() => handleTimerModeChange('focus')} className={`py-2 rounded-md text-xs font-bold transition-colors ${timerMode === 'focus' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-800/50 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-slate-700/50'}`}>Focus (25)</button>
                        <button onClick={() => handleTimerModeChange('short')} className={`py-2 rounded-md text-xs font-bold transition-colors ${timerMode === 'short' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-800/50 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-slate-700/50'}`}>Short Break (5)</button>
                        <button onClick={() => handleTimerModeChange('long')} className={`py-2 rounded-md text-xs font-bold transition-colors ${timerMode === 'long' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-800/50 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-slate-700/50'}`}>Long Break (15)</button>
                        <button onClick={() => handleTimerModeChange('custom')} className={`py-2 rounded-md text-xs font-bold transition-colors ${timerMode === 'custom' ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-slate-800/50 backdrop-blur-sm border border-white/10 text-gray-400 hover:bg-slate-700/50'}`}>Custom</button>
                    </div>
                    {showCustomInput && (
                        <div className="flex justify-center items-center gap-2 mb-6 bg-slate-800/30 backdrop-blur-md p-2 rounded-xl border border-white/10">
                            <span className="text-sm text-gray-400">Duration:</span>
                            <input type="number" value={customTime} onChange={e => { const val = Math.max(1, parseInt(e.target.value) || 1); setCustomTime(val); setTimerState({ timeLeft: val * 60 }); }} className="w-16 p-1 bg-slate-800/50 backdrop-blur-sm border border-white/10 rounded text-center text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"/>
                            <span className="text-sm text-gray-400">min</span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={handleTimerToggle} className={`flex-grow font-bold py-3 rounded-lg shadow-lg transition-transform active:scale-95 ${isTimerActive ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}>{isTimerActive ? 'Pause' : 'Start Timer'}</button>
                        <button onClick={handleTimerReset} className="px-4 bg-slate-800/50 backdrop-blur-sm border border-white/10 hover:bg-slate-700/50 text-gray-300 rounded-lg transition-colors" title="Reset">↺</button>
                    </div>
                </div>
                 <FocusAnalyticsWidget logs={logs} />
            </div>
            </div>
            <canvas ref={canvasRef} className="particle-canvas pointer-events-none" />
        </div>
    );
};
