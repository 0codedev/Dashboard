
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { TestReport, QuestionLog, StudyGoal, GlobalFilter, AiFilter, ChatMessage, RootCauseFilter, Toast, AiAssistantPreferences, NotificationPreferences, UserProfile, Theme, DailyTask, AppearancePreferences, View, GamificationState, LongTermGoal } from './types';
import { TaskType, QuestionStatus, TaskEffort } from './types';
import { Dashboard } from './components/Dashboard';
import { OcrProcessor } from './components/OcrProcessor';
import { DeepAnalysis } from './components/DeepAnalysis';
import { RootCause } from './components/RootCause';
import { DetailedReportsView } from './components/DetailedReportsView';
import { AiAssistant } from './components/AiAssistant';
import { QuestionLogEditor } from './components/QuestionLogEditor';
import { ApiKeyManager } from './components/ApiKeyManager';
import { DailyPlanner } from './components/DailyPlanner';
import { Achievements } from './components/Achievements';
import { Settings } from './components/Settings';
import { Syllabus } from './components/Syllabus';
import { AppShell } from './components/layout/AppShell';
import { generateFocusedStudyPlan } from './services/geminiService';
import { useJeeData } from './hooks/useJeeData';
import { useAchievements } from './hooks/useAchievements';
import { dbService } from './services/dbService';

