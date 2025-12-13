
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
            <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${isProphecyDefied ? 'bg-cyan-600 shadow-cyan-500/50' : 'bg-indigo-900 shadow-indigo-500/50'}`}>
                    {isProphecyDefied ? '✨' : '🔮'}
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                    {isProphecyDefied ? 'Prophecy Defied' : 'Fate Sealed'}
                </h2>
                <p className="text-gray-400 mb-8 max-w-md">
                    {isProphecyDefied 
                        ? "You have successfully overcome your predicted failure points. The Oracle is pleased." 
                        : "The Oracle's prediction was accurate. These topics remain a vulnerability."}
                </p>

                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 mb-8">
                    {score}/{questions.length}
                </div>

                <div className="w-full max-w-2xl text-left space-y-4 mb-8 overflow-y-auto max-h-64 custom-scrollbar pr-2">
                    {questions.map((q, i) => (
                        <div key={i} className={`p-4 rounded-lg border ${answers[i] === q.answer || (i === questions.length - 1 && selectedOption === q.answer) ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                            <div className="text-sm font-bold text-gray-300 mb-1">
                                <span className="text-slate-500 mr-2">Q{i+1}:</span>
                                <MarkdownRenderer content={q.question} baseTextSize="text-sm" baseTextColor="text-gray-300" className="inline-block" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2">Correct: <span className="text-green-400 font-bold">{q.answer}</span> | You: <span className={answers[i] === q.answer ? 'text-green-400' : 'text-red-400'}>{answers[i] || selectedOption}</span></p>
                            <div className="mt-3 text-xs text-slate-300 bg-slate-800/50 p-3 rounded border border-slate-700/50">
                                <strong className="text-amber-400 block mb-1">Explanation:</strong>
                                <MarkdownRenderer content={q.explanation} baseTextSize="text-xs" baseTextColor="text-slate-300" />
                            </div>
                        </div>
                    ))}
                </div>

                <Button onClick={handleFinish} className="px-8 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-full">
                    Close Chamber
                </Button>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto py-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    The Oracle's Trial
                </div>
                <div className="flex gap-1">
                    {questions.map((_, i) => (
                        <div key={i} className={`h-1 w-8 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : i < currentIndex ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                    ))}
                </div>
            </div>

            {/* Question Card */}
            <div className="flex-grow flex flex-col justify-center">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                    <span className="text-6xl text-slate-700 absolute -right-4 -bottom-8 font-black opacity-20 pointer-events-none select-none">
                        0{currentIndex + 1}
                    </span>
                    
                    <div className="mb-8 relative z-10">
                        <MarkdownRenderer 
                            content={currentQuestion.question} 
                            baseTextSize="text-xl md:text-2xl" 
                            baseTextColor="text-white"
                            className="font-medium leading-relaxed"
                        />
                    </div>

                    <div className="grid gap-3 relative z-10">
                        {Object.entries(currentQuestion.options).map(([key, text]) => (
                            <button
                                key={key}
                                onClick={() => handleOptionSelect(key)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-4 group/btn ${
                                    selectedOption === key 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                    : 'bg-slate-900/50 border-slate-700 text-gray-400 hover:bg-slate-800 hover:text-gray-200 hover:border-slate-500'
                                }`}
                            >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                                    selectedOption === key ? 'bg-white text-indigo-600' : 'bg-slate-800 text-gray-500 group-hover/btn:bg-slate-700'
                                }`}>
                                    {key}
                                </span>
                                <span className="font-medium">
                                    <MarkdownRenderer content={text} baseTextSize="text-sm md:text-base" baseTextColor={selectedOption === key ? "text-white" : "text-gray-300"} />
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-end">
                <Button 
                    onClick={handleNext} 
                    disabled={!selectedOption}
                    className={`px-8 py-3 rounded-full font-bold transition-all ${
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
