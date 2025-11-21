import { useMemo, useCallback, useEffect } from 'react';
// Fix: Import React types to resolve namespace errors.
import type { Dispatch, SetStateAction } from 'react';
import type { GamificationState, AchievementId, Toast, DailyTask, TestReport, QuestionLog, StudyGoal } from '../types';
import { ACHIEVEMENT_CONFIG, LEVEL_THRESHOLDS, XP_EVENTS } from '../achievements';

type JeeData = {
  testReports: TestReport[];
  questionLogs: QuestionLog[];
  studyGoals: StudyGoal[];
  // dailyTasks are managed locally in DailyPlanner, so we need a different approach for them.
};

export const useAchievements = (
  jeeData: JeeData,
  gamificationState: GamificationState,
  setGamificationState: Dispatch<SetStateAction<GamificationState>>,
  addToast: (toast: Omit<Toast, 'id'>) => void
) => {
  const { testReports, questionLogs } = jeeData;

  const checkAchievements = useCallback(() => {
    const newlyUnlocked: AchievementId[] = [];
    const now = new Date().toISOString();

    const checkAndAdd = (id: AchievementId) => {
      if (!gamificationState.unlockedAchievements[id]) {
        newlyUnlocked.push(id);
      }
    };

    // First Steps
    if (testReports.length > 0) checkAndAdd('firstSteps');
    
    // Fix: Use the correct AchievementId 'testVeteran' and simplify the check.
    // Test Veteran
    if (testReports.length >= 10) checkAndAdd('testVeteran');

    // Comeback Kid
    if (testReports.length >= 2) {
      const sortedByDate = [...testReports].sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
      for (let i = 1; i < sortedByDate.length; i++) {
        if (sortedByDate[i-1].total.rank - sortedByDate[i].total.rank > 1000) {
          checkAndAdd('comebackKid');
          break;
        }
      }
    }
    
    if (newlyUnlocked.length > 0) {
      const updatedAchievements = { ...gamificationState.unlockedAchievements };
      newlyUnlocked.forEach(id => {
        updatedAchievements[id] = { unlockedAt: now };
        const config = ACHIEVEMENT_CONFIG[id];
        addToast({ title: 'Achievement Unlocked!', message: config.title, icon: config.icon });
      });
      setGamificationState(prev => ({ ...prev, unlockedAchievements: updatedAchievements }));
    }
  }, [testReports, gamificationState.unlockedAchievements, addToast, setGamificationState]);

  useEffect(() => {
    // Check achievements when data loads or changes
    checkAchievements();
  }, [testReports, questionLogs, checkAchievements]);

  const addXp = useCallback((event: keyof typeof XP_EVENTS) => {
    const xpToAdd = XP_EVENTS[event];
    setGamificationState(prev => {
      let newXp = prev.xp + xpToAdd;
      let newLevel = prev.level;
      let xpForNext = LEVEL_THRESHOLDS[newLevel - 1];
      
      while (newXp >= xpForNext && newLevel < LEVEL_THRESHOLDS.length) {
        newXp -= xpForNext;
        newLevel++;
        xpForNext = LEVEL_THRESHOLDS[newLevel - 1];
        addToast({ title: 'Level Up!', message: `You've reached Level ${newLevel}!`, icon: '🎉' });
      }
      
      return { ...prev, xp: newXp, level: newLevel };
    });
  }, [setGamificationState, addToast]);

  const levelInfo = useMemo(() => {
    const currentLevelXP = gamificationState.xp;
    const xpForNextLevel = LEVEL_THRESHOLDS[gamificationState.level - 1] || Infinity;
    const progress = xpForNextLevel !== Infinity ? (currentLevelXP / xpForNextLevel) * 100 : 100;

    return {
      currentLevelXP,
      xpForNextLevel,
      progress
    };
  }, [gamificationState.level, gamificationState.xp]);

  const achievements = useMemo(() => {
    return Object.values(ACHIEVEMENT_CONFIG).map(config => ({
      ...config,
      unlocked: !!gamificationState.unlockedAchievements[config.id],
    }));
  }, [gamificationState.unlockedAchievements]);

  return { achievements, addXp, levelInfo };
};