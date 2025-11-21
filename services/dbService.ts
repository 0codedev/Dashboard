import type { TestReport, QuestionLog, StudyGoal, ChatMessage, GamificationState, DailyTask, LongTermGoal } from '../types';

const DB_NAME = 'JeePerformanceDB';
const DB_VERSION = 4; // Bump version for schema change
const STORES = ['testReports', 'questionLogs', 'studyGoals', 'chatHistory', 'gamificationState', 'dailyTasks', 'appState', 'longTermGoals'] as const;
type StoreName = typeof STORES[number];

class DBService {
  private static instance: DBService;
  private db: IDBDatabase | null = null;

  private constructor() {}

  public static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  public async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject('Error opening IndexedDB.');
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        
        if (event.oldVersion < 1) {
            db.createObjectStore('testReports', { keyPath: 'id' });
            db.createObjectStore('questionLogs', { autoIncrement: true });
            db.createObjectStore('studyGoals', { keyPath: 'id' });
            db.createObjectStore('chatHistory', { autoIncrement: true });
        }
        if (event.oldVersion < 2) {
            if (!db.objectStoreNames.contains('gamificationState')) {
                db.createObjectStore('gamificationState');
            }
        }
        if (event.oldVersion < 3) {
            if (!db.objectStoreNames.contains('dailyTasks')) {
                db.createObjectStore('dailyTasks', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('appState')) {
                db.createObjectStore('appState');
            }
        }
        if (event.oldVersion < 4) {
            if (!db.objectStoreNames.contains('longTermGoals')) {
                db.createObjectStore('longTermGoals', { keyPath: 'id' });
            }
        }
      };
    });
  }
  
  public async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return new Promise(async (resolve, reject) => {
      const db = await this.initDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(`Error getting item with key ${key} from ${storeName}`);
      request.onsuccess = () => resolve(request.result as T | undefined);
    });
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    return new Promise(async (resolve, reject) => {
      const db = await this.initDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(`Error getting all items from ${storeName}`);
      request.onsuccess = () => resolve(request.result as T[]);
    });
  }
  
  public async getCount(storeName: StoreName): Promise<number> {
    return new Promise(async (resolve, reject) => {
      const db = await this.initDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onerror = () => reject(`Error counting items in ${storeName}`);
      request.onsuccess = () => resolve(request.result);
    });
  }

  public async put<T>(storeName: StoreName, item: T, key?: IDBValidKey): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const db = await this.initDB();
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(item, key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => {
            console.error(`Error putting item into ${storeName}`, event);
            reject(`Error putting item into ${storeName}`);
        };
    });
  }

  public async putBulk<T>(storeName: StoreName, items: T[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!items || items.length === 0) {
        resolve();
        return;
      }
      const db = await this.initDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      if (storeName === 'gamificationState' || storeName === 'appState') {
        if (items.length > 0) {
          // These are treated as singleton stores for simplicity in this app
          if(storeName === 'gamificationState') store.put(items[0], 'currentState');
        }
      } else {
        items.forEach(item => store.put(item));
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => {
        console.error(`Error putting bulk items into ${storeName}`, event);
        reject(`Error putting bulk items into ${storeName}`);
      }
    });
  }

  public async syncStore<T>(storeName: StoreName, items: T[]): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const db = await this.initDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      store.clear();
      
      if (storeName === 'gamificationState') {
        // This is a singleton store, so we use a static key.
        if (items.length > 0) {
          store.put(items[0], 'currentState');
        }
      } else {
        items.forEach(item => store.put(item));
      }
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => {
          console.error(`Error syncing store ${storeName}`, event);
          reject(`Error syncing store ${storeName}`)
      };
    });
  }
  
  public async clearAllStores(): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const db = await this.initDB();
        const transaction = db.transaction(STORES, 'readwrite');

        STORES.forEach(storeName => {
            const store = transaction.objectStore(storeName);
            store.clear();
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => {
            console.error(`Error clearing all stores`, event);
            reject(`Error clearing all stores`);
        };
    });
  }

   public async clearStore(storeName: StoreName): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const db = await this.initDB();
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            store.clear();

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => {
                console.error(`Error clearing store ${storeName}`, event);
                reject(`Error clearing store ${storeName}`);
            };
        });
    }
}

export const dbService = DBService.getInstance();