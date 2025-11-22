import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// FIX: 'LiveSession' is not an exported member of '@google/genai'. The type is internal.
import { GoogleGenAI, LiveServerMessage, Blob as GenAiBlob, GenerateContentResponse, Modality } from "@google/genai";
import type { TestReport, QuestionLog, AiFilter, ChatMessage, StudyGoal, AiAssistantPreferences, GenUIToolType, GenUIComponentData } from '../types';
import { generateStudyPlan, explainTopic, retrieveRelevantContext, GENUI_TOOLS, decodeAudioData, encodeAudio, decodeAudio } from '../services/geminiService';
import { QuestionStatus, ErrorReason } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';

// --- Types and Constants ---

interface AiAssistantProps {
  reports: TestReport[];
  questionLogs: QuestionLog[];
  setView: (view: 'question-log-editor') => void;
  setActiveLogFilter: (filter: AiFilter | null) => void;
  apiKey: string;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  studyGoals: StudyGoal[];
  setStudyGoals: React.Dispatch<React.SetStateAction<StudyGoal[]>>;
  preferences: AiAssistantPreferences;
}

// --- GenUI Components ---

const GenUIChart: React.FC<{ data: any }> = ({ data }) => {
    const { title, chartType, data: chartData, xAxisLabel } = data;
    
    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 my-2 w-full h-64">
            <h4 className="text-sm font-bold text-gray-200 mb-2 text-center">{title}</h4>
            <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} />
                    </LineChart>
                ) : (
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} label={{ value: xAxisLabel, position: 'insideBottom', offset: -5, fontSize: 10 }} />
                        <YAxis stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                        <Legend />
                        <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};

const GenUIChecklist: React.FC<{ data: any }> = ({ data }) => {
    const { title, items } = data;
    const [checked, setChecked] = useState<Record<number, boolean>>({});

    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 my-2">
            <h4 className="text-sm font-bold text-gray-200 mb-3 border-b border-slate-700 pb-2">{title}</h4>
            <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-2 hover:bg-slate-800/50 rounded transition-colors">
                        <input 
                            type="checkbox" 
                            checked={!!checked[idx]} 
                            onChange={() => setChecked(p => ({...p, [idx]: !p[idx]}))}
                            className="mt-1 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-700"
                        />
                        <div>
                            <p className={`text-sm ${checked[idx] ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.task}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                item.priority === 'High' ? 'bg-red-900/30 border-red-800 text-red-300' :
                                item.priority === 'Medium' ? 'bg-yellow-900/30 border-yellow-800 text-yellow-300' :
                                'bg-blue-900/30 border-blue-800 text-blue-300'
                            }`}>
                                {item.priority}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Helper Components & Functions ---

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const renderLine = (line: string) => {
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g).filter(Boolean);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-gray-200">{part.slice(1, -1)}</em>;
            }
            return part;
        });
    };

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('### ')) {
            if (listItems.length > 0) {
                elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 my-2 space-y-1">{listItems}</ul>);
                listItems = [];
            }
            elements.push(<h3 key={i} className="text-xl font-bold mt-4 mb-2 text-cyan-300 border-b border-slate-700 pb-1">{renderLine(line.substring(4))}</h3>);
            continue;
        }
        
        if (line.match(/^\s*\*\s/)) { 
            listItems.push(<li key={i}>{renderLine(line.replace(/^\s*\*\s/, ''))}</li>);
            continue;
        }

        if (listItems.length > 0) {
            elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 my-2 space-y-1">{listItems}</ul>);
            listItems = [];
        }

        if (line.trim() === '') {
            // Spacer logic
             elements.push(<div key={i} className="h-2"></div>);
        } else {
            elements.push(<p key={i} className="my-2 leading-relaxed">{renderLine(line)}</p>);
        }
    }
    
    if (listItems.length > 0) {
        elements.push(<ul key="ul-end" className="list-disc pl-5 my-2 space-y-1">{listItems}</ul>);
    }

    return (
        <div className="prose prose-invert text-gray-300 max-w-full">{elements}</div>
    );
};

