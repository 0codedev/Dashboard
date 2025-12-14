
import React, { useState, useRef, useEffect } from 'react';
import type { AiAssistantPreferences, NotificationPreferences, UserProfile, Theme, AppearancePreferences, TestReport, QuestionLog, LongTermGoal, GamificationState, StudyGoal, ChatMessage, LlmTaskCategory, TargetExam } from '../types';
import { getDailyQuote } from '../services/geminiService';
import { MODEL_REGISTRY, TASK_DEFAULTS } from '../services/llm/models';
import Modal from './common/Modal';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { Select } from './common/Select';

interface SettingsProps {
    apiKey: string;
    onKeySubmit: (key: string) => void;
    onClearKey: () => void;
    
    handleFullReset: () => void;
    handleReportsReset: () => void;
    handleChatReset: () => void;
    handleGamificationReset: () => void;

    aiPreferences: AiAssistantPreferences;
    setAiPreferences: React.Dispatch<React.SetStateAction<AiAssistantPreferences>>;
    notificationPreferences: NotificationPreferences;
    setNotificationPreferences: React.Dispatch<React.SetStateAction<NotificationPreferences>>;
    appearancePreferences: AppearancePreferences;
    setAppearancePreferences: React.Dispatch<React.SetStateAction<AppearancePreferences>>;
    
    userProfile: UserProfile; 
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    longTermGoals: LongTermGoal[];
    setLongTermGoals: React.Dispatch<React.SetStateAction<LongTermGoal[]>>;
    
    theme: Theme;
    setTheme: React.Dispatch<React.SetStateAction<Theme>>;

    reports: TestReport[];
    logs: QuestionLog[];
    onSyncData: (data: any) => void; 
    addToast: (toast: any) => void;

    gamificationState: GamificationState;
    studyGoals: StudyGoal[];
    chatHistory: ChatMessage[];
}

