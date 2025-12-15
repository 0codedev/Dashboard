
import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import type { TestReport, QuestionLog, StudyGoal, GlobalFilter, AiFilter, ChatMessage, RootCauseFilter, Toast, AiAssistantPreferences, NotificationPreferences, UserProfile, Theme, DailyTask, AppearancePreferences, View, GamificationState, LongTermGoal } from './types';
import { TaskType, QuestionStatus, TaskEffort } from './types';
import { ApiKeyManager } from './components/ApiKeyManager';
import { AppShell } from './components/layout/AppShell';
import { generateFocusedStudyPlan } from './services/geminiService';
import { useJeeData } from './hooks/useJeeData';
import { useAchievements } from './hooks/useAchievements';
import { dbService } from './services/dbService';

// --- Lazy Load Heavy Components ---
// This splits the code into separate chunks, so the browser doesn't load
// heavy charts/physics engines until the user actually navigates to that tab.
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const OcrProcessor = React.lazy(() => import('./components/OcrProcessor').then(module => ({ default: module.OcrProcessor })));
const DeepAnalysis = React.lazy(() => import('./components/DeepAnalysis').then(module => ({ default: module.DeepAnalysis })));
const RootCause = React.lazy(() => import('./components/RootCause').then(module => ({ default: module.RootCause })));
const DetailedReportsView = React.lazy(() => import('./components/DetailedReportsView').then(module => ({ default: module.DetailedReportsView })));
const AiAssistant = React.lazy(() => import('./components/AiAssistant').then(module => ({ default: module.AiAssistant })));
const QuestionLogEditor = React.lazy(() => import('./components/QuestionLogEditor').then(module => ({ default: module.QuestionLogEditor })));
const DailyPlanner = React.lazy(() => import('./components/DailyPlanner').then(module => ({ default: module.DailyPlanner })));
const Achievements = React.lazy(() => import('./components/Achievements').then(module => ({ default: module.Achievements })));
const Settings = React.lazy(() => import('./components/Settings').then(module => ({ default: module.Settings })));
const Syllabus = React.lazy(() => import('./components/Syllabus').then(module => ({ default: module.Syllabus })));
const ErrorVaccinator = React.lazy(() => import('./components/flashcards/ErrorVaccinator').then(module => ({ default: module.ErrorVaccinator })));

// --- Loading Component ---
const PageLoader = () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-lg">
        <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-500"></div>
            <p className="text-sm font-medium text-slate-400 animate-pulse tracking-widest uppercase">Loading Module...</p>
        </div>
    </div>
);

