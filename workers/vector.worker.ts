
/// <reference lib="webworker" />

// Use CDN imports directly to ensure worker can load dependencies without sharing main thread import map
import * as tf from 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/+esm';
import * as use from 'https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder@1.3.3/+esm';

let model: use.UniversalSentenceEncoder | null = null;
let isModelLoading = false;

// Initialize Model
const initModel = async () => {
    if (model || isModelLoading) return;
    
    isModelLoading = true;
    try {
        await tf.ready();
        // Fallback to CPU if WebGL fails or for stability in background worker
        if (tf.getBackend() !== 'webgl' && tf.getBackend() !== 'cpu') {
             await tf.setBackend('cpu');
        }
        
        // Load model
        model = await use.load();
        self.postMessage({ type: 'MODEL_LOADED' });
    } catch (error: any) {
        console.error("Worker: Failed to load USE model", error);
        self.postMessage({ type: 'ERROR', error: 'Failed to load model: ' + error.message });
    } finally {
        isModelLoading = false;
    }
};

self.onmessage = async (e: MessageEvent) => {
    const { id, type, text } = e.data;

    if (type === 'INIT') {
        await initModel();
        return;
    }

    if (type === 'EMBED') {
        if (!model && !isModelLoading) {
            await initModel();
        }

        // Wait if still loading
        if (isModelLoading) {
             // Simple poll wait
             let attempts = 0;
             while(isModelLoading && attempts < 50) {
                 await new Promise(r => setTimeout(r, 100));
                 attempts++;
             }
        }

        if (!model) {
            self.postMessage({ id, type: 'ERROR', error: 'Model not initialized' });
            return;
        }

        try {
            const embeddings = await model.embed(text);
            const vector = await embeddings.array();
            embeddings.dispose(); 

            const result = Array.isArray(text) ? vector : vector[0];
            self.postMessage({ id, type: 'EMBED_RESULT', vector: result });
        } catch (error: any) {
            self.postMessage({ id, type: 'ERROR', error: error.message });
        }
    }
};
