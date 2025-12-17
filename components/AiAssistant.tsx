
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Blob as GenAiBlob, Modality, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { QuestionStatus, type TestReport, type QuestionLog, type AiFilter, type ChatMessage, type StudyGoal, type AiAssistantPreferences, type GenUIToolType, type GenUIComponentData, type UserProfile, type LlmTaskCategory } from '../types';
import { retrieveRelevantContext, GENUI_TOOLS, decodeAudioData, encodeAudio, decodeAudio, fileToGenerativePart } from '../services/geminiService';
import { MODEL_REGISTRY, AIModel } from '../services/llm/models';
import { generateTextOpenAI } from '../services/llm/providers';
import { llmPipeline } from '../services/llm'; 
import { MarkdownRenderer } from './common/MarkdownRenderer';

// --- NEW AI ARCHITECTURE IMPORTS ---
import { classifyIntent } from '../services/ai/Router';
import { getPersona } from '../services/ai/factory';
import { AIContext } from '../services/ai/types';
import { indexQuestionLogs } from '../services/vectorStore';

// --- NEW GENUI IMPORTS ---
import { GenUIChart, GenUIChecklist, GenUIDiagram, GenUIMindMap } from './genui/GenUIComponents';

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
  onUpdatePreferences?: React.Dispatch<React.SetStateAction<AiAssistantPreferences>>;
  userProfile: UserProfile; 
  onAddTasksToPlanner?: (tasks: { task: string, time: number, topic: string }[]) => void; 
}

const PRIMARY_MODELS = MODEL_REGISTRY.filter(m => m.provider === 'google');
const SECONDARY_MODELS = MODEL_REGISTRY.filter(m => m.provider !== 'google');

