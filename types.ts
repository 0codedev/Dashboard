
export enum TaskType {
  StudySession = "Study Session",
  ProblemPractice = "Problem Practice",
  Revision = "Revision",
  MockTest = "Mock Test",
  Break = "Break",
}

export enum TaskEffort {
    Low = "Low (Chore)",
    Medium = "Medium (Standard)",
    High = "High (Deep Work)"
}

export interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
  linkedTopic?: string;
  taskType: TaskType;
  effort?: TaskEffort;
  estimatedTime: number;
  accomplishment?: string;
  scheduledTime?: string;
}

export interface StudyGoal {
  id: string;
  text: string;
  completed: boolean;
  linkedTopic?: string;
}

export interface LongTermGoal {
    id: string;
    text: string;
    completed: boolean;
}

export interface SubjectData {
  marks: number;
  rank: number;
  correct: number;
  wrong: number;
  unanswered: number;
  partial: number;
  maxMarks?: number;
}

export interface CalculatedMetrics {
  accuracy: number;
  attemptRate: number;
  cwRatio: number;
  spaq: number;
  unattemptedPercent: number;
  negativeMarkImpact: number;
  scorePotentialRealized: number;
}

export interface SubjectDataWithMetrics extends SubjectData, CalculatedMetrics {}

export enum TestType {
  FullSyllabusMock = 'Full Syllabus Mock',
  ChapterTest = 'Chapter Test',
  PreviousYearPaper = 'Previous Year Paper',
  PartTest = 'Part Test',
}

export enum TestSubType {
  JEEMains = 'JEE Mains',
  JEEAdvanced = 'JEE Advanced',
}

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface GlobalFilter {
  type: TestType | 'all';
  subType: TestSubType | 'all';
  startDate?: string;
  endDate?: string;
}

export interface TestReport {
  id: string;
  testDate: string;
  testName: string;
  type?: TestType;
  subType?: TestSubType;
  difficulty?: DifficultyLevel; 
  topperScore?: number; 

  physics: SubjectData;
  chemistry: SubjectData;
  maths: SubjectData;
  total: SubjectData;

  physicsMetrics?: CalculatedMetrics;
  chemistryMetrics?: CalculatedMetrics;
  mathsMetrics?: CalculatedMetrics;
  totalMetrics?: CalculatedMetrics;
}

export enum QuestionType {
  // Generic
  SingleCorrect = "Single Correct",
  MultipleCorrect = "Multiple Correct",
  Integer = "Integer",
  MatrixMatch = "Matrix Match",
  
  // Specific Schemes (Restored for Dropdowns)
  SingleCorrect31 = "Single Correct (+3, -1)",
  SingleCorrect41 = "Single Correct (+4, -1)",
  SingleCorrect40 = "Single Correct (+4, 0)",
  MultipleCorrect42 = "Multiple Correct (+4, -2)",
  MultipleCorrect41 = "Multiple Correct (+4, -1)",
  Integer30 = "Integer (+3, 0)",
  Integer40 = "Integer (+4, 0)",
  Integer41 = "Integer (+4, -1)"
}

export enum QuestionStatus {
  FullyCorrect = "Fully Correct",
  PartiallyCorrect = "Partially Correct",
  Wrong = "Wrong",
  Unanswered = "Unanswered",
}

export enum ErrorReason {
  SillyMistake = "Silly Mistake",
  ConceptualGap = "Conceptual Gap",
  TimePressure = "Time Pressure",
  MisreadQuestion = "Misread Question",
  Guess = "Guess",
}

export interface QuestionLog {
  testId: string;
  subject: "physics" | "chemistry" | "maths";
  questionNumber: number;
  questionType: string; // Flexible string
  positiveMarks?: number; 
  negativeMarks?: number; 
  status: QuestionStatus;
  marksAwarded: number;
  topic: string;
  reasonForError?: string; // Changed to string to allow custom reasons
  answered?: string;
  finalKey?: string;
  timeSpent?: number;
}

// --- Advanced Analysis Types ---

export interface PanicEvent {
    testId: string;
    testName: string;
    startQuestion: number;
    endQuestion: number;
    length: number;
    lostMarks: number;
}

export interface GuessStats {
    totalGuesses: number;
    correctGuesses: number;
    efficiency: number; // Net Score / Potential Score
    netScoreImpact: number;
    
    // New Detailed Metrics
    intuitionScore: number; // % of guesses that were correct (ignoring marking scheme)
    safeGuesses: number; // Guesses on questions with 0 negative marks
    riskyGuesses: number; // Guesses on questions with negative marks
    riskyMisses: number; // Risky guesses that went wrong
}