type SettingsCategory = 'profile' | 'appearance' | 'ai' | 'connectivity' | 'data';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <div className="flex items-center justify-between group">
        <span className="text-gray-300 group-hover:text-gray-100 transition-colors text-sm font-medium">{label}</span>
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-all focus:outline-none ${checked ? 'bg-[rgb(var(--color-primary-rgb))]' : 'bg-slate-700 border border-slate-600'}`}
        >
            <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform shadow-md ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
);

// --- 1. PROFILE & STRATEGY SETTINGS ---
const ProfileSettings: React.FC<Pick<SettingsProps, 'userProfile' | 'setUserProfile' | 'longTermGoals' | 'setLongTermGoals'>> = ({ userProfile, setUserProfile, longTermGoals, setLongTermGoals }) => {
    const [newGoal, setNewGoal] = useState('');

    const handleGoalAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newGoal.trim()) {
            setLongTermGoals(prev => [...prev, { id: Date.now().toString(), text: newGoal, completed: false }]);
            setNewGoal('');
        }
    };

    const handleGoalRemove = (id: string) => {
        setLongTermGoals(prev => prev.filter(g => g.id !== id));
    };

    const updateTime = (period: 'morning' | 'afternoon' | 'evening', val: string) => {
        setUserProfile(prev => ({ ...prev, studyTimes: { ...prev.studyTimes, [period]: val } }));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <h3 className="text-lg font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <span className="text-xl">👤</span> Identity & Goals
                </h3>
                
                <div className="grid grid-cols-1 gap-6 mb-6">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Display Name</label>
                        <Input 
                            value={userProfile.name} 
                            onChange={e => setUserProfile(prev => ({ ...prev, name: e.target.value }))} 
                            placeholder="e.g. Future IITian"
                            className="bg-slate-900 border-slate-700 focus:border-cyan-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Target Exam Date</label>
                         <Input 
                            type="date"
                            value={userProfile.targetExamDate || ''} 
                            onChange={e => setUserProfile(prev => ({ ...prev, targetExamDate: e.target.value }))} 
                            className="bg-slate-900 border-slate-700 focus:border-cyan-500 transition-colors"
                        />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Syllabus Buffer (Days)</label>
                         <Input 
                            type="number"
                            value={userProfile.syllabusCompletionBufferDays || 90} 
                            onChange={e => setUserProfile(prev => ({ ...prev, syllabusCompletionBufferDays: parseInt(e.target.value) || 0 }))} 
                            className="bg-slate-900 border-slate-700 focus:border-cyan-500 transition-colors"
                        />
                    </div>
                </div>

                <div className="mt-6">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Primary Target</label>
                    <div className="flex flex-wrap gap-2">
                        {['JEE Mains', 'JEE Advanced', 'BITSAT', 'NEET'].map(exam => (
                            <button
                                key={exam}
                                onClick={() => {
                                    const current = userProfile.targetExams || [];
                                    const exists = current.includes(exam as any);
                                    const newExams = exists ? current.filter(e => e !== exam) : [...current, exam as any];
                                    setUserProfile(prev => ({ ...prev, targetExams: newExams }));
                                }}
                                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all duration-200 ${
                                    userProfile.targetExams?.includes(exam as any)
                                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                        : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {exam}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                 <h3 className="text-lg font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <span className="text-xl">👥</span> Cohort Calibration
                </h3>
                <p className="text-xs text-slate-400 mb-4">Set the estimated number of students for percentile calculations.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">JEE Mains Cohort Size</label>
                        <Input 
                            type="number"
                            value={userProfile.cohortSizes?.['JEE Mains'] || 10000} 
                            onChange={e => setUserProfile(prev => ({ ...prev, cohortSizes: { ...prev.cohortSizes, 'JEE Mains': parseInt(e.target.value) } }))}
                            className="bg-slate-900 border-slate-700"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase block mb-1">JEE Advanced Cohort Size</label>
                        <Input 
                            type="number"
                            value={userProfile.cohortSizes?.['JEE Advanced'] || 2500} 
                            onChange={e => setUserProfile(prev => ({ ...prev, cohortSizes: { ...prev.cohortSizes, 'JEE Advanced': parseInt(e.target.value) } }))}
                            className="bg-slate-900 border-slate-700"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                 <h3 className="text-lg font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <span className="text-xl">⏱️</span> Pace Strategy (Target Time/Q)
                </h3>
                <p className="text-xs text-slate-400 mb-4">Set your ideal time per question. This calibrates the "Paper Strategy Simulator" to detect panic moments.</p>
                <div className="space-y-4">
                    {['physics', 'chemistry', 'maths'].map(subject => (
                        <div key={subject} className="flex items-center gap-4">
                            <label className="w-24 text-xs font-bold text-slate-300 uppercase capitalize">{subject}</label>
                            <input 
                                type="range" 
                                min="30" max="300" step="10"
                                value={userProfile.targetTimePerQuestion?.[subject as 'physics'|'chemistry'|'maths'] || 120}
                                onChange={(e) => setUserProfile(prev => ({
                                    ...prev, 
                                    targetTimePerQuestion: { ...prev.targetTimePerQuestion, [subject]: parseInt(e.target.value) }
                                }))}
                                className={`flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-${subject === 'physics' ? 'cyan' : subject === 'chemistry' ? 'emerald' : 'red'}-500`}
                            />
                            <span className="w-16 text-right text-sm font-mono text-slate-200">
                                {userProfile.targetTimePerQuestion?.[subject as 'physics'|'chemistry'|'maths']} s
                            </span>
                        </div>
                    ))}
                    <div className="flex justify-between text-[10px] text-slate-600 px-28">
                        <span>Sprint (30s)</span>
                        <span>Marathon (300s)</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <h3 className="text-lg font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <span className="text-xl">📅</span> Study Routine
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['morning', 'afternoon', 'evening'].map((period) => (
                        <div key={period} className="bg-slate-900 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{period} Slot</label>
                            <Input 
                                value={userProfile.studyTimes[period as 'morning'|'afternoon'|'evening']} 
                                onChange={e => updateTime(period as any, e.target.value)}
                                className="text-sm border-none bg-transparent focus:ring-0 px-0"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <h3 className="text-lg font-bold text-cyan-400 mb-6 flex items-center gap-2">
                    <span className="text-xl">🔭</span> Vision Board
                </h3>
                <form onSubmit={handleGoalAdd} className="flex gap-2 mb-4">
                    <Input 
                        value={newGoal} 
                        onChange={e => setNewGoal(e.target.value)} 
                        placeholder="Add a major milestone (e.g. 'Top 500 Rank')"
                        className="flex-grow bg-slate-900 border-slate-700 focus:border-cyan-500"
                    />
                    <Button type="submit" variant="primary">Add</Button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {longTermGoals.map(goal => (
                        <div key={goal.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700 group hover:border-slate-600 transition-all">
                            <span className="text-sm text-slate-300">{goal.text}</span>
                            <button onClick={() => handleGoalRemove(goal.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        </div>
                    ))}
                    {longTermGoals.length === 0 && <p className="text-xs text-slate-600 italic text-center py-2">"A goal without a plan is just a wish."</p>}
                </div>
            </div>
        </div>
    );
};

// --- 2. APPEARANCE SETTINGS ---
const AppearanceSettings: React.FC<Pick<SettingsProps, 'theme' | 'setTheme' | 'appearancePreferences' | 'setAppearancePreferences'>> = ({ theme, setTheme, appearancePreferences, setAppearancePreferences }) => {
    const themes: { id: Theme; name: string; color: string; desc: string }[] = [
        { id: 'cyan', name: 'Cyber Cyan', color: '#22d3ee', desc: 'High energy, focus-oriented.' },
        { id: 'indigo', name: 'Deep Indigo', color: '#818cf8', desc: 'Calm, deep thinking.' },
        { id: 'green', name: 'Matrix Green', color: '#34d399', desc: 'Growth, consistency.' },
        { id: 'red', name: 'Focus Red', color: '#f87171', desc: 'Urgency, intensity.' },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <h3 className="text-lg font-bold text-[rgb(var(--color-primary-rgb))] mb-6 flex items-center gap-2">
                    <span className="text-xl">🎨</span> Interface Theme
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {themes.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTheme(t.id)}
                            className={`relative p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all duration-300 group overflow-hidden ${theme === t.id ? 'border-white bg-slate-800 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'}`}
                        >
                            <div 
                                className={`w-12 h-12 rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110 ${theme === t.id ? 'scale-110' : ''}`}
                                style={{ backgroundColor: t.color, boxShadow: `0 0 15px ${t.color}66` }}
                            ></div>
                            <div className="text-center z-10">
                                <span className={`block font-bold text-sm ${theme === t.id ? 'text-white' : 'text-slate-400'}`}>{t.name}</span>
                                <span className="text-[10px] text-slate-500">{t.desc}</span>
                            </div>
                            {theme === t.id && (
                                <div className="absolute top-2 right-2 text-xs bg-white text-black font-bold px-1.5 rounded">✓</div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <h3 className="text-lg font-bold text-[rgb(var(--color-primary-rgb))] mb-6 flex items-center gap-2">
                    <span className="text-xl">👁️</span> Visual Comfort
                </h3>
                <div className="space-y-6">
                     <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-200">Particle Effects</p>
                            <p className="text-xs text-slate-500">Disable floating background particles for performance.</p>
                        </div>
                        <ToggleSwitch 
                            label="" 
                            checked={!appearancePreferences.disableParticles} 
                            onChange={c => setAppearancePreferences(p => ({ ...p, disableParticles: !c }))} 
                        />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-200">Reduced Motion</p>
                            <p className="text-xs text-slate-500">Minimize animations and transitions.</p>
                        </div>
                        <ToggleSwitch 
                            label="" 
                            checked={appearancePreferences.reduceMotion} 
                            onChange={c => setAppearancePreferences(p => ({ ...p, reduceMotion: c }))} 
                        />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-200">High Contrast</p>
                            <p className="text-xs text-slate-500">Increase contrast for better readability.</p>
                        </div>
                        <ToggleSwitch 
                            label="" 
                            checked={appearancePreferences.highContrast} 
                            onChange={c => setAppearancePreferences(p => ({ ...p, highContrast: c }))} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 3. AI SETTINGS (ENHANCED) ---
const TASK_USAGE_DESC: Record<LlmTaskCategory, string> = {
    chat: "General Chat Assistant, Contextual Explanations",
    analysis: "Deep Performance Analysis, Root Cause 5-Whys, Executive Briefing",
    planning: "Daily Planner Generation, Study Plan Creation, Smart Sorting",
    creative: "Motivational Quotes, Persona-based Coaching, Insights",
    math: "Gatekeeper Quizzes, Numerical Problem Solving",
    coding: "Data Formatting, Structural Parsing (Internal Logic)"
};

const AdvancedModelConfig: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    preferences: AiAssistantPreferences; 
    onUpdate: (prefs: AiAssistantPreferences) => void; 
}> = ({ isOpen, onClose, preferences, onUpdate }) => {
    
    const taskCategories: { id: LlmTaskCategory; label: string; icon: string }[] = [
        { id: 'chat', label: 'General Chat', icon: '💬' },
        { id: 'analysis', label: 'Deep Analysis', icon: '🧠' },
        { id: 'planning', label: 'Planning', icon: '📅' },
        { id: 'creative', label: 'Creative', icon: '✨' },
        { id: 'math', label: 'Math & STEM', icon: '📐' },
        { id: 'coding', label: 'Technical Ops', icon: '💻' }
    ];

    const handleOverrideChange = (task: LlmTaskCategory, modelId: string) => {
        onUpdate({
            ...preferences,
            modelOverrides: {
                ...preferences.modelOverrides,
                [task]: modelId
            }
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Advanced Neural Routing">
            <div className="p-1 space-y-6">
                <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-lg flex gap-3 items-start">
                    <span className="text-2xl">⚡</span>
                    <div>
                        <p className="text-sm text-blue-200 font-bold">Precision Control</p>
                        <p className="text-xs text-blue-300/70 mt-1">
                            Assign specialized AI models to specific cognitive tasks. If a selected model is unavailable (e.g., API key missing), the system automatically fails over to <strong>Gemini Flash</strong>.
                        </p>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {taskCategories.map(task => {
                        const currentModelId = preferences.modelOverrides?.[task.id] || TASK_DEFAULTS[task.id][0];
                        const currentModelDef = MODEL_REGISTRY.find(m => m.id === currentModelId);

                        // Fix repeated provider name in display
                        const displayModelName = currentModelDef?.name 
                            ? (currentModelDef.name.toLowerCase().includes(currentModelDef.provider) 
                                ? currentModelDef.name 
                                : `${currentModelDef.name} (${currentModelDef.provider})`)
                            : currentModelId;

                        return (
                            <div key={task.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center">
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                        <span className="text-lg">{task.icon}</span> {task.label}
                                    </h4>
                                    <p className="text-[11px] text-slate-400 mt-1 pl-7">{TASK_USAGE_DESC[task.id]}</p>
                                </div>
                                
                                <div className="w-full md:w-64 flex flex-col gap-2">
                                    <div className="relative">
                                        <select 
                                            value={currentModelId} 
                                            onChange={(e) => handleOverrideChange(task.id, e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none appearance-none font-medium"
                                        >
                                            {MODEL_REGISTRY.map(model => {
                                                const label = model.name.toLowerCase().includes(model.provider) 
                                                    ? model.name 
                                                    : `${model.name} (${model.provider})`;
                                                return <option key={model.id} value={model.id}>{label}</option>
                                            })}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs">▼</div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center px-1">
                                        <div className="flex gap-2">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider border ${
                                                currentModelDef?.provider === 'google' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                currentModelDef?.provider === 'groq' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                            }`}>
                                                {currentModelDef?.provider}
                                            </span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                                {currentModelDef?.contextWindow ? (currentModelDef.contextWindow / 1000) + 'k ctx' : 'N/A'}
                                            </span>
                                        </div>
                                        <span className={`text-[9px] font-bold ${currentModelDef?.costCategory === 'free' ? 'text-green-500' : 'text-yellow-500'}`}>
                                            {currentModelDef?.costCategory === 'free' ? 'FREE' : 'PAID'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="flex justify-end pt-4 border-t border-slate-700/50">
                    <Button onClick={onClose} variant="primary" className="px-8 shadow-lg shadow-cyan-500/20">Save Configuration</Button>
                </div>
            </div>
        </Modal>
    );
};

