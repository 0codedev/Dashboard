import { useState, useMemo, useEffect } from 'react';
import type { TestReport, QuestionLog, StudyGoal, GlobalFilter, ChatMessage, GamificationState, DailyTask, LongTermGoal } from '../types';
import { MOCK_TEST_REPORTS, MOCK_QUESTION_LOGS } from '../constants';
import { calculateMetrics } from '../utils/metrics';
import { dbService } from '../services/dbService';

const initialGamificationState: GamificationState = {
  level: 1,
  xp: 0,
  unlockedAchievements: {} as GamificationState['unlockedAchievements'],
  completedTasks: 0,
  streakData: { count: 0, date: '' },
  events: {},
};

export const useJeeData = () => {
    // Initialize with empty state
    const [testReports, setTestReports] = useState<TestReport[]>([]);
    const [questionLogs, setQuestionLogs] = useState<QuestionLog[]>([]);
    const [studyGoals, setStudyGoals] = useState<StudyGoal[]>([]);
    const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
    const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [gamificationState, setGamificationState] = useState<GamificationState>(initialGamificationState);
    
    // State for DB initialization
    const [isDbInitialized, setIsDbInitialized] = useState(false);

    const [globalFilter, setGlobalFilter] = useState<GlobalFilter>(() => {
        // Global filter is small, localStorage is fine for it.
        try {
            const saved = localStorage.getItem('jeeGlobalFilter_v2');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.type && parsed.subType) return { ...parsed, startDate: parsed.startDate || '', endDate: parsed.endDate || '' };
            }
        } catch (e) { console.error(e); }
        return { type: 'all', subType: 'all', startDate: '', endDate: '' };
    });
    
    // Load data from IndexedDB on initial mount
    useEffect(() => {
        const loadData = async () => {
            await dbService.initDB();
            const reportsCount = await dbService.getCount('testReports');

            if (reportsCount === 0) {
                // First time load, populate with mock data
                await dbService.putBulk('testReports', MOCK_TEST_REPORTS);
                await dbService.putBulk('questionLogs', MOCK_QUESTION_LOGS);
                await dbService.putBulk('chatHistory', [{ role: 'model', content: "Hello! I'm your AI performance coach. Ask me anything about your test reports, or generate a study plan." }]);
                await dbService.putBulk('gamificationState', [initialGamificationState]);
            }

            // Now load from DB
            const [reports, logs, goals, history, gStateArray, tasks, longGoals] = await Promise.all([
                dbService.getAll<TestReport>('testReports'),
                dbService.getAll<QuestionLog>('questionLogs'),
                dbService.getAll<StudyGoal>('studyGoals'),
                dbService.getAll<ChatMessage>('chatHistory'),
                dbService.getAll<GamificationState>('gamificationState'),
                dbService.getAll<DailyTask>('dailyTasks'),
                dbService.getAll<LongTermGoal>('longTermGoals'),
            ]);
            
            setTestReports(reports);
            setQuestionLogs(logs);
            setStudyGoals(goals);
            setLongTermGoals(longGoals);
            setGamificationState(gStateArray[0] || initialGamificationState);

            const today = new Date().toISOString().split('T')[0];
            const savedDate = await dbService.get<string>('appState', 'dailyTasksDate');
            if (savedDate === today) {
                setDailyTasks(tasks);
            } else {
                setDailyTasks([]); // Clear tasks for the new day
            }
            

            if(history.length > 0) {
                setChatHistory(history);
            } else {
                 setChatHistory([{ role: 'model', content: "Hello! I'm your AI performance coach. Ask me anything about your test reports, or generate a study plan." }]);
            }
            setIsDbInitialized(true);
        };

        loadData();
    }, []);

    // Sync state changes back to IndexedDB
    useEffect(() => { if (isDbInitialized) { dbService.syncStore('testReports', testReports); } }, [testReports, isDbInitialized]);
    useEffect(() => { if (isDbInitialized) { dbService.syncStore('questionLogs', questionLogs); } }, [questionLogs, isDbInitialized]);
    useEffect(() => { if (isDbInitialized) { dbService.syncStore('studyGoals', studyGoals); } }, [studyGoals, isDbInitialized]);
    useEffect(() => { if (isDbInitialized) { dbService.syncStore('longTermGoals', longTermGoals); } }, [longTermGoals, isDbInitialized]);
    useEffect(() => { 
        if (isDbInitialized) { 
            dbService.syncStore('dailyTasks', dailyTasks);
            dbService.put('appState', new Date().toISOString().split('T')[0], 'dailyTasksDate');
        } 
    }, [dailyTasks, isDbInitialized]);
    useEffect(() => { if (isDbInitialized) { dbService.syncStore('chatHistory', chatHistory); } }, [chatHistory, isDbInitialized]);
    useEffect(() => { if (isDbInitialized) { dbService.syncStore('gamificationState', [gamificationState]); } }, [gamificationState, isDbInitialized]);

    // Persist global filter to localStorage (it's small and simple)
    useEffect(() => { try { localStorage.setItem('jeeGlobalFilter_v2', JSON.stringify(globalFilter)); } catch (e) { console.error("Failed to save global filter", e); } }, [globalFilter]);


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
                // Add T00:00:00 to avoid timezone issues during comparison
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

    // --- Granular Reset Functions ---
    const clearTestReportsAndLogs = async () => {
        await dbService.clearStore('testReports');
        await dbService.clearStore('questionLogs');
        setTestReports([]);
        setQuestionLogs([]);
    };
    const clearChatHistory = async () => {
        await dbService.clearStore('chatHistory');
        setChatHistory([{ role: 'model', content: "Chat history cleared." }]);
    };
    const clearGamificationState = async () => {
        await dbService.clearStore('gamificationState');
        setGamificationState(initialGamificationState);
    };

    return {
        testReports,
        setTestReports,
        questionLogs,
        setQuestionLogs,
        studyGoals,
        setStudyGoals,
        longTermGoals,
        setLongTermGoals,
        dailyTasks,
        setDailyTasks,
        chatHistory,
        setChatHistory,
        gamificationState,
        setGamificationState,
        globalFilter,
        setGlobalFilter,
        reportsWithMetrics,
        filteredReports,
        filteredLogs,
        availableTestTypes,
        availableSubTypes,
        clearTestReportsAndLogs,
        clearChatHistory,
        clearGamificationState,
    };
};