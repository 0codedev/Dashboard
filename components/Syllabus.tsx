
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { UserProfile, QuestionLog, ChapterProgress, TestReport, QuizQuestion } from '../types';
import { SyllabusStatus, TargetExam, QuestionStatus } from '../types';
import { SUBJECT_CONFIG, TOPIC_WEIGHTAGE, TOPIC_DEPENDENCIES, JEE_SYLLABUS } from '../constants';
import Modal from './common/Modal';
import { explainTopic, generateGatekeeperQuiz, generateLearningPath, generatePreMortem } from '../services/geminiService';
import { SyllabusSunburst } from './visualizations/SyllabusSunburst';
import { SyllabusSubwayMap } from './visualizations/SyllabusSubwayMap';
import { SyllabusRiverFlow } from './visualizations/SyllabusRiverFlow';
import { SyllabusTree } from './visualizations/SyllabusTree';
import { SkeletonText } from './common/Skeletons';
import { MarkdownRenderer } from './common/MarkdownRenderer';

// --- Imported Sub-Components ---
import { StrategicPlanner } from './syllabus/StrategicPlanner';
import { GatekeeperQuiz } from './syllabus/GatekeeperQuiz';
import { ChapterCard } from './syllabus/ChapterCard'; // Required for Modal
import { SubjectSyllabus } from './syllabus/SubjectSyllabus';
import { SyllabusOverviewWidget } from './syllabus/SyllabusOverview';
import { calculateMasteryScore, getMasteryTier } from './syllabus/utils';


interface SyllabusProps {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    questionLogs: QuestionLog[];
    reports: TestReport[];
    apiKey: string;
    onStartFocusSession: (topic: string) => void;
    setView: (view: any) => void;
    addTasksToPlanner?: (tasks: { task: string, time: number, topic: string }[]) => void;
    modelName?: string;
}

const ViewControl: React.FC<{ mode: string; setMode: (m: any) => void }> = ({ mode, setMode }) => {
    const modes = [
        { id: 'overview', icon: '☷', label: 'List' },
        { id: 'sunburst', icon: '◎', label: 'Sunburst' },
        { id: 'tree', icon: '🌳', label: 'Tree' },
        { id: 'river', icon: '🌊', label: 'River' },
        { id: 'subway', icon: '🚇', label: 'Subway' },
    ];

    return (
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-lg">
            {modes.map(m => (
                <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        mode === m.id 
                        ? 'bg-cyan-600 text-white shadow-md' 
                        : 'text-gray-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={m.label}
                >
                    <span className="text-lg leading-none">{m.icon}</span>
                    <span className="hidden sm:inline">{m.label}</span>
                </button>
            ))}
        </div>
    );
};

