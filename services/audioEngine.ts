
import { GoogleGenAI, Modality } from "@google/genai";

// ==========================================
// 1. Singleton AudioContext Management
// ==========================================
let sharedAudioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
    if (!sharedAudioContext && typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        sharedAudioContext = new AudioContextClass();
    }
    return sharedAudioContext!;
}

// ==========================================
// 2. Base64 Decoder Utility
// ==========================================
async function decodeBase64ToAudioBuffer(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
    // Convert Base64 string to an ArrayBuffer
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Gemini TTS returns raw 16-bit PCM at 24kHz
    const sampleRate = 24000;
    const numChannels = 1;
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

// ==========================================
// 3. TTS State Management
// ==========================================
let currentTTSSource: AudioBufferSourceNode | null = null;

export function stopTTS() {
    if (currentTTSSource) {
        try {
            currentTTSSource.stop();
            currentTTSSource.disconnect();
        } catch (e) {
            // Ignore errors if already stopped
        }
        currentTTSSource = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}

// ==========================================
// 4. The Hybrid Fallback TTS Function
// ==========================================
export async function playTTS(text: string, apiKey: string): Promise<void> {
    if (!text) return;
    
    // Stop any currently playing audio
    stopTTS();

    // Initialize/Resume AudioContext strictly upon user interaction
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    try {
        if (!apiKey) throw new Error("No API key provided for Gemini TTS");

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data returned from Gemini");
        }

        const audioBuffer = await decodeBase64ToAudioBuffer(base64Audio, ctx);
        
        currentTTSSource = ctx.createBufferSource();
        currentTTSSource.buffer = audioBuffer;
        currentTTSSource.connect(ctx.destination);
        currentTTSSource.start(0);

    } catch (error) {
        console.warn("Gemini TTS failed, falling back to native synthesis:", error);
        fallbackTTS(text);
    }
}

function fallbackTTS(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        console.error("Native speech synthesis not supported in this browser.");
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Optional: Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// ==========================================
// 5. Existing AudioEngine (Refactored to use shared context)
// ==========================================
export class AudioEngine {
    private source: AudioBufferSourceNode | null = null;
    private oscillators: AudioNode[] = [];
    private gainNode: GainNode | null = null;
    private isPlaying: boolean = false;
    private buffers: Map<string, AudioBuffer> = new Map();

    public init() {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
    }

    private createNoiseBuffer(type: 'brown' | 'pink' | 'white') {
        const ctx = getAudioContext();
        if (this.buffers.has(type)) return this.buffers.get(type);

        const bufferSize = ctx.sampleRate * 2; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        } else if (type === 'pink') {
            let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11; 
                b6 = white * 0.115926;
            }
        } else { 
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5; 
            }
        }
        this.buffers.set(type, buffer);
        return buffer;
    }

    playNoise(type: 'brown' | 'pink' | 'white', volume: number = 0.1) {
        const ctx = getAudioContext();
        if (this.isPlaying) this.stop();

        const buffer = this.createNoiseBuffer(type);
        if (!buffer) return;

        this.source = ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;

        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = volume;

        this.source.connect(this.gainNode);
        this.gainNode.connect(ctx.destination);
        this.source.start();
        this.isPlaying = true;
    }

    playBinaural(baseFreq: number, beatFreq: number, volume: number = 0.1) {
        const ctx = getAudioContext();
        if (this.isPlaying) this.stop();

        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = volume;
        this.gainNode.connect(ctx.destination);

        // Left Oscillator (Base Freq)
        const oscL = ctx.createOscillator();
        oscL.type = 'sine';
        oscL.frequency.value = baseFreq;
        const panL = ctx.createStereoPanner();
        panL.pan.value = -1; // Pan Left
        oscL.connect(panL).connect(this.gainNode);

        // Right Oscillator (Base + Beat)
        const oscR = ctx.createOscillator();
        oscR.type = 'sine';
        oscR.frequency.value = baseFreq + beatFreq;
        const panR = ctx.createStereoPanner();
        panR.pan.value = 1; // Pan Right
        oscR.connect(panR).connect(this.gainNode);

        oscL.start();
        oscR.start();
        this.oscillators = [oscL, oscR];
        this.isPlaying = true;
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); this.source.disconnect(); } catch (e) { }
            this.source = null;
        }
        this.oscillators.forEach(osc => {
             try { (osc as any).stop(); osc.disconnect(); } catch(e){}
        });
        this.oscillators = [];

        if (this.gainNode) { this.gainNode.disconnect(); this.gainNode = null; }
        this.isPlaying = false;
    }

    setVolume(val: number) {
        const ctx = getAudioContext();
        if (this.gainNode && ctx) {
            this.gainNode.gain.setTargetAtTime(val, ctx.currentTime, 0.1);
        }
    }
}

export const audioEngine = new AudioEngine();

/**
 * Checklist for safely calling playTTS in a React component:
 * 
 * 1. ALWAYS call `playTTS` from a user-initiated event handler (e.g., `onClick`, `onKeyDown`).
 *    DO NOT call it directly inside `useEffect` or during component render, as this will violate
 *    browser autoplay policies and the AudioContext will remain suspended.
 * 
 * 2. Ensure you have a valid Gemini API key available before calling `playTTS`.
 *    Pass the key as the second argument.
 * 
 * Example:
 * ```tsx
 * const handlePlayAudio = async () => {
 *   try {
 *     await playTTS("Hello world", apiKey);
 *   } catch (err) {
 *     console.error("Audio playback failed", err);
 *   }
 * };
 * 
 * <button onClick={handlePlayAudio}>Play</button>
 * ```
 */
