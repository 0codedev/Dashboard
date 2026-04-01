import React, { useState, useRef } from 'react';
import { Info, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useJeeStore } from '../store/useJeeStore';
import { QuestionLog, QuestionStatus, TestReport, SubjectData, TestType, TestSubType } from '../types';

const GUIDE_CONTENT = `
### 🕵️‍♂️ The ExamGOAL "Hacker" Guide: Extracting Test Data

**Phase 1: Open the Trap**
1. Log in to ExamGOAL on your laptop (Chrome or Edge).
2. Go to the **Result / Analysis Page** of the test you just finished.
3. Press **\`F12\`** on your keyboard (This opens the Developer Tools panel on the right).
4. At the top of that new panel, click the **Network** tab.
5. Just below that, click the filter button that says **\`Fetch/XHR\`** (This hides all the images and only shows the pure database files).

**Phase 2: Catch the Data**
1. With the Network panel open, press **\`F5\`** to refresh the page. 
2. Watch the list fill up with files. You are looking for exactly two files.

**Phase 3: Download Target 1 (The Question Database)**
1. Look at the "Name" column in the list. Find the file that starts with the word **\`batch\`** (e.g., \`batch?user_stats=true...\`).
2. **Right-click** on that file name.
3. Hover over **Copy**, then click **Copy Response**. (This copies the raw, hidden code to your clipboard).
4. Open the **Notepad** app on your computer.
5. Press **\`Ctrl + V\`** to paste the code.
6. Click **File -> Save As**, name it **\`batch.json\`**, and save it to your Desktop.

**Phase 4: Download Target 2 (Your Personal Test Data)**
1. Go back to the Network list. Look for a file name that is a long, random string of numbers and letters (e.g., \`72957d76-217f...\` or \`f3047962...\`). *Note: It is usually near the top of the list.*
2. **Right-click** on that random string file name.
3. Hover over **Copy**, then click **Copy Response**.
4. Open a *new* empty **Notepad** window.
5. Press **\`Ctrl + V\`** to paste it.
6. Click **File -> Save As**, name it **\`attempt.json\`**, and save it to your Desktop.

**Phase 5: The Magic Import**
1. Open your JEE Dashboard.
2. Go to the "ExamGoal Importer."
3. Upload \`batch.json\` and \`attempt.json\`.
4. Click **Import Data** and watch all 75 questions, times, and topics instantly populate!
`;

interface ExamGoalJsonImporterProps {
    onImportedData: (data: { report: TestReport; logs: QuestionLog[] }) => void;
}

