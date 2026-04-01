
import React, { useState, useRef, useEffect, useCallback, Suspense, useMemo } from 'react';
import type { AiFilter, RootCauseFilter, Toast, DailyTask, View, TestReport, QuestionLog } from './types';
import { TaskType, QuestionStatus, TaskEffort, TestType, TestSubType } from './types';
import { ApiKeyManager } from './components/ApiKeyManager';
import { LoginScreen } from './components/LoginScreen';
import { AppShell } from './components/layout/AppShell';
import { generateFocusedStudyPlan } from './services/geminiService';
import { useAchievements } from './hooks/useAchievements';
import { useJeeStore } from './store/useJeeStore';
import { calculateMetrics } from './utils/metrics';
import { auth } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

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
const NewAIFeatures = React.lazy(() => import('./components/NewAIFeatures').then(module => ({ default: module.NewAIFeatures })));
const ReflectionsTab = React.lazy(() => import('./components/ReflectionsTab').then(module => ({ default: module.ReflectionsTab })));
const Launchpad = React.lazy(() => import('./components/Launchpad').then(module => ({ default: module.Launchpad })));

// --- Loading Component ---
const PageLoader = () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-lg">
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
        activeSessionId, setActiveSessionId,
        gamificationState, setGamificationState,
        aiPreferences, setAiPreferences,
        notificationPreferences, setNotificationPreferences,
        appearancePreferences, setAppearancePreferences,
        theme, setTheme,
        globalFilter, setGlobalFilter,
        reflections, setReflections,
        endOfDaySummaries, setEndOfDaySummaries,
        dailyPlansHistory, setDailyPlansHistory,
        bioStats, setBioStats,
        dailyQuote, setDailyQuote,
        streakData, setStreakData,
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
    
    // --- Auth State ---
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // --- Init ---
    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

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
        const availableTestTypes = Array.from(new Set([...reports.map(r => r.type).filter(Boolean), ...Object.values(TestType)])) as string[];
        const availableSubTypes = Array.from(new Set(reports.map(r => r.subType).filter(Boolean))) as string[];
        
        const globallyFilteredReports = reports.filter(report => {
            const typeMatch = globalFilter.type === 'all' || 
                (Array.isArray(globalFilter.type) 
                    ? (globalFilter.type.length === 0 || globalFilter.type.includes(report.type as any))
                    : report.type === globalFilter.type);
            const subTypeMatch = globalFilter.subType === 'all' || 
                (Array.isArray(globalFilter.subType)
                    ? (globalFilter.subType.length === 0 || globalFilter.subType.includes(report.subType as any))
                    : report.subType === globalFilter.subType);
            
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
        const correspondingLogs = questionLogs.filter(log => {
            if (!filteredReportIds.has(log.testId)) return false;
            if (globalFilter.subjects && globalFilter.subjects.length > 0) {
                if (!globalFilter.subjects.includes(log.subject)) return false;
            }
            return true;
        });

        return {
            filteredReports: globallyFilteredReports,
            filteredLogs: correspondingLogs,
            availableTestTypes,
            availableSubTypes
        };
    }, [reportsWithMetrics, questionLogs, globalFilter]);

    // --- Achievements Logic ---
    const toastCounter = useRef(0);
    const handleAchievementToast = useCallback((toast: Omit<Toast, 'id'>) => {
        if (notificationPreferences.achievements) {
            toastCounter.current += 1;
            setToasts(p => [...p, { ...toast, id: Date.now() + toastCounter.current }]);
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

    // Flashcard Reminder
    useEffect(() => {
        if (!notificationPreferences.flashcardReminders) return;
        
        const checkFlashcards = () => {
            try {
                const storedCardsStr = localStorage.getItem('errorFlashcards_v1');
                if (!storedCardsStr) return;
                const cards = JSON.parse(storedCardsStr);
                const now = new Date();
                const dueCount = cards.filter((c: any) => new Date(c.nextReview) <= now && c.back !== '__STUB__').length;
                
                if (dueCount > 0) {
                    toastCounter.current += 1;
                    setToasts(prev => [...prev, { 
                        id: Date.now() + toastCounter.current, 
                        title: 'Flashcards Due', 
                        message: `You have ${dueCount} flashcard(s) ready for review.`, 
                        icon: '🎴' 
                    }]);
                }
            } catch (e) {
                console.error("Failed to check flashcards for reminder", e);
            }
        };

        // Check once on mount
        checkFlashcards();
        
        // And check every hour
        const interval = setInterval(checkFlashcards, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [notificationPreferences.flashcardReminders]);

    // Bio Check Reminder
    useEffect(() => {
        if (!notificationPreferences.bioCheckReminders) return;
        
        const checkBio = () => {
            toastCounter.current += 1;
            setToasts(prev => [...prev, { 
                id: Date.now() + toastCounter.current, 
                title: 'Bio Check', 
                message: 'Time to stretch, hydrate, and rest your eyes!', 
                icon: '💧' 
            }]);
        };

        // Check every 2 hours
        const interval = setInterval(checkBio, 2 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [notificationPreferences.bioCheckReminders]);

    // Auto-Backup and Unsaved Changes Reminder
    const backupStateRef = useRef({ testReports, questionLogs, userProfile, aiPreferences, notificationPreferences, appearancePreferences, gamificationState, studyGoals, longTermGoals, chatHistory, dailyTasks, reflections, endOfDaySummaries, dailyPlansHistory });
    useEffect(() => {
        backupStateRef.current = { testReports, questionLogs, userProfile, aiPreferences, notificationPreferences, appearancePreferences, gamificationState, studyGoals, longTermGoals, chatHistory, dailyTasks, reflections, endOfDaySummaries, dailyPlansHistory };
    });

    useEffect(() => {
        if (!currentUser) return;

        const checkBackupStatus = async () => {
            const unsavedCountStr = localStorage.getItem('unsaved_changes_count');
            const unsavedCount = parseInt(unsavedCountStr || '0', 10);
            const lastBackupStr = localStorage.getItem('last_auto_backup_time');
            const lastBackup = lastBackupStr ? new Date(lastBackupStr) : new Date(0);
            const now = new Date();
            const hoursSinceBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

            // Reminder for unsaved changes
            if (unsavedCount > 50) {
                toastCounter.current += 1;
                setToasts(prev => [...prev, {
                    id: Date.now() + toastCounter.current,
                    title: 'Backup Recommended',
                    message: 'You have many unsaved changes. Consider backing up your progress in Settings.',
                    icon: '💾'
                }]);
                // Reset counter slightly so it doesn't spam every minute, but will remind again if they keep working
                localStorage.setItem('unsaved_changes_count', '20');
            }

            // Auto-backup once a day
            if (hoursSinceBackup >= 24 && unsavedCount > 0) {
                try {
                    const { backupFullDataToFirebase } = await import('./services/backupService');
                    const state = backupStateRef.current;
                    const exportData = {
                        version: 1,
                        date: new Date().toISOString(),
                        reports: state.testReports,
                        logs: state.questionLogs,
                        userProfile: state.userProfile,
                        aiPreferences: state.aiPreferences,
                        notificationPreferences: state.notificationPreferences,
                        appearancePreferences: state.appearancePreferences,
                        gamificationState: state.gamificationState,
                        studyGoals: state.studyGoals,
                        longTermGoals: state.longTermGoals,
                        chatHistory: state.chatHistory,
                        dailyTasks: state.dailyTasks,
                        reflections: state.reflections,
                        endOfDaySummaries: state.endOfDaySummaries,
                        dailyPlansHistory: state.dailyPlansHistory
                    };
                    await backupFullDataToFirebase(exportData);
                    toastCounter.current += 1;
                    setToasts(prev => [...prev, {
                        id: Date.now() + toastCounter.current,
                        title: 'Auto-Backup Complete',
                        message: 'Your progress was automatically backed up to Firebase.',
                        icon: '☁️'
                    }]);
                } catch (err) {
                    console.error("Auto-backup failed:", err);
                }
            }
        };

        // Check every 15 minutes
        const interval = setInterval(checkBackupStatus, 15 * 60 * 1000);
        // Also check 1 minute after load
        const initialTimeout = setTimeout(checkBackupStatus, 60 * 1000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, [currentUser]);

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
        toastCounter.current += 1;
        setToasts(p => [...p, {
            id: Date.now() + toastCounter.current,
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
        toastCounter.current += 1;
        setToasts(p => [...p, { id: Date.now() + toastCounter.current, title: 'Report Deleted', message: 'Test report and logs have been removed.', icon: '🗑️' }]);
    };

    const handleDataSync = (data: any) => {
        if (data.reports) {
            // Repair missing types/subTypes in restored data
            const repairedReports = data.reports.map((report: any) => {
                let type = report.type;
                let subType = report.subType;
                
                if (!type || !subType) {
                    const lowerTitle = (report.testName || "").toLowerCase();
                    if (!subType) {
                        if (lowerTitle.includes('mains') || lowerTitle.includes('main')) subType = TestSubType.JEEMains;
                        else if (lowerTitle.includes('advanced')) subType = TestSubType.JEEAdvanced;
                        else subType = TestSubType.JEEMains; // Default
                    }
                    if (!type) {
                        if (lowerTitle.includes('full syllabus') || lowerTitle.includes('mock')) type = TestType.FullSyllabusMock;
                        else if (lowerTitle.includes('pyq') || lowerTitle.includes('previous year')) type = TestType.PreviousYearPaper;
                        else type = TestType.ChapterTest; // Default
                    }
                }
                
                return { ...report, type, subType };
            });
            setTestReports(repairedReports);
        }
        if (data.logs) setQuestionLogs(data.logs);
        if (data.userProfile) updateUserProfile(data.userProfile);
        if (data.studyGoals) setStudyGoals(data.studyGoals);
        if (data.longTermGoals) setLongTermGoals(data.longTermGoals);
        if (data.gamificationState) setGamificationState(data.gamificationState);
        if (data.aiPreferences) setAiPreferences(data.aiPreferences);
        if (data.notificationPreferences) setNotificationPreferences(data.notificationPreferences);
        if (data.appearancePreferences) setAppearancePreferences(data.appearancePreferences);
        if (data.chatHistory) setChatHistory(data.chatHistory);
        if (data.dailyTasks) setDailyTasks(data.dailyTasks);
        if (data.reflections) setReflections(data.reflections);
        if (data.endOfDaySummaries) useJeeStore.getState().setEndOfDaySummaries(data.endOfDaySummaries);
        if (data.dailyPlansHistory) useJeeStore.getState().setDailyPlansHistory(data.dailyPlansHistory);
        toastCounter.current += 1;
        setToasts(p => [...p, { id: Date.now() + toastCounter.current, title: 'Restore Complete', message: 'All data restored.', icon: '✅' }]);
        setView('dashboard');
    };

    const handleViewQuestionLogForTest = (testId: string) => { setActiveLogFilter({ testId: testId }); setView('question-log-editor'); };
    
    if (!isAuthReady) { return <PageLoader />; }
    
    if (!currentUser) { return <LoginScreen onLoginSuccess={() => {}} />; }

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
                    {view === 'daily-planner' && <DailyPlanner goals={studyGoals} setGoals={setStudyGoals} apiKey={apiKey || ''} logs={questionLogs} proactiveInsight={proactiveInsight} onAcceptPlan={handleAcceptPlan} onDismissInsight={handleDismissInsight} addXp={() => addXp('completeTask')} userProfile={userProfile} prefilledTask={prefilledTask} setPrefilledTask={setPrefilledTask} tasks={dailyTasks} onUpdateTasks={setDailyTasks} modelName={aiPreferences.model} bioStats={bioStats} setBioStats={setBioStats} dailyQuote={dailyQuote} setDailyQuote={setDailyQuote} streakData={streakData} setStreakData={setStreakData} endOfDaySummaries={endOfDaySummaries} setEndOfDaySummaries={setEndOfDaySummaries} dailyPlansHistory={dailyPlansHistory} setDailyPlansHistory={setDailyPlansHistory} />}
                    {view === 'dashboard' && <Dashboard reports={filteredReports} logs={filteredLogs} apiKey={apiKey} setView={setView} setRootCauseFilter={setRootCauseFilter} onStartFocusSession={handleStartFocusSession} longTermGoals={longTermGoals} modelName={aiPreferences.model} userProfile={userProfile} onUpdateProfile={updateUserProfile} />}
                    {view === 'syllabus' && <Syllabus userProfile={userProfile} setUserProfile={updateUserProfile} questionLogs={questionLogs} reports={filteredReports} apiKey={apiKey} onStartFocusSession={handleStartFocusSession} setView={setView} addTasksToPlanner={addTasksToPlanner} modelName={aiPreferences.model} />}
                    {view === 'detailed-reports' && <DetailedReportsView allReports={testReports} filteredReports={filteredReports} setReports={setTestReports} onViewQuestionLog={handleViewQuestionLogForTest} onDeleteReport={handleDeleteReport} apiKey={apiKey} logs={questionLogs} />}
                    {view === 'deep-analysis' && <DeepAnalysis reports={filteredReports} />}
                    {view === 'root-cause' && <RootCause logs={filteredLogs} reports={filteredReports} rootCauseFilter={rootCauseFilter} setRootCauseFilter={setRootCauseFilter} apiKey={apiKey} onAddTask={(task) => addTasksToPlanner([task])} modelName={aiPreferences.model} />}
                    {view === 'ai-assistant' && <AiAssistant reports={filteredReports} questionLogs={questionLogs} setView={setView} setActiveLogFilter={setActiveLogFilter} apiKey={apiKey} chatHistory={chatHistory} setChatHistory={setChatHistory} activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId} studyGoals={studyGoals} setStudyGoals={setStudyGoals} preferences={aiPreferences} onUpdatePreferences={setAiPreferences} userProfile={userProfile} onAddTasksToPlanner={addTasksToPlanner} />}
                    {view === 'flashcards' && <ErrorVaccinator logs={questionLogs} reports={testReports} apiKey={apiKey} />}
                    {view === 'question-log-editor' && <QuestionLogEditor logs={questionLogs} reports={testReports} setLogs={setQuestionLogs} activeLogFilter={activeLogFilter} setActiveLogFilter={setActiveLogFilter} />}
                    {view === 'data-entry' && <OcrProcessor onAddData={addData} apiKey={apiKey} modelName={aiPreferences.modelOverrides?.['ocr_extraction'] || aiPreferences.model} />}
                    {view === 'achievements' && <Achievements gamificationState={gamificationState} achievements={achievements} levelInfo={levelInfo} />}
                    {view === 'new-ai-features' && <NewAIFeatures />}
                    {view === 'reflections' && <ReflectionsTab apiKey={apiKey!} reflections={reflections} setReflections={setReflections} />}
                    {view === 'launchpad' && <Launchpad />}
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
                            addToast={(toast: any) => {
                                toastCounter.current += 1;
                                setToasts(p => [...p, { ...toast, id: Date.now() + toastCounter.current }]);
                            }} 
                            reports={testReports} 
                            logs={questionLogs} 
                            onSyncData={handleDataSync} 
                            longTermGoals={longTermGoals} 
                            setLongTermGoals={setLongTermGoals} 
                            gamificationState={gamificationState}
                            studyGoals={studyGoals}
                            chatHistory={chatHistory}
                            dailyTasks={dailyTasks}
                            reflections={reflections}
                            endOfDaySummaries={endOfDaySummaries}
                            dailyPlansHistory={dailyPlansHistory}
                        />
                    )}
                </Suspense>
            </AppShell>
        </div>
    );
};

export default App;
