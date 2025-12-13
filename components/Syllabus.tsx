
// ... (Previous imports)
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { UserProfile, QuestionLog, ChapterProgress, TestReport, QuizQuestion, Flashcard } from '../types';
import { SyllabusStatus, QuestionStatus } from '../types';
import { SUBJECT_CONFIG, TOPIC_DEPENDENCIES, JEE_SYLLABUS } from '../constants';
import Modal from './common/Modal';
import { explainTopic, generateGatekeeperQuiz, generateLearningPath, generatePreMortem, generateFlashcards } from '../services/geminiService';
import { SyllabusSunburst } from './visualizations/SyllabusSunburst';
import { CyberSkillTree } from './visualizations/CyberSkillTree'; // Updated import
import { SyllabusRiverFlow } from './visualizations/SyllabusRiverFlow';
import { SyllabusTree } from './visualizations/SyllabusTree';
import { SkeletonText } from './common/Skeletons';
import { MarkdownRenderer } from './common/MarkdownRenderer';
import { FlashCardModal } from './FlashCardModal';
import { useJeeStore } from '../store/useJeeStore';

// --- Imported Sub-Components ---
import { StrategicPlanner } from './syllabus/StrategicPlanner';
import { GatekeeperQuiz } from './syllabus/GatekeeperQuiz';
import { ChapterCard } from './syllabus/ChapterCard';
import { SubjectSyllabus } from './syllabus/SubjectSyllabus';
import { SyllabusOverviewWidget } from './syllabus/SyllabusOverview';

// --- Extracted Logic Hooks ---
import { useMasteryScores, useRevisionStack } from '../hooks/useSyllabusLogic';

