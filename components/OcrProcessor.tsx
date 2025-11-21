
import React, { useState, useCallback } from 'react';
import type { TestReport, SubjectData, QuestionLog } from '../types';
import { QuestionType, TestType, TestSubType, QuestionStatus, DifficultyLevel } from '../types';
import { extractDataFromImage } from '../services/geminiService';
import { exportSingleReportToCsv, exportExtractedQuestionsToCsv } from '../services/sheetParser';

interface OcrProcessorProps {
  onAddData: (data: { report: TestReport; logs: QuestionLog[] }) => void;
  apiKey: string;
}

const initialReportState: Partial<TestReport> = {
  testDate: new Date().toISOString().split('T')[0],
  testName: '',
  type: TestType.ChapterTest,
  subType: TestSubType.JEEAdvanced,
  difficulty: 'Medium',
  topperScore: 0,
  physics: { marks: 0, rank: 0, correct: 0, wrong: 0, unanswered: 0, partial: 0, maxMarks: 60 },
  chemistry: { marks: 0, rank: 0, correct: 0, wrong: 0, unanswered: 0, partial: 0, maxMarks: 60 },
  maths: { marks: 0, rank: 0, correct: 0, wrong: 0, unanswered: 0, partial: 0, maxMarks: 60 },
  total: { marks: 0, rank: 0, correct: 0, wrong: 0, unanswered: 0, partial: 0, maxMarks: 180 },
};

// --- Helper Components ---

const SelectCell: React.FC<{ value: string; onChange: (value: any) => void; options: readonly string[]; }> = ({ value, onChange, options }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-slate-700 p-1 border border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs">
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
);