const AiSettings: React.FC<Pick<SettingsProps, 'aiPreferences' | 'setAiPreferences' | 'notificationPreferences' | 'setNotificationPreferences'>> = ({ aiPreferences, setAiPreferences, notificationPreferences, setNotificationPreferences }) => {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    return (
        <div className="space-y-8 animate-fade-in">
            <AdvancedModelConfig 
                isOpen={isAdvancedOpen} 
                onClose={() => setIsAdvancedOpen(false)} 
                preferences={aiPreferences} 
                onUpdate={setAiPreferences} 
            />

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700/50 pb-4">
                    <h3 className="text-lg font-bold text-[rgb(var(--color-primary-rgb))] flex items-center gap-2">
                        <span className="text-xl">🤖</span> Cognitive Settings
                    </h3>
                    <button 
                        onClick={() => setIsAdvancedOpen(true)}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-600 hover:border-slate-500 shadow-sm"
                    >
                        <span>⚙️</span> Advanced Routing
                    </button>
                </div>
                
                <div className="mb-6 p-4 bg-indigo-900/20 rounded-xl border border-indigo-500/30">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl flex-shrink-0 border border-indigo-500/30">🤔</div>
                        <div className="flex-grow">
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="text-sm font-bold text-indigo-200">Socratic Coaching Mode</h5>
                                <ToggleSwitch checked={!!aiPreferences.socraticMode} onChange={checked => setAiPreferences(prev => ({ ...prev, socraticMode: checked }))} label=""/>
                            </div>
                            <p className="text-xs text-indigo-300/70 leading-relaxed">
                                Instead of giving direct answers, the AI will ask guiding questions to help you discover the solution yourself. 
                                Great for deep learning.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Response Verbosity</label>
                        <Select 
                            value={aiPreferences.responseLength} 
                            onChange={e => setAiPreferences(prev => ({ ...prev, responseLength: e.target.value as any }))} 
                            className="w-full bg-slate-900 border-slate-700 text-sm"
                        >
                            <option value="short">Short & Concise</option>
                            <option value="medium">Balanced</option>
                            <option value="long">Detailed Explanations</option>
                        </Select>
                    </div>
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Coaching Persona</label>
                        <Select 
                            value={aiPreferences.tone} 
                            onChange={e => setAiPreferences(prev => ({ ...prev, tone: e.target.value as any }))} 
                            className="w-full bg-slate-900 border-slate-700 text-sm"
                        >
                            <option value="encouraging">Supportive Mentor (High Empathy)</option>
                            <option value="neutral">Analytical Observer (Objective)</option>
                            <option value="direct">Drill Sergeant (Strict)</option>
                        </Select>
                    </div>
                </div>
                
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">System Prompt Override (Advanced)</label>
                    <textarea 
                        value={aiPreferences.customInstructions || ''} 
                        onChange={e => setAiPreferences(prev => ({ ...prev, customInstructions: e.target.value }))} 
                        placeholder="e.g. 'Act as Richard Feynman. Explain concepts using analogies. Be witty.'" 
                        className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white resize-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all placeholder-slate-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-2">Provide specific instructions to shape the AI's personality and output style.</p>
                </div>
            </div>

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                <h3 className="text-lg font-bold text-[rgb(var(--color-primary-rgb))] mb-6 flex items-center gap-2">
                    <span className="text-xl">🔔</span> Proactive Insights
                </h3>
                <div className="space-y-4">
                     <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-200">Achievement Toasts</p>
                        </div>
                        <ToggleSwitch checked={notificationPreferences.achievements} onChange={c => setNotificationPreferences(p => ({...p, achievements: c}))} label=""/>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
                        <div>
                            <p className="text-sm font-medium text-slate-200">Enable Proactive Drop Detection</p>
                        </div>
                        <ToggleSwitch checked={notificationPreferences.proactiveInsights} onChange={c => setNotificationPreferences(p => ({...p, proactiveInsights: c}))} label=""/>
                    </div>
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Sensitivity Threshold</label>
                        <Select 
                            value={notificationPreferences.proactiveInsightSensitivity} 
                            onChange={e => setNotificationPreferences(prev => ({ ...prev, proactiveInsightSensitivity: e.target.value as any }))} 
                            className="w-full bg-slate-900 border-slate-700 text-sm"
                            disabled={!notificationPreferences.proactiveInsights}
                        >
                            <option value="high">High (Notify on &gt;3% drop)</option>
                            <option value="medium">Medium (Notify on &gt;5% drop)</option>
                            <option value="low">Low (Notify on &gt;10% drop)</option>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 4. CONNECTIVITY SETTINGS (PRESERVED) ---
const ConnectivitySettings: React.FC<Pick<SettingsProps, 'onClearKey' | 'apiKey' | 'addToast' | 'aiPreferences' | 'setAiPreferences'>> = ({ onClearKey, apiKey, addToast, aiPreferences, setAiPreferences }) => {
    const [isTesting, setIsTesting] = useState(false);

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            await getDailyQuote(apiKey);
            addToast({ title: 'Connection Successful', message: 'API connection verified.', icon: '✅' });
        } catch {
            addToast({ title: 'Connection Failed', message: 'Could not connect.', icon: '❌' });
        } finally { setIsTesting(false); }
    };
    
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                 <h3 className="text-lg font-bold text-[rgb(var(--color-primary-rgb))] mb-2 flex items-center gap-2">
                    <span className="text-xl">🔌</span> API Gateways
                </h3>
                <p className="text-xs text-slate-400 mb-6">Manage access keys for various AI providers. Keys are stored locally in your browser.</p>
            
                <div className="space-y-6">
                    {/* Google Gemini */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-blue-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-1 bg-blue-500/10 rounded-bl-lg text-[10px] text-blue-400 font-bold border-l border-b border-blue-500/20">PRIMARY</div>
                        <label className="text-xs font-bold text-blue-400 uppercase mb-2 block tracking-wider">Google Gemini (Required)</label>
                        <div className="flex items-center gap-4">
                            <div className="flex-grow font-mono text-xs text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 truncate">
                                {apiKey.substring(0, 8)}••••••••••••••••••••••••••••••{apiKey.substring(apiKey.length - 4)}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleTestConnection} disabled={isTesting} className="text-xs bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-4 py-2.5 rounded-lg transition-colors font-bold border border-blue-500/30">{isTesting ? '...' : 'Test'}</button>
                                <button onClick={onClearKey} className="text-xs bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2.5 rounded-lg transition-colors font-bold border border-red-500/30">Unlink</button>
                            </div>
                        </div>
                    </div>

                    {/* Groq */}
                    <div>
                        <label className="text-xs font-bold text-orange-400 uppercase mb-2 flex justify-between items-center tracking-wider">
                            <span>Groq (Ultra-Fast Inference)</span>
                            <a href="https://console.groq.com/keys" target="_blank" className="text-[10px] text-slate-500 hover:text-orange-400 underline flex items-center gap-1">Get Key <span className="text-[8px]">↗</span></a>
                        </label>
                        <Input 
                            type="password" 
                            value={aiPreferences.groqApiKey || ''} 
                            onChange={e => setAiPreferences(prev => ({...prev, groqApiKey: e.target.value}))}
                            placeholder="gsk_..."
                            className="bg-slate-900 border-slate-700 focus:border-orange-500 focus:ring-orange-500/20"
                        />
                    </div>

                    {/* OpenRouter */}
                    <div>
                        <label className="text-xs font-bold text-purple-400 uppercase mb-2 flex justify-between items-center tracking-wider">
                            <span>OpenRouter (Model Aggregator)</span>
                            <a href="https://openrouter.ai/keys" target="_blank" className="text-[10px] text-slate-500 hover:text-purple-400 underline flex items-center gap-1">Get Key <span className="text-[8px]">↗</span></a>
                        </label>
                        <Input 
                            type="password" 
                            value={aiPreferences.openRouterApiKey || ''} 
                            onChange={e => setAiPreferences(prev => ({...prev, openRouterApiKey: e.target.value}))}
                            placeholder="sk-or-..."
                            className="bg-slate-900 border-slate-700 focus:border-purple-500 focus:ring-purple-500/20"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 5. DATA SETTINGS ---
const DataSettings: React.FC<Pick<SettingsProps, 'handleFullReset' | 'handleReportsReset' | 'handleChatReset' | 'handleGamificationReset' | 'onSyncData' | 'reports' | 'logs' | 'userProfile' | 'aiPreferences' | 'notificationPreferences' | 'appearancePreferences' | 'gamificationState' | 'studyGoals' | 'longTermGoals' | 'chatHistory'>> = ({ 
    handleFullReset, handleReportsReset, handleChatReset, handleGamificationReset, onSyncData,
    reports, logs, userProfile, aiPreferences, notificationPreferences, appearancePreferences, gamificationState, studyGoals, longTermGoals, chatHistory
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        action: () => void;
        dangerLevel: 'high' | 'critical';
    }>({ isOpen: false, title: '', message: '', action: () => {}, dangerLevel: 'high' });

    const openConfirm = (title: string, message: string, action: () => void, dangerLevel: 'high' | 'critical' = 'high') => {
        setConfirmModal({ isOpen: true, title, message, action, dangerLevel });
    };

    const handleBackup = () => {
        const data = {
            version: 1,
            date: new Date().toISOString(),
            reports, logs, userProfile, aiPreferences, notificationPreferences, appearancePreferences, gamificationState, studyGoals, longTermGoals, chatHistory
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `jee-dashboard-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target?.result as string);
                    onSyncData(data);
                } catch (err) {
                    alert('Failed to parse backup file.');
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
             <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({...confirmModal, isOpen: false})} title={confirmModal.title} isInfo>
                <div className="space-y-4">
                    <p className="text-gray-300">{confirmModal.message}</p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="secondary" onClick={() => setConfirmModal({...confirmModal, isOpen: false})}>Cancel</Button>
                        <Button variant="danger" onClick={() => { confirmModal.action(); setConfirmModal({...confirmModal, isOpen: false}); }}>
                            {confirmModal.dangerLevel === 'critical' ? 'I Understand, Delete' : 'Confirm'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700/50 shadow-sm">
                 <h3 className="text-lg font-bold text-[rgb(var(--color-primary-rgb))] mb-2 flex items-center gap-2">
                    <span className="text-xl">💾</span> Data & Privacy
                </h3>
                 <p className="text-xs text-slate-400 mb-6">You own your data. Manage imports, exports, and sanitation.</p>

                <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 mb-8">
                    <h4 className="text-sm font-bold text-white mb-4">Sync & Backup</h4>
                    <div className="flex gap-4">
                        <Button onClick={handleBackup} variant="secondary" className="flex-1 flex items-center justify-center gap-2 py-3 border-slate-600 hover:border-cyan-500">
                            <span>⬇️</span> Download Full Backup
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="flex-1 flex items-center justify-center gap-2 py-3 border-slate-600 hover:border-cyan-500">
                            <span>⬆️</span> Restore from File
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleRestore} accept=".json" className="hidden" />
                    </div>
                </div>
            
                <div className="bg-red-900/10 p-6 rounded-xl border border-red-900/30">
                    <h4 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-2"><span className="text-lg">☢️</span> Danger Zone</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-red-950/30 p-3 rounded border border-red-900/30">
                            <p className="text-xs text-red-200 font-bold mb-1">Academic Data</p>
                            <p className="text-[10px] text-red-300/70 mb-3">Reports & Logs only</p>
                            <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => openConfirm('Purge Reports?', 'This will permanently delete all uploaded test reports and question logs. This cannot be undone.', handleReportsReset)} 
                                className="w-full"
                            >
                                Purge Reports
                            </Button>
                        </div>
                         <div className="bg-red-950/30 p-3 rounded border border-red-900/30">
                            <p className="text-xs text-red-200 font-bold mb-1">AI Memory</p>
                            <p className="text-[10px] text-red-300/70 mb-3">Chat history</p>
                            <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => openConfirm('Wipe AI Memory?', 'This will clear your entire chat history with the AI Coach.', handleChatReset)} 
                                className="w-full"
                            >
                                Wipe Memory
                            </Button>
                        </div>
                         <div className="bg-red-950/30 p-3 rounded border border-red-900/30">
                            <p className="text-xs text-red-200 font-bold mb-1">Career Progress</p>
                            <p className="text-[10px] text-red-300/70 mb-3">XP, Levels, Badges</p>
                            <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => openConfirm('Reset Progress?', 'This will reset your XP, Level, and all earned Achievements.', handleGamificationReset)} 
                                className="w-full"
                            >
                                Reset Progress
                            </Button>
                        </div>
                        <div className="bg-red-950/30 p-3 rounded border border-red-900/30">
                            <p className="text-xs text-red-200 font-bold mb-1">Factory Reset</p>
                            <p className="text-[10px] text-red-300/70 mb-3">Everything</p>
                            <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => openConfirm('Factory Reset?', 'ARE YOU SURE? This will wipe ALL data including settings, profile, and logs. This action is irreversible.', handleFullReset, 'critical')} 
                                className="w-full font-black tracking-widest"
                            >
                                NUKE DATA
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Settings: React.FC<SettingsProps> = (props) => {
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');

    const categories: { id: SettingsCategory, label: string, icon: string }[] = [
        { id: 'profile', label: 'Profile & Strategy', icon: '👤' },
        { id: 'appearance', label: 'Appearance', icon: '🎨' },
        { id: 'ai', label: 'AI Coach', icon: '🤖' },
        { id: 'connectivity', label: 'Connectivity', icon: '🔌' },
        { id: 'data', label: 'Data & Privacy', icon: '💾' },
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col lg:flex-row gap-8">
                <nav className="lg:w-64 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-[rgb(var(--color-primary-accent-rgb))] mb-6 pl-2">Control Center</h2>
                    <ul className="space-y-2">
                        {categories.map(cat => (
                            <li key={cat.id}>
                                <button
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-300 group ${activeCategory === cat.id ? 'bg-[rgb(var(--color-primary-rgb))] text-white shadow-lg shadow-[rgba(var(--color-primary-rgb),0.2)]' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                                >
                                    <span className={`text-lg p-1.5 rounded-lg transition-colors ${activeCategory === cat.id ? 'bg-white/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>{cat.icon}</span>
                                    <span className="font-semibold text-sm">{cat.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <main className="flex-grow bg-slate-900/50 p-1 md:p-6 rounded-3xl min-h-[600px]">
                    {activeCategory === 'profile' && <ProfileSettings userProfile={props.userProfile} setUserProfile={props.setUserProfile} longTermGoals={props.longTermGoals} setLongTermGoals={props.setLongTermGoals} />}
                    {activeCategory === 'appearance' && <AppearanceSettings theme={props.theme} setTheme={props.setTheme} appearancePreferences={props.appearancePreferences} setAppearancePreferences={props.setAppearancePreferences} />}
                    {activeCategory === 'ai' && <AiSettings {...props} />}
                    {activeCategory === 'connectivity' && <ConnectivitySettings {...props} />}
                    {activeCategory === 'data' && <DataSettings {...props} />}
                </main>
            </div>
        </div>
    );
};
