
import { dbService } from './dbService';
import { QuestionLog } from '../types';

// Worker Interface
let worker: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

const getWorker = () => {
    if (!worker) {
        // UPDATED: Use `new URL` with `import.meta.url`. 
        // This tells Vite/Webpack to bundle this file and replace it with the correct production URL.
        worker = new Worker(new URL('../workers/vector.worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (e) => {
            const { id, type, vector, error } = e.data;
            
            if (type === 'MODEL_LOADED') {
                console.log("Vector Worker: Model Loaded");
                return;
            }

            const request = pendingRequests.get(id);
            if (request) {
                if (type === 'ERROR') request.reject(new Error(error));
                else request.resolve(vector);
                pendingRequests.delete(id);
            }
        };
        
        worker.onerror = (e) => {
            console.error("Vector Worker Error:", e);
        };

        // Trigger initialization
        worker.postMessage({ type: 'INIT' });
    }
    return worker;
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
    const worker = getWorker();
    const id = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random()}`;
    
    return new Promise((resolve, reject) => {
        // Add timeout to prevent hanging if worker fails silently
        const timeout = setTimeout(() => {
            if (pendingRequests.has(id)) {
                pendingRequests.delete(id);
                reject(new Error("Embedding generation timed out"));
            }
        }, 30000); // 30s timeout for model load + inference

        pendingRequests.set(id, { 
            resolve: (val) => { clearTimeout(timeout); resolve(val); }, 
            reject: (err) => { clearTimeout(timeout); reject(err); } 
        });
        
        worker.postMessage({ id, type: 'EMBED', text });
    });
};

// Store embeddings for question logs in IndexedDB
export const indexQuestionLogs = async (logs: QuestionLog[]) => {
    // Check which logs are already indexed (optimization)
    let existingIds: IDBValidKey[] = [];
    try {
        existingIds = await dbService.getAllKeys('vectorIndex');
    } catch {
        // Store might not be ready, abort
        return;
    }
    
    const existingSet = new Set(existingIds);
    
    // Filter strictly for new items
    const newLogs = logs.filter(l => !existingSet.has(`${l.testId}-${l.questionNumber}`));
    
    if (newLogs.length === 0) return;

    // Process in batches to avoid overwhelming the worker message queue
    const BATCH_SIZE = 5; 
    
    for (let i = 0; i < newLogs.length; i += BATCH_SIZE) {
        const batch = newLogs.slice(i, i + BATCH_SIZE);
        
        // We can run these in parallel
        await Promise.all(batch.map(async (log) => {
            const context = `
                Subject: ${log.subject}
                Topic: ${log.topic}
                Type: ${log.questionType}
                Error Reason: ${log.reasonForError || 'None'}
                Outcome: ${log.status}
            `.trim();
            
            try {
                // This now calls the worker
                const vector = await generateEmbedding(context);
                
                await dbService.put('vectorIndex', {
                    id: `${log.testId}-${log.questionNumber}`,
                    vector,
                    logId: `${log.testId}-${log.questionNumber}`,
                    content: context
                });
            } catch (e) {
                console.warn(`Failed to embed log ${log.testId}-${log.questionNumber}`, e);
            }
        }));
    }
};

// Cosine Similarity
const cosineSimilarity = (a: number[], b: number[]): number => {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

// Semantic Search
export const semanticSearch = async (query: string, limit: number = 5): Promise<{ id: string, score: number, content: string }[]> => {
    // We compute the query vector in the worker
    try {
        const queryVector = await generateEmbedding(query);
        
        // We fetch stored vectors from DB (Main Thread)
        const allVectors = await dbService.getAll<{ id: string, vector: number[], content: string }>('vectorIndex');
        
        const results = allVectors.map(item => ({
            id: item.id,
            score: cosineSimilarity(queryVector, item.vector),
            content: item.content
        }));
        
        // Sort by similarity score descending
        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (e) {
        console.error("Semantic search failed", e);
        return [];
    }
};
