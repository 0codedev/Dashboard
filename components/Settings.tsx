
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { AiAssistantPreferences, NotificationPreferences, UserProfile, Theme, AppearancePreferences, TestReport, QuestionLog, LongTermGoal, TestSubType, GamificationState, StudyGoal, ChatMessage } from '../types';
import { getDailyQuote } from '../services/geminiService';
import { parseReportsFromCsv, parseLogsFromCsv, downloadReportsForSheet, downloadLogsForSheet, exportReportsToCsv, exportLogsToCsv } from '../services/sheetParser';
import { SUBJECT_CONFIG } from '../constants';

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
    onSyncData: (data: any) => void; // Relaxed type to accept full backup
    addToast: (toast: any) => void;

    // New Props for Full Backup
    gamificationState: GamificationState;
    studyGoals: StudyGoal[];
    chatHistory: ChatMessage[];
}

type SettingsCategory = 'profile' | 'appearance' | 'ai' | 'connectivity' | 'data';

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <div className="flex items-center justify-between group">
        <span id={`label-${label.replace(/\s/g, '-')}`} className="text-gray-300 group-hover:text-gray-100 transition-colors">{label}</span>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={`label-${label.replace(/\s/g, '-')}`}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex items-center h-6 rounded-full w-12 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-[rgb(var(--color-primary-rgb))] ${
                checked ? 'bg-[rgb(var(--color-primary-rgb))]' : 'bg-slate-600'
            }`}
        >
            <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform shadow-md ${
                    checked ? 'translate-x-7' : 'translate-x-1'
                }`}
            />
        </button>
    </div>
);

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-2xl w-11/12 max-w-md border border-slate-700 animate-scale-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-red-400 mb-4">{title}</h3>
                <div className="text-gray-300 mb-6">{message}</div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button onClick={() => { onConfirm(); onClose(); }} className="btn bg-red-600 hover:bg-red-700 text-white border-red-700">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

const StrategySlider: React.FC<{ 
    label: string; 
    value: number; 
    onChange: (val: number) => void; 
    min?: number; 
    max?: number; 
    unit?: string 
}> = ({ label, value, onChange, min = 30, max = 300, unit = 's' }) => {
    const percentage = ((value - min) / (max - min)) * 100;
    
    // Color gradient logic based on speed
    let colorClass = 'bg-cyan-500';
    if (value < 60) colorClass = 'bg-red-500'; // Too fast/panic
    else if (value > 180) colorClass = 'bg-blue-500'; // Very slow
    else colorClass = 'bg-green-500'; // Good pace

    return (
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            <div className="flex justify-between mb-2 text-xs font-medium">
                <span className="text-gray-300">{label}</span>
                <span className="text-[rgb(var(--color-primary-rgb))] font-mono">{value} {unit}</span>
            </div>
            <div className="relative h-2 bg-slate-700 rounded-full">
                <div 
                    className={`absolute top-0 left-0 h-full rounded-full ${colorClass} opacity-80 transition-all duration-300`} 
                    style={{ width: `${percentage}%` }}
                ></div>
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    value={value} 
                    onChange={(e) => onChange(parseInt(e.target.value))} 
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-gray-500">
                <span>Sprint ({min}s)</span>
                <span>Marathon ({max}s)</span>
            </div>
        </div>
    );
};

