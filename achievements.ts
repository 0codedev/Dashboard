import type { Achievement, AchievementId, TestReport, DailyTask } from './types';

export const LEVEL_THRESHOLDS = Array.from({ length: 50 }, (_, i) => 100 + i * 50);

export const XP_EVENTS = {
  completeTask: 10,
  addReport: 50,
  dailyStreak: 25,
};

export const ACHIEVEMENT_CONFIG: Record<AchievementId, Omit<Achievement, 'unlocked'>> = {
  firstSteps: {
    id: 'firstSteps',
    title: 'First Steps',
    description: 'Add your first test report to begin your journey.',
    icon: '🚀',
    category: 'Diligence',
    goal: 1,
  },
  taskMaster: {
    id: 'taskMaster',
    title: 'Task Master',
    description: 'Complete tasks in the Daily Planner.',
    icon: '✅',
    category: 'Diligence',
    tiers: [
      { count: 10, title: 'Task Master I' },
      { count: 50, title: 'Task Master II' },
      { count: 100, title: 'Task Master III' },
    ],
  },
  streakKeeper: {
    id: 'streakKeeper',
    title: 'Streak Keeper',
    description: 'Maintain a streak of completing all daily tasks.',
    icon: '🗓️',
    category: 'Consistency',
    tiers: [
        { count: 7, title: 'Week of Focus' },
        { count: 30, title: 'Month of Mastery' },
    ],
  },
  testVeteran: {
    id: 'testVeteran',
    title: 'Test Veteran',
    description: 'Complete test reports.',
    icon: '🎖️',
    category: 'Consistency',
    tiers: [
      { count: 10, title: 'Test Veteran I' },
      { count: 25, title: 'Test Veteran II' },
      { count: 50, title: 'Test Veteran III' },
    ],
  },
  accuracyAce: {
    id: 'accuracyAce',
    title: 'Accuracy Ace',
    description: 'Achieve over 80% accuracy in any full syllabus mock test.',
    icon: '🎯',
    category: 'Performance',
  },
  rankRipper: {
    id: 'rankRipper',
    title: 'Rank Ripper',
    description: 'Achieve a rank in the top 1000 in any test.',
    icon: '👑',
    category: 'Performance',
  },
  comebackKid: {
    id: 'comebackKid',
    title: 'Comeback Kid',
    description: 'Improve your rank by over 1000 between two consecutive tests.',
    icon: '📈',
    category: 'Performance',
  },
  sillyMistakeSlayer: {
    id: 'sillyMistakeSlayer',
    title: 'Silly Mistake Slayer',
    description: 'Log fewer than 3 silly mistakes in a full syllabus mock.',
    icon: '⚔️',
    category: 'Diligence',
  },
  deepDiver: {
    id: 'deepDiver',
    title: 'Deep Diver',
    description: 'Use an AI analysis feature for the first time.',
    icon: '🔬',
    category: 'Diligence',
  },
};