// ... (Interface definitions and ViewControl unchanged)

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
        { id: 'subway', icon: '🚇', label: 'Skill Tree' }, // Renamed Label
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
    // ... (Existing state hooks)
    const [activeSubject, setActiveSubject] = useState<'physics' | 'chemistry' | 'maths'>('physics');
    const [activeUnit, setActiveUnit] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [explainModalData, setExplainModalData] = useState<{ topic: string; content: string; loading: boolean; complexity: 'standard' | 'simple' } | null>(null);
    const [vizMode, setVizMode] = useState<'overview' | 'sunburst' | 'tree' | 'river' | 'subway'>('overview');
    const [quizState, setQuizState] = useState<{ topic: string, questions?: QuizQuestion[], loading: boolean, userAnswers?: Record<number, string>, submitted?: boolean, result?: boolean[] } | null>(null);
    
    const [selectedChapterForModal, setSelectedChapterForModal] = useState<string | null>(null);
    const [isGeneratingPath, setIsGeneratingPath] = useState(false);

    const [hurdleData, setHurdleData] = useState<{ topic: string, content: string } | null>(null);
    const [isHurdleLoading, setIsHurdleLoading] = useState(false);
    const [currentHurdleTopic, setCurrentHurdleTopic] = useState<string | null>(null);

    // Flashcard State
    const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
    // Use store state for modal visibility to keep it synced
    const { startFlashcardSession, isFlashcardModalOpen, closeFlashcardSession, getSessionResults } = useJeeStore();

    const [completionEffect, setCompletionEffect] = useState<{ x: number, y: number, key: number } | null>(null);
    const particleCanvasRef = useRef<HTMLCanvasElement>(null);
    const chapterCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const allMasteryScores = useMasteryScores(userProfile, questionLogs);
    const revisionStackTopics = useRevisionStack(userProfile, questionLogs, reports);

    // ... (Effect for particles unchanged)
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

    // Sync Logic for Flashcards generated here
    useEffect(() => {
        if (!isFlashcardModalOpen) {
            const sessionDeck = getSessionResults();
            if (sessionDeck.length > 0) {
                 // Load current cards from storage
                 const storedCardsStr = localStorage.getItem('errorFlashcards_v1');
                 let allCards: Flashcard[] = storedCardsStr ? JSON.parse(storedCardsStr) : [];
                 
                 // Merge session cards. If they exist, update them. If they are new, add them.
                 sessionDeck.forEach(sessionCard => {
                     const idx = allCards.findIndex(c => c.id === sessionCard.id);
                     if (idx !== -1) {
                         allCards[idx] = sessionCard;
                     } else {
                         allCards.push(sessionCard);
                     }
                 });
                 
                 localStorage.setItem('errorFlashcards_v1', JSON.stringify(allCards));
            }
        }
    }, [isFlashcardModalOpen]);


    // ... (Handlers for syllabus change, explain, quiz, learning path, pre-mortem unchanged)
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
                        const reason = l.reasonForError;
                        if (reason) {
                            const count = acc[reason] || 0;
                            acc[reason] = count + 1;
                        }
                        return acc;
                    }, {} as Record<string, number>);
                    const topReasons = Object.entries(reasons)
                        .sort((a, b) => Number(b[1]) - Number(a[1]))
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


    const handleStartRevision = async () => {
        // Collect relevant topics for revision
        const revisionTopics = revisionStackTopics.map(t => t.name).slice(0, 5);
        
        if (revisionTopics.length === 0) {
            const inProgress = Object.keys(userProfile.syllabus).filter(k => userProfile.syllabus[k]?.status === SyllabusStatus.InProgress);
            if (inProgress.length > 0) {
                revisionTopics.push(...inProgress.slice(0, 3));
            } else {
                alert("Start some chapters or mark weaknesses to generate a revision deck.");
                return;
            }
        }

        setIsGeneratingFlashcards(true);
        try {
            const cards = await generateFlashcards(revisionTopics, apiKey);
            
            // Bridge Logic: Save these cards to persistence immediately so they are available in ErrorVaccinator
            const storedCardsStr = localStorage.getItem('errorFlashcards_v1');
            const allCards: Flashcard[] = storedCardsStr ? JSON.parse(storedCardsStr) : [];
            const newCards = cards.filter(c => !allCards.some(existing => existing.id === c.id));
            
            if (newCards.length > 0) {
                localStorage.setItem('errorFlashcards_v1', JSON.stringify([...allCards, ...newCards]));
            }

            // Start the session locally in the unified modal
            startFlashcardSession(cards); 
            
        } catch (e) {
            console.error(e);
            alert("Failed to generate flashcards. Please try again.");
        } finally {
            setIsGeneratingFlashcards(false);
        }
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
                        onClick={handleStartRevision}
                        disabled={isGeneratingFlashcards}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 text-sm hover:scale-105 transition-transform disabled:opacity-70 disabled:cursor-not-allowed"
                        title="Start AI-Powered Flashcard Revision"
                    >
                        {isGeneratingFlashcards ? (
                            <><span className="animate-spin text-lg">⚡</span> Generating Neural Pathways...</>
                        ) : (
                            <><span>⚡</span> Start Revision</>
                        )}
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
                    <CyberSkillTree userProfile={userProfile} masteryScores={allMasteryScores} onNodeClick={handleNodeClick} />
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

            {/* Pre-Mortem Modal (Fixed Sizing) */}
            <Modal isOpen={!!hurdleData} onClose={() => setHurdleData(null)} title={`🔮 Pre-mortem: ${hurdleData?.topic}`} isInfo={false}>
                <div className="max-w-4xl mx-auto w-full h-[80vh] flex flex-col">
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-1">
                        <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-6">
                            <MarkdownRenderer content={hurdleData?.content || ''} className="text-amber-100" />
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-end shrink-0">
                        <button onClick={() => setHurdleData(null)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">Got it</button>
                    </div>
                </div>
            </Modal>

            {/* Unified Flashcard Modal */}
            <FlashCardModal 
                isOpen={isFlashcardModalOpen} 
                onClose={() => closeFlashcardSession()} 
            />

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
