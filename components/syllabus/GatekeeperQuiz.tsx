
import React from 'react';
import { QuizQuestion, SyllabusStatus } from '../../types';

interface GatekeeperQuizProps {
    quizState: { topic: string, questions?: QuizQuestion[], loading: boolean, userAnswers?: Record<number, string>, submitted?: boolean, result?: boolean[] } | null;
    setQuizState: React.Dispatch<React.SetStateAction<any>>;
    onSuccess: () => void;
}

export const GatekeeperQuiz: React.FC<GatekeeperQuizProps> = ({ quizState, setQuizState, onSuccess }) => {

    if (quizState?.loading) {
        return <div className="text-center p-8">
            <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-300">Generating conceptual questions...</p>
        </div>;
    }

    if (!quizState?.questions) {
        return <div className="text-center p-8 text-red-400">Could not load quiz questions. Please try again.</div>;
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
        <div className="p-4 space-y-6">
            {quizState.questions.map((q, i) => {
                const isCorrect = isSubmitted ? quizState.result?.[i] : undefined;
                const userAnswer = quizState.userAnswers?.[i];

                return (
                    <div key={i} className={`p-4 rounded-lg border ${isSubmitted ? (isCorrect ? 'border-green-500/50 bg-green-900/20' : 'border-red-500/50 bg-red-900/20') : 'border-slate-700 bg-slate-800/50'}`}>
                        <p className="font-semibold text-gray-200 mb-4">{i + 1}. {q.question}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {Object.entries(q.options).map(([key, optionText]) => {
                                const isSelected = userAnswer === key;
                                const isCorrectAnswer = q.answer === key;
                                
                                let buttonClass = "bg-slate-700 hover:bg-slate-600";
                                if (isSubmitted) {
                                    if (isCorrectAnswer) buttonClass = "bg-green-600 text-white";
                                    else if (isSelected) buttonClass = "bg-red-600 text-white";
                                } else if (isSelected) {
                                    buttonClass = "bg-cyan-600 text-white";
                                }

                                return (
                                <button
                                    key={key}
                                    onClick={() => !isSubmitted && handleAnswer(i, key)}
                                    className={`w-full text-left p-3 rounded-md text-sm transition-colors ${buttonClass}`}
                                >
                                    <span className="font-bold mr-2">{key}.</span> {optionText}
                                </button>
                                );
                            })}
                        </div>
                        {isSubmitted && !isCorrect && (
                            <div className="mt-3 p-3 bg-slate-900/50 rounded-md border border-slate-700 text-xs">
                                <p className="text-amber-300 font-bold">Explanation:</p>
                                <p className="text-gray-300">{q.explanation}</p>
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="flex justify-between items-center mt-6">
                 <button onClick={onSuccess} className="text-sm text-gray-400 hover:text-white hover:bg-slate-700 px-4 py-2 rounded-md">
                    Complete Anyway
                </button>
                {!isSubmitted ? (
                    <button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-6 rounded-lg">Submit Answers</button>
                ) : allCorrect ? (
                    <div className="text-center p-3 bg-green-900/30 rounded-lg text-green-300">
                        <p className="font-bold">Perfect! Mastery confirmed.</p>
                        <p className="text-sm">Updating syllabus status...</p>
                    </div>
                ) : (
                    <div className="text-center p-3 bg-red-900/30 rounded-lg text-red-300">
                        <p className="font-bold">Not quite there yet.</p>
                        <p className="text-sm">Review the explanations above and try again later.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
