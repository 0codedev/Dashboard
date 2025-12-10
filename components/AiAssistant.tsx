
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Blob as GenAiBlob, GenerateContentResponse, Modality, HarmBlockThreshold, HarmCategory } from "@google/genai";
import type { TestReport, QuestionLog, AiFilter, ChatMessage, StudyGoal, AiAssistantPreferences, GenUIToolType, GenUIComponentData } from '../types';
import { generateStudyPlan, explainTopic, retrieveRelevantContext, GENUI_TOOLS, decodeAudioData, encodeAudio, decodeAudio, fileToGenerativePart } from '../services/geminiService';
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
  onUpdatePreferences?: React.Dispatch<React.SetStateAction<AiAssistantPreferences>>;
}

const MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: '⚡', desc: 'Main Model (Vision & Speed)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', icon: '🚀', desc: 'Lightweight & Fast' },
    { id: 'gemma-3-27b-it', name: 'Gemma 3 27B', icon: '🤖', desc: 'Text Specialist (Experimental)' },
];

// --- GenUI Components ---

const GenUIChart: React.FC<{ data: any }> = ({ data }) => {
    const { title, chartType, data: chartData, xAxisLabel } = data;
    
    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 my-2 w-full h-80 min-w-[300px]">
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
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 my-2 shadow-lg">
            <h4 className="text-sm font-bold text-gray-200 mb-3 border-b border-slate-700 pb-2 flex justify-between items-center">
                <span>{title}</span>
                <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded">Action Plan</span>
            </h4>
            <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 p-2 hover:bg-slate-800/50 rounded transition-colors border border-transparent hover:border-slate-700/50">
                        <input 
                            type="checkbox" 
                            checked={!!checked[idx]} 
                            onChange={() => setChecked(p => ({...p, [idx]: !p[idx]}))}
                            className="mt-1 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 bg-slate-700 cursor-pointer"
                        />
                        <div className="flex-grow">
                            <p className={`text-sm font-medium transition-all ${checked[idx] ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{item.task}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                    item.priority === 'High' ? 'bg-red-900/30 border-red-800 text-red-300' :
                                    item.priority === 'Medium' ? 'bg-yellow-900/30 border-yellow-800 text-yellow-300' :
                                    'bg-blue-900/30 border-blue-800 text-blue-300'
                                }`}>
                                    {item.priority}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const GenUIDiagram: React.FC<{ data: any }> = ({ data }) => {
    const { title, svgContent, description } = data;
    return (
        <div className="bg-white p-4 rounded-lg border border-slate-300 my-2 shadow-lg text-black">
            <h4 className="text-sm font-bold mb-2 text-center text-slate-800">{title}</h4>
            <div className="w-full flex justify-center my-4" dangerouslySetInnerHTML={{ __html: svgContent }} />
            <p className="text-xs text-slate-600 text-center italic">{description}</p>
        </div>
    );
};

const MindMapNode: React.FC<{ node: any }> = ({ node }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="flex flex-col items-center relative">
            <div 
                className={`p-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${hasChildren ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700 text-gray-200 border-slate-600'}`}
                onClick={() => setExpanded(!expanded)}
            >
                {node.label}
                {hasChildren && <span className="ml-2 text-[10px] opacity-70">{expanded ? '▼' : '▶'}</span>}
            </div>
            {hasChildren && expanded && (
                <div className="flex gap-4 mt-4 relative before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-px before:h-4 before:bg-slate-500">
                    <div className="absolute -top-4 left-0 right-0 h-px bg-slate-500" style={{left: '25%', right: '25%'}}></div>
                    {node.children.map((child: any, idx: number) => (
                        <div key={idx} className="relative pt-4">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-slate-500"></div>
                             <MindMapNode node={child} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const GenUIMindMap: React.FC<{ data: any }> = ({ data }) => {
    const { root } = data;
    return (
        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 my-2 overflow-x-auto shadow-inner min-h-[200px] flex justify-center items-start">
            <MindMapNode node={root} />
        </div>
    );
};

// --- Helper Components & Functions ---

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const renderLine = (line: string) => {
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).filter(Boolean);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-cyan-100 font-bold tracking-wide">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-gray-300">{part.slice(1, -1)}</em>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={i} className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono text-cyan-300">{part.slice(1, -1)}</code>;
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
                elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 my-3 space-y-2">{listItems}</ul>);
                listItems = [];
            }
            elements.push(<h3 key={i} className="text-lg font-bold mt-6 mb-3 text-cyan-300 border-b border-slate-700/50 pb-2">{renderLine(line.substring(4))}</h3>);
            continue;
        }
        
        if (line.match(/^\s*[-*]\s/)) { 
            listItems.push(<li key={i} className="text-gray-300 leading-relaxed pl-2">{renderLine(line.replace(/^\s*[-*]\s/, ''))}</li>);
            continue;
        }
        
        // Blockquotes for insights
        if (line.startsWith('> ')) {
             if (listItems.length > 0) {
                elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 my-3 space-y-2">{listItems}</ul>);
                listItems = [];
            }
            elements.push(
                <div key={i} className="border-l-4 border-cyan-500 pl-4 py-1 my-4 bg-cyan-900/10 italic text-cyan-100">
                    {renderLine(line.substring(2))}
                </div>
            );
            continue;
        }

        if (listItems.length > 0) {
            elements.push(<ul key={`ul-${i}`} className="list-disc pl-5 my-3 space-y-2">{listItems}</ul>);
            listItems = [];
        }

        if (line.trim() === '') {
             elements.push(<div key={i} className="h-3"></div>);
        } else {
            elements.push(<p key={i} className="my-2 leading-7 text-gray-200">{renderLine(line)}</p>);
        }
    }
    
    if (listItems.length > 0) {
        elements.push(<ul key="ul-end" className="list-disc pl-5 my-3 space-y-2">{listItems}</ul>);
    }

    return (
        <div className="prose prose-invert text-gray-200 max-w-full text-sm font-sans">{elements}</div>
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

// --- Advanced System Instruction Generation ---
const getSystemInstruction = (reports: TestReport[], logs: QuestionLog[], preferences: AiAssistantPreferences, extraContext: string) => {
    // 1. Global Stats & Trends
    const totalTests = reports.length;
    const allScores = reports.map(r => r.total.marks);
    const avgScore = allScores.reduce((a, b) => a + b, 0) / (totalTests || 1);
    
    // Moving Average (Last 3 vs All Time)
    const recentReports = reports.slice(-3);
    const recentAvg = recentReports.reduce((a, b) => a + b.total.marks, 0) / (recentReports.length || 1);
    const trendDelta = recentAvg - avgScore;
    const trendDirection = trendDelta > 5 ? 'Surging 🚀' : trendDelta > 0 ? 'Improving 📈' : trendDelta > -5 ? 'Plateauing ➖' : 'Declining 📉';

    // Volatility (Consistency)
    const scoreVariance = allScores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / (totalTests || 1);
    const scoreStdDev = Math.sqrt(scoreVariance);
    const consistencyRating = scoreStdDev < 10 ? 'Machine-like (Very High)' : scoreStdDev < 25 ? 'Stable' : 'Erratic (High Volatility)';

    // 2. Subject Breakdown
    const subjects = ['physics', 'chemistry', 'maths'] as const;
    const subjectAvgs = subjects.map(sub => ({
        name: sub,
        avg: reports.reduce((a, r) => a + r[sub].marks, 0) / (totalTests || 1)
    })).sort((a, b) => b.avg - a.avg);
    
    const strongestSubject = subjectAvgs[0];
    const weakestSubject = subjectAvgs[2];

    // 3. Deep Error Analysis
    const errorStats = logs.reduce((acc, log) => {
        if (log.status === QuestionStatus.Wrong || log.status === QuestionStatus.PartiallyCorrect) {
            acc.total++;
            if (log.reasonForError) acc.reasons[log.reasonForError] = (acc.reasons[log.reasonForError] || 0) + 1;
            if (log.topic) acc.topics[log.topic] = (acc.topics[log.topic] || 0) + 1;
        }
        return acc;
    }, { 
        total: 0, 
        reasons: {} as Record<string, number>, 
        topics: {} as Record<string, number>,
    });

    const topErrorEntry = Object.entries(errorStats.reasons).sort((a, b) => b[1] - a[1])[0];
    const topErrorReason = topErrorEntry ? topErrorEntry[0] : 'None';
    const topErrorPct = topErrorEntry ? Math.round((topErrorEntry[1] / errorStats.total) * 100) : 0;

    const topWeakTopicEntry = Object.entries(errorStats.topics).sort((a, b) => b[1] - a[1])[0];
    const topWeakTopic = topWeakTopicEntry ? `${topWeakTopicEntry[0]} (${topWeakTopicEntry[1]} errors)` : 'None';

    // 4. Victory Metric Calculation (For Encouraging Persona)
    const victoryMetric = (() => {
        if (trendDelta > 5) return `your recent score trajectory is impressive (+${trendDelta.toFixed(0)} points vs average)`;
        if (consistencyRating.includes('High')) return `your performance stability is excellent, providing a reliable base`;
        if (strongestSubject.avg > 0) return `your command over ${strongestSubject.name} is a major asset`;
        return `your dedication to logging ${errorStats.total} errors shows great discipline`;
    })();

    // 5. Construct the System Prompt
    const socraticModeInstruction = `
    **MODE: SOCRATIC COACHING (ACTIVE)**
    1.  **Objective:** Do NOT lecture. Do NOT give a full report immediately. Your goal is to guide the student to realization through questioning.
    2.  **Method:**
        *   Identify *one* specific, high-impact issue from the data (e.g., "I noticed your Chemistry accuracy drops in the last 30 minutes").
        *   Ask a probing question about it (e.g., "Do you think this is due to fatigue or topic difficulty?").
    3.  **Constraint:** Stop there. Do not provide the solution yet. Wait for the user's reply.
    4.  **No Tools:** Do not generate charts or checklists in this mode unless specifically asked.
    `;

    const directModeInstruction = `
    **MODE: DIRECT STRATEGIST**
    You are a high-performance consultant.
    1.  **Objective:** Provide a clear, comprehensive analysis of the situation.
    2.  **Method:**
        *   Synthesize the data into a narrative.
        *   Highlight specific strengths and weaknesses.
        *   Provide actionable next steps immediately.
    `;

    const formattingInstruction = `
    **OUTPUT STYLE GUIDE (STRICT):**
    1.  **Text First:** Your response must be primarily text. Use beautiful, well-structured paragraphs.
    2.  **Narrative:** Tell a story about the student's performance. Connect the dots between different metrics. Do not just list stats.
    3.  **Typography:**
        *   Use **bold** for key metrics and emphasis.
        *   Use > blockquotes for key "Coach's Insights" or summaries.
        *   Use ### Headers to separate distinct thoughts.
    4.  **Tool Usage:** 
        * Use \`renderChart\` or \`createActionPlan\` if appropriate for data visualization or planning.
        * **NEW:** Use \`renderDiagram\` to generate visual explanations (SVG) for physics/math concepts if the user asks.
        * **NEW:** Use \`createMindMap\` to break down complex topics hierarchically if requested.
    `;

    const isPro = preferences.model.toLowerCase().includes('pro');
    const proInstruction = isPro ? `
    **MODEL SPECIFIC INSTRUCTION (GEMINI PRO):**
    You have high reasoning capabilities. Do not simply summarize data.
    - **Correlate:** Link fatigue (question number) to accuracy. Link time-spent to error type.
    - **Synthesize:** Don't just list weak topics; find the *underlying concept* connecting them (e.g., "Calculus application is hurting both Physics and Maths").
    - **Tool Etiquette:** If you generate a chart, you MUST provide a detailed paragraph analyzing what the chart shows and why it matters *before* or *after* the chart. **Never** output a chart as the sole answer.
    - **Professional Tone:** Act like a high-end consultant. Use terms like 'Variance', 'Opportunity Cost', 'Diminishing Returns', 'Pareto Principle'.
    ` : '';

    const basePrompt = `
    You are the **Chief Performance Coach** for an elite JEE aspirant.
    
    **PERSONA:**
    - **Role:** Empathetic, data-driven, and highly encouraging mentor.
    - **Tone:** Warm but rigorous. Use "we" language (e.g., "How can we improve this?").
    - **Opening:** Always start by acknowledging a specific strength or improvement (Victory Metric: ${victoryMetric}) to build confidence before delivering constructive criticism.
    
    **CORE DATA:**
    - **Trajectory:** ${trendDirection} (Recent Avg: ${recentAvg.toFixed(0)} vs Global: ${avgScore.toFixed(0)}).
    - **Stability:** ${consistencyRating}.
    - **Strongest:** ${strongestSubject.name.toUpperCase()} (${strongestSubject.avg.toFixed(1)}).
    - **Weakest:** ${weakestSubject.name.toUpperCase()} (${weakestSubject.avg.toFixed(1)}).
    - **Primary Error:** ${topErrorReason} (${topErrorPct}% of errors).
    - **Critical Weakness:** ${topWeakTopic}.
    
    **CONTEXT:** ${extraContext || "No specific past errors found for this query."}

    ${proInstruction}

    ${preferences.socraticMode ? socraticModeInstruction : directModeInstruction}

    ${formattingInstruction}
    
    ${preferences.customInstructions ? `**USER OVERRIDE:** ${preferences.customInstructions}` : ''}
    `;

    return basePrompt;
};

// Main Component
export const AiAssistant: React.FC<AiAssistantProps> = ({ reports, questionLogs, setView, setActiveLogFilter, apiKey, chatHistory, setChatHistory, studyGoals, setStudyGoals, preferences, onUpdatePreferences }) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'voice'>('chat');
    
    // Chat State
    const [userInput, setUserInput] = useState('');
    const [isStreamingResponse, setIsStreamingResponse] = useState(false);
    const [isInputExpanded, setIsInputExpanded] = useState(true);
    const [attachedImage, setAttachedImage] = useState<File | null>(null);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const ai = useMemo(() => new GoogleGenAI({ apiKey }), [apiKey]);

    // Voice State (Gemini Live)
    const [isLiveConnected, setIsLiveConnected] = useState(false);
    const [liveStatus, setLiveStatus] = useState<'listening' | 'thinking' | 'speaking'>('listening');
    const [audioVolume, setAudioVolume] = useState(0);
    // Use 'any' as the session type is not exported by the SDK
    const liveSessionRef = useRef<any | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioWorkletRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    
    // Auto-scroll
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

    // Close model selector on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
                setIsModelSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clean up Live Session on Unmount or Tab Change
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

    const currentModel = MODELS.find(m => m.id === preferences.model) || MODELS[0];

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

        // RAG Retrieval
        const ragContext = await retrieveRelevantContext(currentInput, questionLogs, apiKey);
        const systemInstruction = getSystemInstruction(reports, questionLogs, preferences, ragContext);

        try {
            // Prepare contents: Text + Optional Image
            const parts: any[] = [{ text: currentInput || "Analyze this." }];
            if (currentImage) {
                const imagePart = await fileToGenerativePart(currentImage);
                parts.unshift(imagePart); // Image comes first usually
            }

            const isGemma = preferences.model.toLowerCase().includes('gemma');
            let reqConfig: any = {};
            let reqContents = [{ role: 'user', parts: parts }];

            if (isGemma) {
                // Gemma Logic: Text only, no system instruction in config, no tools
                // Filter out non-text parts (images)
                const textParts = parts.filter(p => p.text);
                const imageParts = parts.filter(p => !p.text);
                
                if (imageParts.length > 0) {
                     setChatHistory(prev => [...prev, { role: 'model', content: "⚠️ Note: Gemma models are text-only and cannot analyze images. I've ignored the attached image." }]);
                }
                
                // Sanitize system prompt to remove tool references
                const sanitizedSystemPrompt = systemInstruction
                    .replace(/Use `renderChart`.*planning\./g, '')
                    .replace(/Use `createActionPlan`.*planning\./g, '')
                    .replace(/Use `renderDiagram`.*asks\./g, '')
                    .replace(/Use `createMindMap`.*requested\./g, '')
                    .replace(/\*\*Tool Usage:\*\*[\s\S]*?(?=\*\*)/g, ''); // Remove Tool Usage section

                // Prepend system instruction to the first text part
                if (textParts.length > 0) {
                    textParts[0].text = `SYSTEM INSTRUCTION:\n${sanitizedSystemPrompt}\n\nUSER QUERY:\n${textParts[0].text}`;
                }
                
                reqContents = [{ role: 'user', parts: textParts }];
                // No tools, no systemInstruction in config
                // Relax safety settings for Gemma
                reqConfig = {
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ]
                };
            } else {
                // Gemini Logic: Full capabilities
                reqConfig = {
                    systemInstruction,
                    tools: [{ functionDeclarations: GENUI_TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
                };
                reqContents = [{ role: 'user', parts: parts }];
            }

            const response = await ai.models.generateContentStream({
                model: preferences.model || 'gemini-2.5-flash', 
                contents: reqContents,
                config: reqConfig
            });

            let streamedText = '';

            for await (const chunk of response) {
                // Check for Function Calls (GenUI)
                const toolCall = chunk.functionCalls?.[0];
                if (toolCall) {
                    // GenUI Trigger
                    let genType: GenUIToolType = 'none';
                    if (toolCall.name === 'renderChart') genType = 'chart';
                    else if (toolCall.name === 'createActionPlan') genType = 'checklist';
                    else if (toolCall.name === 'renderDiagram') genType = 'chart'; // Reusing type string but logic handled in render
                    else if (toolCall.name === 'createMindMap') genType = 'chart'; // Reusing type string

                    const genData: GenUIComponentData = {
                        type: genType, // We misuse type slightly here for internal mapping, corrected below in renderer logic
                        data: toolCall.args,
                        id: toolCall.id || Date.now().toString()
                    };
                    
                    // Fix manual type overrides for new tools
                    if (toolCall.name === 'renderDiagram') {
                        setChatHistory(prev => [...prev, { role: 'model', content: { type: 'genUI', component: { ...genData, type: 'diagram' as any } } }]);
                    } else if (toolCall.name === 'createMindMap') {
                        setChatHistory(prev => [...prev, { role: 'model', content: { type: 'genUI', component: { ...genData, type: 'mindmap' as any } } }]);
                    } else if (genData.type !== 'none') {
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
            console.error("Chat generation error:", err);
            setChatHistory(prev => [...prev, { role: 'model', content: "Error generating response. Please check your API key, billing status, or network connection." }]);
        } finally {
            setIsStreamingResponse(false);
        }

    }, [userInput, attachedImage, isStreamingResponse, ai, questionLogs, reports, preferences, apiKey]);

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
        <div className="flex flex-col h-[calc(100vh-120px)] bg-slate-800/50 rounded-lg shadow-lg border border-slate-700 overflow-hidden relative">
            {/* Header */}
            <div className="flex justify-between items-center p-3 border-b border-slate-700 bg-slate-900/90 backdrop-blur-md z-30">
                {/* Model Selector (ChatGPT Style) */}
                <div className="relative" ref={modelSelectorRef}>
                    <button 
                        onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium text-gray-200"
                    >
                        <span className="text-cyan-400 text-lg">{currentModel.icon}</span>
                        <span>{currentModel.name}</span>
                        <span className="text-gray-500 text-xs ml-1">▼</span>
                    </button>

                    {isModelSelectorOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 animate-scale-in overflow-hidden">
                            {MODELS.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelChange(model.id)}
                                    className={`w-full text-left p-3 flex items-start gap-3 hover:bg-slate-700/50 transition-colors ${preferences.model === model.id ? 'bg-slate-700/30' : ''}`}
                                >
                                    <span className="text-xl mt-0.5">{model.icon}</span>
                                    <div>
                                        <p className={`text-sm font-bold ${preferences.model === model.id ? 'text-cyan-400' : 'text-gray-200'}`}>{model.name}</p>
                                        <p className="text-xs text-gray-500">{model.desc}</p>
                                    </div>
                                    {preferences.model === model.id && <span className="ml-auto text-cyan-400 font-bold">✓</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                    <button onClick={() => setActiveTab('chat')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'chat' ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Chat</button>
                    <button onClick={() => setActiveTab('voice')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'voice' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>Live</button>
                </div>
            </div>

            {activeTab === 'chat' ? (
                <div className="flex-grow relative flex flex-col overflow-hidden">
                    <div ref={chatContainerRef} className={`flex-grow p-4 overflow-y-auto space-y-6 custom-scrollbar ${isInputExpanded ? 'pb-44' : 'pb-20'} transition-all duration-300`}>
                        {chatHistory.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 text-4xl grayscale">
                                    {currentModel.icon}
                                </div>
                                <p className="text-lg font-medium mb-2">How can I help you ace JEE?</p>
                            </div>
                        )}
                        {chatHistory.map((msg, index) => (
                            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                                <div className={`p-4 rounded-2xl max-w-[90%] lg:max-w-[75%] shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-slate-800 text-gray-100 rounded-br-sm' 
                                    : 'bg-transparent text-gray-200 pl-0'
                                }`}>
                                    {msg.role === 'model' && (
                                        <div className="flex items-center gap-2 mb-1 text-xs font-bold text-cyan-400">
                                            <span>{currentModel.icon}</span> AI Coach
                                        </div>
                                    )}
                                    {typeof msg.content === 'string' ? (
                                        <MarkdownRenderer content={msg.content} />
                                    ) : msg.content.type === 'testReport' ? (
                                        <TestReportCard report={msg.content.data} />
                                    ) : msg.content.type === 'genUI' ? (
                                        msg.content.component.type === 'chart' ? (
                                            <GenUIChart data={msg.content.component.data} />
                                        ) : msg.content.component.type === 'checklist' ? (
                                            <GenUIChecklist data={msg.content.component.data} />
                                        ) : (msg.content.component as any).type === 'diagram' ? (
                                            <GenUIDiagram data={msg.content.component.data} />
                                        ) : (msg.content.component as any).type === 'mindmap' ? (
                                            <GenUIMindMap data={msg.content.component.data} />
                                        ) : null
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {isStreamingResponse && (
                            <div className="flex items-center gap-2 pl-2">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-150"></div>
                            </div>
                        )}
                    </div>

                    {/* Premium Input Area */}
                    <div className={`absolute bottom-0 left-0 right-0 z-20 transition-transform duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${isInputExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-20px)] opacity-0 pointer-events-none'}`}>
                        <div className="p-4 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent pt-10">
                            {/* Suggestions Pills */}
                            {isInputExpanded && chatHistory.length < 2 && (
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-2 hide-scrollbar px-2">
                                    {suggestions.map((s, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => handleSuggestionClick(s)} 
                                            className="whitespace-nowrap px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-cyan-500/30 text-xs text-gray-300 hover:text-white rounded-full transition-all shadow-sm backdrop-blur-sm"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {/* Attachment Preview */}
                            {attachedImage && (
                                <div className="mx-2 mb-2 flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl border border-slate-700/50 w-fit animate-scale-in backdrop-blur-sm">
                                    <div className="w-10 h-10 bg-slate-700 rounded-lg overflow-hidden flex items-center justify-center text-lg shadow-inner">
                                        🖼️
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-white font-medium truncate max-w-[150px]">{attachedImage.name}</span>
                                        <span className="text-[10px] text-gray-400">{(attachedImage.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                    <button onClick={handleRemoveImage} className="ml-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-700 text-gray-400 hover:text-red-400 transition-colors">×</button>
                                </div>
                            )}

                            {/* Glass Input Box */}
                            <form 
                                onSubmit={handleSendMessage} 
                                className="relative bg-slate-900/50 border border-slate-700/50 backdrop-blur-xl rounded-3xl shadow-2xl transition-all focus-within:border-cyan-500/50 focus-within:shadow-[0_0_20px_rgba(34,211,238,0.1)]"
                            >
                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                                
                                <div className="flex items-end p-2">
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-3 text-gray-400 hover:text-cyan-400 hover:bg-cyan-900/20 rounded-full transition-all"
                                        title="Attach image"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </button>
                                    
                                    <textarea
                                        ref={inputRef}
                                        value={userInput}
                                        onChange={handleUserInput}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                                        placeholder={`Message ${currentModel.name}...`}
                                        className="w-full bg-transparent text-gray-100 px-3 py-3.5 max-h-48 focus:outline-none resize-none text-sm placeholder-gray-500"
                                        rows={1}
                                        disabled={isStreamingResponse}
                                    />
                                    
                                    <button 
                                        type="submit" 
                                        disabled={isStreamingResponse || (userInput.trim() === '' && !attachedImage)}
                                        className="p-2 mb-1 mr-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full transition-all disabled:opacity-0 disabled:scale-75 shadow-lg shadow-cyan-500/20"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                                    </button>
                                </div>
                            </form>
                            <div className="text-center mt-2">
                                <p className="text-[10px] text-gray-600">AI can make mistakes. Verify important information.</p>
                            </div>
                        </div>
                    </div>

                    {/* Minimizing Toggle (Floating Fab when collapsed) */}
                    {!isInputExpanded && (
                        <div className="absolute bottom-6 right-6 z-30 animate-scale-in">
                            <button
                                onClick={() => setIsInputExpanded(true)}
                                className="group relative w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(34,211,238,0.4)] text-white transition-all duration-500 ease-out hover:scale-110 hover:rotate-3 ring-2 ring-white/20 overflow-hidden"
                            >
                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                                
                                {/* Filled Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 drop-shadow-md transform transition-transform group-hover:scale-110">
                                    <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    )}
                    
                    {/* Collapse Arrow (When expanded) */}
                    {isInputExpanded && (
                        <div className="absolute bottom-[88px] right-6 z-30">
                             <button
                                onClick={() => setIsInputExpanded(false)}
                                className="w-8 h-8 bg-slate-800/50 hover:bg-slate-700 text-gray-400 hover:text-white rounded-full flex items-center justify-center backdrop-blur border border-slate-600/50 transition-all"
                                title="Minimize Input"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                        </div>
                    )}
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