const App: React.FC = () => {
    const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('gemini-api-key'));
    const [view, setView] = useState<View>('daily-planner');
    const [activeLogFilter, setActiveLogFilter] = useState<AiFilter | null>(null);
    const [rootCauseFilter, setRootCauseFilter] = useState<RootCauseFilter>({});
    const [proactiveInsight, setProactiveInsight] = useState<{ subject: 'physics' | 'chemistry' | 'maths'; visible: boolean; } | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [prefilledTask, setPrefilledTask] = useState<Partial<DailyTask> | null>(null);

    const [aiPreferences, setAiPreferences] = useState<AiAssistantPreferences>(() => {
        try { const saved = localStorage.getItem('aiAssistantPreferences_v1'); return saved ? JSON.parse(saved) : { responseLength: 'medium', tone: 'encouraging' }; } catch { return { responseLength: 'medium', tone: 'encouraging' }; }
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

    // Memoize the callback to ensure referential stability
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
        const canvas = document.getElementById('background-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: any[] = [];
        const mouse = { x: -200, y: -200 };

        const style = getComputedStyle(document.documentElement);
        let primaryRgb = style.getPropertyValue('--color-primary-rgb').trim();
        let accentRgb = style.getPropertyValue('--color-primary-accent-rgb').trim();

        const updateColors = () => {
             const newStyle = getComputedStyle(document.documentElement);
             primaryRgb = newStyle.getPropertyValue('--color-primary-rgb').trim();
             accentRgb = newStyle.getPropertyValue('--color-primary-accent-rgb').trim();
        }

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init(); // Re-initialize particles on resize
        };

        const handleMouseMove = (event: MouseEvent) => {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        };

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', handleMouseMove);
        
        class Particle {
            x: number; y: number; size: number; speedX: number; speedY: number; color: string;
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 1.5 + 0.5;
                this.speedX = (Math.random() * 2 - 1) * 0.2;
                this.speedY = (Math.random() * 2 - 1) * 0.2;
                this.color = `rgba(${primaryRgb}, 0.5)`;
            }
            update() {
                if (this.x > canvas.width || this.x < 0) this.speedX = -this.speedX;
                if (this.y > canvas.height || this.y < 0) this.speedY = -this.speedY;
                this.x += this.speedX;
                this.y += this.speedY;
            }
            draw() { if(ctx) { ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); } }
        }

        function init() {
            updateColors();
            particles = [];
            const numberOfParticles = Math.floor(canvas.width / 40);
            for (let i = 0; i < numberOfParticles; i++) { particles.push(new Particle()); }
        }

        function connect() {
            if (!ctx) return;
            let opacityValue = 1;
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    const distance = Math.sqrt(Math.pow(particles[a].x - particles[b].x, 2) + Math.pow(particles[a].y - particles[b].y, 2));
                    if (distance < 120) {
                        opacityValue = 1 - distance / 120;
                        ctx.strokeStyle = `rgba(${primaryRgb}, ${opacityValue * 0.3})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(particles[a].x, particles[a].y); ctx.lineTo(particles[b].x, particles[b].y); ctx.stroke();
                    }
                }
            }
            for (let i = 0; i < particles.length; i++) {
                const distance = Math.sqrt(Math.pow(particles[i].x - mouse.x, 2) + Math.pow(particles[i].y - mouse.y, 2));
                if (distance < 200) {
                    opacityValue = 1 - distance / 200;
                    ctx.strokeStyle = `rgba(${accentRgb}, ${opacityValue * 0.4})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                }
            }
        }

        function animate() {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            connect();
            animationFrameId = requestAnimationFrame(animate);
        }

        resizeCanvas();
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, [theme]);


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
        const canvas = document.getElementById('background-canvas') as HTMLCanvasElement;
        if (canvas) {
            canvas.style.display = appearancePreferences.disableParticles ? 'none' : 'block';
        }
    }, [appearancePreferences]);
    useEffect(() => { localStorage.setItem('userProfile_v2', JSON.stringify(userProfile)); }, [userProfile]);
    useEffect(() => {
        localStorage.setItem('theme_v1', JSON.stringify(theme));
        document.documentElement.className = `theme-${theme}`;
    }, [theme]);

    // Backup Reminder Logic
    useEffect(() => {
        if (testReports.length > lastReportCountRef.current) {
            // Data increased
            const diff = testReports.length - lastReportCountRef.current;
            // Trigger every 3rd report added or simply if data grew significantly
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
        // Clear relevant localStorage items
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
            
            if (latestAccuracy > 0 && secondLatestAccuracy > 0 && latestAccuracy < secondLatestAccuracy - 5) { // 5% drop
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
            const plan = await generateFocusedStudyPlan(subject, weakTopics, apiKey);
            jeeData.setChatHistory(prev => prev.map(msg => msg.content === loadingMessage ? { ...msg, content: plan } : msg));
        } catch (error) {
            const errorMessage = "Sorry, I couldn't generate the plan right now. Please try asking me again later.";
            jeeData.setChatHistory(prev => prev.map(msg => msg.content === loadingMessage ? { ...msg, content: errorMessage } : msg));
        }
    }, [apiKey, proactiveInsight, jeeData.questionLogs, jeeData.setChatHistory]);

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
        // Confirmation is now handled by the DeleteConfirmationModal in DetailedReportsView
        setTestReports(prev => prev.filter(r => r.id !== reportId));
        setQuestionLogs(prev => prev.filter(l => l.testId !== reportId));
        setToasts(p => [...p, { id: Date.now(), title: 'Report Deleted', message: 'Test report and logs have been removed.', icon: '🗑️' }]);
    };

    // Enhanced Data Restore Handler
    const handleDataSync = (data: any) => {
        if (data.reports) setTestReports(data.reports);
        
        if (data.logs) {
            setQuestionLogs(data.logs);
        } else if (data.reports) {
            // If reports are provided but logs are not, clear the logs to avoid mismatch
            setQuestionLogs([]);
        }

        // Restore Profile & Syllabus
        if (data.userProfile) {
            setUserProfile(data.userProfile);
        }

        // Restore Goals
        if (data.studyGoals) jeeData.setStudyGoals(data.studyGoals);
        if (data.longTermGoals) jeeData.setLongTermGoals(data.longTermGoals);

        // Restore Gamification
        if (data.gamificationState) setGamificationState(data.gamificationState);

        // Restore Preferences
        if (data.aiPreferences) setAiPreferences(data.aiPreferences);
        if (data.notificationPreferences) setNotificationPreferences(data.notificationPreferences);
        if (data.appearancePreferences) setAppearancePreferences(data.appearancePreferences);
        
        // Restore Chat
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
                {view === 'daily-planner' && <DailyPlanner goals={jeeData.studyGoals} setGoals={jeeData.setStudyGoals} apiKey={apiKey} logs={jeeData.questionLogs} proactiveInsight={proactiveInsight} onAcceptPlan={handleAcceptPlan} onDismissInsight={handleDismissInsight} addXp={() => addXp('completeTask')} userProfile={userProfile} prefilledTask={prefilledTask} setPrefilledTask={setPrefilledTask} />}
                {view === 'dashboard' && <Dashboard reports={jeeData.filteredReports} logs={jeeData.filteredLogs} apiKey={apiKey} setView={setView} setRootCauseFilter={setRootCauseFilter} onStartFocusSession={handleStartFocusSession} longTermGoals={jeeData.longTermGoals} />}
                {view === 'syllabus' && <Syllabus userProfile={userProfile} setUserProfile={setUserProfile} questionLogs={jeeData.questionLogs} reports={jeeData.filteredReports} apiKey={apiKey} onStartFocusSession={handleStartFocusSession} setView={setView} addTasksToPlanner={addTasksToPlanner}/>}
                {view === 'detailed-reports' && <DetailedReportsView allReports={jeeData.testReports} filteredReports={jeeData.filteredReports} setReports={setTestReports} onViewQuestionLog={handleViewQuestionLogForTest} onDeleteReport={handleDeleteReport}/>}
                {view === 'deep-analysis' && <DeepAnalysis reports={jeeData.filteredReports} />}
                {view === 'root-cause' && <RootCause logs={jeeData.filteredLogs} reports={jeeData.filteredReports} rootCauseFilter={rootCauseFilter} setRootCauseFilter={setRootCauseFilter} apiKey={apiKey} />}
                {view === 'ai-assistant' && <AiAssistant reports={jeeData.filteredReports} questionLogs={jeeData.questionLogs} setView={setView} setActiveLogFilter={setActiveLogFilter} apiKey={apiKey} chatHistory={jeeData.chatHistory} setChatHistory={jeeData.setChatHistory} studyGoals={jeeData.studyGoals} setStudyGoals={jeeData.setStudyGoals} preferences={aiPreferences} />}
                {view === 'question-log-editor' && <QuestionLogEditor logs={jeeData.questionLogs} reports={jeeData.testReports} setLogs={setQuestionLogs} activeLogFilter={activeLogFilter} setActiveLogFilter={setActiveLogFilter} />}
                {view === 'data-entry' && <OcrProcessor onAddData={addData} apiKey={apiKey} />}
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
            </AppShell>
        </div>
    );
};

export default App;
