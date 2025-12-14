
import React, { useState, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { MarkdownRenderer } from './common/MarkdownRenderer';
import { Button } from './common/Button';

interface OracleChamberProps {
    questions: QuizQuestion[];
    onClose: () => void;
    onComplete: (score: number) => void;
}

export const OracleChamber: React.FC<OracleChamberProps> = ({ questions, onClose, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [showResult, setShowResult] = useState(false);
    const [score, setScore] = useState(0);

    const handleOptionSelect = (key: string) => {
        if (showResult) return;
        setSelectedOption(key);
    };

    const handleNext = () => {
        if (selectedOption) {
            setAnswers(prev => ({ ...prev, [currentIndex]: selectedOption }));
            setSelectedOption(null);
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                calculateScore();
            }
        }
    };

    const calculateScore = () => {
        let correctCount = 0;
        // Include the last answer which might not be in state yet if we just clicked Next
        const finalAnswers = { ...answers, [currentIndex]: selectedOption! };
        
        questions.forEach((q, i) => {
            if (finalAnswers[i] === q.answer) correctCount++;
        });
        setScore(correctCount);
        setShowResult(true);
    };

    const handleFinish = () => {
        onComplete(score);
        onClose();
    };

    if (showResult) {
        const percentage = (score / questions.length) * 100;
        const isProphecyDefied = percentage >= 80;

        return (
            <div className="flex flex-col h-full p-4 md:p-8 animate-fade-in relative overflow-hidden">
                {/* Header Section - Compact */}
                <div className="flex items-center justify-between shrink-0 mb-4 border-b border-slate-700/50 pb-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isProphecyDefied ? 'bg-cyan-600 shadow-cyan-500/50' : 'bg-indigo-900 shadow-indigo-500/50'}`}>
                            {isProphecyDefied ? '✨' : '🔮'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">
                                {isProphecyDefied ? 'Prophecy Defied' : 'Fate Sealed'}
                            </h2>
                            <p className="text-xs text-gray-400">
                                {isProphecyDefied ? "Vulnerability patched." : "Patterns persist."}
                            </p>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500">
                            {score}/{questions.length}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Score</div>
                    </div>
                </div>

                {/* Main Content - Expanded Solution View */}
                <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar pr-2 mb-4">
                    <div className="space-y-6">
                        {questions.map((q, i) => (
                            <div key={i} className={`p-5 rounded-xl border ${answers[i] === q.answer || (i === questions.length - 1 && selectedOption === q.answer) ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                                <div className="flex gap-3 mb-3">
                                    <span className="text-slate-500 font-mono text-sm shrink-0 mt-1">Q{i+1}</span>
                                    <div className="flex-grow">
                                        <MarkdownRenderer content={q.question} baseTextSize="text-base" baseTextColor="text-gray-200" />
                                    </div>
                                </div>
                                
                                <div className="flex gap-4 text-xs ml-8 mb-4">
                                    <span className={`px-2 py-1 rounded bg-slate-800 border ${answers[i] === q.answer ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}`}>
                                        You: <strong>{answers[i] || selectedOption}</strong>
                                    </span>
                                    <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-300">
                                        Correct: <strong>{q.answer}</strong>
                                    </span>
                                </div>

                                <div className="ml-8 text-sm text-slate-300 bg-slate-800/80 p-4 rounded-lg border border-slate-700 shadow-inner">
                                    <strong className="text-amber-400 block mb-2 text-xs uppercase tracking-wide">Detailed Analysis</strong>
                                    <MarkdownRenderer content={q.explanation} baseTextSize="text-sm" baseTextColor="text-slate-300" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="shrink-0 flex justify-center pt-2">
                    <Button onClick={handleFinish} className="px-12 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all transform hover:scale-105">
                        Return to Reality
                    </Button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto py-4 px-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="animate-pulse">●</span> The Oracle's Trial
                </div>
                <div className="flex gap-1.5">
                    {questions.map((_, i) => (
                        <div key={i} className={`h-1.5 w-12 rounded-full transition-all duration-500 ${i === currentIndex ? 'bg-white shadow-[0_0_10px_white]' : i < currentIndex ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                    ))}
                </div>
            </div>

            {/* Question Card */}
            <div className="flex-grow flex flex-col justify-center min-h-0">
                <div className="bg-slate-800/50 p-6 md:p-10 rounded-2xl border border-slate-700 shadow-2xl relative overflow-y-auto custom-scrollbar group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
                    <span className="text-[8rem] text-slate-700 absolute -right-6 -bottom-16 font-black opacity-10 pointer-events-none select-none leading-none">
                        {currentIndex + 1}
                    </span>
                    
                    <div className="mb-10 relative z-10">
                        <MarkdownRenderer 
                            content={currentQuestion.question} 
                            baseTextSize="text-xl md:text-2xl" 
                            baseTextColor="text-white"
                            className="font-medium leading-relaxed"
                        />
                    </div>

                    <div className="grid gap-4 relative z-10">
                        {Object.entries(currentQuestion.options).map(([key, text]) => (
                            <button
                                key={key}
                                onClick={() => handleOptionSelect(key)}
                                className={`w-full text-left p-5 rounded-xl border transition-all duration-200 flex items-start gap-4 group/btn ${
                                    selectedOption === key 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                    : 'bg-slate-900/50 border-slate-700 text-gray-400 hover:bg-slate-800 hover:text-gray-200 hover:border-slate-500'
                                }`}
                            >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors shrink-0 ${
                                    selectedOption === key ? 'bg-white text-indigo-600' : 'bg-slate-800 text-gray-500 group-hover/btn:bg-slate-700'
                                }`}>
                                    {key}
                                </span>
                                <span className="font-medium mt-1">
                                    <MarkdownRenderer content={text} baseTextSize="text-base" baseTextColor={selectedOption === key ? "text-white" : "text-gray-300"} />
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end shrink-0">
                <Button 
                    onClick={handleNext} 
                    disabled={!selectedOption}
                    className={`px-10 py-4 rounded-full font-bold transition-all text-sm uppercase tracking-wider ${
                        selectedOption 
                        ? 'bg-white text-black hover:bg-gray-200 hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                        : 'bg-slate-800 text-gray-600 cursor-not-allowed'
                    }`}
                >
                    {currentIndex === questions.length - 1 ? 'Reveal Fate' : 'Next Question'}
                </Button>
            </div>
        </div>
    );
};
