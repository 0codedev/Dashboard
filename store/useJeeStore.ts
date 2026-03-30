import { create } from 'zustand';
import { 
    FlashcardSession,
    Flashcard,
    UserProfile,
    TestReport,
    QuestionLog,
    StudyGoal,
    LongTermGoal,
    DailyTask,
    ChatMessage,
    GamificationState,
    GlobalFilter,
    AiAssistantPreferences,
    NotificationPreferences,
    AppearancePreferences,
    Reflection
} from '../types';
import { dbService } from '../services/dbService';
import { MOCK_TEST_REPORTS, MOCK_QUESTION_LOGS } from '../constants';

import { useAppStore } from './useAppStore';
import { useDataStore } from './useDataStore';
import { useAIStore } from './useAIStore';

export interface JeeState {
    // Session State (Flashcards)
    flashcardSession: FlashcardSession;
    isFlashcardModalOpen: boolean;
    shieldActive: boolean;

    // Global App State
    isInitialized: boolean;
    apiKey: string | null;
    userProfile: UserProfile;
    
    // Data Collections
    testReports: TestReport[];
    questionLogs: QuestionLog[];
    studyGoals: StudyGoal[];
    longTermGoals: LongTermGoal[];
    dailyTasks: DailyTask[];
    chatHistory: ChatMessage[];
    activeSessionId: string | null;
    reflections: Reflection[];
    
    // DailyPlanner specific state
    bioStats: { sleep: number; stress: number; energy: number; date: string; skipped?: boolean } | null;
    dailyQuote: { text: string; date: string } | null;
    streakData: { count: number; date: string };
    endOfDaySummaries: Record<string, string>;
    dailyPlansHistory: Record<string, DailyTask[]>;
    
    // State & Config
    gamificationState: GamificationState;
    globalFilter: GlobalFilter;
    
    // Preferences
    aiPreferences: AiAssistantPreferences;
    notificationPreferences: NotificationPreferences;
    appearancePreferences: AppearancePreferences;
    theme: 'cyan' | 'indigo' | 'green' | 'red';
}

export interface JeeActions {
    // Initialization
    initialize: () => Promise<void>;
    
    // Flashcard Actions
    startFlashcardSession: (cards: Flashcard[]) => void;
    rateCurrentCard: (quality: number) => void;
    closeFlashcardSession: () => void;
    getSessionResults: () => Flashcard[]; 

    // Global Setters (with Persistence)
    setApiKey: (key: string | null) => void;
    updateUserProfile: (profile: UserProfile | ((prev: UserProfile) => UserProfile)) => void;
    setGlobalFilter: (filter: GlobalFilter) => void;
    
    // Data Actions
    addTestReport: (report: TestReport, logs: QuestionLog[]) => void;
    setTestReports: (reports: TestReport[] | ((prev: TestReport[]) => TestReport[])) => void;
    setQuestionLogs: (logs: QuestionLog[] | ((prev: QuestionLog[]) => QuestionLog[])) => void;
    
    // Task & Goal Actions
    setDailyTasks: (tasks: DailyTask[] | ((prev: DailyTask[]) => DailyTask[])) => void;
    setStudyGoals: (goals: StudyGoal[] | ((prev: StudyGoal[]) => StudyGoal[])) => void;
    setLongTermGoals: (goals: LongTermGoal[] | ((prev: LongTermGoal[]) => LongTermGoal[])) => void;
    setReflections: (reflections: Reflection[] | ((prev: Reflection[]) => Reflection[])) => void;
    
