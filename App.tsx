import React, { useState, useRef, useEffect, useCallback, Suspense, useMemo } from 'react';
import type { AiFilter, RootCauseFilter, Toast, DailyTask, View, TestReport, QuestionLog } from './types';
import { TaskType, QuestionStatus, TaskEffort } from './types';
import { ApiKeyManager } from './components/ApiKeyManager';
import { AppShell } from './components/layout/AppShell';
import { generateFocusedStudyPlan } from './services/geminiService';
import { useAchievements } from './hooks/useAchievements';
import { useJeeStore } from './store/useJeeStore';
import { calculateMetrics } from './utils/metrics';

// --- Lazy Load Heavy Components ---
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
    // --- Store Access ---
    const { 
        apiKey, setApiKey,
        userProfile, updateUserProfile,
        testReports, addTestReport, setTestReports,
        questionLogs, setQuestionLogs,
        studyGoals, setStudyGoals,
        longTermGoals, setLongTermGoals,
        dailyTasks, setDailyTasks,
        chatHistory, setChatHistory,
        gamificationState, setGamificationState,
        aiPreferences, setAiPreferences,
        notificationPreferences, setNotificationPreferences,
        appearancePreferences, setAppearancePreferences,
        theme, setTheme,
        globalFilter, setGlobalFilter,
        fullReset, clearReportsAndLogs, clearChatHistory, clearGamification,
        initialize
    } = useJeeStore();

    // --- Local UI State ---
    const [view, setView] = useState<View>('daily-planner');
    const [activeLogFilter, setActiveLogFilter] = useState<AiFilter | null>(null);
    const [rootCauseFilter, setRootCauseFilter] = useState<RootCauseFilter>({});
    const [proactiveInsight, setProactiveInsight] = useState<{ subject: 'physics' | 'chemistry' | 'maths'; visible: boolean; } | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [prefilledTask, setPrefilledTask] = useState<Partial<DailyTask> | null>(null);

    // --- Init ---
    useEffect(() => {
        initialize();
    }, [initialize]);

    // --- Computed Data (Replaces useJeeData logic) ---
    const reportsWithMetrics = useMemo(() => {
        return testReports.map(report => ({
            ...report,
            physicsMetrics: calculateMetrics(report.physics),
            chemistryMetrics: calculateMetrics(report.chemistry),
            mathsMetrics: calculateMetrics(report.maths),
            totalMetrics: calculateMetrics(report.total, 75),
        }));
    }, [testReports]);

    const { filteredReports, filteredLogs, availableTestTypes, availableSubTypes } = useMemo(() => {
        const reports = reportsWithMetrics;
        const availableTestTypes = Array.from(new Set(reports.map(r => r.type).filter(Boolean))) as string[];
        const availableSubTypes = Array.from(new Set(reports.map(r => r.subType).filter(Boolean))) as string[];
        
        const globallyFilteredReports = reports.filter(report => {
            const typeMatch = globalFilter.type === 'all' || report.type === globalFilter.type;
            const subTypeMatch = globalFilter.subType === 'all' || report.subType === globalFilter.subType;
            
            const dateMatch = (() => {
                if (!globalFilter.startDate && !globalFilter.endDate) return true;
                const reportDate = new Date(`${report.testDate}T00:00:00`);
                const start = globalFilter.startDate ? new Date(`${globalFilter.startDate}T00:00:00`) : null;
                const end = globalFilter.endDate ? new Date(`${globalFilter.endDate}T00:00:00`) : null;
                if (start && reportDate < start) return false;
                if (end && reportDate > end) return false;
                return true;
            })();

            return typeMatch && subTypeMatch && dateMatch;
        });
        
        const filteredReportIds = new Set(globallyFilteredReports.map(r => r.id));
        const correspondingLogs = questionLogs.filter(log => filteredReportIds.has(log.testId));

        return {
            filteredReports: globallyFilteredReports,
            filteredLogs: correspondingLogs,
            availableTestTypes,
            availableSubTypes
        };
    }, [reportsWithMetrics, questionLogs, globalFilter]);

    // --- Achievements Logic ---
    const handleAchievementToast = useCallback((toast: Omit<Toast, 'id'>) => {
        if (notificationPreferences.achievements) {
            setToasts(p => [...p, { ...toast, id: Date.now() }]);
        }
    }, [notificationPreferences.achievements]);

    const { achievements, addXp, levelInfo } = useAchievements(
        { testReports, questionLogs, studyGoals }, // Passed as object to match hook sig
        gamificationState,
        setGamificationState,
        handleAchievementToast,
    );

    // --- Insights Logic ---
    const insightDismissedForThisDataset = useRef(false);
    const prevFilteredReportsRef = useRef(filteredReports);
    const lastReportCountRef = useRef(testReports.length);

    useEffect(() => {
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            const heading = mainContent.querySelector('h1, h2');
            if (heading) { (heading as HTMLElement).focus(); }
        }
    }, [view]);

    useEffect(() => {
        if (testReports.length > lastReportCountRef.current) {
            if (testReports.length % 3 === 0) {
                setToasts(prev => [...prev, { id: Date.now(), title: 'Backup Recommended', message: 'You have added significant data. Consider backing up your progress in Settings.', icon: '💾' }]);
            }
        }
        lastReportCountRef.current = testReports.length;
    }, [testReports]);

    useEffect(() => {
        if (prevFilteredReportsRef.current !== filteredReports) {
            insightDismissedForThisDataset.current = false;
            prevFilteredReportsRef.current = filteredReports;
        }
    }, [filteredReports]);

    useEffect(() => {
        if (!notificationPreferences.proactiveInsights || filteredReports.length < 2 || proactiveInsight?.visible || insightDismissedForThisDataset.current) {
            return;
        }

        const latestReport = filteredReports[filteredReports.length - 1];
        const secondLatestReport = filteredReports[filteredReports.length - 2];
        const subjects: ('physics' | 'chemistry' | 'maths')[] = ['physics', 'chemistry', 'maths'];

        for (const subject of subjects) {
            const latestAccuracy = latestReport[`${subject}Metrics`]?.accuracy ?? 0;
            const secondLatestAccuracy = secondLatestReport[`${subject}Metrics`]?.accuracy ?? 0;
            
            if (latestAccuracy > 0 && secondLatestAccuracy > 0 && latestAccuracy < secondLatestAccuracy - 5) {
                setProactiveInsight({ subject, visible: true });
                break;
            }
        }
    }, [filteredReports, proactiveInsight, notificationPreferences.proactiveInsights]);

    // --- Handlers ---

    const handleKeySubmit = (key: string) => setApiKey(key);
    const handleClearKey = () => setApiKey(null);
    
    const handleResetData = async () => fullReset();

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

    const handleAcceptPlan = useCallback(async () => {
        insightDismissedForThisDataset.current = true;
        if (!proactiveInsight || !apiKey) return;
        
        const { subject } = proactiveInsight;
        setProactiveInsight(null);

        const loadingMessage = `Okay, I'm creating a focused 3-day recovery plan for ${subject}. Give me a moment...`;
        setChatHistory(prev => [...prev, { role: 'model', content: loadingMessage }]);
        setView('ai-assistant');

        const weakTopics = Array.from(
            questionLogs
                .filter(log => log.subject === subject && (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) && log.topic && log.topic !== 'N/A')
                .reduce((acc, log) => acc.set(log.topic, (acc.get(log.topic) || 0) + 1), new Map<string, number>())
                .entries()
        ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

        try {
            const plan = await generateFocusedStudyPlan(subject, weakTopics, apiKey, aiPreferences.model);
            setChatHistory(prev => prev.map(msg => msg.content === loadingMessage ? { ...msg, content: plan } : msg));
        } catch (error) {
            const errorMessage = "Sorry, I couldn't generate the plan right now. Please try asking me again later.";
            setChatHistory(prev => prev.map(msg => msg.content === loadingMessage ? { ...msg, content: errorMessage } : msg));
        }
    }, [apiKey, proactiveInsight, questionLogs, setChatHistory, aiPreferences.model]);

    const handleDismissInsight = () => {
        insightDismissedForThisDataset.current = true;
        setProactiveInsight(prev => prev ? { ...prev, visible: false } : null);
    };

    const addData = (data: { report: TestReport; logs: QuestionLog[] }) => {
        addTestReport(data.report, data.logs);
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
        if (data.logs) setQuestionLogs(data.logs);
        if (data.userProfile) updateUserProfile(data.userProfile);
        if (data.studyGoals) setStudyGoals(data.studyGoals);
        if (data.longTermGoals) setLongTermGoals(data.longTermGoals);
        if (data.gamificationState) setGamificationState(data.gamificationState);
        if (data.aiPreferences) setAiPreferences(data.aiPreferences);
        if (data.notificationPreferences) setNotificationPreferences(data.notificationPreferences);
        if (data.appearancePreferences) setAppearancePreferences(data.appearancePreferences);
        if (data.chatHistory) setChatHistory(data.chatHistory);
        setToasts(p => [...p, { id: Date.now(), title: 'Restore Complete', message: 'All data restored.', icon: '✅' }]);
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
                globalFilter={globalFilter}
                setGlobalFilter={setGlobalFilter}
                availableTestTypes={availableTestTypes}
                availableSubTypes={availableSubTypes}
                toasts={toasts}
                setToasts={setToasts}
            >
                <Suspense fallback={<PageLoader />}>
                    {view === 'daily-planner' && <DailyPlanner goals={studyGoals} setGoals={setStudyGoals} apiKey={apiKey} logs={questionLogs} proactiveInsight={proactiveInsight} onAcceptPlan={handleAcceptPlan} onDismissInsight={handleDismissInsight} addXp={() => addXp('completeTask')} userProfile={userProfile} prefilledTask={prefilledTask} setPrefilledTask={setPrefilledTask} dailyTasks={dailyTasks} setDailyTasks={setDailyTasks} modelName={aiPreferences.model} />}
                    {view === 'dashboard' && <Dashboard reports={filteredReports} logs={filteredLogs} apiKey={apiKey} setView={setView} setRootCauseFilter={setRootCauseFilter} onStartFocusSession={handleStartFocusSession} longTermGoals={longTermGoals} modelName={aiPreferences.model} userProfile={userProfile} onUpdateProfile={updateUserProfile} />}
                    {view === 'syllabus' && <Syllabus userProfile={userProfile} setUserProfile={updateUserProfile} questionLogs={questionLogs} reports={filteredReports} apiKey={apiKey} onStartFocusSession={handleStartFocusSession} setView={setView} addTasksToPlanner={addTasksToPlanner} modelName={aiPreferences.model} />}
                    {view === 'detailed-reports' && <DetailedReportsView allReports={testReports} filteredReports={filteredReports} setReports={setTestReports} onViewQuestionLog={handleViewQuestionLogForTest} onDeleteReport={handleDeleteReport}/>}
                    {view === 'deep-analysis' && <DeepAnalysis reports={filteredReports} />}
                    {view === 'root-cause' && <RootCause logs={filteredLogs} reports={filteredReports} rootCauseFilter={rootCauseFilter} setRootCauseFilter={setRootCauseFilter} apiKey={apiKey} onAddTask={(task) => addTasksToPlanner([task])} modelName={aiPreferences.model} />}
                    {view === 'ai-assistant' && <AiAssistant reports={filteredReports} questionLogs={questionLogs} setView={setView} setActiveLogFilter={setActiveLogFilter} apiKey={apiKey} chatHistory={chatHistory} setChatHistory={setChatHistory} studyGoals={studyGoals} setStudyGoals={setStudyGoals} preferences={aiPreferences} onUpdatePreferences={setAiPreferences} userProfile={userProfile} onAddTasksToPlanner={addTasksToPlanner} />}
                    {view === 'flashcards' && <ErrorVaccinator logs={questionLogs} apiKey={apiKey} />}
                    {view === 'question-log-editor' && <QuestionLogEditor logs={questionLogs} reports={testReports} setLogs={setQuestionLogs} activeLogFilter={activeLogFilter} setActiveLogFilter={setActiveLogFilter} />}
                    {view === 'data-entry' && <OcrProcessor onAddData={addData} apiKey={apiKey} modelName={aiPreferences.model} />}
                    {view === 'achievements' && <Achievements gamificationState={gamificationState} achievements={achievements} levelInfo={levelInfo} />}
                    {view === 'settings' && (
                        <Settings 
                            apiKey={apiKey!} 
                            onKeySubmit={handleKeySubmit} 
                            onClearKey={handleClearKey} 
                            handleFullReset={handleResetData} 
                            handleReportsReset={clearReportsAndLogs} 
                            handleChatReset={clearChatHistory} 
                            handleGamificationReset={clearGamification} 
                            aiPreferences={aiPreferences} 
                            setAiPreferences={setAiPreferences} 
                            notificationPreferences={notificationPreferences} 
                            setNotificationPreferences={setNotificationPreferences} 
                            appearancePreferences={appearancePreferences} 
                            setAppearancePreferences={setAppearancePreferences} 
                            userProfile={userProfile} 
                            setUserProfile={updateUserProfile} 
                            theme={theme} 
                            setTheme={setTheme} 
                            addToast={(toast: any) => setToasts(p => [...p, { ...toast, id: Date.now() }])} 
                            reports={testReports} 
                            logs={questionLogs} 
                            onSyncData={handleDataSync} 
                            longTermGoals={longTermGoals} 
                            setLongTermGoals={setLongTermGoals} 
                            gamificationState={gamificationState}
                            studyGoals={studyGoals}
                            chatHistory={chatHistory}
                        />
                    )}
                </Suspense>
            </AppShell>
        </div>
    );
};

export default App;