const SubjectInputGroup: React.FC<{
    subjectName: keyof Omit<TestReport, 'id' | 'testDate' | 'testName' | 'type' | 'subType' | 'physicsMetrics' | 'chemistryMetrics' | 'mathsMetrics' | 'totalMetrics' | 'difficulty' | 'topperScore'>;
    data: SubjectData;
    onChange: (subject: keyof Omit<TestReport, 'id' | 'testDate' | 'testName' | 'type' | 'subType' | 'difficulty' | 'topperScore'>, field: keyof SubjectData, value: number) => void;
    confidence?: 'high' | 'medium' | 'low';
}> = ({ subjectName, data, onChange, confidence }) => {
    const title = subjectName.charAt(0).toUpperCase() + subjectName.slice(1);
    const confidenceClass = (confidence === 'medium' || confidence === 'low') ? 'border-yellow-400' : 'border-gray-700/50';

    return (
        <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-900/50 rounded-lg border transition-all ${confidenceClass}`}>
            <h3 className="col-span-full text-lg font-semibold text-[rgb(var(--color-primary-rgb))] flex justify-between">
                {title}
                {subjectName !== 'total' && (
                    <div className="flex items-center gap-2 text-xs font-normal text-gray-400">
                         Max: 
                         <input 
                            type="number" 
                            value={data.maxMarks || 0} 
                            onChange={(e) => onChange(subjectName, 'maxMarks', parseInt(e.target.value) || 0)}
                            className="w-12 p-1 bg-gray-800 border border-gray-600 rounded text-center text-white"
                         />
                    </div>
                )}
            </h3>
            {Object.keys(data).map((key) => {
                if (key === 'maxMarks') return null; // Handled in header
                return (
                    <div key={key}>
                        <label className="text-sm text-gray-400 capitalize">{key}</label>
                        <input
                            type="number"
                            value={data[key as keyof SubjectData]}
                            onChange={(e) => onChange(subjectName, key as keyof SubjectData, parseInt(e.target.value, 10) || 0)}
                            className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow"
                        />
                    </div>
                );
            })}
        </div>
    );
};


const QuestionLogReviewTable: React.FC<{
    logs: Partial<QuestionLog>[];
    setLogs: React.Dispatch<React.SetStateAction<Partial<QuestionLog>[]>>;
    isManualMode?: boolean;
    onAddRow?: () => void;
}> = ({ logs, setLogs, isManualMode, onAddRow }) => {

    const handleLogChange = (index: number, field: keyof QuestionLog, value: any) => {
        const newLogs = [...logs];
        newLogs[index] = { ...newLogs[index], [field]: value };
        setLogs(newLogs);
    };

    if (logs.length === 0 && !isManualMode) {
        return <p className="text-sm text-gray-500 text-center py-4">No detailed question data was found in the image.</p>;
    }

    return (
        <div>
            <div className="overflow-x-auto max-h-[400px]">
                <table className="min-w-full text-xs">
                    <thead className="bg-slate-700/50 sticky top-0">
                        <tr>
                            <th className="p-2 text-left">Q.No</th>
                            <th className="p-2 text-left">Subject</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-left">Topic</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {logs.map((log, index) => (
                            <tr key={index} className="hover:bg-slate-700/40">
                                <td className="p-1 w-16">
                                     <input
                                        type="number"
                                        value={log.questionNumber || ''}
                                        onChange={e => handleLogChange(index, 'questionNumber', parseInt(e.target.value) || 0)}
                                        className="w-full bg-slate-700 p-1 border border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                    />
                                </td>
                                <td className="p-1 w-32">
                                    <SelectCell value={log.subject || 'physics'} onChange={v => handleLogChange(index, 'subject', v)} options={['physics', 'chemistry', 'maths']} />
                                </td>
                                <td className="p-1 w-40">
                                    <SelectCell value={log.status || ''} onChange={v => handleLogChange(index, 'status', v)} options={Object.values(QuestionStatus)} />
                                </td>
                                <td className="p-1 w-48">
                                    <SelectCell value={log.questionType || ''} onChange={v => handleLogChange(index, 'questionType', v)} options={Object.values(QuestionType)} />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        value={log.topic || ''}
                                        onChange={e => handleLogChange(index, 'topic', e.target.value)}
                                        className="w-full bg-slate-700 p-1 border border-slate-600 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                        placeholder="e.g., Rotational Motion"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {logs.length === 0 && isManualMode && <p className="text-sm text-gray-500 text-center py-4">Click "Add Question" to start building your log.</p>}
            </div>
            {isManualMode && (
                <div className="pt-2 text-center border-t border-slate-700">
                    <button onClick={onAddRow} className="text-sm bg-indigo-600/50 hover:bg-indigo-600 text-white font-semibold py-1 px-3 rounded-full transition-colors mt-2">
                        + Add Question
                    </button>
                </div>
            )}
        </div>
    );
};

const SkeletonLoader = () => (
    <div className="mt-6 space-y-4 animate-pulse">
        <h3 className="h-6 w-1/3 bg-gray-700 rounded"></h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-12 bg-gray-700 rounded-md"></div>
            <div className="h-12 bg-gray-700 rounded-md"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-48 bg-gray-700 rounded-lg"></div>
            <div className="h-48 bg-gray-700 rounded-lg"></div>
            <div className="h-48 bg-gray-700 rounded-lg"></div>
            <div className="h-48 bg-gray-700 rounded-lg"></div>
        </div>
        <div className="h-40 bg-gray-700 rounded-lg"></div>
    </div>
);


export const OcrProcessor: React.FC<OcrProcessorProps> = ({ onAddData, apiKey }) => {
  const [entryMode, setEntryMode] = useState<'ocr' | 'manual' | null>(null);
  const [workflowStep, setWorkflowStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [extractedData, setExtractedData] = useState<Partial<TestReport>>(initialReportState);
  const [extractedConfidence, setExtractedConfidence] = useState<Record<string, 'high'|'medium'|'low'>>({});
  const [extractedLogs, setExtractedLogs] = useState<Partial<QuestionLog>[]>([]);
  
  const handleReset = () => {
      setEntryMode(null);
      setWorkflowStep('upload');
      setImageFile(null);
      setPreviewUrl(null);
      setError(null);
      setExtractedData(initialReportState);
      setExtractedConfidence({});
      setExtractedLogs([]);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setError(null);
    }
  };

  const processImage = useCallback(async () => {
    if (!imageFile) return;
    setWorkflowStep('processing');
    setError(null);
    
    try {
      const { report, questions, confidence } = await extractDataFromImage(imageFile, apiKey);
      setExtractedData(prev => ({...prev, ...report}));
      setExtractedConfidence(confidence);
      setExtractedLogs(questions);
      setWorkflowStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setWorkflowStep('upload'); // Go back to upload step on error
    }
  }, [imageFile, apiKey]);

    const handleInputChange = <K extends keyof Omit<TestReport, 'id'>>(
        key: K,
        value: Omit<TestReport, 'id'>[K]
    ) => {
        setExtractedData(prev => ({...prev, [key]: value}));
    };

    const handleSubjectChange = (
        subject: keyof Omit<TestReport, 'id' | 'testDate' | 'testName' | 'type' | 'subType' | 'difficulty' | 'topperScore'>,
        field: keyof SubjectData,
        value: number
    ) => {
        setExtractedData(prev => ({
            ...prev,
            [subject]: {
                ...(prev[subject] as SubjectData),
                [field]: value
            }
        }));
    };

  const addQuestionLog = () => {
    setExtractedLogs(prev => {
        const nextQuestionNumber = prev.length > 0 ? Math.max(...prev.map(l => l.questionNumber || 0)) + 1 : 1;
        return [
            ...prev,
            { questionNumber: nextQuestionNumber, subject: 'physics', status: QuestionStatus.Unanswered, questionType: QuestionType.SingleCorrect4, topic: 'N/A', marksAwarded: 0 }
        ];
    });
  };

  const handleSave = () => {
    if (!extractedData.testName || extractedData.testName.trim() === '') {
        setError("Test Name is required.");
        return;
    }
    const reportId = `test-${Date.now()}`;
    
    // Ensure total max marks is updated sum of parts
    const totalMax = (extractedData.physics?.maxMarks || 0) + (extractedData.chemistry?.maxMarks || 0) + (extractedData.maths?.maxMarks || 0);
    if(extractedData.total) extractedData.total.maxMarks = totalMax;

    const newReport: TestReport = {
        ...(extractedData as Omit<TestReport, 'id'>),
        id: reportId
    };
    
    const newLogs: QuestionLog[] = extractedLogs.map((log, index) => ({
      testId: reportId,
      subject: log.subject || 'physics',
      questionNumber: log.questionNumber || index + 1,
      questionType: log.questionType || QuestionType.SingleCorrect4, 
      status: log.status || QuestionStatus.Unanswered,
      marksAwarded: log.marksAwarded || 0,
      topic: log.topic || 'N/A',
    }));

    onAddData({ report: newReport, logs: newLogs });
    handleReset();
  };
  
  const handleExportSummary = () => {
      const reportToExport: TestReport = {
        ...(extractedData as Omit<TestReport, 'id'>),
        id: `temp-export-${Date.now()}`
      };
      exportSingleReportToCsv(reportToExport);
  };

  const handleExportQuestions = () => {
    exportExtractedQuestionsToCsv(extractedData, extractedLogs);
  };

  const title = entryMode === 'ocr' ? 'Automated Data Input (OCR)' : entryMode === 'manual' ? 'Manual Data Input' : 'Add New Report';

  return (
    <div className="p-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-2xl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold mb-6 text-[rgb(var(--color-primary-accent-rgb))]">{title}</h2>
        {entryMode && (
            <button onClick={handleReset} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-md">Start Over</button>
        )}
      </div>

      {error && <p className="text-red-400 my-4 bg-red-900/50 p-3 rounded-lg">{error}</p>}
      
      {!entryMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div onClick={() => setEntryMode('ocr')} className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-[rgb(var(--color-primary-rgb))] hover:scale-105 transition-all cursor-pointer text-center">
                <div className="text-5xl mb-4">📸</div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))]">Automated Entry (OCR)</h3>
                <p className="text-gray-400 mt-2">Upload an image of your score sheet and let AI extract the data for you.</p>
            </div>
             <div onClick={() => { setEntryMode('manual'); setWorkflowStep('review'); }} className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-[rgb(var(--color-primary-rgb))] hover:scale-105 transition-all cursor-pointer text-center">
                <div className="text-5xl mb-4">✍️</div>
                <h3 className="text-xl font-bold text-[rgb(var(--color-primary-rgb))]">Manual Entry</h3>
                <p className="text-gray-400 mt-2">Fill out the report form and question log by hand.</p>
            </div>
        </div>
      )}

      {entryMode === 'ocr' && workflowStep === 'upload' && (
        <div className="animate-fade-in">
          <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start">
            <div className='flex-shrink-0'>
              <label htmlFor="file-upload" className="cursor-pointer bg-[rgb(var(--color-primary-hover-rgb))] hover:bg-[rgb(var(--color-primary-dark-rgb))] text-white font-bold py-2 px-4 rounded-lg inline-block transition-transform hover:scale-105">
                {imageFile ? "Change Image" : "Upload Score Sheet"}
              </label>
              <input id="file-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
            </div>
            {previewUrl && (
              <div className="mb-4 border-2 border-dashed border-gray-600 p-2 rounded-lg">
                <img src={previewUrl} alt="Score sheet preview" className="max-w-xs max-h-64 rounded-lg" />
              </div>
            )}
          </div>

          {imageFile && (
            <button
              onClick={processImage}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 ease-in-out shadow-lg hover:shadow-indigo-500/50"
            >
              Step 1: Process Image with AI
            </button>
          )}
        </div>
      )}

      {entryMode === 'ocr' && workflowStep === 'processing' && (
         <div className="animate-fade-in">
             <p className="text-center text-lg text-indigo-300 mb-4">Analyzing image and extracting data... This may take a moment.</p>
             <SkeletonLoader />
         </div>
      )}

      {workflowStep === 'review' && (
        <div className="animate-fade-in mt-6 space-y-6">
            <div>
                <h3 className="text-xl font-semibold border-b border-gray-600 pb-2 text-[rgb(var(--color-primary))]">{entryMode === 'ocr' ? 'Step 2: ' : ''}Review & Correct Summary</h3>
                {entryMode === 'ocr' && <p className="text-sm text-gray-400 mt-2">AI has extracted the following summary. Fields highlighted in yellow had lower confidence and may need your attention.</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <div>
                    <label className="text-sm text-gray-400">Test Name</label>
                    <input
                        type="text"
                        value={extractedData.testName}
                        onChange={(e) => handleInputChange('testName', e.target.value)}
                        className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-400">Test Date</label>
                    <input
                        type="date"
                        value={extractedData.testDate}
                        onChange={(e) => handleInputChange('testDate', e.target.value)}
                        className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow"
                    />
                </div>
                <div>
                    <label className="text-sm text-gray-400">Test Type</label>
                    <select value={extractedData.type} onChange={(e) => handleInputChange('type', e.target.value as TestType)} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow">
                        {Object.values(TestType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="text-sm text-gray-400">Sub-Type</label>
                    <select value={extractedData.subType} onChange={(e) => handleInputChange('subType', e.target.value as TestSubType)} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow">
                         {Object.values(TestSubType).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Difficulty</label>
                    <select value={extractedData.difficulty} onChange={(e) => handleInputChange('difficulty', e.target.value as DifficultyLevel)} className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow">
                         <option value="Easy">Easy</option>
                         <option value="Medium">Medium</option>
                         <option value="Hard">Hard</option>
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Topper Score (Optional)</label>
                     <input
                        type="number"
                        value={extractedData.topperScore || ''}
                        placeholder="e.g. 160"
                        onChange={(e) => handleInputChange('topperScore', parseInt(e.target.value) || 0)}
                        className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-[rgb(var(--color-primary-rgb))] focus:outline-none transition-shadow"
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SubjectInputGroup subjectName="physics" data={extractedData.physics!} onChange={handleSubjectChange} confidence={extractedConfidence.physics} />
                <SubjectInputGroup subjectName="chemistry" data={extractedData.chemistry!} onChange={handleSubjectChange} confidence={extractedConfidence.chemistry}/>
                <SubjectInputGroup subjectName="maths" data={extractedData.maths!} onChange={handleSubjectChange} confidence={extractedConfidence.maths}/>
                <SubjectInputGroup subjectName="total" data={extractedData.total!} onChange={handleSubjectChange} confidence={extractedConfidence.total}/>
            </div>
            
            <div>
                 <h3 className="text-xl font-semibold border-b border-gray-600 pb-2 text-[rgb(var(--color-primary))]">{entryMode === 'ocr' ? 'Step 3: ' : ''}Review & Correct Question Details</h3>
                 <p className="text-sm text-gray-400 mt-2">Correct any errors in the question-by-question data below before saving.</p>
                 <div className="mt-4 bg-gray-900/50 rounded-lg border border-gray-700/50">
                    <QuestionLogReviewTable logs={extractedLogs} setLogs={setExtractedLogs} isManualMode={entryMode === 'manual'} onAddRow={addQuestionLog}/>
                 </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 pt-6 border-t border-gray-700">
                <details className="w-full sm:w-auto">
                    <summary className="text-sm text-gray-400 cursor-pointer hover:text-white">Export Options</summary>
                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                         <button onClick={handleExportSummary} className="bg-green-600/50 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Export Summary CSV</button>
                         <button onClick={handleExportQuestions} className="bg-teal-600/50 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg text-sm">Export Questions CSV</button>
                    </div>
                </details>

                <button
                    onClick={handleSave}
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 ease-in-out shadow-lg hover:shadow-green-500/50"
                >
                    Finalize & Save Report
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
