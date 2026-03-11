import React, { useState, useRef, useEffect } from 'react';
import { useJeeStore } from '../store/useJeeStore';
import { GoogleGenAI, Type, ThinkingLevel, Modality, LiveServerMessage } from '@google/genai';
import { Button } from './common/Button';
import { Card } from './common/Card';
import { Input } from './common/Input';
import { MarkdownRenderer } from './common/MarkdownRenderer';

export const NewAIFeatures: React.FC = () => {
    const { apiKey } = useJeeStore();
    const [activeFeature, setActiveFeature] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const getAi = () => {
        const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("API Key is missing. Please set it in Settings.");
        return new GoogleGenAI({ apiKey: key });
    };

    const features = [
        { id: 'search', title: 'Use Google Search data', icon: '🔍' },
        { id: 'intelligence', title: 'Gemini intelligence', icon: '🧠' },
        { id: 'chatbot', title: 'AI powered chatbot', icon: '💬' },
        { id: 'analyze_images', title: 'Analyze images', icon: '🖼️' },
        { id: 'fast_responses', title: 'Fast AI responses', icon: '⚡' },
        { id: 'think_more', title: 'Think more when needed', icon: '🤔' },
        { id: 'generate_speech', title: 'Generate speech', icon: '🗣️' },
        { id: 'nano_banana_2', title: 'Nano Banana 2', icon: '🍌' },
        { id: 'voice_apps', title: 'Create conversational voice apps', icon: '🎙️' },
        { id: 'nano_banana_pro', title: 'Generate images with Nano Banana Pro', icon: '🎨' },
        { id: 'video_understanding', title: 'Video understanding', icon: '🎬' },
        { id: 'transcribe_audio', title: 'Transcribe audio', icon: '📝' },
    ];

    return (
        <div className="flex h-full gap-4">
            <div className="w-64 bg-slate-800 rounded-xl p-4 overflow-y-auto border border-slate-700">
                <h2 className="text-lg font-bold text-white mb-4">New AI Features</h2>
                <div className="flex flex-col gap-2">
                    {features.map(f => (
                        <button
                            key={f.id}
                            onClick={() => { setActiveFeature(f.id); setResult(null); setError(null); }}
                            className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${activeFeature === f.id ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            <span className="text-xl">{f.icon}</span>
                            <span className="text-sm font-medium">{f.title}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 bg-slate-800 rounded-xl p-6 border border-slate-700 overflow-y-auto">
                {!activeFeature ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        Select a feature from the sidebar to test it.
                    </div>
                ) : (
                    <FeatureSandbox 
                        featureId={activeFeature} 
                        getAi={getAi} 
                        loading={loading} 
                        setLoading={setLoading} 
                        result={result} 
                        setResult={setResult} 
                        error={error} 
                        setError={setError} 
                    />
                )}
            </div>
        </div>
    );
};

const FeatureSandbox: React.FC<{
    featureId: string;
    getAi: () => GoogleGenAI;
    loading: boolean;
    setLoading: (l: boolean) => void;
    result: any;
    setResult: (r: any) => void;
    error: string | null;
    setError: (e: string | null) => void;
}> = ({ featureId, getAi, loading, setLoading, result, setResult, error, setError }) => {
    const [input, setInput] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');

    // Chatbot state
    const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
    const chatRef = useRef<any>(null);

    // Live API state
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sessionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const handleAction = async () => {
        setLoading(true);
        setError(null);
        try {
            if (featureId === 'nano_banana_pro' || featureId === 'nano_banana_2') {
                // @ts-ignore
                if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
                    // @ts-ignore
                    await window.aistudio.openSelectKey();
                }
            }

            const ai = getAi();
            if (featureId === 'search') {
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: input || 'What is the latest news about space exploration?',
                    config: { tools: [{ googleSearch: {} }] }
                });
                setResult(response.text);
            } else if (featureId === 'intelligence') {
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: input || 'Explain quantum computing in simple terms.'
                });
                setResult(response.text);
            } else if (featureId === 'chatbot') {
                if (!chatRef.current) {
                    chatRef.current = ai.chats.create({ model: 'gemini-3.1-pro-preview' });
                }
                const response = await chatRef.current.sendMessage({ message: input });
                setChatHistory(prev => [...prev, { role: 'user', text: input }, { role: 'model', text: response.text }]);
                setInput('');
            } else if (featureId === 'analyze_images') {
                if (!file) throw new Error("Please select an image file.");
                const base64 = await fileToBase64(file);
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: {
                        parts: [
                            { inlineData: { data: base64, mimeType: file.type } },
                            { text: input || 'Describe this image in detail.' }
                        ]
                    }
                });
                setResult(response.text);
            } else if (featureId === 'fast_responses') {
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-flash-lite-preview',
                    contents: input || 'Write a short poem about speed.'
                });
                setResult(response.text);
            } else if (featureId === 'think_more') {
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: input || 'Solve this logic puzzle: I am tall when I am young, and I am short when I am old. What am I?',
                    config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } }
                });
                setResult(response.text);
            } else if (featureId === 'generate_speech') {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-preview-tts',
                    contents: [{ parts: [{ text: input || 'Hello, this is a test of the text to speech system.' }] }],
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
                    }
                });
                const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (base64Audio) {
                    setResult(`data:audio/mp3;base64,${base64Audio}`);
                }
            } else if (featureId === 'nano_banana_2') {
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-flash-image-preview',
                    contents: { parts: [{ text: input || 'A futuristic city skyline at sunset.' }] },
                    config: { imageConfig: { aspectRatio: '16:9', imageSize: '1K' } }
                });
                for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData) {
                        setResult(`data:image/png;base64,${part.inlineData.data}`);
                        break;
                    }
                }
            } else if (featureId === 'nano_banana_pro') {
                // Requires user to select API key if not set, but we use the one from store
                const response = await ai.models.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: { parts: [{ text: input || 'A photorealistic portrait of a cat astronaut.' }] },
                    config: { imageConfig: { aspectRatio: '1:1', imageSize: imageSize } }
                });
                for (const part of response.candidates?.[0]?.content?.parts || []) {
                    if (part.inlineData) {
                        setResult(`data:image/png;base64,${part.inlineData.data}`);
                        break;
                    }
                }
            } else if (featureId === 'video_understanding') {
                if (!file) throw new Error("Please select a video file.");
                const base64 = await fileToBase64(file);
                const response = await ai.models.generateContent({
                    model: 'gemini-3.1-pro-preview',
                    contents: {
                        parts: [
                            { inlineData: { data: base64, mimeType: file.type } },
                            { text: input || 'Summarize the events in this video.' }
                        ]
                    }
                });
                setResult(response.text);
            } else if (featureId === 'transcribe_audio') {
                if (!file) throw new Error("Please select an audio file.");
                const base64 = await fileToBase64(file);
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        parts: [
                            { inlineData: { data: base64, mimeType: file.type } },
                            { text: input || 'Transcribe this audio.' }
                        ]
                    }
                });
                setResult(response.text);
            }
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    const toggleLiveApi = async () => {
        if (isLiveConnected) {
            sessionRef.current?.close();
            mediaRecorderRef.current?.stop();
            audioContextRef.current?.close();
            setIsLiveConnected(false);
            return;
        }

        try {
            const ai = getAi();
            audioContextRef.current = new AudioContext({ sampleRate: 16000 });
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const sessionPromise = ai.live.connect({
                model: "gemini-3.1-flash-lite-preview",
                callbacks: {
                    onopen: () => {
                        setIsLiveConnected(true);
                        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
                        mediaRecorderRef.current = mediaRecorder;
                        mediaRecorder.ondataavailable = async (e) => {
                            if (e.data.size > 0) {
                                const buffer = await e.data.arrayBuffer();
                                const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                                sessionPromise.then(session => {
                                    session.sendRealtimeInput({
                                        media: { data: base64, mimeType: 'audio/webm;codecs=opus' }
                                    });
                                });
                            }
                        };
                        mediaRecorder.start(100);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
                            const audioBuffer = await audioContextRef.current!.decodeAudioData(audioData.buffer);
                            const source = audioContextRef.current!.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(audioContextRef.current!.destination);
                            source.start();
                        }
                    },
                    onclose: () => {
                        setIsLiveConnected(false);
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } } }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (err: any) {
            setError(err.message || String(err));
        }
    };

    const fileToBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <h3 className="text-xl font-bold text-white mb-2 capitalize">{featureId.replace(/_/g, ' ')}</h3>
            
            {featureId === 'chatbot' ? (
                <div className="flex flex-col h-full gap-4">
                    <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-y-auto border border-slate-700 flex flex-col gap-3">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`p-3 rounded-lg max-w-[80%] ${msg.role === 'user' ? 'bg-cyan-900/50 self-end text-cyan-100' : 'bg-slate-800 self-start text-slate-200'}`}>
                                <MarkdownRenderer content={msg.text} />
                            </div>
                        ))}
                        {loading && <div className="text-slate-400 animate-pulse">AI is typing...</div>}
                    </div>
                    <div className="flex gap-2">
                        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAction()} />
                        <Button onClick={handleAction} disabled={loading || !input}>Send</Button>
                    </div>
                </div>
            ) : featureId === 'voice_apps' ? (
                <div className="flex flex-col items-center justify-center h-full gap-6">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl transition-all ${isLiveConnected ? 'bg-red-500/20 text-red-400 animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'bg-slate-700 text-slate-400'}`}>
                        🎙️
                    </div>
                    <Button onClick={toggleLiveApi} className={isLiveConnected ? 'bg-red-600 hover:bg-red-700' : ''}>
                        {isLiveConnected ? 'Stop Conversation' : 'Start Conversation'}
                    </Button>
                    {error && <div className="text-red-400 mt-2">{error}</div>}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {['analyze_images', 'video_understanding', 'transcribe_audio'].includes(featureId) && (
                        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-slate-300" accept={featureId === 'analyze_images' ? 'image/*' : featureId === 'video_understanding' ? 'video/*' : 'audio/*'} />
                    )}
                    
                    {featureId === 'nano_banana_pro' && (
                        <select value={imageSize} onChange={e => setImageSize(e.target.value as any)} className="bg-slate-700 text-white p-2 rounded-lg w-48">
                            <option value="1K">1K Resolution</option>
                            <option value="2K">2K Resolution</option>
                            <option value="4K">4K Resolution</option>
                        </select>
                    )}

                    <div className="flex gap-2">
                        <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter prompt..." className="flex-1" />
                        <Button onClick={handleAction} disabled={loading}>
                            {loading ? 'Processing...' : 'Run'}
                        </Button>
                    </div>

                    {error && <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">{error}</div>}
                    
                    {result && (
                        <div className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Result</h4>
                            {featureId === 'generate_speech' ? (
                                <audio controls src={result} className="w-full" autoPlay />
                            ) : featureId.includes('nano_banana') ? (
                                <img src={result} alt="Generated" className="max-w-full rounded-lg shadow-lg" />
                            ) : (
                                <div className="text-slate-200 prose prose-invert max-w-none">
                                    <MarkdownRenderer content={result} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
