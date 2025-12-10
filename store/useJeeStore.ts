
import { create } from 'zustand';
import { 
    UserProfile, 
    TestReport, 
    QuestionLog, 
    StudyGoal, 
    LongTermGoal, 
    GamificationState, 
    GlobalFilter,
    SyllabusStatus,
    ChapterProgress
} from '../types';

interface JeeState {
    userProfile: UserProfile;
    testReports: TestReport[];
    questionLogs: QuestionLog[];
    studyGoals: StudyGoal[];
    longTermGoals: LongTermGoal[];
    gamificationState: GamificationState;
    globalFilter: GlobalFilter;
}

interface JeeActions {
    // Setters (Bulk)
    setUserProfile: (profile: UserProfile) => void;
    setTestReports: (reports: TestReport[]) => void;
    setQuestionLogs: (logs: QuestionLog[]) => void;
    setStudyGoals: (goals: StudyGoal[]) => void;
    setLongTermGoals: (goals: LongTermGoal[]) => void;
    setGamificationState: (state: GamificationState) => void;
    setGlobalFilter: (filter: GlobalFilter) => void;

    // Atomic Updates
    updateUserProfile: (updates: Partial<UserProfile>) => void;
    updateSyllabusStatus: (chapter: string, progress: Partial<ChapterProgress>) => void;
    
    addTestReport: (report: TestReport) => void;
    removeTestReport: (id: string) => void;
    
    addQuestionLogs: (logs: QuestionLog[]) => void;
    
    addStudyGoal: (goal: StudyGoal) => void;
    toggleStudyGoal: (id: string) => void;
    removeStudyGoal: (id: string) => void;

    addLongTermGoal: (goal: LongTermGoal) => void;
    toggleLongTermGoal: (id: string) => void;
    removeLongTermGoal: (id: string) => void;
}

const initialGamificationState: GamificationState = {
    level: 1,
    xp: 0,
    unlockedAchievements: {} as GamificationState['unlockedAchievements'],
    completedTasks: 0,
    streakData: { count: 0, date: '' },
    events: {},
};

const initialUserProfile: UserProfile = {
    name: '',
    targetExams: [],
    studyTimes: { morning: "7 AM - 10 AM", afternoon: "2 PM - 5 PM", evening: "8 PM - 11 PM" },
    syllabus: {},
    cohortSizes: { 'JEE Mains': 10000, 'JEE Advanced': 2500 },
    targetTimePerQuestion: { physics: 120, chemistry: 60, maths: 150 }
};

export const useJeeStore = create<JeeState & JeeActions>((set) => ({
    // Initial State
    userProfile: initialUserProfile,
    testReports: [],
    questionLogs: [],
    studyGoals: [],
    longTermGoals: [],
    gamificationState: initialGamificationState,
    globalFilter: { type: 'all', subType: 'all', startDate: '', endDate: '' },

    // Actions
    setUserProfile: (userProfile) => set({ userProfile }),
    setTestReports: (testReports) => set({ testReports }),
    setQuestionLogs: (questionLogs) => set({ questionLogs }),
    setStudyGoals: (studyGoals) => set({ studyGoals }),
    setLongTermGoals: (longTermGoals) => set({ longTermGoals }),
    setGamificationState: (gamificationState) => set({ gamificationState }),
    setGlobalFilter: (globalFilter) => set({ globalFilter }),

    updateUserProfile: (updates) => set((state) => ({
        userProfile: { ...state.userProfile, ...updates }
    })),

    updateSyllabusStatus: (chapter, progress) => set((state) => ({
        userProfile: {
            ...state.userProfile,
            syllabus: {
                ...state.userProfile.syllabus,
                [chapter]: {
                    ...(state.userProfile.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0 }),
                    ...progress
                }
            }
        }
    })),

    addTestReport: (report) => set((state) => ({
        testReports: [...state.testReports, report]
    })),

    removeTestReport: (id) => set((state) => ({
        testReports: state.testReports.filter(r => r.id !== id),
        questionLogs: state.questionLogs.filter(l => l.testId !== id) // Cascade delete logs
    })),

    addQuestionLogs: (logs) => set((state) => ({
        questionLogs: [...state.questionLogs, ...logs]
    })),

    addStudyGoal: (goal) => set((state) => ({
        studyGoals: [...state.studyGoals, goal]
    })),

    toggleStudyGoal: (id) => set((state) => ({
        studyGoals: state.studyGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g)
    })),

    removeStudyGoal: (id) => set((state) => ({
        studyGoals: state.studyGoals.filter(g => g.id !== id)
    })),

    addLongTermGoal: (goal) => set((state) => ({
        longTermGoals: [...state.longTermGoals, goal]
    })),

    toggleLongTermGoal: (id) => set((state) => ({
        longTermGoals: state.longTermGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g)
    })),

    removeLongTermGoal: (id) => set((state) => ({
        longTermGoals: state.longTermGoals.filter(g => g.id !== id)
    })),
}));
