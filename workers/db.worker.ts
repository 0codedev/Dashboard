import { expose } from 'comlink';
import Dexie, { type Table } from 'dexie';
import type { QuestionLog } from '../types';

// Define types for the new tables
export interface SyllabusNode {
  id: string;
  topic: string;
  subject: string;
  masteryScore: number;
  lastReviewed?: string;
  status?: string;
}

export interface AnalyticsCache {
  id: string;
  data: any;
  timestamp: number;
}

// Initialize Dexie DB
// We connect to the existing 'JeePerformanceDB' to share data with the main thread,
// but bump the version to 6 to safely add our new tables without breaking dbService.ts.
class JeeWorkerDatabase extends Dexie {
  questionLogs!: Table<QuestionLog, number>;
  syllabusNodes!: Table<SyllabusNode, string>;
  analyticsCache!: Table<AnalyticsCache, string>;

  constructor() {
    super('JeePerformanceDB');
    
    // Define schema. We include existing stores to prevent Dexie from deleting them,
    // and add our new stores (syllabusNodes, analyticsCache).
    this.version(6).stores({
      testReports: 'id',
      questionLogs: '++id', // ++id represents autoIncrement: true
      studyGoals: 'id',
      chatHistory: '++id',
      gamificationState: '', 
      dailyTasks: 'id',
      appState: '',
      longTermGoals: 'id',
      vectorIndex: 'id',
      // New tables for the worker pipeline
      syllabusNodes: 'id, subject, topic',
      analyticsCache: 'id'
    });
  }
}

const db = new JeeWorkerDatabase();

// Define the API to expose to the main thread
const dbWorkerAPI = {
  // --- Question Logs CRUD ---
  async getQuestionLogs(): Promise<QuestionLog[]> {
    return await db.questionLogs.toArray();
  },
  async addQuestionLog(log: QuestionLog): Promise<number> {
    return await db.questionLogs.add(log);
  },
  async addQuestionLogsBulk(logs: QuestionLog[]): Promise<void> {
    await db.questionLogs.bulkAdd(logs);
  },
  async clearQuestionLogs(): Promise<void> {
    await db.questionLogs.clear();
  },
  async syncQuestionLogs(logs: QuestionLog[]): Promise<void> {
    await db.transaction('rw', db.questionLogs, async () => {
      await db.questionLogs.clear();
      await db.questionLogs.bulkAdd(logs);
    });
  },

  // --- Syllabus Nodes CRUD ---
  async getSyllabusNodes(): Promise<SyllabusNode[]> {
    return await db.syllabusNodes.toArray();
  },
  async putSyllabusNode(node: SyllabusNode): Promise<string> {
    return await db.syllabusNodes.put(node);
  },
  async putSyllabusNodesBulk(nodes: SyllabusNode[]): Promise<void> {
    await db.syllabusNodes.bulkPut(nodes);
  },
  async deleteSyllabusNode(id: string): Promise<void> {
    await db.syllabusNodes.delete(id);
  },

  // --- Analytics Cache CRUD ---
  async getAnalyticsCache(id: string): Promise<AnalyticsCache | undefined> {
    return await db.analyticsCache.get(id);
  },
  async setAnalyticsCache(cache: AnalyticsCache): Promise<string> {
    return await db.analyticsCache.put(cache);
  },
  async clearAnalyticsCache(): Promise<void> {
    await db.analyticsCache.clear();
  }
};

// Export the type so the main thread can use it for the Comlink proxy
export type DBWorkerAPI = typeof dbWorkerAPI;

// Expose the API to the main thread
expose(dbWorkerAPI);
