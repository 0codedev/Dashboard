
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { QuestionLog } from '../types';
import { dbService } from './dbService';

// Singleton to hold the model
let model: use.UniversalSentenceEncoder | null = null;
let isModelLoading = false;

// Initialize model lazily
const loadModel = async () => {
    if (model) return model;
    if (isModelLoading) {
        // Wait for existing load
        while (isModelLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (model) return model;
        }
    }
    
    isModelLoading = true;
    try {
        console.log("Loading Universal Sentence Encoder...");
        await tf.ready();
        model = await use.load();
        console.log("USE Model loaded.");
        return model;
    } catch (e) {
        console.error("Failed to load USE model:", e);
        return null;
    } finally {
        isModelLoading = false;
    }
};

const dotProduct = (a: number[], b: number[]) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
};

// Generate embedding for a single text string
export const generateEmbedding = async (text: string): Promise<number[]> => {
    const m = await loadModel();
    if (!m) return [];
    
    const embeddings = await m.embed(text);
    const data = await embeddings.data();
    embeddings.dispose(); // Cleanup tensor
    return Array.from(data);
};

// Store embeddings for question logs in IndexedDB
export const indexQuestionLogs = async (logs: QuestionLog[]) => {
    const m = await loadModel();
    if (!m) {
        console.warn("Skipping vector indexing: Model not available.");
        return;
    }

    console.time("Vector Indexing");
    
    // 1. Check which logs are already indexed
    const existingIds = new Set(await dbService.getAllKeys('vectorIndex'));
    const newLogs = logs.filter(l => !existingIds.has(`${l.testId}-${l.questionNumber}`));

    if (newLogs.length === 0) {
        console.timeEnd("Vector Indexing");
        return;
    }

    console.log(`Indexing ${newLogs.length} new logs...`);

    // 2. Prepare text batch
    const itemsToEmbed = newLogs.map(log => ({
        id: `${log.testId}-${log.questionNumber}`,
        content: `Subject: ${log.subject}. Topic: ${log.topic}. Error Type: ${log.reasonForError || 'None'}. Question Type: ${log.questionType}. Status: ${log.status}. Marks: ${log.marksAwarded}.`
    }));

    const texts = itemsToEmbed.map(i => i.content);

    // 3. Batch processing (USE works best with batches, but prevent UI freeze)
    const BATCH_SIZE = 50;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batchTexts = texts.slice(i, i + BATCH_SIZE);
        const batchItems = itemsToEmbed.slice(i, i + BATCH_SIZE);
        
        const tensor = await m.embed(batchTexts);
        const embeddingsData = await tensor.array();
        tensor.dispose();

        const storeItems = batchItems.map((item, idx) => ({
            id: item.id,
            content: item.content,
            vector: embeddingsData[idx]
        }));

        await dbService.putBulk('vectorIndex', storeItems);
        // Small yield to UI
        await new Promise(r => setTimeout(r, 0));
    }

    console.timeEnd("Vector Indexing");
};

interface SearchResult {
    id: string;
    score: number;
    content: string;
}

// Semantic Search
export const semanticSearch = async (query: string, limit: number = 5): Promise<SearchResult[]> => {
    const m = await loadModel();
    if (!m) return [];

    // 1. Embed query
    const queryTensor = await m.embed(query);
    const queryVector = await queryTensor.data();
    queryTensor.dispose();
    const qVec = Array.from(queryVector) as number[];

    // 2. Fetch all vectors from IDB
    // Optimization: In a real app, keep these in memory if dataset < 10k. 
    // Here we load from IDB to respect memory constraints of the tab.
    const allVectors = await dbService.getAll<{id: string, vector: number[], content: string}>('vectorIndex');
    
    if (allVectors.length === 0) return [];

    // 3. Calculate Cosine Similarity
    const results = allVectors.map(item => {
        // USE vectors are roughly normalized, so dot product is close to cosine similarity
        // Ideally we should normalize if strictly needed, but raw dot product works well for ranking here
        const score = dotProduct(qVec, item.vector);
        return { id: item.id, score, content: item.content };
    });

    // 4. Sort and Top-K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
};