// ... [TestReportCard, VoiceVisualizer, createBlob, ModelDropdownItem - UNCHANGED]
const TestReportCard: React.FC<{ report: TestReport }> = ({ report }) => {
    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];
    return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 my-1"><h4 className="font-bold text-cyan-300">{report.testName}</h4><p className="text-xs text-gray-400 mb-2">{new Date(report.testDate + "T00:00:00").toLocaleDateString()}</p><div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">{subjects.map(subject => (<div key={subject} className="flex justify-between border-b border-slate-700/50 py-1"><span className="capitalize text-gray-300">{subject}</span><span className="font-semibold text-white">{report[subject].marks}</span></div>))}</div></div>
    );
};
const VoiceVisualizer: React.FC<{ isActive: boolean; volume: number; status: 'listening' | 'thinking' | 'speaking' }> = ({ isActive, volume, status }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!isActive || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        let animationId: number; let time = 0;
        const render = () => {
            const width = canvasRef.current!.width; const height = canvasRef.current!.height; const centerX = width / 2; const centerY = height / 2;
            ctx.clearRect(0, 0, width, height);
            const baseRadius = status === 'thinking' ? 40 : 50 + (volume * 50);
            const color = status === 'thinking' ? '#f59e0b' : status === 'speaking' ? '#22d3ee' : '#818cf8';
            if (status === 'thinking') { ctx.beginPath(); ctx.arc(centerX, centerY, baseRadius + Math.sin(time * 5) * 5, 0, Math.PI * 2); ctx.fillStyle = `${color}44`; ctx.fill(); }
            ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
            for (let i = 0; i < 100; i++) { const angle = (i / 100) * Math.PI * 2; const r = baseRadius + Math.sin(angle * 5 + time * 3) * (volume * 20 + 5); const x = centerX + Math.cos(angle) * r; const y = centerY + Math.sin(angle) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
            ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(centerX, centerY, 20, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); time += 0.05; animationId = requestAnimationFrame(render);
        };
        render(); return () => cancelAnimationFrame(animationId);
    }, [isActive, volume, status]);
    return <canvas ref={canvasRef} width={300} height={300} className="w-64 h-64 mx-auto" />;
};
function createBlob(data: Float32Array): GenAiBlob { const l = data.length; const int16 = new Int16Array(l); for (let i = 0; i < l; i++) { int16[i] = data[i] * 32768; } return { data: encodeAudio(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000', }; }

const ModelDropdownItem: React.FC<{ model: AIModel; isSelected: boolean; onClick: () => void }> = ({ model, isSelected, onClick }) => (
    <button 
        onClick={onClick} 
        className={`w-full text-left p-3 flex items-start gap-3 transition-colors border-b border-slate-700/50 hover:bg-slate-700/30 ${isSelected ? 'bg-indigo-900/20' : ''}`}
    >
        <span className="text-xl mt-0.5">{model.icon}</span>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-sm font-bold truncate ${isSelected ? 'text-cyan-400' : 'text-gray-200'}`}>{model.name}</span>
                <span className={`text-[9px] px-1.5 rounded uppercase font-bold tracking-wider border ${
                    model.provider === 'google' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    model.provider === 'groq' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                    {model.provider}
                </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{model.description}</p>
            <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                    {(model.contextWindow / 1000)}k Context
                </span>
                <span className={`text-[9px] font-bold ${model.costCategory === 'free' ? 'text-green-500' : 'text-yellow-500'}`}>
                    {model.costCategory === 'free' ? 'FREE' : 'PAID'}
                </span>
            </div>
        </div>
        {isSelected && <span className="text-cyan-400 font-bold">✓</span>}
    </button>
);

// Main Component
export const AiAssistant: React.FC<AiAssistantProps> = ({ reports, questionLogs, setView, setActiveLogFilter, apiKey, chatHistory, setChatHistory, studyGoals, setStudyGoals, preferences, onUpdatePreferences, userProfile, onAddTasksToPlanner }) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'voice'>('chat');
    
    const [userInput, setUserInput] = useState('');
    const [isStreamingResponse, setIsStreamingResponse] = useState(false);
    const [isInputExpanded, setIsInputExpanded] = useState(true);
    const [attachedImage, setAttachedImage] = useState<File | null>(null);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    
    const [isSecondarySelectorOpen, setIsSecondarySelectorOpen] = useState(false);
    const [secondaryModelId, setSecondaryModelId] = useState<string>('none');
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const secondarySelectorRef = useRef<HTMLDivElement>(null);
    const ai = useMemo(() => new GoogleGenAI({ apiKey }), [apiKey]);

    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'listening' | 'thinking' | 'speaking'>('listening');
    const [audioVolume, setAudioVolume] = useState(0);
    const liveSessionRef = useRef<any | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    
    // Background Indexing of Logs for RAG
    useEffect(() => {
        if (questionLogs.length > 0) {
            // Non-blocking indexing
            setTimeout(() => {
                indexQuestionLogs(questionLogs).catch(e => console.error("Vector Indexing Failed", e));
            }, 2000);
        }
    }, [questionLogs]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isStreamingResponse, isInputExpanded]);

    useEffect(() => {
        if (activeTab === 'chat' && inputRef.current && isInputExpanded) {
            inputRef.current.focus();
        }
    }, [activeTab, isInputExpanded]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
                setIsModelSelectorOpen(false);
            }
            if (secondarySelectorRef.current && !secondarySelectorRef.current.contains(event.target as Node)) {
                setIsSecondarySelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        return () => {
            if (liveSessionRef.current) {
                liveSessionRef.current.close();
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
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachedImage(file);
        }
    };

    const handleRemoveImage = () => {
        setAttachedImage(null);
        if(fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleModelChange = (modelId: string) => {
        if (onUpdatePreferences) {
            onUpdatePreferences(prev => ({ ...prev, model: modelId }));
        }
        setIsModelSelectorOpen(false);
    };

    const handleSecondaryModelChange = (modelId: string) => {
        setSecondaryModelId(modelId);
        setIsSecondarySelectorOpen(false);
    };

    const currentModel = PRIMARY_MODELS.find(m => m.id === preferences.model) || PRIMARY_MODELS[0];
    const currentSecondary = SECONDARY_MODELS.find(m => m.id === secondaryModelId);

    const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
        if(e) e.preventDefault();
        if ((userInput.trim() === '' && !attachedImage) || isStreamingResponse) return;

        const currentInput = userInput;
        const currentImage = attachedImage;
        
        setUserInput('');
        setAttachedImage(null);
        if(inputRef.current) { inputRef.current.style.height = 'auto'; }
        
        const userMessageContent = currentImage 
            ? `[Image Uploaded] ${currentInput}` 
            : currentInput;

        setChatHistory(prev => [...prev, { role: 'user', content: userMessageContent }]);
        setIsStreamingResponse(true);

        // --- CORE GENERATION LOGIC ---
        const executeGeneration = async (modelId: string, fallbackFrom?: string) => {
            // 1. Classify Intent
            const intent = await classifyIntent(currentInput, apiKey);
            
            // 2. Get Persona
            const persona = getPersona(intent);
            
            // 2.5 RAG Retrieval
            let ragContext = "";
            if (intent !== 'GENERAL' && intent !== 'EMOTIONAL') {
                 ragContext = await retrieveRelevantContext(currentInput, questionLogs, apiKey);
            }

            // 3. Construct Context
            // IMPORTANT: Inject the *currently attempted* modelId into preferences 
            // so the Persona logic knows which model is active (crucial for Coach/Tutor checks)
            const aiContext: AIContext = {
                reports,
                logs: questionLogs,
                userProfile,
                preferences: { ...preferences, model: modelId }, 
                userQuery: currentInput,
                ragContext
            };

            // 4. Get System Instruction & Tools
            const systemInstruction = persona.getSystemInstruction(aiContext);
            const allowedTools = persona.getTools();
            
            // Detect if model is Google or External
            const modelDef = MODEL_REGISTRY.find(m => m.id === modelId);
            const isGoogleModel = !modelDef || modelDef.provider === 'google' || modelId.includes('gemini') || modelId.includes('gemma');

            if (isGoogleModel) {
                // --- GOOGLE SDK STREAMING PATH ---
                const parts: any[] = [{ text: currentInput || "Analyze this." }];
                if (currentImage) {
                    const imagePart = await fileToGenerativePart(currentImage);
                    parts.unshift(imagePart);
                }

                const isGemma = modelId.toLowerCase().includes('gemma');
                let reqConfig: any = {};
                let reqContents = [{ role: 'user', parts: parts }];

                if (isGemma) {
                    const textParts = parts.filter(p => p.text);
                    if (textParts.length > 0) {
                        textParts[0].text = `SYSTEM: ${systemInstruction}\n\nUSER QUERY: ${textParts[0].text}`;
                    }
                    reqContents = [{ role: 'user', parts: textParts }];
                    reqConfig = { safetySettings: [] };
                } else {
                    reqConfig = {
                        systemInstruction,
                        tools: allowedTools.length > 0 ? [{ functionDeclarations: allowedTools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }] : undefined,
                    };
                    reqContents = [{ role: 'user', parts: parts }];
                }

                const response = await ai.models.generateContentStream({
                    model: modelId, 
                    contents: reqContents,
                    config: reqConfig
                });

                let streamedText = '';

                for await (const chunk of response) {
                    const toolCall = chunk.functionCalls?.[0];
                    if (toolCall) {
                        let genType: GenUIToolType = 'none';
                        if (toolCall.name === 'renderChart') genType = 'chart';
                        else if (toolCall.name === 'createActionPlan') genType = 'checklist';
                        else if (toolCall.name === 'renderDiagram') genType = 'chart'; 
                        else if (toolCall.name === 'createMindMap') genType = 'chart'; 

                        const genData: GenUIComponentData = {
                            type: genType, 
                            data: toolCall.args,
                            id: toolCall.id || Date.now().toString()
                        };
                        
                        if (toolCall.name === 'renderDiagram') {
                            setChatHistory(prev => [...prev, { role: 'model', content: { type: 'genUI', component: { ...genData, type: 'diagram' as any } } }]);
                        } else if (toolCall.name === 'createMindMap') {
                            setChatHistory(prev => [...prev, { role: 'model', content: { type: 'genUI', component: { ...genData, type: 'mindmap' as any } } }]);
                        } else if (genData.type !== 'none') {
                            setChatHistory(prev => [...prev, { role: 'model', content: { type: 'genUI', component: genData } }]);
                        }
                        continue; 
                    }

                    if (chunk.text) {
                        streamedText += chunk.text;
                        
                        setChatHistory(prev => {
                            const last = prev[prev.length - 1];
                            let displayContent = streamedText;
                            
                            if (last?.role === 'model' && typeof last.content === 'string') {
                                return [...prev.slice(0, -1), { role: 'model', content: displayContent }];
                            }
                            return [...prev, { role: 'model', content: displayContent }];
                        });
                    }
                }

                // 7. Append Model Footer (Google Models Only - Manual Logic)
                const usedModelName = modelDef ? modelDef.name : modelId;
                let footerHtml = '';
                
                if (fallbackFrom) {
                    const fallbackName = MODEL_REGISTRY.find(m => m.id === fallbackFrom)?.name || fallbackFrom;
                    footerHtml = `\n\n<div class="text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-700/50 flex items-center gap-1"><span class="text-amber-500">⚠️</span> Fallback to <strong>${usedModelName}</strong> <span class="text-slate-500">(${fallbackName} unavailable)</span></div>`;
                } else {
                    footerHtml = `\n\n<div class="text-[10px] text-slate-500 mt-4 pt-2 border-t border-slate-700/50 flex items-center gap-1"><span>⚡</span> Generated by <strong>${usedModelName}</strong></div>`;
                }

                setChatHistory(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'model' && typeof last.content === 'string' && !last.content.includes('Generated by <strong>') && !last.content.includes('Fallback to <strong>')) {
                         return [...prev.slice(0, -1), { ...last, content: last.content + footerHtml }];
                    }
                    return prev;
                });

            } else {
                // --- EXTERNAL PROVIDER PATH ---
                // For external models, we delegate the fallback logic AND the footer generation to the llmPipeline directly.
                // We do NOT manually append the footer here, because llmPipeline will do it, ensuring the footer accurately reflects
                // which model was *actually* used after any internal fallbacks.
                
                let taskCategory: LlmTaskCategory = 'chat';
                if (intent === 'ANALYSIS') taskCategory = 'analysis';
                if (intent === 'PLANNING') taskCategory = 'planning';
                if (intent === 'CONCEPT') taskCategory = 'math';
                if (intent === 'EMOTIONAL') taskCategory = 'creative';

                const responseText = await llmPipeline({
                    task: taskCategory,
                    prompt: currentInput,
                    systemInstruction: systemInstruction,
                    userPreferences: {
                        ...preferences,
                        modelOverrides: { [taskCategory]: modelId } // Force override
                    },
                    googleApiKey: apiKey,
                    expectJson: false,
                    includeFooter: true // IMPORTANT: Tell pipeline to append footer
                });

                setChatHistory(prev => [...prev, { role: 'model', content: responseText }]);
            }
        };

        // --- EXECUTION WITH OUTER FALLBACK ---
        // If the *entire* execution block fails (e.g. Google SDK limit), we catch it here.
        
        const targetModelId = secondaryModelId !== 'none' ? secondaryModelId : preferences.model;
        
        try {
            await executeGeneration(targetModelId);
        } catch (err) {
            console.warn(`Attempt with ${targetModelId} failed.`, err);
            
            // 2. Fallback Logic (Outer Safety Net)
            // If the failed model was the secondary one, fall back to primary
            if (targetModelId !== preferences.model) {
                // Pass targetModelId as 'fallbackFrom' to generate the correct footer
                try {
                    await executeGeneration(preferences.model, targetModelId);
                } catch (fallbackErr) {
                    console.error("Fallback generation error:", fallbackErr);
                    setChatHistory(prev => [...prev, { role: 'model', content: `Error generating response (Primary & Secondary failed).\nDetails: ${(fallbackErr as Error).message}` }]);
                }
            } else {
                setChatHistory(prev => [...prev, { role: 'model', content: `Error generating response.\nDetails: ${(err as Error).message}` }]);
            }
        }
        
        setIsStreamingResponse(false);

    }, [userInput, attachedImage, isStreamingResponse, ai, questionLogs, reports, preferences, apiKey, secondaryModelId, userProfile]);

    // ... [startLiveSession, stopLiveSession... UNCHANGED]
    const startLiveSession = async () => { if (!apiKey) return; try { audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }); const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const source = inputCtx.createMediaStreamSource(stream); const processor = inputCtx.createScriptProcessor(4096, 1, 1); audioWorkletRef.current = processor; const sessionPromise = ai.live.connect({ model: 'gemini-2.5-flash-native-audio-preview-09-2025', config: { responseModalities: [Modality.AUDIO], systemInstruction: `You are an AI Coach.` }, callbacks: { onopen: () => { setIsLiveConnected(true); setLiveStatus('listening'); processor.onaudioprocess = (e) => { const inputData = e.inputBuffer.getChannelData(0); let sum = 0; for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i]; setAudioVolume(Math.sqrt(sum / inputData.length)); const blob = createBlob(inputData); sessionPromise.then(session => session.sendRealtimeInput({ media: blob })); }; source.connect(processor); processor.connect(inputCtx.destination); }, onmessage: async (msg: LiveServerMessage) => { const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data; if (audioData) { setLiveStatus('speaking'); const buffer = await decodeAudioData( decodeAudio(audioData), audioContextRef.current!, 24000, 1 ); const source = audioContextRef.current!.createBufferSource(); source.buffer = buffer; source.connect(audioContextRef.current!.destination); const now = audioContextRef.current!.currentTime; nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now); source.start(nextStartTimeRef.current); nextStartTimeRef.current += buffer.duration; source.onended = () => setLiveStatus('listening'); } if (msg.serverContent?.interrupted) { nextStartTimeRef.current = audioContextRef.current!.currentTime; setLiveStatus('listening'); } }, onclose: () => { setIsLiveConnected(false); }, onerror: (e) => { console.error(e); setIsLiveConnected(false); } } }); liveSessionRef.current = await sessionPromise; } catch (e) { console.error("Failed to start live session", e); alert("Microphone access denied or API error."); } };
    const stopLiveSession = () => { if (liveSessionRef.current) { liveSessionRef.current.close(); liveSessionRef.current = null; } if (audioWorkletRef.current) { audioWorkletRef.current.disconnect(); audioWorkletRef.current = null; } if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; } setIsLiveConnected(false); };
    const handleSuggestionClick = (suggestion: string) => { setIsInputExpanded(true); setUserInput(suggestion); setTimeout(() => inputRef.current?.focus(), 0); };
    const suggestions = [ "Analyze my Physics weak areas", "Create a study checklist for Rotational Motion", "Show me my score trend chart", "Why did I lose marks in the last test?" ];

    // Rendering Helper for GenUI logic
    const renderMessageContent = (msg: ChatMessage) => {
        if (typeof msg.content === 'string') {
            return <MarkdownRenderer content={msg.content} />;
        }
        
        if (msg.content.type === 'testReport') {
            return <TestReportCard report={msg.content.data} />;
        }
        
        if (msg.content.type === 'genUI') {
            const { component } = msg.content;
            
            if (component.type === 'chart') {
                return <GenUIChart data={component.data} />;
            }
            
            if (component.type === 'checklist') {
                return <GenUIChecklist data={component.data} onAddToPlanner={onAddTasksToPlanner} />;
            }
            
            if ((component as any).type === 'diagram') {
                return <GenUIDiagram data={component.data} />;
            }
            
            if ((component as any).type === 'mindmap') {
                return <GenUIMindMap data={component.data} />;
            }
        }
        
        return null;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-800/50 rounded-lg shadow-lg border border-slate-700 overflow-hidden relative">
            <div className="flex justify-between items-center p-3 border-b border-slate-700 bg-slate-900/90 backdrop-blur-md z-30">
                <div className="flex items-center gap-3">
                    <div className="relative" ref={modelSelectorRef}>
                        <button onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium text-gray-200 border border-slate-700">
                            <span className="text-cyan-400 text-lg">{currentModel.icon || '⚡'}</span><span>{currentModel.name}</span><span className="text-gray-500 text-xs ml-1">▼</span>
                        </button>
                        {isModelSelectorOpen && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 animate-scale-in overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase bg-slate-900/50 border-b border-slate-700">Google Native</div>
                                {PRIMARY_MODELS.map(model => (
                                    <ModelDropdownItem 
                                        key={model.id} 
                                        model={model} 
                                        isSelected={preferences.model === model.id} 
                                        onClick={() => handleModelChange(model.id)} 
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="relative" ref={secondarySelectorRef}>
                        <button onClick={() => setIsSecondarySelectorOpen(!isSecondarySelectorOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium text-gray-200 border border-slate-700">
                            <span className={`text-lg ${secondaryModelId !== 'none' ? 'text-purple-400' : 'text-gray-500'}`}>{secondaryModelId !== 'none' ? '🧠' : '○'}</span><span>{currentSecondary ? currentSecondary.name : 'Fallback: None'}</span><span className="text-gray-500 text-xs ml-1">▼</span>
                        </button>
                        {isSecondarySelectorOpen && (
                            <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 animate-scale-in overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
                                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase bg-slate-900/50 border-b border-slate-700">Fallback Models</div>
                                <button onClick={() => handleSecondaryModelChange('none')} className={`w-full text-left p-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors ${secondaryModelId === 'none' ? 'bg-slate-700/30' : ''}`}><span className="text-xl">○</span><p className="text-sm font-bold text-gray-200">No Selection</p>{secondaryModelId === 'none' && <span className="ml-auto text-cyan-400 font-bold">✓</span>}</button>
                                {SECONDARY_MODELS.map(model => (
                                    <ModelDropdownItem 
                                        key={model.id} 
                                        model={model} 
                                        isSelected={secondaryModelId === model.id} 
                                        onClick={() => handleSecondaryModelChange(model.id)} 
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700"><button onClick={() => setActiveTab('chat')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'chat' ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Chat</button><button onClick={() => setActiveTab('voice')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'voice' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Live</button></div>
            </div>
            {activeTab === 'chat' ? (
                <div className="flex-grow relative flex flex-col overflow-hidden">
                    <div ref={chatContainerRef} className={`flex-grow p-4 overflow-y-auto space-y-6 custom-scrollbar ${isInputExpanded ? 'pb-44' : 'pb-20'} transition-all duration-300`}>
                        {chatHistory.length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50"><div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-4xl grayscale">{currentModel.name.includes('Gemma') ? '🤖' : '⚡'}</div><p className="text-lg font-medium mb-2">How can I help you ace JEE?</p></div>}
                        {chatHistory.map((msg, index) => (
                            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                                <div className={`p-4 rounded-2xl max-w-[90%] lg:max-w-[75%] shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-gray-100 rounded-br-sm' : 'bg-transparent text-gray-200 pl-0'}`}>
                                    {msg.role === 'model' && <div className="flex items-center gap-2 mb-1 text-xs font-bold text-cyan-400"><span>{currentModel.name.includes('Gemma') ? '🤖' : '⚡'}</span> AI Coach</div>}
                                    {renderMessageContent(msg)}
                                </div>
                            </div>
                        ))}
                        {isStreamingResponse && <div className="flex items-center gap-2 pl-2"><div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-150"></div></div>}
                    </div>
                    {/* ... (Input Area Unchanged) ... */}
                    <div className={`absolute bottom-0 left-0 right-0 z-20 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${isInputExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-20px)] opacity-0 pointer-events-none'}`}>
                        <div className="p-4 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent pt-10">
                            {isInputExpanded && chatHistory.length < 2 && <div className="flex gap-2 mb-3 overflow-x-auto pb-2 hide-scrollbar px-2">{suggestions.map((s, i) => (<button key={i} onClick={() => handleSuggestionClick(s)} className="whitespace-nowrap px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-cyan-500/30 text-xs text-gray-300 hover:text-white rounded-full transition-all shadow-sm backdrop-blur-sm">{s}</button>))}</div>}
                            {attachedImage && <div className="mx-2 mb-2 flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700/50 w-fit animate-scale-in backdrop-blur-sm"><div className="w-10 h-10 bg-slate-700 rounded-lg overflow-hidden flex items-center justify-center text-lg shadow-inner">🖼️</div><div className="flex flex-col"><span className="text-xs text-white font-medium truncate max-w-[150px]">{attachedImage.name}</span><span className="text-[10px] text-gray-400">{(attachedImage.size / 1024).toFixed(1)} KB</span></div><button onClick={handleRemoveImage} className="ml-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-700 text-gray-400 hover:text-red-400 transition-colors">×</button></div>}
                            <form onSubmit={handleSendMessage} className="relative bg-slate-900/50 border border-slate-700/50 backdrop-blur-xl rounded-3xl shadow-2xl transition-all focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                                <div className="flex items-end p-2">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-cyan-400 hover:bg-cyan-900/20 rounded-full transition-all" title="Attach image"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></button>
                                    <textarea ref={inputRef} value={userInput} onChange={handleUserInput} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} placeholder={`Message ${secondaryModelId !== 'none' ? currentSecondary?.name : currentModel.name}...`} className="w-full bg-transparent text-gray-100 px-3 py-3.5 max-h-48 focus:outline-none resize-none text-sm placeholder-gray-500" rows={1} disabled={isStreamingResponse} />
                                    <button type="submit" disabled={isStreamingResponse || (userInput.trim() === '' && !attachedImage)} className="p-2 mb-1 mr-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full transition-all disabled:opacity-0 disabled:scale-75 shadow-lg shadow-cyan-500/20"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0 l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg></button>
                                </div>
                            </form>
                            <div className="text-center mt-2"><p className="text-[10px] text-gray-600">AI can make mistakes. Verify important information.</p></div>
                        </div>
                    </div>
                    {!isInputExpanded && (
                        <div className="absolute bottom-6 right-6 z-30 animate-scale-in">
                            <button onClick={() => setIsInputExpanded(true)} className="group relative w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(34,211,238,0.4)] text-white transition-all duration-500 ease-out hover:scale-110 hover:rotate-3 ring-2 ring-white/20 overflow-hidden"><div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 drop-shadow-md transform transition-transform group-hover:scale-110"><path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z" clipRule="evenodd" /></svg></button>
                        </div>
                    )}
                    {isInputExpanded && (<div className="absolute bottom-[88px] right-6 z-30"><button onClick={() => setIsInputExpanded(false)} className="w-8 h-8 bg-slate-800/50 hover:bg-slate-700 text-gray-400 hover:text-white rounded-full flex items-center justify-center backdrop-blur border border-slate-600/50 transition-all" title="Minimize Input"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button></div>)}
                </div>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-8 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-slate-900 pointer-events-none"></div>
                    <div className="relative z-10 text-center space-y-8">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Gemini Live Coach</h3>
                        <div className="h-64 w-64 relative flex items-center justify-center">{isLiveConnected ? (<VoiceVisualizer isActive={true} volume={audioVolume} status={liveStatus} />) : (<div className="w-40 h-40 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shadow-2xl"><svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></div>)}</div>
                        <div className="h-8">{isLiveConnected && (<p className="text-cyan-400 animate-pulse font-mono text-sm uppercase tracking-widest">{liveStatus === 'listening' ? 'Listening...' : liveStatus === 'thinking' ? 'Thinking...' : 'Speaking'}</p>)}</div>
                        <button onClick={isLiveConnected ? stopLiveSession : startLiveSession} className={`px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_30px_rgba(0,0,0,0.3)] transition-all transform hover:scale-105 ${isLiveConnected ? 'bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white ring-4 ring-indigo-500/20'}`}>{isLiveConnected ? 'End Session' : 'Start Conversation'}</button>
                        {!isLiveConnected && <p className="text-sm text-gray-500">Experience real-time voice coaching with Gemini 2.5</p>}
                    </div>
                </div>
            )}
        </div>
    );
};
