
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { dbService } from './dbService';
import { QuestionLog } from '../types';

let model: use.UniversalSentenceEncoder | null = null;
let isModelLoading = false;

// Initialize TensorFlow.js and load the model
export const initVectorModel = async () => {
    if (model || isModelLoading) return;
    
    isModelLoading = true;
    try {
        await tf.ready(); // Ensure backend is ready (WebGL/WASM)
        model = await use.load();
        console.log("Universal Sentence Encoder loaded.");
    } catch (error) {
        console.error("Failed to load USE model:", error);
    } finally {
        isModelLoading = false;
    }
};

// Generate an embedding vector for a given text
export const generateEmbedding = async (text: string): Promise<number[]> => {
    if (!model) await initVectorModel();
    if (!model) throw new Error("Vector model failed to initialize.");

    const embeddings = await model.embed(text);
    const vector = await embeddings.array();
    embeddings.dispose(); // Clean up tensor memory
    return vector[0];
};

// Store embeddings for question logs in IndexedDB
export const indexQuestionLogs = async (logs: QuestionLog[]) => {
    // Check which logs are already indexed (optimization)
    const existingIds = await dbService.getAllKeys('vectorIndex');
    const existingSet = new Set(existingIds);
    
    const newLogs = logs.filter(l => !existingSet.has(`${l.testId}-${l.questionNumber}`));
    
    if (newLogs.length === 0) return;

    // Process in batches to avoid freezing UI
    const BATCH_SIZE = 10;
    for (let i = 0; i < newLogs.length; i += BATCH_SIZE) {
        const batch = newLogs.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (log) => {
            const context = `
                Subject: ${log.subject}
                Topic: ${log.topic}
                Type: ${log.questionType}
                Error Reason: ${log.reasonForError || 'None'}
                Outcome: ${log.status}
            `.trim();
            
            try {
                const vector = await generateEmbedding(context);
                await dbService.put('vectorIndex', {
                    id: `${log.testId}-${log.questionNumber}`,
                    vector,
                    logId: `${log.testId}-${log.questionNumber}`, // Reference to original log
                    content: context
                });
            } catch (e) {
                console.warn(`Failed to embed log ${log.testId}-${log.questionNumber}`, e);
            }
        }));
        
        // Small delay to yield to main thread
        await new Promise(resolve => setTimeout(resolve, 50));
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
    if (!model) await initVectorModel();
    
    const queryVector = await generateEmbedding(query);
    const allVectors = await dbService.getAll<{ id: string, vector: number[], content: string }>('vectorIndex');
    
    const results = allVectors.map(item => ({
        id: item.id,
        score: cosineSimilarity(queryVector, item.vector),
        content: item.content
    }));
    
    // Sort by similarity score descending
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
};