// Sub-components for each category
const ProfileSettings: React.FC<Pick<SettingsProps, 'userProfile' | 'setUserProfile' | 'longTermGoals' | 'setLongTermGoals'>> = ({ userProfile, setUserProfile, longTermGoals, setLongTermGoals }) => {
    const [newLongTermGoal, setNewLongTermGoal] = useState('');

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUserProfile(prev => ({...prev, name: e.target.value}));
    };

    const handleStudyTimeChange = (period: 'morning' | 'afternoon' | 'evening', value: string) => {
        setUserProfile(prev => ({ ...prev, studyTimes: { ...prev.studyTimes, [period]: value }}));
    };
    
    const handleCohortSizeChange = (type: 'JEE Mains' | 'JEE Advanced', value: number) => {
        setUserProfile(prev => ({ ...prev, cohortSizes: { ...prev.cohortSizes, [type]: value }}));
    }

    const handleTargetTimeChange = (subject: 'physics' | 'chemistry' | 'maths', value: number) => {
        setUserProfile(prev => ({ ...prev, targetTimePerQuestion: { ...prev.targetTimePerQuestion, [subject]: value }}));
    }

    const addLongTermGoal = (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (newLongTermGoal.trim() === '') return; 
        setLongTermGoals(prev => [...prev, { id: `long-${Date.now()}`, text: newLongTermGoal, completed: false }]); 
        setNewLongTermGoal(''); 
    };
    const toggleLongTermGoal = (id: string) => { setLongTermGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g)); };
    const deleteLongTermGoal = (id: string) => { setLongTermGoals(prev => prev.filter(g => g.id !== id)); };

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))] mb-2 border-b border-[rgb(var(--color-primary-rgb))] pb-2 inline-block">Profile & Strategy</h3>
                <p className="text-sm text-gray-400 mt-2">Configure your digital twin for accurate simulations.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2"><span className="text-lg">👤</span> Identity & Goals</h4>
                    <div>
                        <label htmlFor="user-name" className="block text-xs font-medium text-gray-400 mb-1">Display Name</label>
                        <input id="user-name" type="text" value={userProfile.name} onChange={handleNameChange} placeholder="Enter your name" className="input-base w-full"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label htmlFor="exam-date" className="block text-xs font-medium text-gray-400 mb-1">Target Exam Date</label>
                            <input 
                                id="exam-date"
                                type="date" 
                                value={userProfile.targetExamDate || ''} 
                                onChange={e => setUserProfile(prev => ({ ...prev, targetExamDate: e.target.value }))} 
                                className="input-base mt-1 w-full"
                            />
                        </div>
                        <div>
                            <label htmlFor="buffer-days" className="block text-xs font-medium text-gray-400 mb-1">Syllabus Buffer (Days)</label>
                            <input 
                                id="buffer-days"
                                type="number" 
                                value={userProfile.syllabusCompletionBufferDays || 90} 
                                onChange={e => setUserProfile(prev => ({ ...prev, syllabusCompletionBufferDays: parseInt(e.target.value) || 0 }))} 
                                className="input-base mt-1 w-full"
                                placeholder="e.g. 90"
                            />
                        </div>
                    </div>
                    
                    <h4 className="text-sm font-bold text-gray-200 mt-6 mb-4 flex items-center gap-2"><span className="text-lg">👥</span> Cohort Calibration</h4>
                    <div className="space-y-3">
                        <div><label className="block text-xs text-gray-400">JEE Mains Cohort Size</label><input type="number" value={userProfile.cohortSizes?.['JEE Mains'] || 0} onChange={e => handleCohortSizeChange('JEE Mains', parseInt(e.target.value))} className="input-base mt-1 w-full"/></div>
                        <div><label className="block text-xs text-gray-400">JEE Advanced Cohort Size</label><input type="number" value={userProfile.cohortSizes?.['JEE Advanced'] || 0} onChange={e => handleCohortSizeChange('JEE Advanced', parseInt(e.target.value))} className="input-base mt-1 w-full"/></div>
                    </div>
                </div>

                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2"><span className="text-lg">⏱️</span> Pace Strategy (Target Time/Q)</h4>
                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">Set your ideal time per question. This calibrates the "Paper Strategy Simulator" to detect panic moments.</p>
                    <div className="space-y-4">
                        <StrategySlider label="Physics" value={userProfile.targetTimePerQuestion?.physics || 120} onChange={(v) => handleTargetTimeChange('physics', v)} />
                        <StrategySlider label="Chemistry" value={userProfile.targetTimePerQuestion?.chemistry || 60} onChange={(v) => handleTargetTimeChange('chemistry', v)} />
                        <StrategySlider label="Maths" value={userProfile.targetTimePerQuestion?.maths || 150} onChange={(v) => handleTargetTimeChange('maths', v)} />
                    </div>
                </div>
            </div>

             <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2"><span className="text-lg">📅</span> Study Routine</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-xs text-gray-400">Morning Slot</label><input type="text" value={userProfile.studyTimes.morning} onChange={e => handleStudyTimeChange('morning', e.target.value)} className="input-base mt-1 w-full"/></div>
                    <div><label className="block text-xs text-gray-400">Afternoon Slot</label><input type="text" value={userProfile.studyTimes.afternoon} onChange={e => handleStudyTimeChange('afternoon', e.target.value)} className="input-base mt-1 w-full"/></div>
                    <div><label className="block text-xs text-gray-400">Evening Slot</label><input type="text" value={userProfile.studyTimes.evening} onChange={e => handleStudyTimeChange('evening', e.target.value)} className="input-base mt-1 w-full"/></div>
                </div>
            </div>
            
            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                 <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2"><span className="text-lg">🔭</span> Vision Board</h4>
                 <form onSubmit={addLongTermGoal} className="flex gap-3 mb-4">
                    <input type="text" value={newLongTermGoal} onChange={e => setNewLongTermGoal(e.target.value)} placeholder="Add a major milestone (e.g. 'Top 500 Rank')" className="input-base flex-grow"/>
                    <button type="submit" className="btn btn-primary">Add</button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {longTermGoals.map(goal => (
                        <div key={goal.id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 flex items-center gap-4 group transition-all hover:border-[rgb(var(--color-primary-rgb))]">
                            <input type="checkbox" checked={goal.completed} onChange={() => toggleLongTermGoal(goal.id)} className="form-checkbox h-5 w-5 bg-slate-700 border-slate-600 text-[rgb(var(--color-primary-rgb))] rounded focus:ring-[rgb(var(--color-primary-rgb))] flex-shrink-0"/>
                            <p className={`flex-grow transition-colors font-medium ${goal.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>{goal.text}</p>
                            <button onClick={() => deleteLongTermGoal(goal.id)} className="text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">×</button>
                        </div>
                    ))}
                    {longTermGoals.length === 0 && <p className="text-center text-sm text-gray-500 py-4 italic">"A goal without a plan is just a wish."</p>}
                </div>
            </div>
        </div>
    );
};

const AppearanceSettings: React.FC<Pick<SettingsProps, 'theme' | 'setTheme' | 'appearancePreferences' | 'setAppearancePreferences'>> = ({ theme, setTheme, appearancePreferences, setAppearancePreferences }) => {
    const themes: { id: Theme; name: string; class: string; color: string }[] = [
        { id: 'cyan', name: 'Cyber Cyan', class: 'theme-cyan', color: '#22d3ee' },
        { id: 'indigo', name: 'Deep Indigo', class: 'theme-indigo', color: '#818cf8' },
        { id: 'green', name: 'Matrix Green', class: 'theme-green', color: '#34d399' },
        { id: 'red', name: 'Crimson Alert', class: 'theme-red', color: '#f87171' },
    ];
    return (
        <div className="space-y-8 animate-fade-in">
             <div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))] mb-2 border-b border-[rgb(var(--color-primary-rgb))] pb-2 inline-block">Visual Experience</h3>
                <p className="text-sm text-gray-400 mt-2">Customize the interface to reduce eye strain or boost focus.</p>
            </div>
            
            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-gray-200 mb-4">Color Theme</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {themes.map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => setTheme(t.id)} 
                            aria-pressed={theme === t.id} 
                            className={`relative p-4 rounded-xl border-2 transition-all duration-300 overflow-hidden group ${theme === t.id ? 'border-[rgb(var(--color-primary-rgb))] ring-1 ring-[rgb(var(--color-primary-rgb))] bg-slate-800' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br from-${t.color}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                            <div className="flex flex-col items-center gap-3 relative z-10">
                                <div className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center" style={{ backgroundColor: t.color }}>
                                    {theme === t.id && <span className="text-slate-900 font-bold">✓</span>}
                                </div>
                                <span className="font-semibold text-sm text-gray-200">{t.name}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-gray-200 mb-4">Accessibility & Motion</h4>
                <div className="space-y-6">
                    <ToggleSwitch label="Disable Particle Background (Performance)" checked={appearancePreferences.disableParticles} onChange={checked => setAppearancePreferences(p => ({...p, disableParticles: checked}))} />
                    <ToggleSwitch label="Reduce Motion (Accessibility)" checked={appearancePreferences.reduceMotion} onChange={checked => setAppearancePreferences(p => ({...p, reduceMotion: checked}))} />
                    <ToggleSwitch label="High Contrast Mode" checked={appearancePreferences.highContrast} onChange={checked => setAppearancePreferences(p => ({...p, highContrast: checked}))} />
                </div>
            </div>
        </div>
    );
};

const AiSettings: React.FC<Pick<SettingsProps, 'aiPreferences' | 'setAiPreferences' | 'notificationPreferences' | 'setNotificationPreferences'>> = ({ aiPreferences, setAiPreferences, notificationPreferences, setNotificationPreferences }) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))] mb-2 border-b border-[rgb(var(--color-primary-rgb))] pb-2 inline-block">AI Coach Configuration</h3>
                <p className="text-sm text-gray-400 mt-2">Fine-tune your AI assistant's personality and proactive behaviors.</p>
            </div>
            
            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2"><span className="text-lg">🧠</span> Cognitive Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label htmlFor="response-length" className="text-xs font-medium text-gray-400 block mb-2">Response Verbosity</label>
                        <select id="response-length" value={aiPreferences.responseLength} onChange={e => setAiPreferences(prev => ({ ...prev, responseLength: e.target.value as AiAssistantPreferences['responseLength'] }))} className="select-base w-full">
                            <option value="short">Short & Concise (Bullet points)</option>
                            <option value="medium">Balanced</option>
                            <option value="long">Detailed Explanations</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="response-tone" className="text-xs font-medium text-gray-400 block mb-2">Coaching Persona</label>
                        <select id="response-tone" value={aiPreferences.tone} onChange={e => setAiPreferences(prev => ({ ...prev, tone: e.target.value as AiAssistantPreferences['tone'] }))} className="select-base w-full">
                            <option value="encouraging">Supportive Mentor (High Empathy)</option>
                            <option value="neutral">Analytical Observer (Just Facts)</option>
                            <option value="direct">Drill Sergeant (Strict & Direct)</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    <label htmlFor="custom-instructions" className="text-xs font-medium text-gray-400 block mb-2">System Prompt Override (Advanced)</label>
                    <textarea 
                        id="custom-instructions"
                        value={aiPreferences.customInstructions || ''}
                        onChange={e => setAiPreferences(prev => ({ ...prev, customInstructions: e.target.value }))}
                        placeholder="e.g. 'Act as Richard Feynman. Explain concepts using analogies. Be witty.'"
                        className="input-base w-full h-24 resize-none text-sm"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Provide specific instructions to shape the AI's personality and output style.</p>
                </div>
            </div>

            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2"><span className="text-lg">🔔</span> Proactive Insights</h4>
                <div className="space-y-6">
                    <ToggleSwitch label="Achievement Toasts" checked={notificationPreferences.achievements} onChange={checked => setNotificationPreferences(prev => ({...prev, achievements: checked}))}/>
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                        <div className="mb-4">
                            <ToggleSwitch label="Enable Proactive Drop Detection" checked={notificationPreferences.proactiveInsights} onChange={checked => setNotificationPreferences(prev => ({...prev, proactiveInsights: checked}))}/>
                        </div>
                        <div className={`transition-opacity duration-300 ${notificationPreferences.proactiveInsights ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <label htmlFor="insight-sensitivity" className="text-xs font-medium text-gray-400 block mb-2">Sensitivity Threshold</label>
                            <select id="insight-sensitivity" value={notificationPreferences.proactiveInsightSensitivity} onChange={e => setNotificationPreferences(prev => ({ ...prev, proactiveInsightSensitivity: e.target.value as NotificationPreferences['proactiveInsightSensitivity'] }))} className="select-base w-full">
                                <option value="high">High (Notify on &gt;3% drop)</option>
                                <option value="medium">Medium (Notify on &gt;5% drop)</option>
                                <option value="low">Low (Notify on &gt;10% drop)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ConnectivitySettings: React.FC<Pick<SettingsProps, 'onClearKey' | 'apiKey' | 'addToast'>> = ({ onClearKey, apiKey, addToast }) => {
    const [isTesting, setIsTesting] = useState(false);

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            await getDailyQuote(apiKey);
            addToast({ title: 'Connection Successful', message: 'API connection verified.', icon: '✅' });
        } catch (error) {
            addToast({ title: 'Connection Failed', message: 'Could not connect. Check your key or billing.', icon: '❌' });
        } finally {
            setIsTesting(false);
        }
    };
    
    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))] mb-2 border-b border-[rgb(var(--color-primary-rgb))] pb-2 inline-block">Connectivity</h3>
                <p className="text-sm text-gray-400 mt-2">Manage your gateway to the Gemini API.</p>
            </div>
            
            <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700">
                <div className="flex items-center gap-4 bg-slate-900/80 p-4 rounded-lg border border-slate-700/50 shadow-inner">
                    <div className="flex-grow font-mono text-sm text-gray-400">
                        {apiKey.substring(0, 4)}•••••••••••••••••••••••{apiKey.substring(apiKey.length - 4)}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleTestConnection} disabled={isTesting} className="text-xs bg-cyan-600/20 hover:bg-cyan-600 hover:text-white text-cyan-400 font-bold py-2 px-4 rounded transition-colors border border-cyan-600/30">
                            {isTesting ? 'Pinging...' : 'Test Ping'}
                        </button>
                        <button onClick={onClearKey} className="text-xs bg-red-600/20 hover:bg-red-600 hover:text-white text-red-400 font-bold py-2 px-4 rounded transition-colors border border-red-600/30">
                            Unlink
                        </button>
                    </div>
                </div>
                <div className="mt-4 flex items-start gap-3 p-3 bg-blue-900/20 rounded-lg border border-blue-800/30 text-xs text-blue-200">
                    <span className="text-lg">ℹ️</span>
                    <p>
                        Your API key is stored locally on your device via `localStorage`. It is never sent to any server other than Google's Gemini API endpoints.
                        Ensure your Google Cloud Project has the Gemini API enabled.
                    </p>
                </div>
            </div>
        </div>
    );
};

const DataHealthWidget: React.FC<{ reports: TestReport[], logs: QuestionLog[] }> = ({ reports, logs }) => {
    const [issues, setIssues] = useState<string[]>([]);

    const runDiagnostics = () => {
        const foundIssues: string[] = [];
        
        // Check 1: Orphaned Logs
        const reportIds = new Set(reports.map(r => r.id));
        const orphanedCount = logs.filter(l => !reportIds.has(l.testId)).length;
        if (orphanedCount > 0) foundIssues.push(`Found ${orphanedCount} question logs linked to missing test reports.`);

        // Check 2: Logical Marks
        const invalidMarks = logs.filter(l => l.status === 'Wrong' && l.marksAwarded > 0).length;
        if (invalidMarks > 0) foundIssues.push(`Found ${invalidMarks} logs marked 'Wrong' but having positive marks.`);

        // Check 3: Missing Metadata
        const missingTopic = logs.filter(l => !l.topic || l.topic === 'N/A').length;
        if (missingTopic > 0) foundIssues.push(`Found ${missingTopic} logs with missing topic tags.`);

        setIssues(foundIssues.length > 0 ? foundIssues : ['All systems operational. No data anomalies detected.']);
    };

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 mt-4">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-gray-300 flex items-center gap-2">🏥 Data Health Monitor</h4>
                <button onClick={runDiagnostics} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors">Run Scan</button>
            </div>
            {issues.length > 0 ? (
                <ul className="space-y-1">
                    {issues.map((issue, i) => (
                        <li key={i} className={`text-xs ${issue.includes('operational') ? 'text-green-400' : 'text-amber-400'} flex items-start gap-2`}>
                            <span>{issue.includes('operational') ? '✓' : '⚠'}</span>
                            {issue}
                        </li>
                    ))}
                </ul>
            ) : <p className="text-xs text-gray-500 italic">Click 'Run Scan' to check for data integrity issues.</p>}
        </div>
    );
};

const DataSettings: React.FC<SettingsProps> = (props) => {
    const [modalState, setModalState] = useState<{ isOpen: boolean, onConfirm: () => void, title: string, message: React.ReactNode } | null>(null);

    const openConfirmation = (action: 'full' | 'reports' | 'chat' | 'gamification') => {
        const actions = {
            full: { onConfirm: props.handleFullReset, title: "Confirm Factory Reset", message: <p>This is a <strong className="text-red-400">destructive action</strong>. All reports, logs, settings, and progress will be permanently erased. This cannot be undone.</p>},
            reports: { onConfirm: props.handleReportsReset, title: "Clear Academic Data", message: "Deleting all test reports and question logs. Your profile settings will remain."},
            chat: { onConfirm: props.handleChatReset, title: "Wipe Coach Memory", message: "Clearing conversation history. The AI will lose context of previous discussions."},
            gamification: { onConfirm: props.handleGamificationReset, title: "Reset Career Progress", message: "Resetting Level, XP, and Achievements to zero."}
        };
        setModalState({ ...actions[action], isOpen: true });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <ConfirmationModal isOpen={!!modalState} onClose={() => setModalState(null)} {...modalState!} />
             <div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))] mb-2 border-b border-[rgb(var(--color-primary-rgb))] pb-2 inline-block">Data & Privacy</h3>
                <p className="text-sm text-gray-400 mt-2">You own your data. Manage imports, exports, and sanitation.</p>
            </div>
            
            <div className="bg-slate-800/30 p-5 rounded-xl border border-slate-700">
                <h4 className="text-sm font-bold text-gray-200 mb-4">Sync & Backup</h4>
                <DataSyncComponent {...props} setModalState={setModalState} />
                
                <DataHealthWidget reports={props.reports} logs={props.logs} />
            </div>

            <div className="bg-red-900/10 p-5 rounded-xl border border-red-900/30">
                 <h4 className="text-sm font-bold text-red-400 mb-4 flex items-center gap-2"><span className="text-lg">☢️</span> Danger Zone</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-2 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                         <span className="text-xs font-bold text-red-200">Academic Data</span>
                         <p className="text-[10px] text-red-300/70">Reports & Logs only</p>
                         <button onClick={() => openConfirmation('reports')} className="mt-auto btn btn-danger text-xs py-1">Purge Reports</button>
                     </div>
                     <div className="flex flex-col gap-2 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                         <span className="text-xs font-bold text-red-200">AI Memory</span>
                         <p className="text-[10px] text-red-300/70">Chat history</p>
                         <button onClick={() => openConfirmation('chat')} className="mt-auto btn btn-danger text-xs py-1">Wipe Memory</button>
                     </div>
                     <div className="flex flex-col gap-2 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                         <span className="text-xs font-bold text-red-200">Career Progress</span>
                         <p className="text-[10px] text-red-300/70">XP, Levels, Badges</p>
                         <button onClick={() => openConfirmation('gamification')} className="mt-auto btn btn-danger text-xs py-1">Reset Progress</button>
                     </div>
                     <div className="flex flex-col gap-2 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                         <span className="text-xs font-bold text-red-200">Factory Reset</span>
                         <p className="text-[10px] text-red-300/70">Everything</p>
                         <button onClick={() => openConfirmation('full')} className="mt-auto btn btn-danger text-xs py-1 bg-red-700 hover:bg-red-800">NUKE DATA</button>
                     </div>
                 </div>
            </div>
        </div>
    );
};


// DataSync functionality
const DataSyncComponent: React.FC<SettingsProps & { setModalState: (state: any) => void }> = (props) => {
    const [activeTab, setActiveTab] = useState<'local' | 'csv' | 'sheet'>('local');
    return (
         <div className="space-y-4">
             <div className="flex border-b border-slate-700">
                <button onClick={() => setActiveTab('local')} className={`py-2 px-4 font-semibold transition-colors text-xs rounded-t-md ${activeTab === 'local' ? 'bg-slate-700 text-[rgb(var(--color-primary-rgb))]' : 'text-gray-400 hover:bg-slate-700/50'}`}>Local JSON</button>
                <button onClick={() => setActiveTab('csv')} className={`py-2 px-4 font-semibold transition-colors text-xs rounded-t-md ${activeTab === 'csv' ? 'bg-slate-700 text-[rgb(var(--color-primary-rgb))]' : 'text-gray-400 hover:bg-slate-700/50'}`}>CSV</button>
                <button onClick={() => setActiveTab('sheet')} className={`py-2 px-4 font-semibold transition-colors text-xs rounded-t-md ${activeTab === 'sheet' ? 'bg-slate-700 text-[rgb(var(--color-primary-rgb))]' : 'text-gray-400 hover:bg-slate-700/50'}`}>Google Sheet</button>
            </div>
            
            <div className="p-4 bg-slate-900/40 rounded-b-lg rounded-r-lg border border-slate-700/50">
                {activeTab === 'local' && <LocalBackupTab {...props} />}
                {activeTab === 'csv' && <CsvSyncTab {...props} />}
                {activeTab === 'sheet' && <SheetSyncTab {...props} />}
            </div>
        </div>
    )
}

const LocalBackupTab: React.FC<SettingsProps & { setModalState: (state: any) => void }> = ({ 
    reports, logs, onSyncData, setModalState, 
    userProfile, studyGoals, longTermGoals, gamificationState, aiPreferences, notificationPreferences, appearancePreferences, chatHistory
}) => {
    const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('lastLocalBackupDate'));
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');

    const handleDownloadBackup = () => {
        // Full application state backup
        const dataToBackup = {
            reports,
            logs,
            userProfile,
            studyGoals,
            longTermGoals,
            gamificationState,
            aiPreferences,
            notificationPreferences,
            appearancePreferences,
            chatHistory,
            // Versioning for future migrations
            backupVersion: 2,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(dataToBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jee_dashboard_full_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        const now = new Date().toISOString();
        localStorage.setItem('lastLocalBackupDate', now);
        setLastBackup(now);
    };

    const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result;
                if (typeof result !== 'string') {
                    throw new Error("File content is not readable text.");
                }
                const restoredData = JSON.parse(result);
                
                // Basic validation: check if it looks like our data structure
                // We check for at least one key property or array
                if ((restoredData.reports && Array.isArray(restoredData.reports)) || restoredData.userProfile) {
                    setModalState({
                        isOpen: true,
                        title: 'Confirm Full Restore',
                        message: 'This will overwrite your current data (Reports, Logs, Syllabus, Profile, Settings) with the backup file. Are you sure?',
                        onConfirm: () => onSyncData(restoredData)
                    });
                    setError('');
                } else {
                    throw new Error("Invalid backup file format. Missing critical data sections.");
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to read or parse the backup file.");
            } finally {
                // Reset file input to allow re-uploading the same file
                if (e.target) e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="relative">
             <div className="absolute top-0 right-0 text-[10px] text-gray-500">Last Backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}</div>
            <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400">Complete backup of your entire account state (Reports, Logs, Syllabus, Profile, Settings) in a raw JSON file.</p>
                {error && <div className="p-2 mb-2 bg-red-900/50 text-red-300 rounded-lg text-sm">{error}</div>}
                <div className="flex gap-4">
                    <button onClick={handleDownloadBackup} className="btn btn-secondary flex-1 text-xs">Download Full Backup</button>
                    <button onClick={() => restoreInputRef.current?.click()} className="btn btn-secondary flex-1 text-xs">Restore from File</button>
                    <input ref={restoreInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFromFile}/>
                </div>
            </div>
        </div>
    );
};

const CsvSyncTab: React.FC<Pick<SettingsProps, 'reports' | 'logs' | 'onSyncData'>> = ({ reports, logs, onSyncData }) => {
    const [reportsFile, setReportsFile] = useState<File | null>(null);
    const [logsFile, setLogsFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'reports' | 'logs') => {
        const file = e.target.files?.[0];
        if (file) {
            if (fileType === 'reports') setReportsFile(file);
            else setLogsFile(file);
        }
    };

    const handleImport = () => {
        if (!reportsFile) {
            setError('A reports CSV file is required to import data.');
            return;
        }
        setError('');
        setSuccessMessage('');

        const readerReports = new FileReader();
        readerReports.onload = (e) => {
            try {
                const reportsCsv = e.target?.result as string;
                const newReports = parseReportsFromCsv(reportsCsv);

                if (logsFile) {
                    const readerLogs = new FileReader();
                    readerLogs.onload = (eLogs) => {
                        try {
                            const logsCsv = eLogs.target?.result as string;
                            const newLogs = parseLogsFromCsv(logsCsv, newReports);
                            onSyncData({ reports: newReports, logs: newLogs });
                            setSuccessMessage(`Successfully imported ${newReports.length} reports and ${newLogs.length} logs.`);
                        } catch (err) {
                            setError(err instanceof Error ? `Error parsing logs: ${err.message}` : "Failed to parse logs CSV.");
                        }
                    };
                    readerLogs.readAsText(logsFile);
                } else {
                    onSyncData({ reports: newReports, logs: [] });
                    setSuccessMessage(`Successfully imported ${newReports.length} reports. No logs file provided.`);
                }
            } catch (err) {
                setError(err instanceof Error ? `Error parsing reports: ${err.message}` : "Failed to parse reports CSV.");
            }
        };
        readerReports.readAsText(reportsFile);
    };

     return (
        <div className="space-y-4">
            {error && <div className="p-2 bg-red-900/50 text-red-300 rounded-lg text-xs">{error}</div>}
            {successMessage && <div className="p-2 bg-green-900/50 text-green-300 rounded-lg text-xs">{successMessage}</div>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/30 p-3 rounded border border-slate-700">
                    <h5 className="text-xs font-bold text-gray-300 mb-2">Import</h5>
                    <div className="space-y-2">
                        <div><label className="block text-[10px] text-gray-500 mb-1">Reports CSV (Required)</label><input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'reports')} className="text-xs w-full text-slate-400"/></div>
                        <div><label className="block text-[10px] text-gray-500 mb-1">Logs CSV (Optional)</label><input type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'logs')} className="text-xs w-full text-slate-400"/></div>
                        <button onClick={handleImport} disabled={!reportsFile} className="btn btn-secondary w-full text-xs mt-2">Import Files</button>
                    </div>
                </div>
                <div className="bg-slate-900/30 p-3 rounded border border-slate-700">
                    <h5 className="text-xs font-bold text-gray-300 mb-2">Export</h5>
                    <div className="space-y-2">
                        <button onClick={() => exportReportsToCsv(reports)} className="btn btn-secondary w-full text-xs">Download Reports CSV</button>
                        <button onClick={() => exportLogsToCsv(logs, reports)} className="btn btn-secondary w-full text-xs">Download Logs CSV</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SheetSyncTab: React.FC<Pick<SettingsProps, 'reports' | 'logs' | 'onSyncData'>> = ({ reports, logs, onSyncData }) => {
    const [sheetId, setSheetId] = useState(() => localStorage.getItem('googleSheetId_v1') || '');
    const [reportsGid, setReportsGid] = useState(() => localStorage.getItem('googleSheetReportsGid_v1') || '');
    const [logsGid, setLogsGid] = useState(() => localStorage.getItem('googleSheetLogsGid_v1') || '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => { localStorage.setItem('googleSheetId_v1', sheetId); }, [sheetId]);
    useEffect(() => { localStorage.setItem('googleSheetReportsGid_v1', reportsGid); }, [reportsGid]);
    useEffect(() => { localStorage.setItem('googleSheetLogsGid_v1', logsGid); }, [logsGid]);

    const performPull = async () => {
        setIsLoading(true);
        setError('');
        setSuccessMessage('');

        const fetchSheet = async (gid: string) => {
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch sheet with GID ${gid}. Status: ${response.statusText}`);
            }
            return response.text();
        };

        try {
            const reportsCsv = await fetchSheet(reportsGid);
            const newReports = parseReportsFromCsv(reportsCsv);

            let newLogs: QuestionLog[] = [];
            if (logsGid) {
                try {
                    const logsCsv = await fetchSheet(logsGid);
                    newLogs = parseLogsFromCsv(logsCsv, newReports);
                } catch (logError) {
                    console.warn("Could not fetch or parse logs sheet, proceeding with reports only.", logError);
                }
            }

            onSyncData({ reports: newReports, logs: newLogs });
            setSuccessMessage(`Successfully pulled ${newReports.length} reports and ${newLogs.length} logs.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during sync.');
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            {error && <div className="p-2 bg-red-900/50 text-red-300 rounded-lg text-xs">{error}</div>}
            {successMessage && <div className="p-2 bg-green-900/50 text-green-300 rounded-lg text-xs">{successMessage}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div><label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sheet ID</label><input type="text" value={sheetId} onChange={e => setSheetId(e.target.value)} className="input-base mt-1 text-xs w-full bg-slate-900" placeholder="abc123xyz..."/></div>
                <div><label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider">Reports GID</label><input type="text" value={reportsGid} onChange={e => setReportsGid(e.target.value)} className="input-base mt-1 text-xs w-full bg-slate-900" placeholder="0"/></div>
                <div><label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider">Logs GID</label><input type="text" value={logsGid} onChange={e => setLogsGid(e.target.value)} className="input-base mt-1 text-xs w-full bg-slate-900" placeholder="123456789"/></div>
            </div>
            <button onClick={performPull} disabled={isLoading || !sheetId || !reportsGid} className="btn btn-secondary w-full text-xs">{isLoading ? 'Pulling Data...' : 'Pull from Google Sheet'}</button>
            
            <p className="text-[10px] text-gray-500 mt-2">
                <strong>Note:</strong> Sheet must be public ("Anyone with link can view"). The ID is the long string in the URL. GID is the tab ID (usually 0 for first tab).
            </p>
        </div>
    );
};


// Main Component
export const Settings: React.FC<SettingsProps> = (props) => {
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile');

    const categories: { id: SettingsCategory, label: string, icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Profile & Strategy', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
        { id: 'appearance', label: 'Appearance', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg> },
        { id: 'ai', label: 'AI Coach', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> },
        { id: 'connectivity', label: 'Connectivity', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.394 8.332a15 15 0 0121.212 0" /></svg> },
        { id: 'data', label: 'Data & Privacy', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            <h1 className="text-3xl font-bold text-[rgb(var(--color-primary-accent-rgb))]">Control Center</h1>
            <div className="flex flex-col lg:flex-row gap-8">
                <nav className="lg:w-64 flex-shrink-0">
                    <ul className="space-y-2 bg-slate-800/30 p-2 rounded-xl border border-slate-700/50 sticky top-6">
                        {categories.map(cat => (
                            <li key={cat.id}>
                                <button
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 ${activeCategory === cat.id ? 'bg-[rgb(var(--color-primary-rgb))] text-white shadow-lg' : 'text-gray-400 hover:bg-slate-700/50 hover:text-gray-200'}`}
                                >
                                    {cat.icon}
                                    <span className="font-medium text-sm">{cat.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <main className="flex-grow bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700 min-h-[600px] relative overflow-hidden">
                    {/* Background accent */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[rgb(var(--color-primary-rgb))] opacity-5 blur-[100px] pointer-events-none"></div>
                    
                    {activeCategory === 'profile' && <ProfileSettings {...props} />}
                    {activeCategory === 'appearance' && <AppearanceSettings {...props} />}
                    {activeCategory === 'ai' && <AiSettings {...props} />}
                    {activeCategory === 'connectivity' && <ConnectivitySettings {...props} />}
                    {activeCategory === 'data' && <DataSettings {...props} />}
                </main>
            </div>
        </div>
    );
};