export const ExamGoalJsonImporter: React.FC<ExamGoalJsonImporterProps> = ({ onImportedData }) => {
    const [attemptFile, setAttemptFile] = useState<File | null>(null);
    const [batchFile, setBatchFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showGuide, setShowGuide] = useState(false);

    const attemptInputRef = useRef<HTMLInputElement>(null);
    const batchInputRef = useRef<HTMLInputElement>(null);

    const formatString = (str: string) => {
        if (!str || str === 'Unknown') return '';
        return str
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const handleImport = async () => {
        if (!attemptFile || !batchFile) {
            setError("Please select both attempt.json and batch.json files.");
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            const attemptData = await readFileAsJson(attemptFile);
            const batchData = await readFileAsJson(batchFile);

            if (!attemptData?.data?.userState || !batchData?.results) {
                throw new Error("Invalid file format. Please ensure you uploaded the correct attempt and batch JSON files.");
            }

            const userState = attemptData.data.userState;
            const results = batchData.results;
            
            const testId = attemptData.data.testId || `examgoal-${Date.now()}`;
            const testTitle = attemptData.data.title || "ExamGoal Imported Test";
            const testDate = attemptData.data.time || new Date().toISOString();

            // Detect Type and SubType
            let type: TestType = TestType.ChapterTest;
            let subType: TestSubType = TestSubType.JEEAdvanced;

            const lowerTitle = testTitle.toLowerCase();
            if (lowerTitle.includes('mains') || lowerTitle.includes('main')) {
                subType = TestSubType.JEEMains;
            } else if (lowerTitle.includes('advanced')) {
                subType = TestSubType.JEEAdvanced;
            }

            if (lowerTitle.includes('full syllabus') || lowerTitle.includes('mock')) {
                type = TestType.FullSyllabusMock;
            } else if (lowerTitle.includes('pyq') || lowerTitle.includes('previous year')) {
                type = TestType.PreviousYearPaper;
            }

            const logs: QuestionLog[] = [];
            
            let physicsCorrect = 0, physicsWrong = 0, physicsUnanswered = 0, physicsMarks = 0;
            let chemistryCorrect = 0, chemistryWrong = 0, chemistryUnanswered = 0, chemistryMarks = 0;
            let mathsCorrect = 0, mathsWrong = 0, mathsUnanswered = 0, mathsMarks = 0;

            Object.keys(userState).forEach(questionId => {
                const stateData = userState[questionId];
                const batchQuestion = results.find((r: any) => r.question_id === questionId);

                if (batchQuestion) {
                    let status = QuestionStatus.Unanswered;
                    if (stateData.state === "attempted") {
                        status = stateData.isRight ? QuestionStatus.FullyCorrect : QuestionStatus.Wrong;
                    }

                    const timeSpentSeconds = Math.round((stateData.timeSpent || 0) / 1000);
                    let subjectRaw = (batchQuestion.subject || "").toLowerCase();
                    let subject: "physics" | "chemistry" | "maths" = "physics";
                    
                    if (subjectRaw.includes('physic')) {
                        subject = 'physics';
                    } else if (subjectRaw.includes('chemist')) {
                        subject = 'chemistry';
                    } else if (subjectRaw.includes('math') || subjectRaw.includes('mathematic')) {
                        subject = 'maths';
                    } else {
                        // Fallback: try to infer from chapter or topic if subject is missing/unrecognized
                        const combined = (batchQuestion.chapter + " " + batchQuestion.topic).toLowerCase();
                        if (combined.includes('physic')) subject = 'physics';
                        else if (combined.includes('chemist')) subject = 'chemistry';
                        else if (combined.includes('math') || combined.includes('mathematic')) subject = 'maths';
                    }
                    
                    const positiveMarks = batchQuestion.marks || 4;
                    const negativeMarks = batchQuestion.negMarks || 1;
                    
                    let marksAwarded = 0;
                    if (status === QuestionStatus.FullyCorrect) {
                        marksAwarded = positiveMarks;
                    } else if (status === QuestionStatus.Wrong) {
                        marksAwarded = -negativeMarks;
                    }

                    // Extract rich data
                    const enQuestion = batchQuestion.question?.en || {};
                    const difficultyRaw = batchQuestion.difficulty || 'medium';
                    const difficulty = (difficultyRaw.charAt(0).toUpperCase() + difficultyRaw.slice(1)) as any;
                    
                    const peerStats = batchQuestion.user_stats || {};
                    const peerTimeSpentSeconds = peerStats.timeSpent ? Math.round(peerStats.timeSpent / 1000) : undefined;
                    
                    let answeredStr = undefined;
                    if (stateData.selectedIndex && stateData.selectedIndex.length > 0) {
                        answeredStr = stateData.selectedIndex.join(', ');
                    } else if (stateData.input !== undefined && stateData.input !== null) {
                        answeredStr = String(stateData.input);
                    }

                    let questionType = batchQuestion.type || "Unknown";
                    const lowerType = questionType.toLowerCase();
                    if (lowerType === 'mcq') {
                        questionType = "Single Correct (+4, -1)";
                    } else if (lowerType === 'integer') {
                        questionType = "Integer (+4, -1)";
                    }

                    // Fix question numbering: ensure it's 1-based and correctly extracted
                    let qNum = 0;
                    if (stateData.position !== undefined) {
                        qNum = Number(stateData.position) + 1;
                    } else if (batchQuestion.position !== undefined) {
                        qNum = Number(batchQuestion.position) + 1;
                    } else {
                        // Fallback to index if no position found
                        qNum = logs.length + 1;
                    }

                    logs.push({
                        testId,
                        subject,
                        questionNumber: qNum,
                        questionType,
                        status,
                        marksAwarded,
                        chapter: formatString(batchQuestion.chapter || ""),
                        topic: formatString(batchQuestion.topic || ""),
                        timeSpent: timeSpentSeconds,
                        positiveMarks,
                        negativeMarks,
                        reasonForError: status === QuestionStatus.Wrong ? "Unknown" : undefined,
                        answered: answeredStr,
                        
                        // Rich Data
                        questionHtml: enQuestion.content,
                        explanationHtml: enQuestion.explanation,
                        optionsHtml: enQuestion.options,
                        correctOptions: enQuestion.correct_options,
                        difficulty: difficulty,
                        peerCorrectPercent: peerStats.correct,
                        peerWrongPercent: peerStats.wrong,
                        peerTimeSpent: peerTimeSpentSeconds,
                        optionsDistribution: peerStats.options
                    });
                    
                    // Update subject stats
                    if (subject === 'physics') {
                        if (status === QuestionStatus.FullyCorrect) physicsCorrect++;
                        else if (status === QuestionStatus.Wrong) physicsWrong++;
                        else physicsUnanswered++;
                        physicsMarks += marksAwarded;
                    } else if (subject === 'chemistry') {
                        if (status === QuestionStatus.FullyCorrect) chemistryCorrect++;
                        else if (status === QuestionStatus.Wrong) chemistryWrong++;
                        else chemistryUnanswered++;
                        chemistryMarks += marksAwarded;
                    } else if (subject === 'maths') {
                        if (status === QuestionStatus.FullyCorrect) mathsCorrect++;
                        else if (status === QuestionStatus.Wrong) mathsWrong++;
                        else mathsUnanswered++;
                        mathsMarks += marksAwarded;
                    }
                }
            });

            const createSubjectData = (marks: number, correct: number, wrong: number, unanswered: number): SubjectData => ({
                marks,
                correct,
                wrong,
                unanswered,
                rank: 0,
                partial: 0
            });

            logs.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));

            const report: TestReport = {
                id: testId,
                testDate,
                testName: testTitle,
                type,
                subType,
                physics: createSubjectData(physicsMarks, physicsCorrect, physicsWrong, physicsUnanswered),
                chemistry: createSubjectData(chemistryMarks, chemistryCorrect, chemistryWrong, chemistryUnanswered),
                maths: createSubjectData(mathsMarks, mathsCorrect, mathsWrong, mathsUnanswered),
                total: createSubjectData(
                    physicsMarks + chemistryMarks + mathsMarks,
                    physicsCorrect + chemistryCorrect + mathsCorrect,
                    physicsWrong + chemistryWrong + mathsWrong,
                    physicsUnanswered + chemistryUnanswered + mathsUnanswered
                )
            };

            onImportedData({ report, logs });
            
            // Reset
            setAttemptFile(null);
            setBatchFile(null);
            if (attemptInputRef.current) attemptInputRef.current.value = '';
            if (batchInputRef.current) batchInputRef.current.value = '';

        } catch (err: any) {
            setError(err.message || "An error occurred during import.");
        } finally {
            setIsImporting(false);
        }
    };

    const readFileAsJson = (file: File): Promise<any> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target?.result as string);
                    resolve(json);
                } catch (err) {
                    reject(new Error(`Failed to parse ${file.name} as JSON.`));
                }
            };
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
            reader.readAsText(file);
        });
    };

    return (
        <div className="p-6 glass-panel rounded-2xl border border-cyan-500/20 bg-slate-900/50 mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-2xl">📥</span> ExamGoal JSON Importer
                </h2>
                <button 
                    onClick={() => setShowGuide(true)}
                    className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-full transition-colors"
                    title="How to get these files?"
                >
                    <Info size={20} />
                </button>
            </div>
            
            <AnimatePresence>
                {showGuide && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                                <h3 className="font-bold text-white flex items-center gap-2">
                                    <Info size={18} className="text-cyan-400" />
                                    Extraction Guide
                                </h3>
                                <button 
                                    onClick={() => setShowGuide(false)}
                                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto prose prose-invert prose-cyan max-w-none">
                                <ReactMarkdown>{GUIDE_CONTENT}</ReactMarkdown>
                            </div>
                            <div className="p-4 border-t border-white/10 bg-slate-800/50 flex justify-end">
                                <button 
                                    onClick={() => setShowGuide(false)}
                                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all"
                                >
                                    Got it!
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <p className="text-sm text-gray-400 mb-6">
                Upload your <code className="text-cyan-400 bg-cyan-400/10 px-1 rounded">attempt.json</code> and <code className="text-cyan-400 bg-cyan-400/10 px-1 rounded">batch.json</code> files exported from ExamGoal to automatically import your test performance and question logs.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Attempt JSON</label>
                    <input
                        type="file"
                        accept=".json"
                        ref={attemptInputRef}
                        onChange={(e) => setAttemptFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-400
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-cyan-500/10 file:text-cyan-400
                            hover:file:bg-cyan-500/20
                            cursor-pointer border border-white/10 rounded-lg p-2 bg-black/20"
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Batch JSON</label>
                    <input
                        type="file"
                        accept=".json"
                        ref={batchInputRef}
                        onChange={(e) => setBatchFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-400
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-cyan-500/10 file:text-cyan-400
                            hover:file:bg-cyan-500/20
                            cursor-pointer border border-white/10 rounded-lg p-2 bg-black/20"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
                    {success}
                </div>
            )}

            <button
                onClick={handleImport}
                disabled={isImporting || !attemptFile || !batchFile}
                className={`w-full py-3 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2
                    ${isImporting || !attemptFile || !batchFile 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/50'}`}
            >
                {isImporting ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Importing Data...
                    </>
                ) : (
                    <>
                        <span>🚀</span> Import Data
                    </>
                )}
            </button>
        </div>
    );
};