export const Syllabus: React.FC<SyllabusProps> = ({ userProfile, setUserProfile, questionLogs, reports, apiKey, onStartFocusSession, setView, addTasksToPlanner, modelName }) => {
    const [activeSubject, setActiveSubject] = useState<'physics' | 'chemistry' | 'maths'>('physics');
    const [activeUnit, setActiveUnit] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [explainModalData, setExplainModalData] = useState<{ topic: string; content: string; loading: boolean; complexity: 'standard' | 'simple' } | null>(null);
    const [vizMode, setVizMode] = useState<'overview' | 'sunburst' | 'tree' | 'river' | 'subway'>('overview');
    const [quizState, setQuizState] = useState<{ topic: string, questions?: QuizQuestion[], loading: boolean, userAnswers?: Record<number, string>, submitted?: boolean, result?: boolean[] } | null>(null);
    
    // Chapter Detail Modal State
    const [selectedChapterForModal, setSelectedChapterForModal] = useState<string | null>(null);
    const [isGeneratingPath, setIsGeneratingPath] = useState(false);

    // Pre-mortem State
    const [hurdleData, setHurdleData] = useState<{ topic: string, content: string } | null>(null);
    const [isHurdleLoading, setIsHurdleLoading] = useState(false);
    const [currentHurdleTopic, setCurrentHurdleTopic] = useState<string | null>(null);

    // Quick Review Mode
    const [isQuickReviewOpen, setIsQuickReviewOpen] = useState(false);
    const [quickReviewCards, setQuickReviewCards] = useState<{ topic: string, content: string }[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    // Particle effect state
    const [completionEffect, setCompletionEffect] = useState<{ x: number, y: number, key: number } | null>(null);
    const particleCanvasRef = useRef<HTMLCanvasElement>(null);
    const chapterCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const triggerCompletionEffect = useCallback((coords: { x: number, y: number }) => {
        setCompletionEffect({ ...coords, key: Date.now() });
    }, []);

    useEffect(() => {
        if (!completionEffect || !particleCanvasRef.current) return;
        const canvas = particleCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles: any[] = [];
        const { x, y } = completionEffect;
        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.random() * 4 + 1;
            particles.push({
                x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                radius: Math.random() * 2 + 1,
                color: `rgba(34, 211, 238, ${Math.random() * 0.5 + 0.5})`, // Default Cyan
                life: 60,
            });
        }
        let animationFrameId: number;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1;
                if (p.life <= 0) particles.splice(i, 1);
                else {
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = p.color; ctx.globalAlpha = p.life / 60; ctx.fill();
                }
            });
            if (particles.length > 0) animationFrameId = requestAnimationFrame(animate);
            else { ctx.clearRect(0, 0, canvas.width, canvas.height); setCompletionEffect(null); }
        };
        animate();
        return () => cancelAnimationFrame(animationFrameId);
    }, [completionEffect]);

    const handleSyllabusChange = (chapter: string, updatedProgress: Partial<ChapterProgress>) => {
        setUserProfile(prev => {
            const existingProgress = prev.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0 };
            const wasCompleted = existingProgress.status === SyllabusStatus.Completed || existingProgress.status === SyllabusStatus.Revising;
            
            const newProgress = { ...existingProgress, ...updatedProgress };

            if (newProgress.status === SyllabusStatus.Completed && existingProgress.status !== SyllabusStatus.Completed) {
                newProgress.completionDate = new Date().toISOString();
                 if (!wasCompleted) {
                    const cardEl = chapterCardRefs.current[chapter];
                    if (cardEl) {
                        const rect = cardEl.getBoundingClientRect();
                        triggerCompletionEffect({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                    } else {
                        triggerCompletionEffect({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    }
                }
            }
    
            return {
                ...prev,
                syllabus: {
                    ...prev.syllabus,
                    [chapter]: newProgress
                }
            };
        });
    };

    const allMasteryScores = useMemo(() => {
        const scores: Record<string, { score: number, tier: string, color: string }> = {};
        if (!userProfile?.syllabus) return scores;

        ['physics', 'chemistry', 'maths'].forEach(sub => {
            // @ts-ignore
            JEE_SYLLABUS[sub]?.forEach((unit: any) => {
                unit.chapters.forEach((ch: any) => {
                    const progress = userProfile.syllabus[ch.name];
                    const score = calculateMasteryScore(ch.name, questionLogs, progress?.status);
                    const info = getMasteryTier(score);
                    scores[ch.name] = { score, tier: info.tier, color: info.color };
                });
            });
        });
        return scores;
    }, [userProfile?.syllabus, questionLogs]);

    const handleExplainTopic = async (topic: string, complexity: 'standard' | 'simple' = 'standard') => {
        setExplainModalData({ topic, content: '', loading: true, complexity });
        try {
            const explanation = await explainTopic(topic, apiKey, complexity, modelName);
            setExplainModalData(prev => prev ? { ...prev, content: explanation, loading: false } : null);
            handleSyllabusChange(topic, { flashcard: explanation });
        } catch (error) {
            setExplainModalData(prev => prev ? { ...prev, content: "Failed to load explanation.", loading: false } : null);
        }
    };

    const triggerCompletionQuiz = useCallback(async (topic: string) => {
        setQuizState({ topic, loading: true });
        try {
            const questions = await generateGatekeeperQuiz(topic, apiKey, modelName);
            if (questions && questions.length > 0) {
                setQuizState(prev => prev ? { ...prev, questions, loading: false } : null);
            } else {
                throw new Error("No questions generated.");
            }
        } catch (e) {
            console.error("Failed to generate quiz, aborting completion.", e);
            setQuizState(null);
            alert("Failed to generate Gatekeeper Quiz. Please check your internet connection or API key limits. Syllabus status not updated.");
        }
    }, [apiKey, modelName]);

    const handleGenerateLearningPath = async () => {
        if (!selectedChapterForModal || !apiKey) return;
        setIsGeneratingPath(true);
        try {
            const prereqs = TOPIC_DEPENDENCIES[selectedChapterForModal] || [];
            const weakPrereqs = prereqs.filter(p => {
                const mastery = allMasteryScores[p];
                return !mastery || mastery.score < 1200;
            });

            const path = await generateLearningPath(selectedChapterForModal, weakPrereqs, apiKey, modelName);
            if (addTasksToPlanner) {
                addTasksToPlanner(path);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to generate learning path.");
        } finally {
            setIsGeneratingPath(false);
        }
    };

    const handlePredictHurdles = async (topic: string) => {
        if (!apiKey) return;
        setIsHurdleLoading(true);
        setCurrentHurdleTopic(topic);
        try {
            const prereqs = TOPIC_DEPENDENCIES[topic] || [];
            const prereqErrors: string[] = [];
            
            prereqs.forEach(p => {
                const errors = questionLogs.filter(l => l.topic === p && (l.status === QuestionStatus.Wrong || l.status === QuestionStatus.PartiallyCorrect));
                if (errors.length > 0) {
                    const reasons = errors.reduce((acc, l) => {
                        if (l.reasonForError) acc[l.reasonForError] = (acc[l.reasonForError] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    const topReasons = Object.entries(reasons)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(r => r[0])
                        .join(', ');
                    prereqErrors.push(`${p}: ${errors.length} errors (${topReasons})`);
                }
            });

            const prediction = await generatePreMortem(topic, prereqs, prereqErrors, apiKey, modelName);
            setHurdleData({ topic, content: prediction });
        } catch (e) {
            console.error(e);
            alert("Failed to predict hurdles.");
        } finally {
            setIsHurdleLoading(false);
            setCurrentHurdleTopic(null);
        }
    };

    const startQuickReview = () => {
        const cards: { topic: string, content: string }[] = [];
        if (userProfile?.syllabus) {
            Object.entries(userProfile.syllabus).forEach(([topic, p]) => {
                const progress = p as ChapterProgress;
                if (progress.flashcard) {
                    cards.push({ topic, content: progress.flashcard });
                }
            });
        }

        if (cards.length === 0) {
            alert("No flashcards saved. Use the 'Explain' feature on chapters to generate them first.");
            return;
        }

        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        setQuickReviewCards(cards);
        setCurrentCardIndex(0);
        setIsCardFlipped(false);
        setIsQuickReviewOpen(true);
    };

    const handleNodeClick = (topic: string) => {
        setSelectedChapterForModal(topic);
    };

    const handleSunburstClick = (type: 'subject' | 'unit', name: string) => {
        if (type === 'subject') { setActiveSubject(name.toLowerCase() as 'physics' | 'chemistry' | 'maths'); setActiveUnit(null); setVizMode('overview'); } 
        else if (type === 'unit') {
            const subject = ['physics', 'chemistry', 'maths'].find(sub => {
                // @ts-ignore
                return JEE_SYLLABUS[sub]?.some((u: any) => u.unit === name);
            });
            if (subject) { setActiveSubject(subject as 'physics' | 'chemistry' | 'maths'); setActiveUnit(name); setVizMode('overview'); }
        }
    };

    const revisionStackTopics = useMemo(() => {
        const topics: { name: string, weight: number, reason: string }[] = [];
        if (!userProfile?.syllabus) return [];

        const syllabusChapters = Object.values(JEE_SYLLABUS).flatMap((subject: any) => subject.flatMap((unit: any) => unit.chapters.map((c: any) => c.name)));
        syllabusChapters.forEach((chapter: any) => {
            const progress = userProfile.syllabus[chapter] || { status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {} };
            const baseWeight = TOPIC_WEIGHTAGE[chapter] === 'High' ? 3 : TOPIC_WEIGHTAGE[chapter] === 'Medium' ? 2 : 1;
            let lastInteractionDate = new Date('2000-01-01');
            let hasInteraction = false;
             questionLogs.forEach(log => {
                if (log.topic === chapter) {
                    const report = reports.find(r => r.id === log.testId);
                    if (report) {
                        const date = new Date(report.testDate);
                        if (date > lastInteractionDate) { lastInteractionDate = date; hasInteraction = true; }
                    }
                }
            });
            if(hasInteraction) {
                const today = new Date();
                const diffTime = Math.abs(today.getTime() - lastInteractionDate.getTime());
                const daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                const stability = 7 * (1 + (progress.revisionCount || 0) * 0.5); 
                const retention = Math.exp(-daysAgo / stability);
                if(retention < 0.7) { 
                    const urgency = retention < 0.4 ? 2 : 1;
                    topics.push({ name: chapter, weight: baseWeight * 5 * urgency, reason: 'Fading Memory' });
                    return; 
                }
            }
            if (progress.strength === 'weakness') { topics.push({ name: chapter, weight: baseWeight * 4, reason: 'Marked Weakness' }); return; }
            if (progress.status === SyllabusStatus.InProgress) { topics.push({ name: chapter, weight: baseWeight * 2, reason: 'In Progress' }); return; }
        });
        if (topics.length === 0) {
             syllabusChapters.forEach((chapter: any) => {
                 const progress = userProfile.syllabus[chapter];
                 if(progress && progress.status === SyllabusStatus.InProgress) { topics.push({ name: chapter, weight: 1, reason: 'Continue Progress' }); }
             });
        }
        return topics.sort((a, b) => b.weight - a.weight).slice(0, 5);
    }, [userProfile?.syllabus, questionLogs, reports]);

    const handleGenerateRevisionStack = () => {
        if(revisionStackTopics.length === 0) { alert("You haven't marked enough chapters as 'In Progress' or 'Weakness' to generate a targeted stack."); return; }
        if(addTasksToPlanner) { const tasks = revisionStackTopics.map(t => ({ task: `Revise: ${t.name} (${t.reason})`, time: 30, topic: t.name })); addTasksToPlanner(tasks); } 
        else { onStartFocusSession(revisionStackTopics[0].name); }
    };

    const selectedChapterObj = useMemo(() => {
        if (!selectedChapterForModal) return null;
        // @ts-ignore
        const allUnits = Object.values(JEE_SYLLABUS).flatMap(subject => subject);
        for (const unit of allUnits) {
            const chapter = unit.chapters.find((c: any) => c.name === selectedChapterForModal);
            if (chapter) return chapter;
        }
        return null;
    }, [selectedChapterForModal]);

    return (
        <div className="space-y-6 pb-20">
            {completionEffect && <canvas ref={particleCanvasRef} className="fixed inset-0 pointer-events-none z-[100]" />}
            <StrategicPlanner userProfile={userProfile} />

            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-[rgb(var(--color-primary-accent-rgb))]">Syllabus Tracker</h2>
                
                <div className="flex items-center gap-4">
                    <button
                        onClick={startQuickReview}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 text-sm hover:scale-105 transition-transform"
                        title="Review saved AI explanations as flashcards"
                    >
                        <span>⚡</span> Quick Review
                    </button>

                    <button 
                        onClick={handleGenerateRevisionStack}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 text-sm hover:scale-105 transition-transform"
                        title="Auto-generate tasks for fading, weak, or in-progress topics"
                    >
                        <span>🧠</span> Generate Revision Stack
                        {revisionStackTopics.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{revisionStackTopics.length}</span>}
                    </button>
                    
                    <ViewControl mode={vizMode} setMode={setVizMode} />

                     <input 
                        type="text" 
                        placeholder="Search chapters..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="bg-slate-700 border border-slate-600 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none w-64"
                    />
                </div>
            </div>

            <div className="relative">
                {vizMode === 'sunburst' ? (
                    <SyllabusSunburst userProfile={userProfile} onSliceClick={handleSunburstClick} />
                ) : vizMode === 'subway' ? (
                    <SyllabusSubwayMap userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} />
                ) : vizMode === 'river' ? (
                    <SyllabusRiverFlow userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} />
                ) : vizMode === 'tree' ? (
                    <SyllabusTree userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} onSyllabusChange={handleSyllabusChange} />
                ) : ( 
                    <SyllabusOverviewWidget userProfile={userProfile} questionLogs={questionLogs} />
                )}
            </div>
            
            {(vizMode === 'overview' || activeUnit) && (
                 <div className="flex items-center gap-4 border-b border-slate-700 overflow-x-auto">
                     {(['physics', 'chemistry', 'maths'] as const).map(subject => (
                         <button
                            key={subject}
                            onClick={() => { setActiveSubject(subject); setActiveUnit(null); }}
                            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeSubject === subject ? `border-[${SUBJECT_CONFIG[subject].color}] text-white` : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            style={{ borderColor: activeSubject === subject ? SUBJECT_CONFIG[subject].color : 'transparent', color: activeSubject === subject ? SUBJECT_CONFIG[subject].color : undefined }}
                        >
                            {subject}
                        </button>
                     ))}
                     {activeUnit && (
                         <div className="flex items-center gap-2 pb-3 text-sm font-bold text-cyan-300 border-b-2 border-cyan-300 whitespace-nowrap animate-fade-in">
                             <span className="text-gray-500">/</span> {activeUnit} 
                             <button onClick={() => setActiveUnit(null)} className="ml-1 text-gray-500 hover:text-white font-normal">✕</button>
                         </div>
                     )}
                </div>
            )}
           
            {vizMode === 'overview' && (
                 <SubjectSyllabus 
                    subject={activeSubject} 
                    userProfile={userProfile} 
                    onSyllabusChange={handleSyllabusChange} 
                    questionLogs={questionLogs} 
                    reports={reports} 
                    onStartFocusSession={onStartFocusSession}
                    onExplainTopic={(topic) => handleExplainTopic(topic, 'standard')}
                    searchQuery={searchQuery}
                    activeUnitFilter={activeUnit}
                    onTriggerQuiz={triggerCompletionQuiz}
                    onCompletionEffect={triggerCompletionEffect}
                    chapterCardRefs={chapterCardRefs}
                    quizLoadingState={quizState?.loading ? quizState.topic : null}
                    onNodeClick={handleNodeClick}
                    onPredictHurdles={handlePredictHurdles}
                    isHurdleLoading={isHurdleLoading}
                    currentHurdleTopic={currentHurdleTopic}
                />
            )}
            
            {/* Explanation Modal */}
             <Modal isOpen={!!explainModalData} onClose={() => setExplainModalData(null)} title={`Concept: ${explainModalData?.topic}`}>
                <div className="flex justify-end px-4 pb-2 border-b border-slate-700/50 mb-2">
                    <div className="flex bg-slate-800 rounded p-1 gap-1">
                        <button onClick={() => handleExplainTopic(explainModalData!.topic, 'standard')} className={`px-3 py-1 text-xs rounded ${explainModalData?.complexity === 'standard' ? 'bg-cyan-600 text-white' : 'text-gray-400'}`}>Standard</button>
                        <button onClick={() => handleExplainTopic(explainModalData!.topic, 'simple')} className={`px-3 py-1 text-xs rounded ${explainModalData?.complexity === 'simple' ? 'bg-pink-600 text-white' : 'text-gray-400'}`}>Explain Like I'm 5</button>
                    </div>
                </div>
                {explainModalData?.loading ? (
                    <SkeletonText />
                ) : (
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 shadow-inner">
                        <MarkdownRenderer content={explainModalData?.content || ''} />
                    </div>
                )}
            </Modal>

            {/* Quiz Modal */}
            <Modal isOpen={!!quizState} onClose={() => setQuizState(null)} title={`Mastery Check: ${quizState?.topic}`}>
                <GatekeeperQuiz
                    quizState={quizState}
                    setQuizState={setQuizState}
                    onSuccess={() => {
                        if(quizState?.topic) {
                            handleSyllabusChange(quizState.topic, { status: SyllabusStatus.Completed });
                        }
                        setQuizState(null);
                    }}
                />
            </Modal>

            {/* Pre-Mortem Modal */}
            <Modal isOpen={!!hurdleData} onClose={() => setHurdleData(null)} title={`🔮 Pre-mortem: ${hurdleData?.topic}`} isInfo>
                <div className="p-1">
                    <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4">
                        <MarkdownRenderer content={hurdleData?.content || ''} className="text-amber-100" />
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button onClick={() => setHurdleData(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">Got it</button>
                    </div>
                </div>
            </Modal>

            {/* Quick Review Modal */}
            <Modal isOpen={isQuickReviewOpen} onClose={() => setIsQuickReviewOpen(false)} title="⚡ Quick Review">
                <div className="flex flex-col items-center justify-center h-[400px] p-4 relative">
                    {quickReviewCards.length > 0 ? (
                        <div 
                            className="relative w-full max-w-2xl h-full cursor-pointer perspective-1000"
                            onClick={() => setIsCardFlipped(!isCardFlipped)}
                        >
                            <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                                {/* Front */}
                                <div className="absolute inset-0 backface-hidden bg-slate-800 rounded-xl border border-slate-600 flex flex-col items-center justify-center p-8 shadow-2xl">
                                    <span className="text-xs text-gray-400 uppercase tracking-widest mb-4">Topic</span>
                                    <h2 className="text-3xl font-bold text-white text-center">{quickReviewCards[currentCardIndex].topic}</h2>
                                    <p className="text-sm text-gray-500 mt-8 animate-pulse">Click to flip</p>
                                </div>
                                {/* Back */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-indigo-900/30 rounded-xl border border-indigo-500/50 flex flex-col p-8 shadow-2xl overflow-y-auto custom-scrollbar">
                                    <span className="text-xs text-indigo-300 uppercase tracking-widest mb-2 sticky top-0 bg-transparent">Explanation</span>
                                    <MarkdownRenderer content={quickReviewCards[currentCardIndex].content} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-400">No flashcards loaded.</div>
                    )}
                    
                    {quickReviewCards.length > 0 && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 items-center">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(p => (p - 1 + quickReviewCards.length) % quickReviewCards.length); setIsCardFlipped(false); }}
                                className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                                ← Prev
                            </button>
                            <span className="text-sm text-gray-400">{currentCardIndex + 1} / {quickReviewCards.length}</span>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(p => (p + 1) % quickReviewCards.length); setIsCardFlipped(false); }}
                                className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Unified Chapter Detail Modal */}
            <Modal isOpen={!!selectedChapterForModal} onClose={() => setSelectedChapterForModal(null)} title="">
                {selectedChapterForModal && selectedChapterObj && (
                    <div className="h-full">
                        <ChapterCard 
                            cardRef={() => {}}
                            chapter={selectedChapterObj}
                            progress={{ status: SyllabusStatus.NotStarted, strength: null, revisionCount: 0, subTopicStatus: {}, ...(userProfile.syllabus?.[selectedChapterForModal] || {}) } as ChapterProgress}
                            onSyllabusChange={handleSyllabusChange}
                            questionLogs={questionLogs}
                            reports={reports}
                            onStartFocusSession={onStartFocusSession}
                            onExplainTopic={(topic) => handleExplainTopic(topic, 'standard')}
                            userProfile={userProfile}
                            mastery={{...allMasteryScores[selectedChapterForModal], bg: '', color: allMasteryScores[selectedChapterForModal]?.color || '#ccc'}}
                            onTriggerQuiz={triggerCompletionQuiz}
                            onCompletionEffect={triggerCompletionEffect}
                            isQuizLoading={quizState?.loading}
                            forceExpanded={true}
                            showAIPath={true}
                            onGeneratePath={handleGenerateLearningPath}
                            isGeneratingPath={isGeneratingPath}
                            onCardClick={() => {}}
                            onPredictHurdles={handlePredictHurdles}
                            isHurdleLoading={isHurdleLoading && currentHurdleTopic === selectedChapterForModal}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
};