const App: React.FC = () => {
    const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('gemini-api-key'));
    const [view, setView] = useState<View>('daily-planner');
    const [activeLogFilter, setActiveLogFilter] = useState<AiFilter | null>(null);
    const [rootCauseFilter, setRootCauseFilter] = useState<RootCauseFilter>({});
    const [proactiveInsight, setProactiveInsight] = useState<{ subject: 'physics' | 'chemistry' | 'maths'; visible: boolean; } | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [prefilledTask, setPrefilledTask] = useState<Partial<DailyTask> | null>(null);

    const [aiPreferences, setAiPreferences] = useState<AiAssistantPreferences>(() => {
        try { 
            const saved = localStorage.getItem('aiAssistantPreferences_v1'); 
            const parsed = saved ? JSON.parse(saved) : {};
            return { 
                ...parsed, 
                model: parsed.model || 'gemini-2.5-flash', 
                responseLength: parsed.responseLength || 'medium', 
                tone: parsed.tone || 'encouraging',
            }; 
        } catch { 
            return { model: 'gemini-2.5-flash', responseLength: 'medium', tone: 'encouraging' }; 
        }
    });
    const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
        try { const saved = localStorage.getItem('notificationPreferences_v1'); return saved ? JSON.parse(saved) : { achievements: true, proactiveInsights: true, proactiveInsightSensitivity: 'medium' }; } catch { return { achievements: true, proactiveInsights: true, proactiveInsightSensitivity: 'medium' }; }
    });
    const [appearancePreferences, setAppearancePreferences] = useState<AppearancePreferences>(() => {
        try { const saved = localStorage.getItem('appearancePreferences_v1'); return saved ? JSON.parse(saved) : { disableParticles: true, reduceMotion: false, highContrast: false }; } catch { return { disableParticles: true, reduceMotion: false, highContrast: false }; }
    });
    const [userProfile, setUserProfile] = useState<UserProfile>(() => {
        try { const saved = localStorage.getItem('userProfile_v2'); return saved ? JSON.parse(saved) : { name: '', targetExams: [], studyTimes: { morning: "7 AM - 10 AM", afternoon: "2 PM - 5 PM", evening: "8 PM - 11 PM" }, syllabus: {}, cohortSizes: { 'JEE Mains': 10000, 'JEE Advanced': 2500 }, targetTimePerQuestion: { physics: 120, chemistry: 60, maths: 150 } }; } catch { return { name: '', targetExams: [], studyTimes: { morning: "7 AM - 10 AM", afternoon: "2 PM - 5 PM", evening: "8 PM - 11 PM" }, syllabus: {}, cohortSizes: { 'JEE Mains': 10000, 'JEE Advanced': 2500 }, targetTimePerQuestion: { physics: 120, chemistry: 60, maths: 150 } }; }
    });
    const [theme, setTheme] = useState<Theme>(() => {
        try { const saved = localStorage.getItem('theme_v1'); return saved ? JSON.parse(saved) : 'cyan'; } catch { return 'cyan'; }
    });

    const jeeData = useJeeData();
    const {
        setTestReports,
        setQuestionLogs,
        gamificationState,
        setGamificationState,
        clearTestReportsAndLogs,
        clearChatHistory,
        clearGamificationState,
        testReports,
        dailyTasks,
        setDailyTasks
    } = jeeData;

    const handleAchievementToast = useCallback((toast: Omit<Toast, 'id'>) => {
        if (notificationPreferences.achievements) {
            setToasts(p => [...p, { ...toast, id: Date.now() }]);
        }
    }, [notificationPreferences.achievements]);

    const { achievements, addXp, levelInfo } = useAchievements(
        jeeData,
        gamificationState,
        setGamificationState,
        handleAchievementToast,
    );

    const insightDismissedForThisDataset = useRef(false);
    const prevFilteredReportsRef = useRef<TestReport[] | undefined>(undefined);
    const lastReportCountRef = useRef(testReports.length);

    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            const heading = mainContent.querySelector('h1, h2');
            if (heading) {
                (heading as HTMLElement).focus();
            }
        }
    }, [view]);

    useEffect(() => { localStorage.setItem('aiAssistantPreferences_v1', JSON.stringify(aiPreferences)); }, [aiPreferences]);
    useEffect(() => { localStorage.setItem('notificationPreferences_v1', JSON.stringify(notificationPreferences)); }, [notificationPreferences]);
    useEffect(() => {
        localStorage.setItem('appearancePreferences_v1', JSON.stringify(appearancePreferences));
        document.body.classList.toggle('reduce-motion', appearancePreferences.reduceMotion);
        document.body.classList.toggle('high-contrast', appearancePreferences.highContrast);
    }, [appearancePreferences]);
    useEffect(() => { localStorage.setItem('userProfile_v2', JSON.stringify(userProfile)); }, [userProfile]);
    useEffect(() => {
        localStorage.setItem('theme_v1', JSON.stringify(theme));
        document.documentElement.className = `theme-${theme}`;
    }, [theme]);

    useEffect(() => {
        if (testReports.length > lastReportCountRef.current) {
            if (testReports.length % 3 === 0) {
                setToasts(prev => [...prev, { id: Date.now(), title: 'Backup Recommended', message: 'You have added significant data. Consider backing up your progress in Settings.', icon: '💾' }]);
            }
        }
        lastReportCountRef.current = testReports.length;
    }, [testReports]);


    const handleKeySubmit = (key: string) => { localStorage.setItem('gemini-api-key', key); setApiKey(key); };
    const handleClearKey = () => { localStorage.removeItem('gemini-api-key'); setApiKey(null); };
    
    const handleResetData = async () => {
        await dbService.clearAllStores();
        localStorage.removeItem('jeeGlobalFilter_v2');
        localStorage.removeItem('dailyQuote');
        localStorage.removeItem('streakData_v1');
        localStorage.removeItem('rootCauseWidgetLayout_v7');
        localStorage.removeItem('dashboardWidgetLayout_v7'); 
        localStorage.removeItem('userProfile_v2');
        localStorage.removeItem('theme_v1');
        localStorage.removeItem('aiAssistantPreferences_v1');
        localStorage.removeItem('notificationPreferences_v1');
        localStorage.removeItem('appearancePreferences_v1');
        window.location.reload();
    };

    const handleStartFocusSession = (topic: string) => {
        setPrefilledTask({
            text: `Focus Session: ${topic}`,
            linkedTopic: topic,
            taskType: TaskType.ProblemPractice,
            estimatedTime: 60,
        });
        setView('daily-planner');
    };

    const addTasksToPlanner = (tasks: { task: string; time: number; topic: string; }[]) => {
        const newTasks: DailyTask[] = tasks.map((t, i) => ({
             id: `rev-${Date.now()}-${i}`,
             text: t.task,
             completed: false,
             taskType: TaskType.Revision,
             estimatedTime: t.time,
             linkedTopic: t.topic,
             effort: TaskEffort.Medium
        }));
        setDailyTasks(prev => [...newTasks, ...prev]);
        setToasts(p => [...p, {
            id: Date.now(),
            title: 'Tasks Added!',
            message: `${tasks.length} task${tasks.length > 1 ? 's have' : ' has'} been added to your Daily Planner.`,
            icon: '🧠'
        }]);
    };


    useEffect(() => {
        if (prevFilteredReportsRef.current !== jeeData.filteredReports) {
            insightDismissedForThisDataset.current = false;
            prevFilteredReportsRef.current = jeeData.filteredReports;
        }
    }, [jeeData.filteredReports]);

    useEffect(() => {
        if (!notificationPreferences.proactiveInsights || jeeData.filteredReports.length < 2 || proactiveInsight?.visible || insightDismissedForThisDataset.current) {
            return;
        }

        const latestReport = jeeData.filteredReports[jeeData.filteredReports.length - 1];
        const secondLatestReport = jeeData.filteredReports[jeeData.filteredReports.length - 2];
        const subjects: ('physics' | 'chemistry' | 'maths')[] = ['physics', 'chemistry', 'maths'];

        for (const subject of subjects) {
            const latestAccuracy = latestReport[`${subject}Metrics`]?.accuracy ?? 0;
            const secondLatestAccuracy = secondLatestReport[`${subject}Metrics`]?.accuracy ?? 0;
            
            if (latestAccuracy > 0 && secondLatestAccuracy > 0 && latestAccuracy < secondLatestAccuracy - 5) {
                setProactiveInsight({ subject, visible: true });
                break;
            }
        }
    }, [jeeData.filteredReports, proactiveInsight, notificationPreferences.proactiveInsights]);

    const handleAcceptPlan = useCallback(async () => {
        insightDismissedForThisDataset.current = true;
        if (!proactiveInsight || !apiKey) return;
        
        const { subject } = proactiveInsight;
        setProactiveInsight(null);

        const loadingMessage = `Okay, I'm creating a focused 3-day recovery plan for ${subject}. Give me a moment...`;
        jeeData.setChatHistory(prev => [...prev, { role: 'model', content: loadingMessage }]);
        setView('ai-assistant');

        const weakTopics = Array.from(
            jeeData.questionLogs
                .filter(log => log.subject === subject && (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) && log.topic && log.topic !== 'N/A')
                .reduce((acc, log) => acc.set(log.topic, (acc.get(log.topic) || 0) + 1), new Map<string, number>())
                .entries()
        ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

        try {
            const plan = await generateFocusedStudyPlan(subject, weakTopics, apiKey, aiPreferences.model);
            jeeData.setChatHistory(prev => prev.map(msg => msg.content === loadingMessage ? { ...msg, content: plan } : msg));
        } catch (error) {
            const errorMessage = "Sorry, I couldn't generate the plan right now. Please try asking me again later.";
            jeeData.setChatHistory(prev => prev.map(msg => msg.content === loadingMessage ? { ...msg, content: errorMessage } : msg));
        }
    }, [apiKey, proactiveInsight, jeeData.questionLogs, jeeData.setChatHistory, aiPreferences.model]);

    const handleDismissInsight = () => {
        insightDismissedForThisDataset.current = true;
        setProactiveInsight(prev => prev ? { ...prev, visible: false } : null);
    };

    const addData = (data: { report: TestReport; logs: QuestionLog[] }) => {
        setTestReports(prev => [...prev, data.report]);
        setQuestionLogs(prev => [...prev, ...data.logs]);
        addXp('addReport');
        setView('question-log-editor');
    };

    const handleDeleteReport = (reportId: string) => {
        setTestReports(prev => prev.filter(r => r.id !== reportId));
        setQuestionLogs(prev => prev.filter(l => l.testId !== reportId));
        setToasts(p => [...p, { id: Date.now(), title: 'Report Deleted', message: 'Test report and logs have been removed.', icon: '🗑️' }]);
    };

    const handleDataSync = (data: any) => {
        if (data.reports) setTestReports(data.reports);
        if (data.logs) {
            setQuestionLogs(data.logs);
        } else if (data.reports) {
            setQuestionLogs([]);
        }
        if (data.userProfile) setUserProfile(data.userProfile);
        if (data.studyGoals) jeeData.setStudyGoals(data.studyGoals);
        if (data.longTermGoals) jeeData.setLongTermGoals(data.longTermGoals);
        if (data.gamificationState) setGamificationState(data.gamificationState);
        if (data.aiPreferences) setAiPreferences(data.aiPreferences);
        if (data.notificationPreferences) setNotificationPreferences(data.notificationPreferences);
        if (data.appearancePreferences) setAppearancePreferences(data.appearancePreferences);
        if (data.chatHistory) jeeData.setChatHistory(data.chatHistory);
        setToasts(p => [...p, { id: Date.now(), title: 'Restore Complete', message: 'All data including syllabus, reports, and progress has been restored.', icon: '✅' }]);
        setView('dashboard');
    };

    const handleViewQuestionLogForTest = (testId: string) => { setActiveLogFilter({ testId: testId }); setView('question-log-editor'); };
    
    if (!apiKey) { return <ApiKeyManager onKeySubmit={handleKeySubmit} />; }

    return (
        <div className="h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-900 text-gray-100 font-sans overflow-hidden">
            <AppShell
                view={view}
                setView={setView}
                userProfile={userProfile}
                globalFilter={jeeData.globalFilter}
                setGlobalFilter={jeeData.setGlobalFilter}
                availableTestTypes={jeeData.availableTestTypes}
                availableSubTypes={jeeData.availableSubTypes}
                toasts={toasts}
                setToasts={setToasts}
            >
                <Suspense fallback={<PageLoader />}>
                    {view === 'daily-planner' && <DailyPlanner goals={jeeData.studyGoals} setGoals={jeeData.setStudyGoals} apiKey={apiKey} logs={jeeData.questionLogs} proactiveInsight={proactiveInsight} onAcceptPlan={handleAcceptPlan} onDismissInsight={handleDismissInsight} addXp={() => addXp('completeTask')} userProfile={userProfile} prefilledTask={prefilledTask} setPrefilledTask={setPrefilledTask} dailyTasks={jeeData.dailyTasks} setDailyTasks={jeeData.setDailyTasks} modelName={aiPreferences.model} />}
                    {view === 'dashboard' && <Dashboard reports={jeeData.filteredReports} logs={jeeData.filteredLogs} apiKey={apiKey} setView={setView} setRootCauseFilter={setRootCauseFilter} onStartFocusSession={handleStartFocusSession} longTermGoals={jeeData.longTermGoals} modelName={aiPreferences.model} userProfile={userProfile} onUpdateProfile={setUserProfile} />}
                    {view === 'syllabus' && <Syllabus userProfile={userProfile} setUserProfile={setUserProfile} questionLogs={jeeData.questionLogs} reports={jeeData.filteredReports} apiKey={apiKey} onStartFocusSession={handleStartFocusSession} setView={setView} addTasksToPlanner={addTasksToPlanner} modelName={aiPreferences.model} />}
                    {view === 'detailed-reports' && <DetailedReportsView allReports={jeeData.testReports} filteredReports={jeeData.filteredReports} setReports={setTestReports} onViewQuestionLog={handleViewQuestionLogForTest} onDeleteReport={handleDeleteReport}/>}
                    {view === 'deep-analysis' && <DeepAnalysis reports={jeeData.filteredReports} />}
                    {view === 'root-cause' && <RootCause logs={jeeData.filteredLogs} reports={jeeData.filteredReports} rootCauseFilter={rootCauseFilter} setRootCauseFilter={setRootCauseFilter} apiKey={apiKey} onAddTask={(task) => addTasksToPlanner([task])} modelName={aiPreferences.model} />}
                    {view === 'ai-assistant' && <AiAssistant reports={jeeData.filteredReports} questionLogs={jeeData.questionLogs} setView={setView} setActiveLogFilter={setActiveLogFilter} apiKey={apiKey} chatHistory={jeeData.chatHistory} setChatHistory={jeeData.setChatHistory} studyGoals={jeeData.studyGoals} setStudyGoals={jeeData.setStudyGoals} preferences={aiPreferences} onUpdatePreferences={setAiPreferences} userProfile={userProfile} onAddTasksToPlanner={addTasksToPlanner} />}
                    {view === 'flashcards' && <ErrorVaccinator logs={jeeData.questionLogs} apiKey={apiKey} />}
                    {view === 'question-log-editor' && <QuestionLogEditor logs={jeeData.questionLogs} reports={jeeData.testReports} setLogs={setQuestionLogs} activeLogFilter={activeLogFilter} setActiveLogFilter={setActiveLogFilter} />}
                    {view === 'data-entry' && <OcrProcessor onAddData={addData} apiKey={apiKey} modelName={aiPreferences.model} />}
                    {view === 'achievements' && <Achievements gamificationState={gamificationState} achievements={achievements} levelInfo={levelInfo} />}
                    {view === 'settings' && (
                        <Settings 
                            apiKey={apiKey!} 
                            onKeySubmit={handleKeySubmit} 
                            onClearKey={handleClearKey} 
                            handleFullReset={handleResetData} 
                            handleReportsReset={clearTestReportsAndLogs} 
                            handleChatReset={clearChatHistory} 
                            handleGamificationReset={clearGamificationState} 
                            aiPreferences={aiPreferences} 
                            setAiPreferences={setAiPreferences} 
                            notificationPreferences={notificationPreferences} 
                            setNotificationPreferences={setNotificationPreferences} 
                            appearancePreferences={appearancePreferences} 
                            setAppearancePreferences={setAppearancePreferences} 
                            userProfile={userProfile} 
                            setUserProfile={setUserProfile} 
                            theme={theme} 
                            setTheme={setTheme} 
                            addToast={(toast: any) => setToasts(p => [...p, { ...toast, id: Date.now() }])} 
                            reports={jeeData.testReports} 
                            logs={jeeData.questionLogs} 
                            onSyncData={handleDataSync} 
                            longTermGoals={jeeData.longTermGoals} 
                            setLongTermGoals={jeeData.setLongTermGoals} 
                            gamificationState={gamificationState}
                            studyGoals={jeeData.studyGoals}
                            chatHistory={jeeData.chatHistory}
                        />
                    )}
                </Suspense>
            </AppShell>
        </div>
    );
};

export default App;