export interface DependencyAlert {
    topic: string;
    rootCauseTopic: string;
    errorCount: number;
}

// --- AI Assistant & Filter Types ---

export type AiFilter = Partial<Pick<QuestionLog, 'subject' | 'reasonForError' | 'status' | 'topic'>> & { testId?: string };

export type GenUIToolType = 'chart' | 'checklist' | 'syllabus_node' | 'none';

export interface GenUIComponentData {
    type: GenUIToolType;
    data: any; 
    id: string;
}

export type ChatMessageContent =
  | string
  | { type: 'testReport'; data: TestReport }
  | { type: 'testComparison'; data: { testA: TestReport; testB: TestReport } }
  | { type: 'genUI'; component: GenUIComponentData };

export interface ChatMessage {
  role: 'user' | 'model';
  content: ChatMessageContent;
  timestamp?: number;
  isThinking?: boolean; 
  thinkingContent?: string;
}

export interface RootCauseFilter {
    subject?: string | null;
    reason?: ErrorReason | null;
    topic?: string | null;
}

export interface ModelInfo {
    id: string;
    displayName: string;
    description: string;
}

export interface AiAssistantPreferences {
  model: string; 
  responseLength: 'short' | 'medium' | 'long';
  tone: 'encouraging' | 'neutral' | 'direct';
  customInstructions?: string; 
  socraticMode?: boolean; 
}

export interface NotificationPreferences {
  achievements: boolean;
  proactiveInsights: boolean;
  proactiveInsightSensitivity: 'high' | 'medium' | 'low';
}

export interface AppearancePreferences {
  disableParticles: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
}

export enum TargetExam {
    JEEMains = "JEE Mains",
    JEEAdvanced = "JEE Advanced",
    BITSAT = "BITSAT",
    NEET = "NEET",
    Other = "Other"
}

export enum SyllabusStatus {
    NotStarted = "Not Started",
    InProgress = "In Progress",
    Completed = "Completed",
    Revising = "Revising"
}

export type PriorityQuadrant = 'Critical Focus' | 'Sharpen Sword' | 'Opportunity' | 'Stronghold';

export interface ChapterProgress {
    status: SyllabusStatus;
    strength: 'strength' | 'weakness' | null;
    subTopicStatus?: Record<string, boolean>;
    revisionCount: number;
    aiSuggestedStrength?: 'strength' | 'weakness' | 'dismissed' | null;
    lastRevised?: string; 
    nextRevisionDate?: string; 
    lectureCompleted?: boolean;
    notesCompleted?: boolean;
    completionDate?: string; 
    flashcard?: string; // Stores the AI-generated explanation for Quick Review
}

export interface QuizQuestion {
  question: string;
  options: { [key: string]: string };
  answer: string; 
  explanation: string;
}

export interface UserProfile {
  name: string;
  targetExams: TargetExam[];
  studyTimes: {
      morning: string;
      afternoon: string;
      evening: string;
  };
  syllabus: Record<string, Partial<ChapterProgress>>; 
  cohortSizes: {
      [TestSubType.JEEMains]: number;
      [TestSubType.JEEAdvanced]: number;
  };
  targetTimePerQuestion: { 
      physics: number;
      chemistry: number;
      maths: number;
  };
  targetExamDate?: string; 
  syllabusCompletionBufferDays?: number; 
}


export type Theme = 'cyan' | 'indigo' | 'green' | 'red';

// --- Gamification Types ---

export type AchievementId =
  | 'firstSteps'
  | 'taskMaster'
  | 'streakKeeper'
  | 'testVeteran'
  | 'accuracyAce'
  | 'rankRipper'
  | 'comebackKid'
  | 'sillyMistakeSlayer'
  | 'deepDiver';


export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  category: 'Performance' | 'Consistency' | 'Diligence';
  tiers?: { count: number; title: string }[];
  progress?: number;
  goal?: number;
  tier?: number;
  unlockedAt?: string;
}

export interface GamificationState {
  level: number;
  xp: number;
  unlockedAchievements: Record<AchievementId, { unlockedAt: string; tier?: number }>;
  completedTasks: number; 
  streakData: { count: number; date: string }; 
  events: Record<string, boolean>; 
}

export interface Toast {
  id: number;
  title: string;
  message: string;
  icon: string;
}

export type View = 'daily-planner' | 'dashboard' | 'detailed-reports' | 'deep-analysis' | 'root-cause' | 'data-entry' | 'ai-assistant' | 'question-log-editor' | 'settings' | 'achievements' | 'syllabus';