    setBioStats: (stats: { sleep: number; stress: number; energy: number; date: string; skipped?: boolean } | null) => void;
    setDailyQuote: (quote: { text: string; date: string } | null) => void;
    setStreakData: (data: { count: number; date: string }) => void;
    setEndOfDaySummaries: (summaries: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
    setDailyPlansHistory: (history: Record<string, DailyTask[]> | ((prev: Record<string, DailyTask[]>) => Record<string, DailyTask[]>)) => void;
    
    // Chat & Gamification
    setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    setActiveSessionId: (id: string | null) => void;
    setGamificationState: (state: GamificationState | ((prev: GamificationState) => GamificationState)) => void;
    
    // Preferences Actions
    setAiPreferences: (prefs: AiAssistantPreferences | ((prev: AiAssistantPreferences) => AiAssistantPreferences)) => void;
    setNotificationPreferences: (prefs: NotificationPreferences | ((prev: NotificationPreferences) => NotificationPreferences)) => void;
    setAppearancePreferences: (prefs: AppearancePreferences | ((prev: AppearancePreferences) => AppearancePreferences)) => void;
    setTheme: (theme: 'cyan' | 'indigo' | 'green' | 'red') => void;
    setShieldActive: (isActive: boolean) => void;

    // Reset
    fullReset: () => Promise<void>;
    clearReportsAndLogs: () => Promise<void>;
    clearChatHistory: () => Promise<void>;
    clearGamification: () => Promise<void>;
}

export const useJeeStore = create<JeeState & JeeActions>((set, get) => ({
    // --- Initial State (Derived from micro-stores) ---
    flashcardSession: useDataStore.getState().flashcardSession,
    isFlashcardModalOpen: useAppStore.getState().isFlashcardModalOpen,
    shieldActive: useAppStore.getState().shieldActive,
    
    isInitialized: useAppStore.getState().isInitialized,
    apiKey: useAppStore.getState().apiKey,
    userProfile: useAppStore.getState().userProfile,
    
    testReports: useDataStore.getState().testReports,
    questionLogs: useDataStore.getState().questionLogs,
    studyGoals: useDataStore.getState().studyGoals,
    longTermGoals: useDataStore.getState().longTermGoals,
    dailyTasks: useDataStore.getState().dailyTasks,
    chatHistory: useAIStore.getState().chatHistory,
    activeSessionId: useAIStore.getState().activeSessionId,
    reflections: useDataStore.getState().reflections,
    
    bioStats: useDataStore.getState().bioStats,
    dailyQuote: useDataStore.getState().dailyQuote,
    streakData: useDataStore.getState().streakData,
    endOfDaySummaries: useDataStore.getState().endOfDaySummaries,
    dailyPlansHistory: useDataStore.getState().dailyPlansHistory,
    
    gamificationState: useAppStore.getState().gamificationState,
    globalFilter: useAppStore.getState().globalFilter,
    
    aiPreferences: useAppStore.getState().aiPreferences,
    notificationPreferences: useAppStore.getState().notificationPreferences,
    appearancePreferences: useAppStore.getState().appearancePreferences,
    theme: useAppStore.getState().theme,

    // --- Actions (Proxying to micro-stores) ---

    initialize: async () => {
        const appState = useAppStore.getState();
        if (appState.isInitialized) return;

        // 1. Load LocalStorage Items (Sync)
        const apiKey = localStorage.getItem('gemini-api-key');
        const savedProfile = localStorage.getItem('userProfile_v2');
        const savedAiPrefs = localStorage.getItem('aiAssistantPreferences_v1');
        const savedNotifPrefs = localStorage.getItem('notificationPreferences_v1');
        const savedAppearPrefs = localStorage.getItem('appearancePreferences_v1');
        const savedTheme = localStorage.getItem('theme_v1');
        const savedFilter = localStorage.getItem('jeeGlobalFilter_v2');
        const savedTimer = localStorage.getItem('jee_timer_state');

        // 2. Load IndexedDB Items (Async)
        await dbService.initDB();
        const reportsCount = await dbService.getCount('testReports');

        if (reportsCount === 0) {
            // Seed Mock Data if empty
            await dbService.putBulk('testReports', MOCK_TEST_REPORTS);
            await dbService.putBulk('questionLogs', MOCK_QUESTION_LOGS);
            await dbService.putBulk('chatHistory', [{ role: 'model', content: "Hello! I'm your AI performance coach. Ask me anything about your test reports, or generate a study plan." }]);
            
            const initialGamificationState: GamificationState = {
                level: 1,
                xp: 0,
                unlockedAchievements: {} as any,
                completedTasks: 0,
                streakData: { count: 0, date: '' },
                events: {},
            };
            await dbService.putBulk('gamificationState', [initialGamificationState]);
        }

        const [reports, logs, goals, history, gStateArray, tasks, longGoals, reflections] = await Promise.all([
            dbService.getAll<TestReport>('testReports'),
            dbService.getAll<QuestionLog>('questionLogs'),
            dbService.getAll<StudyGoal>('studyGoals'),
            dbService.getAll<ChatMessage>('chatHistory'),
            dbService.getAll<GamificationState>('gamificationState'),
            dbService.getAll<DailyTask>('dailyTasks'),
            dbService.getAll<LongTermGoal>('longTermGoals'),
            dbService.getAll<any>('reflections'),
        ]);

        // Daily Task Reset Logic
        const getLocalDateStr = (date: Date = new Date()) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const today = getLocalDateStr();
        const savedDate = await dbService.get<string>('appState', 'dailyTasksDate');
        
        let currentTasks = tasks;
        if (savedDate !== today) {
            // Keep unfinished tasks as ghosts
            currentTasks = tasks.filter(t => !t.completed).map(t => ({ ...t, isGhost: true, scheduledTime: undefined }));
            // Save the new state
            useDataStore.getState().setDailyTasks(currentTasks);
        }

        // Apply visual preferences immediately
        const appearance = savedAppearPrefs ? JSON.parse(savedAppearPrefs) : appState.appearancePreferences;
        const themeVal = savedTheme ? JSON.parse(savedTheme) : 'cyan';
        document.body.classList.toggle('reduce-motion', appearance.reduceMotion);
        document.body.classList.toggle('high-contrast', appearance.highContrast);
        document.documentElement.className = `theme-${themeVal}`;

        // Hydrate micro-stores
        useAppStore.getState().hydrateApp({
            isInitialized: true,
            apiKey,
            userProfile: savedProfile ? JSON.parse(savedProfile) : appState.userProfile,
            aiPreferences: savedAiPrefs ? JSON.parse(savedAiPrefs) : appState.aiPreferences,
            notificationPreferences: savedNotifPrefs ? JSON.parse(savedNotifPrefs) : appState.notificationPreferences,
            appearancePreferences: appearance,
            theme: themeVal,
            globalFilter: savedFilter ? JSON.parse(savedFilter) : appState.globalFilter,
            gamificationState: gStateArray[0] || appState.gamificationState,
            timerState: savedTimer ? JSON.parse(savedTimer) : appState.timerState,
        });

        const todayStr = getLocalDateStr();
        useDataStore.getState().hydrateData({
            testReports: reports,
            questionLogs: logs,
            studyGoals: goals,
            longTermGoals: longGoals,
            dailyTasks: currentTasks,
            reflections: reflections,
            bioStats: localStorage.getItem(`bioLog_${todayStr}`) ? JSON.parse(localStorage.getItem(`bioLog_${todayStr}`)!) : null,
            dailyQuote: localStorage.getItem('dailyQuote') ? JSON.parse(localStorage.getItem('dailyQuote')!) : null,
            streakData: localStorage.getItem('streakData_v1') ? JSON.parse(localStorage.getItem('streakData_v1')!) : { count: 0, date: '' },
            endOfDaySummaries: localStorage.getItem('endOfDaySummaries_v1') ? JSON.parse(localStorage.getItem('endOfDaySummaries_v1')!) : {},
            dailyPlansHistory: localStorage.getItem('dailyPlansHistory_v1') ? JSON.parse(localStorage.getItem('dailyPlansHistory_v1')!) : {}
        });

        useAIStore.getState().hydrateAI({
            chatHistory: history.length > 0 ? history : [{ role: 'model', content: "Hello! I'm your AI performance coach." }],
        });
    },

    setApiKey: (key) => useAppStore.getState().setApiKey(key),
    updateUserProfile: (profileOrFn) => useAppStore.getState().updateUserProfile(profileOrFn),
    setGlobalFilter: (filter) => useAppStore.getState().setGlobalFilter(filter),
    
    addTestReport: (report, logs) => useDataStore.getState().addTestReport(report, logs),
    setTestReports: (reportsOrFn) => useDataStore.getState().setTestReports(reportsOrFn),
    setQuestionLogs: (logsOrFn) => useDataStore.getState().setQuestionLogs(logsOrFn),
    
    setDailyTasks: (tasksOrFn) => useDataStore.getState().setDailyTasks(tasksOrFn),
    setStudyGoals: (goalsOrFn) => useDataStore.getState().setStudyGoals(goalsOrFn),
    setLongTermGoals: (goalsOrFn) => useDataStore.getState().setLongTermGoals(goalsOrFn),
    setReflections: (reflectionsOrFn) => useDataStore.getState().setReflections(reflectionsOrFn),
    
    setBioStats: (stats) => useDataStore.getState().setBioStats(stats),
    setDailyQuote: (quote) => useDataStore.getState().setDailyQuote(quote),
    setStreakData: (data) => useDataStore.getState().setStreakData(data),
    setEndOfDaySummaries: (summaries) => useDataStore.getState().setEndOfDaySummaries(summaries),
    setDailyPlansHistory: (history) => useDataStore.getState().setDailyPlansHistory(history),
    
    setChatHistory: (historyOrFn) => useAIStore.getState().setChatHistory(historyOrFn),
    setActiveSessionId: (id) => useAIStore.getState().setActiveSessionId(id),
    setGamificationState: (stateOrFn) => useAppStore.getState().setGamificationState(stateOrFn),
    
    setAiPreferences: (prefsOrFn) => useAppStore.getState().setAiPreferences(prefsOrFn),
    setNotificationPreferences: (prefsOrFn) => useAppStore.getState().setNotificationPreferences(prefsOrFn),
    setAppearancePreferences: (prefsOrFn) => useAppStore.getState().setAppearancePreferences(prefsOrFn),
    setTheme: (theme) => useAppStore.getState().setTheme(theme),
    setShieldActive: (isActive) => useAppStore.getState().setShieldActive(isActive),

    fullReset: async () => {
        await dbService.clearAllStores();
        localStorage.clear();
        window.location.reload();
    },

    clearReportsAndLogs: async () => useDataStore.getState().clearReportsAndLogs(),
    clearChatHistory: async () => useAIStore.getState().clearChatHistory(),
    clearGamification: async () => useAppStore.getState().clearGamification(),

    startFlashcardSession: (cards) => {
        useDataStore.getState().startFlashcardSession(cards);
        useAppStore.getState().setFlashcardModalOpen(true);
    },
    rateCurrentCard: (quality) => useDataStore.getState().rateCurrentCard(quality),
    closeFlashcardSession: () => useAppStore.getState().setFlashcardModalOpen(false),
    getSessionResults: () => useDataStore.getState().getSessionResults()
}));

// Sync micro-stores to proxy store to ensure reactivity for components still using useJeeStore
useAppStore.subscribe((state) => {
    useJeeStore.setState({
        isInitialized: state.isInitialized,
        apiKey: state.apiKey,
        userProfile: state.userProfile,
        gamificationState: state.gamificationState,
        globalFilter: state.globalFilter,
        aiPreferences: state.aiPreferences,
        notificationPreferences: state.notificationPreferences,
        appearancePreferences: state.appearancePreferences,
        theme: state.theme,
        isFlashcardModalOpen: state.isFlashcardModalOpen,
        shieldActive: state.shieldActive
    });
});

useDataStore.subscribe((state) => {
    useJeeStore.setState({
        testReports: state.testReports,
        questionLogs: state.questionLogs,
        studyGoals: state.studyGoals,
        longTermGoals: state.longTermGoals,
        dailyTasks: state.dailyTasks,
        flashcardSession: state.flashcardSession,
        reflections: state.reflections,
        bioStats: state.bioStats,
        dailyQuote: state.dailyQuote,
        streakData: state.streakData,
        endOfDaySummaries: state.endOfDaySummaries,
        dailyPlansHistory: state.dailyPlansHistory
    });
});

useAIStore.subscribe((state) => {
    useJeeStore.setState({
        chatHistory: state.chatHistory,
        activeSessionId: state.activeSessionId
    });
});