const TestReportCard: React.FC<{ report: TestReport }> = ({ report }) => {
    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 my-1">
            <h4 className="font-bold text-cyan-300">{report.testName}</h4>
            <p className="text-xs text-gray-400 mb-2">{new Date(report.testDate + "T00:00:00").toLocaleDateString()}</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                {subjects.map(subject => (
                    <div key={subject} className="flex justify-between border-b border-slate-700/50 py-1">
                        <span className="capitalize text-gray-300">{subject}</span>
                        <span className="font-semibold text-white">{report[subject].marks}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Voice Visualizer ---
const VoiceVisualizer: React.FC<{ isActive: boolean; volume: number; status: 'listening' | 'thinking' | 'speaking' }> = ({ isActive, volume, status }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        if (!isActive || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let time = 0;

        const render = () => {
            const width = canvasRef.current!.width;
            const height = canvasRef.current!.height;
            const centerX = width / 2;
            const centerY = height / 2;
            
            ctx.clearRect(0, 0, width, height);
            
            // Base Orb
            const baseRadius = status === 'thinking' ? 40 : 50 + (volume * 50);
            const color = status === 'thinking' ? '#f59e0b' : status === 'speaking' ? '#22d3ee' : '#818cf8';
            
            // Pulsing Effect
            if (status === 'thinking') {
                ctx.beginPath();
                ctx.arc(centerX, centerY, baseRadius + Math.sin(time * 5) * 5, 0, Math.PI * 2);
                ctx.fillStyle = `${color}44`; // Transparent
                ctx.fill();
            }

            // Waveform for speaking/listening
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            
            for (let i = 0; i < 100; i++) {
                const angle = (i / 100) * Math.PI * 2;
                const r = baseRadius + Math.sin(angle * 5 + time * 3) * (volume * 20 + 5);
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            
            // Core
            ctx.beginPath();
            ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            time += 0.05;
            animationId = requestAnimationFrame(render);
        };
        
        render();
        return () => cancelAnimationFrame(animationId);
    }, [isActive, volume, status]);

    return <canvas ref={canvasRef} width={300} height={300} className="w-64 h-64 mx-auto" />;
};

function createBlob(data: Float32Array): GenAiBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encodeAudio(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const getSystemInstruction = (reports: TestReport[], logs: QuestionLog[], preferences: AiAssistantPreferences, extraContext: string) => {
    const summary = reports.map(r => ({
        testName: r.testName,
        totalMarks: r.total.marks,
        totalRank: r.total.rank,
        accuracy: r.totalMetrics?.accuracy.toFixed(1) + '%'
    })).slice(-10);

    const errorAnalysis = logs.reduce((acc, log) => {
        if (log.status === QuestionStatus.Wrong && log.reasonForError) {
            acc[log.reasonForError] = (acc[log.reasonForError] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const topErrorReasons = Object.entries(errorAnalysis)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([reason, count]) => `${reason} (${count} times)`)
        .join(', ');

    return `You are an expert JEE performance coach. Your goal is to help the student improve.
    
    Student Context:
    - Recent Tests: ${JSON.stringify(summary)}
    - Common Errors: ${topErrorReasons}
    - RAG Context: ${extraContext || "None"}

    Guidelines:
    - Tone: ${preferences.tone}
    - Length: ${preferences.responseLength}
    - Socratic Mode: ${preferences.socraticMode ? "ON. Ask guiding questions instead of giving direct answers." : "OFF."}
    - **GenUI**: Use the \`renderChart\` tool if the user asks for visual trends. Use \`createActionPlan\` for checklists.
    
    Interactive Capabilities:
    - Use \`renderChart\` to show data visually.
    - Use \`createActionPlan\` for steps.
    - Always return markdown.`;
};

// Main Component
export const AiAssistant: React.FC<AiAssistantProps> = ({ reports, questionLogs, setView, setActiveLogFilter, apiKey, chatHistory, setChatHistory, studyGoals, setStudyGoals, preferences }) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'voice'>('chat');
    
    // Chat State
    const [userInput, setUserInput] = useState('');
    const [isStreamingResponse, setIsStreamingResponse] = useState(false);
    const [isInputExpanded, setIsInputExpanded] = useState(true);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const ai = useMemo(() => new GoogleGenAI({ apiKey }), [apiKey]);

    // Voice State (Gemini Live)
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'listening' | 'thinking' | 'speaking'>('listening');
    const [audioVolume, setAudioVolume] = useState(0);
    // FIX: Using `any` because the session type is not exported.
    const liveSessionRef = useRef<any | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    
    // Auto-scroll
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isStreamingResponse]);

    useEffect(() => {
        if (activeTab === 'chat' && inputRef.current) {
            inputRef.current.focus();
        }
    }, [activeTab, isInputExpanded]);

    // Clean up Live Session on Unmount or Tab Change
    useEffect(() => {
        return () => {
            if (liveSessionRef.current) {
                // There is no explicit close method on the session interface provided in the doc, 
                // but usually we handle cleanup by stopping tracks and context.
                liveSessionRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
        };
    }, [activeTab]);

    const handleUserInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        if (userInput.trim() === '' || isStreamingResponse) return;

        const currentInput = userInput;
        setUserInput('');
        if(inputRef.current) { inputRef.current.style.height = 'auto'; }
        
        setChatHistory(prev => [...prev, { role: 'user', content: currentInput }]);
        setIsStreamingResponse(true);

        // RAG Retrieval
        const ragContext = await retrieveRelevantContext(currentInput, questionLogs, apiKey);
        const systemInstruction = getSystemInstruction(reports, questionLogs, preferences, ragContext);

        try {
            // Using standard Chat with GenUI tools
            const response = await ai.models.generateContentStream({
                model: 'gemini-3-pro-preview', // Use Pro for better reasoning/GenUI
                contents: [{ role: 'user', parts: [{ text: currentInput }] }],
                config: {
                    systemInstruction,
                    tools: [{ functionDeclarations: GENUI_TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
                    thinkingConfig: { thinkingBudget: 1024 } // Enable thinking for 2.5 model
                }
            });

            let streamedText = '';
            let isThinking = false;
            let thinkingBuffer = '';

            for await (const chunk of response) {
                // Handle Thinking parts (if visible in chunk, typically separate)
                // Note: Implementation detail depends on how thinking tokens are returned.
                // Assuming text property contains everything for now or handled internally.
                
                // Check for Function Calls (GenUI)
                const toolCall = chunk.functionCalls?.[0];
                if (toolCall) {
                    // GenUI Trigger
                    const genData: GenUIComponentData = {
                        type: toolCall.name === 'renderChart' ? 'chart' : toolCall.name === 'createActionPlan' ? 'checklist' : 'none',
                        data: toolCall.args,
                        id: toolCall.id || Date.now().toString()
                    };
                    
                    if (genData.type !== 'none') {
                        setChatHistory(prev => [...prev, { role: 'model', content: { type: 'genUI', component: genData } }]);
                    }
                    continue; 
                }

                // Standard Text
                if (chunk.text) {
                    streamedText += chunk.text;
                    setChatHistory(prev => {
                        const last = prev[prev.length - 1];
                        if (last?.role === 'model' && typeof last.content === 'string') {
                            return [...prev.slice(0, -1), { role: 'model', content: streamedText }];
                        }
                        return [...prev, { role: 'model', content: streamedText }];
                    });
                }
            }
        } catch (err) {
            setChatHistory(prev => [...prev, { role: 'model', content: "Error generating response. Please check your API key." }]);
        } finally {
            setIsStreamingResponse(false);
        }

    }, [userInput, isStreamingResponse, ai, questionLogs, reports, preferences, apiKey]);

    // --- Gemini Live Implementation ---
    const startLiveSession = async () => {
        if (!apiKey) return;
        
        try {
            // Audio Context Setup
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = inputCtx.createMediaStreamSource(stream);
            
            // Simplified ScriptProcessor for Demo (Worklet preferred for Prod)
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            audioWorkletRef.current = processor;

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: getSystemInstruction(reports, questionLogs, preferences, "Voice Mode"),
                },
                callbacks: {
                    onopen: () => {
                        setIsLiveConnected(true);
                        setLiveStatus('listening');
                        
                        processor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            // Calculate volume for visualizer
                            let sum = 0;
                            for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                            setAudioVolume(Math.sqrt(sum / inputData.length));

                            const blob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: blob }));
                        };
                        source.connect(processor);
                        processor.connect(inputCtx.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            setLiveStatus('speaking');
                            const buffer = await decodeAudioData(
                                decodeAudio(audioData), 
                                audioContextRef.current!, 
                                24000, 
                                1
                            );
                            const source = audioContextRef.current!.createBufferSource();
                            source.buffer = buffer;
                            source.connect(audioContextRef.current!.destination);
                            
                            // Schedule playback
                            const now = audioContextRef.current!.currentTime;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += buffer.duration;
                            
                            source.onended = () => setLiveStatus('listening');
                        }
                        
                        if (msg.serverContent?.interrupted) {
                            // Clear queue if interrupted
                            nextStartTimeRef.current = audioContextRef.current!.currentTime;
                            setLiveStatus('listening');
                        }
                    },
                    onclose: () => { setIsLiveConnected(false); },
                    onerror: (e) => { console.error(e); setIsLiveConnected(false); }
                }
            });
            liveSessionRef.current = await sessionPromise;

        } catch (e) {
            console.error("Failed to start live session", e);
            alert("Microphone access denied or API error.");
        }
    };

    const stopLiveSession = () => {
        if (liveSessionRef.current) {
            // FIX: Per guidelines, the session object has a `close()` method to terminate the connection.
            liveSessionRef.current.close();
            liveSessionRef.current = null;
        }
        if (audioWorkletRef.current) {
            audioWorkletRef.current.disconnect();
            audioWorkletRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsLiveConnected(false);
    };

    const handleSuggestionClick = (suggestion: string) => { 
        setIsInputExpanded(true);
        setUserInput(suggestion); 
        setTimeout(() => inputRef.current?.focus(), 0); 
    };
    
    const suggestions = [ "Analyze my Physics weak areas", "Create a study checklist for Rotational Motion", "Show me my score trend chart", "Why did I lose marks in the last test?" ];

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-800/50 rounded-lg shadow-lg border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'chat' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}>Text Chat</button>
                    <button onClick={() => setActiveTab('voice')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'voice' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}>Gemini Live</button>
                </div>
            </div>

            {activeTab === 'chat' ? (
                <div className="flex-grow relative flex flex-col overflow-hidden">
                    <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6 custom-scrollbar pb-24">
                        {chatHistory.length === 0 && (
                            <div className="text-center text-gray-500 mt-20">
                                <p className="text-lg font-medium mb-2">Your AI Performance Coach</p>
                                <p className="text-sm">Ready to analyze logs, create plans, and visualize progress.</p>
                            </div>
                        )}
                        {chatHistory.map((msg, index) => (
                            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`p-4 rounded-2xl max-w-[90%] lg:max-w-[70%] shadow-md ${msg.role === 'user' ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-none' : 'bg-slate-800 border border-slate-700 text-gray-200 rounded-bl-none'}`}>
                                    {typeof msg.content === 'string' ? (
                                        <MarkdownRenderer content={msg.content} />
                                    ) : msg.content.type === 'testReport' ? (
                                        <TestReportCard report={msg.content.data} />
                                    ) : msg.content.type === 'genUI' ? (
                                        msg.content.component.type === 'chart' ? (
                                            <GenUIChart data={msg.content.component.data} />
                                        ) : msg.content.component.type === 'checklist' ? (
                                            <GenUIChecklist data={msg.content.component.data} />
                                        ) : null
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {isStreamingResponse && (
                            <div className="flex items-start"><div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"><span className="flex gap-1"><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></span><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span></span></div></div>
                        )}
                    </div>

                    <div className={`absolute bottom-0 left-0 right-0 z-20 transition-transform duration-300 ease-in-out ${isInputExpanded ? 'translate-y-0' : 'translate-y-full'}`}>
                        <div className="p-4 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm">
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 hide-scrollbar">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => handleSuggestionClick(s)} className="whitespace-nowrap px-3 py-1.5 bg-slate-800 border border-slate-700 hover:border-cyan-500 text-xs text-cyan-400 rounded-full transition-colors">
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <form onSubmit={handleSendMessage} className="relative">
                                <textarea
                                    ref={inputRef}
                                    value={userInput}
                                    onChange={handleUserInput}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                    placeholder="Ask your coach..."
                                    className="w-full bg-slate-800 text-white rounded-xl p-4 pr-14 border border-slate-700 focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none shadow-inner"
                                    rows={1}
                                    disabled={isStreamingResponse}
                                />
                                <button 
                                    type="submit" 
                                    disabled={isStreamingResponse || !userInput.trim()}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:hover:bg-cyan-600"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="absolute bottom-4 right-4 z-30">
                        <button
                            onClick={() => setIsInputExpanded(p => !p)}
                            className="w-14 h-14 bg-cyan-600 rounded-full flex items-center justify-center shadow-lg text-white hover:bg-cyan-500 transition-all transform hover:scale-110"
                            aria-label={isInputExpanded ? "Collapse input area" : "Expand input area"}
                        >
                            {isInputExpanded ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-slate-900 pointer-events-none"></div>
                    
                    <div className="relative z-10 text-center space-y-8">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Gemini Live Coach</h3>
                        
                        <div className="h-64 w-64 relative flex items-center justify-center">
                            {isLiveConnected ? (
                                <VoiceVisualizer isActive={true} volume={audioVolume} status={liveStatus} />
                            ) : (
                                <div className="w-40 h-40 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-2xl">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                </div>
                            )}
                        </div>

                        <div className="h-8">
                            {isLiveConnected && (
                                <p className="text-cyan-400 animate-pulse font-mono text-sm uppercase tracking-widest">
                                    {liveStatus === 'listening' ? 'Listening...' : liveStatus === 'thinking' ? 'Thinking...' : 'Speaking'}
                                </p>
                            )}
                        </div>

                        <button 
                            onClick={isLiveConnected ? stopLiveSession : startLiveSession}
                            className={`px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-all transform hover:scale-105 ${isLiveConnected ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-4 ring-indigo-500/20'}`}
                        >
                            {isLiveConnected ? 'End Session' : 'Start Conversation'}
                        </button>
                        
                        {!isLiveConnected && <p className="text-sm text-gray-500">Experience real-time voice coaching with Gemini 2.5</p>}
                    </div>
                </div>
            )}
        </div>
    );
};
