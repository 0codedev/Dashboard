
import React from 'react';
import { QuizQuestion, SyllabusStatus } from '../../types';

interface GatekeeperQuizProps {
    quizState: { topic: string, questions?: QuizQuestion[], loading: boolean, userAnswers?: Record<number, string>, submitted?: boolean, result?: boolean[] } | null;
    setQuizState: React.Dispatch<React.SetStateAction<any>>;
    onSuccess: () => void;
}

export const GatekeeperQuiz: React.FC<GatekeeperQuizProps> = ({ quizState, setQuizState, onSuccess }) => {

    if (quizState?.loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)]">
                <div className="relative w-16 h-16 mb-6">
                    <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-4 bg-cyan-500/20 rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 tracking-wide">AI Gatekeeper Active</h3>
                <p className="text-cyan-400/80 text-sm animate-pulse">Generating conceptual interrogation...</p>
            </div>
        );
    }

    if (!quizState?.questions) {
        return (
            <div className="text-center p-8 bg-slate-900/80 backdrop-blur-xl border border-red-500/30 rounded-2xl">
                <div className="text-red-400 mb-2">⚠️ Connection Error</div>
                <p className="text-gray-400 text-sm">The Gatekeeper could not be reached. Please try again.</p>
            </div>
        );
    }

    const handleAnswer = (qIndex: number, answerKey: string) => {
        setQuizState((prev: any) => ({
            ...prev,
            userAnswers: {
                ...prev.userAnswers,
                [qIndex]: answerKey
            }
        }));
    };

    const handleSubmit = () => {
        const results = quizState.questions!.map((q, i) => {
            return quizState.userAnswers?.[i] === q.answer;
        });
        const allCorrect = results.every(Boolean);

        setQuizState((prev: any) => ({
            ...prev,
            submitted: true,
            result: results
        }));

        if (allCorrect) {
            setTimeout(() => {
                onSuccess();
            }, 2000);
        }
    };

    const isSubmitted = quizState.submitted;
    const allCorrect = isSubmitted && quizState.result?.every(Boolean);

    return (
        <div className="relative overflow-hidden bg-slate-950/90 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl">
            {/* Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-cyan-500/10 blur-[100px] pointer-events-none"></div>
            
            <div className="relative p-6 sm:p-8 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">Mastery Interrogation</h2>
                    <p className="text-slate-400 text-sm">Prove your conceptual understanding to unlock mastery.</p>
                </div>

                <div className="space-y-8">
                    {quizState.questions.map((q, i) => {
                        const isCorrect = isSubmitted ? quizState.result?.[i] : undefined;
                        const userAnswer = quizState.userAnswers?.[i];

                        return (
                            <div key={i} className={`relative p-6 rounded-xl border backdrop-blur-sm transition-all duration-300 ${
                                isSubmitted 
                                    ? (isCorrect ? 'border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'border-rose-500/30 bg-rose-950/20 shadow-[0_0_30px_rgba(244,63,94,0.05)]') 
                                    : 'border-slate-700/50 bg-slate-900/50 hover:border-slate-600/50'
                            }`}>
                                {/* Question Number Badge */}
                                <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border ${
                                    isSubmitted
                                        ? (isCorrect ? 'bg-emerald-900 border-emerald-500 text-emerald-400' : 'bg-rose-900 border-rose-500 text-rose-400')
                                        : 'bg-slate-800 border-slate-600 text-slate-300'
                                }`}>
                                    {i + 1}
                                </div>

                                <p className="font-medium text-slate-200 mb-6 leading-relaxed ml-2">{q.question}</p>
                                
                                <div className="grid grid-cols-1 gap-3">
                                    {Object.entries(q.options).map(([key, optionText]) => {
                                        const isSelected = userAnswer === key;
                                        const isCorrectAnswer = q.answer === key;
                                        
                                        let buttonClass = "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600";
                                        if (isSubmitted) {
                                            if (isCorrectAnswer) buttonClass = "bg-emerald-900/40 border-emerald-500/50 text-emerald-200";
                                            else if (isSelected) buttonClass = "bg-rose-900/40 border-rose-500/50 text-rose-200";
                                            else buttonClass = "bg-slate-900/30 border-slate-800/50 text-slate-500 opacity-50";
                                        } else if (isSelected) {
                                            buttonClass = "bg-cyan-900/40 border-cyan-500/50 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]";
                                        }

                                        return (
                                        <button
                                            key={key}
                                            onClick={() => !isSubmitted && handleAnswer(i, key)}
                                            disabled={isSubmitted}
                                            className={`w-full text-left p-4 rounded-lg border transition-all duration-200 flex items-start gap-3 ${buttonClass} ${!isSubmitted && 'cursor-pointer active:scale-[0.99]'}`}
                                        >
                                            <span className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                                isSelected && !isSubmitted ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700/50 text-slate-400'
                                            }`}>
                                                {key}
                                            </span>
                                            <span className="leading-tight pt-0.5">{optionText}</span>
                                        </button>
                                        );
                                    })}
                                </div>
                                {isSubmitted && !isCorrect && (
                                    <div className="mt-6 p-4 bg-rose-950/30 rounded-lg border border-rose-500/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-rose-400 font-bold text-sm uppercase tracking-wider">Gatekeeper Analysis</span>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed">{q.explanation}</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="pt-6 border-t border-slate-800/50 mt-8">
                    {!isSubmitted ? (
                        <button 
                            onClick={handleSubmit} 
                            disabled={Object.keys(quizState.userAnswers || {}).length !== quizState.questions.length}
                            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                        >
                            Submit Analysis
                        </button>
                    ) : allCorrect ? (
                        <div className="text-center p-6 bg-emerald-950/30 border border-emerald-500/30 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="font-bold text-emerald-400 text-lg mb-1">Mastery Verified</p>
                            <p className="text-emerald-500/70 text-sm">Access granted. Updating neural pathways...</p>
                        </div>
                    ) : (
                        <div className="text-center p-6 bg-rose-950/30 border border-rose-500/30 rounded-xl">
                            <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="font-bold text-rose-400 text-lg mb-1">Mastery Denied</p>
                            <p className="text-rose-500/70 text-sm mb-4">Conceptual gaps detected. Review the analysis and try again.</p>
                            <button 
                                onClick={() => setQuizState(null)}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                            >
                                Return to Syllabus
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
