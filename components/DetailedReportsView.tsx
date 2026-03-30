import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './common/MarkdownRenderer';
import type { TestReport, SubjectData, QuestionLog } from '../types';
import { exportReportsToCsv } from '../services/sheetParser';
import { generateTestAnalysis, generateAudioDebrief } from '../services/geminiService';
import { SUBJECT_COLORS } from '../constants';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ComposedChart, Area, AreaChart, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface DetailedReportsViewProps {
    allReports: TestReport[];
    filteredReports: TestReport[];
    setReports: React.Dispatch<React.SetStateAction<TestReport[]>>;
    onViewQuestionLog: (testId: string) => void;
    onDeleteReport: (testId: string) => void;
    apiKey: string;
    logs: QuestionLog[];
}

type SortKey =
  | 'testName'
  | 'testDate'
  | 'total.marks'
  | 'total.rank'
  | 'totalMetrics.accuracy';

type SortDirection = 'ascending' | 'descending';

// --- Helper Functions ---

const calculateFocusMetrics = (data: SubjectData, testType?: string) => {
    const totalQuestions = data.correct + data.wrong + data.unanswered + data.partial;
    if (totalQuestions === 0) return { accuracy: 0, attemptRate: 0, cwRatio: 0, spaq: 0, unattempted: 0, negative: 0, scorePotential: 0 };

    const attempted = data.correct + data.wrong + data.partial;
    const accuracy = (data.correct + data.wrong) > 0 ? (data.correct / (data.correct + data.wrong)) * 100 : 0;
    const attemptRate = (attempted / totalQuestions) * 100;
    const cwRatio = data.wrong > 0 ? data.correct / data.wrong : data.correct > 0 ? Infinity : 0;
    const spaq = attempted > 0 ? data.marks / attempted : 0;
    const unattempted = (data.unanswered / totalQuestions) * 100;
    
    // Dynamic marking scheme based on test type
    const isAdvanced = testType?.toLowerCase().includes('advanced');
    const posMark = isAdvanced ? 3.5 : 4; // Average for Advanced
    const negMark = 1;
    
    const potentialPositive = data.correct * posMark;
    const negative = potentialPositive > 0 ? (data.wrong * negMark) / potentialPositive : 0;
    const scorePotential = potentialPositive > 0 ? (data.marks / potentialPositive) * 100 : 0;
    
    return { accuracy, attemptRate, cwRatio, spaq, unattempted, negative, scorePotential };
};

// --- Child Components ---

const DeleteConfirmationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-2xl w-11/12 max-w-md border border-slate-700 animate-scale-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-red-400 mb-2">Delete Report?</h3>
                <p className="text-gray-300 mb-6 text-sm">Are you sure you want to delete this test report? This action cannot be undone and will remove all associated data.</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md text-sm transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-bold transition-colors shadow-lg shadow-red-900/20">Delete Permanently</button>
                </div>
            </div>
        </div>
    );
};

// Updated Comparison Row to handle N values
const ComparisonRow: React.FC<{ label: string; values: (number | string)[]; suffix?: string }> = ({ label, values, suffix = '' }) => {
    return (
        <tr className="border-b border-slate-700">
            <td className="p-3 font-semibold text-gray-300 sticky left-0 bg-slate-800 z-10">{label}</td>
            {values.map((val, idx) => (
                <td key={idx} className="p-3 text-center min-w-[120px]">{val}{suffix}</td>
            ))}
        </tr>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 border border-slate-700 p-4 rounded-xl shadow-2xl backdrop-blur-md min-w-[200px]">
                {label && (
                    <p className="text-sm font-bold text-cyan-400 mb-3 border-b border-slate-700/50 pb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {label}
                    </p>
                )}
                <div className="space-y-2.5">
                    {payload.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-6 group">
                            <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: item.color || item.fill || item.payload?.fill }}></div>
                                <span className="text-xs text-gray-300 font-medium">{item.name}</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">
                                {typeof item.value === 'number' ? item.value.toFixed(item.name.includes('%') || item.name.includes('Accuracy') || item.name.includes('Rate') ? 1 : 0) : item.value}
                                {item.name.includes('%') || item.name.includes('Accuracy') || item.name.includes('Rate') ? '%' : ''}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const ComparisonModal: React.FC<{ reports: TestReport[] | null, onClose: () => void, isOpen: boolean }> = ({ reports, onClose, isOpen }) => {
    const [viewMode, setViewMode] = useState<'table' | 'visual'>('visual');

    if (!isOpen || !reports || reports.length === 0) return null;
    
    // Sort reports by date to show progression left-to-right
    const sortedReports = [...reports].sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());

    const chartData = sortedReports.map(r => {
        const totalQ = (r.physics.correct+r.physics.wrong+r.physics.unanswered+r.physics.partial) + 
                       (r.chemistry.correct+r.chemistry.wrong+r.chemistry.unanswered+r.chemistry.partial) + 
                       (r.maths.correct+r.maths.wrong+r.maths.unanswered+r.maths.partial);
        const attempted = (r.physics.correct+r.physics.wrong+r.physics.partial) + 
                          (r.chemistry.correct+r.chemistry.wrong+r.chemistry.partial) + 
                          (r.maths.correct+r.maths.wrong+r.maths.partial);
        
        return {
            name: r.testName,
            date: new Date(r.testDate).toLocaleDateString(),
            Total: r.total.marks,
            Physics: r.physics.marks,
            Chemistry: r.chemistry.marks,
            Maths: r.maths.marks,
            Rank: r.total.rank,
            Accuracy: r.totalMetrics?.accuracy || 0,
            AttemptRate: totalQ > 0 ? (attempted / totalQ) * 100 : 0
        };
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-2xl w-11/12 max-w-6xl border border-slate-700 animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-cyan-300">Multi-Test Comparison</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>

                {/* View Toggle */}
                <div className="flex bg-slate-900 p-1 rounded-lg mb-4 w-max border border-slate-700">
                    <button 
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'visual' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`} 
                        onClick={() => setViewMode('visual')}
                    >
                        Visual Charts
                    </button>
                    <button 
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-300'}`} 
                        onClick={() => setViewMode('table')}
                    >
                        Data Table
                    </button>
                </div>
                
                <div className="overflow-auto flex-grow custom-scrollbar flex flex-col gap-6">
                    {viewMode === 'visual' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Score Trend */}
                            <div className="h-72 w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700 flex flex-col lg:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-400 mb-2 shrink-0">Overall Score Trend</h3>
                                <div className="flex-grow min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val} />
                                            <YAxis stroke="#94a3b8" fontSize={12} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Area type="monotone" dataKey="Total" stroke="#818cf8" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Subject Breakdown */}
                            <div className="h-72 w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700 flex flex-col">
                                <h3 className="text-sm font-semibold text-gray-400 mb-2 shrink-0">Subject Contribution (Marks)</h3>
                                <div className="flex-grow min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val} />
                                            <YAxis stroke="#94a3b8" fontSize={12} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Bar dataKey="Physics" stackId="a" fill={SUBJECT_COLORS.physics} />
                                            <Bar dataKey="Chemistry" stackId="a" fill={SUBJECT_COLORS.chemistry} />
                                            <Bar dataKey="Maths" stackId="a" fill={SUBJECT_COLORS.maths} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Accuracy vs Attempt Rate */}
                            <div className="h-72 w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700 flex flex-col">
                                <h3 className="text-sm font-semibold text-gray-400 mb-2 shrink-0">Accuracy vs Attempt Rate (%)</h3>
                                <div className="flex-grow min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val} />
                                            <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                                            <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Bar yAxisId="left" dataKey="AttemptRate" name="Attempt Rate" fill="#475569" barSize={20} />
                                            <Line yAxisId="right" type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Rank Trend */}
                            <div className="h-72 w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700 flex flex-col lg:col-span-2">
                                <h3 className="text-sm font-semibold text-gray-400 mb-2 shrink-0">Rank Progression (Lower is Better)</h3>
                                <div className="flex-grow min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val} />
                                            <YAxis stroke="#94a3b8" fontSize={12} reversed={true} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                                            <Line type="monotone" dataKey="Rank" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <table className="min-w-full bg-slate-800 rounded-lg text-sm border-collapse">
                            <thead className="bg-slate-700/50 sticky top-0 z-20">
                                <tr>
                                    <th className="p-3 text-left sticky left-0 bg-slate-700 z-30 shadow-lg">Metric</th>
                                    {sortedReports.map(r => (
                                        <th key={r.id} className="p-3 text-center min-w-[120px] whitespace-nowrap">
                                            <div className="font-bold text-white">{r.testName}</div>
                                            <div className="text-xs text-gray-400 font-normal">{new Date(r.testDate).toLocaleDateString()}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <ComparisonRow label="Total Marks" values={sortedReports.map(r => r.total.marks)} />
                                <ComparisonRow label="Total Rank" values={sortedReports.map(r => r.total.rank)} />
                                <ComparisonRow label="Accuracy" values={sortedReports.map(r => r.totalMetrics?.accuracy.toFixed(1) ?? 'N/A')} suffix="%" />
                                
                                <tr className="bg-slate-700/30"><td colSpan={sortedReports.length + 1} className="p-2 text-xs font-bold text-cyan-400 uppercase tracking-wider sticky left-0 bg-slate-700/30">Physics</td></tr>
                                <ComparisonRow label="Marks" values={sortedReports.map(r => r.physics.marks)} />
                                <ComparisonRow label="Correct" values={sortedReports.map(r => r.physics.correct)} />
                                <ComparisonRow label="Wrong" values={sortedReports.map(r => r.physics.wrong)} />

                                <tr className="bg-slate-700/30"><td colSpan={sortedReports.length + 1} className="p-2 text-xs font-bold text-emerald-400 uppercase tracking-wider sticky left-0 bg-slate-700/30">Chemistry</td></tr>
                                <ComparisonRow label="Marks" values={sortedReports.map(r => r.chemistry.marks)} />
                                <ComparisonRow label="Correct" values={sortedReports.map(r => r.chemistry.correct)} />
                                <ComparisonRow label="Wrong" values={sortedReports.map(r => r.chemistry.wrong)} />

                                <tr className="bg-slate-700/30"><td colSpan={sortedReports.length + 1} className="p-2 text-xs font-bold text-red-400 uppercase tracking-wider sticky left-0 bg-slate-700/30">Maths</td></tr>
                                <ComparisonRow label="Marks" values={sortedReports.map(r => r.maths.marks)} />
                                <ComparisonRow label="Correct" values={sortedReports.map(r => r.maths.correct)} />
                                <ComparisonRow label="Wrong" values={sortedReports.map(r => r.maths.wrong)} />
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

const FocusModeModal: React.FC<{ 
    report: TestReport | null; 
    allReports: TestReport[];
    setReports: React.Dispatch<React.SetStateAction<TestReport[]>>;
    onClose: () => void;
    apiKey: string;
    logs: QuestionLog[];
}> = ({ report: reportProp, allReports, setReports, onClose, apiKey, logs }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [originalReport, setOriginalReport] = useState<TestReport | null>(null);
    const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [isWhatIfMode, setIsWhatIfMode] = useState(false);
    const [whatIfChanges, setWhatIfChanges] = useState({ physics: 0, chemistry: 0, maths: 0 });
    const modalRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'visual'>('table');

    // This finds the most up-to-date version of the report from the main state
    const baseReport = useMemo(() => allReports.find(r => r.id === reportProp?.id), [allReports, reportProp]);

    const timeSinks = useMemo(() => {
        if (!reportProp || !logs) return [];
        const testLogs = logs.filter(log => log.testId === reportProp.id && typeof log.timeSpent === 'number');
        const sortedLogs = [...testLogs].sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0));
        return sortedLogs.filter(log => (log.timeSpent || 0) > 120).slice(0, 6);
    }, [reportProp, logs]);

    const report = useMemo(() => {
        if (!baseReport) return null;
        if (!isWhatIfMode) return baseReport;

        const isAdvanced = baseReport.type?.toLowerCase().includes('advanced');
        const posMark = isAdvanced ? 3.5 : 4;
        const negMark = 1;
        const netGainPerQuestion = posMark + negMark;

        const newReport = JSON.parse(JSON.stringify(baseReport)) as TestReport;
        const subjects: ('physics' | 'chemistry' | 'maths')[] = ['physics', 'chemistry', 'maths'];
        
        subjects.forEach(sub => {
            const changes = whatIfChanges[sub];
            newReport[sub].correct += changes;
            newReport[sub].wrong -= changes;
            newReport[sub].marks += changes * netGainPerQuestion;
        });

        newReport.total.marks = newReport.physics.marks + newReport.chemistry.marks + newReport.maths.marks;
        newReport.total.correct = newReport.physics.correct + newReport.chemistry.correct + newReport.maths.correct;
        newReport.total.wrong = newReport.physics.wrong + newReport.chemistry.wrong + newReport.maths.wrong;
        
        // Very rough rank estimation: 10 marks = ~1000 rank improvement (just for simulation feel)
        const totalMarksGained = newReport.total.marks - baseReport.total.marks;
        newReport.total.rank = Math.max(1, baseReport.total.rank - (totalMarksGained * 100));

        return newReport;
    }, [baseReport, isWhatIfMode, whatIfChanges]);

    // Chart data for both visual view and PDF export
    const marksData = useMemo(() => report ? [
        { subject: 'Physics', marks: report.physics.marks, fill: SUBJECT_COLORS.physics },
        { subject: 'Chemistry', marks: report.chemistry.marks, fill: SUBJECT_COLORS.chemistry },
        { subject: 'Maths', marks: report.maths.marks, fill: SUBJECT_COLORS.maths }
    ] : [], [report]);

    const questionDistData = useMemo(() => report ? [
        { name: 'Correct', value: report.total.correct, fill: '#10b981' },
        { name: 'Wrong', value: report.total.wrong, fill: '#ef4444' },
        { name: 'Unanswered', value: report.total.unanswered, fill: '#64748b' },
        ...(report.total.partial ? [{ name: 'Partial', value: report.total.partial, fill: '#f59e0b' }] : [])
    ] : [], [report]);

    const accuracyData = useMemo(() => report ? [
        { subject: 'Physics', accuracy: calculateFocusMetrics(report.physics, report.testName).accuracy, attemptRate: calculateFocusMetrics(report.physics, report.testName).attemptRate },
        { subject: 'Chemistry', accuracy: calculateFocusMetrics(report.chemistry, report.testName).accuracy, attemptRate: calculateFocusMetrics(report.chemistry, report.testName).attemptRate },
        { subject: 'Maths', accuracy: calculateFocusMetrics(report.maths, report.testName).accuracy, attemptRate: calculateFocusMetrics(report.maths, report.testName).attemptRate }
    ] : [], [report]);

    const radarData = useMemo(() => report ? [
        { subject: 'Physics', score: calculateFocusMetrics(report.physics, report.testName).scorePotential, fullMark: 100 },
        { subject: 'Chemistry', score: calculateFocusMetrics(report.chemistry, report.testName).scorePotential, fullMark: 100 },
        { subject: 'Maths', score: calculateFocusMetrics(report.maths, report.testName).scorePotential, fullMark: 100 }
    ] : [], [report]);

    const currentTestLogs = useMemo(() => {
        return report ? logs.filter(l => l.testId === report.id) : [];
    }, [report, logs]);

    const errorTypologyData = useMemo(() => {
        if (!currentTestLogs.length) return [];
        const errorCounts: Record<string, number> = {};
        currentTestLogs.forEach(log => {
            if ((log.status === 'Wrong' || log.status === 'Partially Correct') && log.reasonForError && log.reasonForError !== 'N/A') {
                errorCounts[log.reasonForError] = (errorCounts[log.reasonForError] || 0) + 1;
            }
        });
        const colors = ['#f43f5e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#10b981', '#64748b'];
        return Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value], index) => ({ name, value, fill: colors[index % colors.length] }));
    }, [currentTestLogs]);

    const topicPerformanceData = useMemo(() => {
        if (!currentTestLogs.length) return [];
        const topicStats: Record<string, { correct: number, wrong: number, marks: number }> = {};
        currentTestLogs.forEach(log => {
            if (log.topic && log.topic !== 'N/A') {
                if (!topicStats[log.topic]) topicStats[log.topic] = { correct: 0, wrong: 0, marks: 0 };
                topicStats[log.topic].marks += log.marksAwarded;
                if (log.status === 'Fully Correct') topicStats[log.topic].correct++;
                if (log.status === 'Wrong') topicStats[log.topic].wrong++;
            }
        });
        return Object.entries(topicStats)
            .map(([topic, stats]) => ({ topic, ...stats }))
            .sort((a, b) => b.marks - a.marks)
            .slice(0, 5); // Top 5 topics
    }, [currentTestLogs]);

    const timeSpentData = useMemo(() => {
        if (!currentTestLogs.length) return [];
        let hasTimeData = false;
        const timeStats = { Physics: 0, Chemistry: 0, Maths: 0 };
        currentTestLogs.forEach(log => {
            if (log.timeSpent && log.timeSpent > 0) {
                hasTimeData = true;
                const subject = log.subject.charAt(0).toUpperCase() + log.subject.slice(1) as 'Physics' | 'Chemistry' | 'Maths';
                if (timeStats[subject] !== undefined) {
                    timeStats[subject] += log.timeSpent;
                }
            }
        });
        
        if (!hasTimeData) return [];
        
        return [
            { subject: 'Physics', time: Math.round(timeStats.Physics / 60), fill: SUBJECT_COLORS.physics },
            { subject: 'Chemistry', time: Math.round(timeStats.Chemistry / 60), fill: SUBJECT_COLORS.chemistry },
            { subject: 'Maths', time: Math.round(timeStats.Maths / 60), fill: SUBJECT_COLORS.maths }
        ];
    }, [currentTestLogs]);

    const handleFieldChange = (field: keyof TestReport | 'physics' | 'chemistry' | 'maths' | 'total', value: any) => {
        if (!baseReport) return;
        const updatedReport = { ...baseReport, [field]: value };
        const updatedAllReports = allReports.map(r => (r.id === updatedReport.id ? updatedReport : r));
        setReports(updatedAllReports);
    };

    useEffect(() => {
        // Auto-recalculate totals whenever a subject changes in edit mode
        if (isEditing && baseReport) {
            const newTotal: SubjectData = { marks: 0, rank: baseReport.total.rank, correct: 0, wrong: 0, unanswered: 0, partial: 0 };
            const subjects: ('physics' | 'chemistry' | 'maths')[] = ['physics', 'chemistry', 'maths'];
            subjects.forEach(sub => {
                newTotal.marks += baseReport[sub].marks;
                newTotal.correct += baseReport[sub].correct;
                newTotal.wrong += baseReport[sub].wrong;
                newTotal.unanswered += baseReport[sub].unanswered;
                newTotal.partial += baseReport[sub].partial;
            });
            // To prevent infinite loops, only update if the total has actually changed
            if (JSON.stringify(newTotal) !== JSON.stringify(baseReport.total)) {
                handleFieldChange('total', newTotal);
            }
        }
    }, [isEditing, baseReport?.physics, baseReport?.chemistry, baseReport?.maths]);

    if (!report) return null;

    const handleSubjectFieldChange = (subject: 'physics' | 'chemistry' | 'maths' | 'total', field: keyof SubjectData, value: number) => {
        handleFieldChange(subject, { ...report[subject], [field]: value });
    };

    const handleEditClick = () => {
        setOriginalReport(JSON.parse(JSON.stringify(report))); // Deep copy for restoration
        setIsEditing(true);
    };

    const handleSaveClick = () => {
        setIsEditing(false);
        setOriginalReport(null);
    };

    const handleCancelClick = () => {
        if (originalReport) {
            const revertedReports = allReports.map(r => r.id === originalReport.id ? originalReport : r);
            setReports(revertedReports);
        }
        setIsEditing(false);
        setOriginalReport(null);
    };
    
    const handleClose = () => {
        if(isEditing) { handleCancelClick(); }
        onClose();
    };

    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];
    const metricsHeaders = ['Accuracy (%)', 'Attempt Rate (%)', 'C/W Ratio', 'SPAQ', 'Unattempted %', 'Negative Mark Impact', 'Score Potential'];

    const handleGenerateAiSummary = async () => {
        if (!report) return;
        setIsGeneratingAiSummary(true);
        try {
            const summary = await generateTestAnalysis(report, apiKey);
            setAiSummary(summary);
        } catch (e) {
            console.error(e);
            setAiSummary("Failed to generate analysis. Please try again.");
        } finally {
            setIsGeneratingAiSummary(false);
        }
    };

    const handleGenerateAudio = async () => {
        if (!report) return;
        setIsGeneratingAudio(true);
        try {
            const base64Audio = await generateAudioDebrief(report, apiKey);
            if (base64Audio) {
                const url = `data:audio/wav;base64,${base64Audio}`;
                setAudioUrl(url);
            } else {
                setAiSummary("Failed to generate audio debrief. Please try again.");
            }
        } catch (e) {
            console.error(e);
            setAiSummary("Failed to generate audio debrief. Please try again.");
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    const handleExportPdf = async () => {
        if (!printRef.current || !report) return;
        setIsExporting(true);
        try {
            // Wait for charts to render in the hidden container
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                backgroundColor: '#0f172a',
                useCORS: true,
                logging: false,
                windowWidth: 1200,
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;

            // Add subsequent pages if content exceeds one page
            while (heightLeft > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Comprehensive_Report_${report.testName.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
            console.error("Failed to export PDF", error);
        } finally {
            setIsExporting(false);
        }
    };

    const renderMetricCell = (metric: string, metricsData: any) => {
        const format = (val: number, isPercent=false) => isNaN(val) ? 'N/A' : val.toFixed(isPercent ? 2 : 1);
        switch (metric) {
            case 'Accuracy (%)': return <td title="Correct / (Correct + Wrong)">{format(metricsData.accuracy, true)}</td>;
            case 'Attempt Rate (%)':
                return <td className="metric-bar-cell" title="Attempted / Total Questions">
                    <div className="metric-bar-fill green" style={{ width: `${metricsData.attemptRate}%` }}></div>
                    <span className="metric-bar relative">{format(metricsData.attemptRate, true)}%</span>
                </td>;
            case 'C/W Ratio': return <td title="Correct / Wrong">{isFinite(metricsData.cwRatio) ? format(metricsData.cwRatio) : '∞'}</td>;
            case 'SPAQ': return <td title="Score Per Attempted Question">{format(metricsData.spaq)}</td>;
            case 'Unattempted %':
                return <td className="metric-bar-cell" title="Unanswered / Total Questions">
                    <div className="metric-bar-fill red" style={{ width: `${metricsData.unattempted}%` }}></div>
                    <span className="metric-bar relative">{format(metricsData.unattempted, true)}%</span>
                </td>;
            case 'Negative Mark Impact': return <td title="(Wrong*1) / (Correct*4)">{format(metricsData.negative)}</td>;
            case 'Score Potential': return <td title="Marks / (Correct*4)">{format(metricsData.scorePotential, true)}</td>;
            default: return <td></td>;
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={handleClose}>
            <div ref={modalRef} className="bg-slate-900 p-6 rounded-lg shadow-2xl w-11/12 max-w-7xl max-h-[90vh] overflow-y-auto border border-slate-700 animate-scale-in custom-scrollbar" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    {isEditing ? (
                        <div className="flex flex-wrap gap-4 items-center">
                            <input type="text" value={report.testName} onChange={e => handleFieldChange('testName', e.target.value)} className="text-2xl font-bold text-cyan-300 bg-slate-800 border border-slate-600 p-1 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none"/>
                            <input type="date" value={report.testDate} onChange={e => handleFieldChange('testDate', e.target.value)} className="text-sm text-white bg-slate-800 border border-slate-600 p-1 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none"/>
                            <select 
                                value={report.type || ''} 
                                onChange={e => handleFieldChange('type', e.target.value)}
                                className="text-sm text-white bg-slate-800 border border-slate-600 p-1 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none"
                            >
                                <option value="">Select Type</option>
                                <option value="Full Syllabus Mock">Full Syllabus Mock</option>
                                <option value="Chapter Test">Chapter Test</option>
                                <option value="Previous Year Paper">Previous Year Paper</option>
                                <option value="Part Test">Part Test</option>
                            </select>
                            <select 
                                value={report.subType || ''} 
                                onChange={e => handleFieldChange('subType', e.target.value)}
                                className="text-sm text-white bg-slate-800 border border-slate-600 p-1 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none"
                            >
                                <option value="">Select SubType</option>
                                <option value="JEE Mains">JEE Mains</option>
                                <option value="JEE Advanced">JEE Advanced</option>
                            </select>
                            <input 
                                type="text" 
                                placeholder="Tags (comma separated)" 
                                value={report.tags?.join(', ') || ''} 
                                onChange={e => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(t => t))} 
                                className="text-sm text-white bg-slate-800 border border-slate-600 p-1 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none"
                            />
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-2xl font-bold text-cyan-300">{report.testName}</h2>
                            <p className="text-sm text-gray-400">{new Date(report.testDate + "T00:00:00").toLocaleDateString()}</p>
                            {report.tags && report.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {report.tags.map(tag => (
                                        <span key={tag} className="text-xs bg-slate-700 text-gray-300 px-2 py-1 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        {isEditing ? (
                            <>
                                <button onClick={handleSaveClick} className="p-2 rounded-full hover:bg-slate-700 text-green-400" title="Save Changes">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={handleCancelClick} className="p-2 rounded-full hover:bg-slate-700 text-red-400" title="Cancel Edit">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setIsWhatIfMode(!isWhatIfMode)} 
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1 ${isWhatIfMode ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-amber-500 hover:bg-slate-600'}`}
                                    title="What-If Simulator: Convert wrong answers to correct"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    What-If
                                </button>
                                <button onClick={handleEditClick} className="p-2 rounded-full hover:bg-slate-700 text-gray-400 hover:text-cyan-300" title="Edit Report">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                                </button>
                            </>
                        )}
                        <button onClick={handleClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                    </div>
                </div>
                
                {isWhatIfMode && (
                    <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-4 text-sm">
                        <span className="text-amber-400 font-bold">Simulator Active:</span>
                        <span className="text-gray-300">How many silly mistakes could you have avoided?</span>
                        <div className="flex gap-4 ml-auto">
                            {(['physics', 'chemistry', 'maths'] as const).map(sub => (
                                <div key={sub} className="flex items-center gap-2">
                                    <span className="text-gray-400 capitalize">{sub}:</span>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max={baseReport?.[sub].wrong || 0}
                                        value={whatIfChanges[sub]} 
                                        onChange={e => setWhatIfChanges(prev => ({ ...prev, [sub]: Math.min(baseReport?.[sub].wrong || 0, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                        className="w-16 bg-slate-800 text-amber-400 border border-amber-500/50 rounded px-1 text-center"
                                    />
                                    <span className="text-xs text-gray-500">/ {baseReport?.[sub].wrong}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* View Mode Toggle */}
                <div className="flex justify-end mb-4">
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Table View
                        </button>
                        <button
                            onClick={() => setViewMode('visual')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'visual' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Visual View
                        </button>
                    </div>
                </div>

                {viewMode === 'table' ? (
                    <div className="overflow-x-auto custom-scrollbar mb-6">
                        <table className="min-w-full text-xs focus-modal-table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Marks</th><th>Rank</th><th>Correct</th><th>Wrong</th><th>Unanswered</th><th>Partial</th>
                                    {metricsHeaders.map(h => <th key={h}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map(subject => {
                                    const data = report[subject];
                                    const metrics = calculateFocusMetrics(data, report.testName);
                                    return (
                                        <tr key={subject}>
                                            <td className="subject-label capitalize">{subject}</td>
                                            {isEditing ? (
                                                <>
                                                    <td><input type="number" value={data.marks} onChange={e => handleSubjectFieldChange(subject as any, 'marks', parseInt(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded px-1 w-full text-center" /></td>
                                                    <td><input type="number" value={data.rank} onChange={e => handleSubjectFieldChange(subject as any, 'rank', parseInt(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded px-1 w-full text-center" /></td>
                                                    <td><input type="number" value={data.correct} onChange={e => handleSubjectFieldChange(subject as any, 'correct', parseInt(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded px-1 w-full text-center" /></td>
                                                    <td><input type="number" value={data.wrong} onChange={e => handleSubjectFieldChange(subject as any, 'wrong', parseInt(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded px-1 w-full text-center" /></td>
                                                    <td><input type="number" value={data.unanswered} onChange={e => handleSubjectFieldChange(subject as any, 'unanswered', parseInt(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded px-1 w-full text-center" /></td>
                                                    <td><input type="number" value={data.partial} onChange={e => handleSubjectFieldChange(subject as any, 'partial', parseInt(e.target.value))} className="bg-slate-800 text-white border border-slate-600 rounded px-1 w-full text-center" /></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>{data.marks}</td><td>{data.rank}</td><td>{data.correct}</td><td>{data.wrong}</td><td>{data.unanswered}</td><td>{data.partial}</td>
                                                </>
                                            )}
                                            {metricsHeaders.map(h => renderMetricCell(h, metrics))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Marks Breakdown Chart */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Marks Breakdown</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={marksData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="subject" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                                        <Bar dataKey="marks" name="Marks" radius={[4, 4, 0, 0]}>
                                            {marksData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Question Distribution Chart */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Question Distribution</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={questionDistData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {questionDistData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Accuracy & Attempt Rate */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Subject-wise Accuracy & Attempt Rate</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={accuracyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="subject" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                        <Bar dataKey="accuracy" name="Accuracy (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="attemptRate" name="Attempt Rate (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Subject Performance Radar */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Subject Performance Radar</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                        <Radar name="Score Potential (%)" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                                        <Tooltip content={<CustomTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Error Typology Breakdown */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Error Typology</h3>
                            <div className="h-64 flex items-center justify-center">
                                {errorTypologyData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={errorTypologyData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {errorTypologyData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No error logs available.</p>
                                )}
                            </div>
                        </div>

                        {/* Top Topics Performance */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Top Topics by Marks</h3>
                            <div className="h-64 flex items-center justify-center">
                                {topicPerformanceData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topicPerformanceData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                            <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis dataKey="topic" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={100} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                                            <Bar dataKey="marks" name="Marks Gained" fill="#10b981" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No topic data available.</p>
                                )}
                            </div>
                        </div>

                        {/* Time Spent per Subject */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-gray-300 mb-4 text-center">Time Spent per Subject (Mins)</h3>
                            <div className="h-64 flex items-center justify-center">
                                {timeSpentData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={timeSpentData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="subject" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.4 }} />
                                            <Bar dataKey="time" name="Time (mins)" radius={[4, 4, 0, 0]}>
                                                {timeSpentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No time data available.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Time Sinks Section */}
                {timeSinks.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Time Sinks (Questions taking &gt; 2 mins)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {timeSinks.map((log, idx) => (
                                <div key={idx} className="bg-slate-900/50 p-3 rounded border border-slate-700/50 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-semibold text-gray-300 capitalize">{log.subject} Q{log.questionNumber}</span>
                                        <span className="text-xs font-mono text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded">
                                            {Math.floor(log.timeSpent! / 60)}m {log.timeSpent! % 60}s
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex flex-col gap-1">
                                        <span className="truncate" title={log.topic}>Topic: <span className="text-gray-400">{log.topic || 'N/A'}</span></span>
                                        <span>Status: <span className={`capitalize ${log.status === 'Fully Correct' ? 'text-emerald-400' : log.status === 'Wrong' ? 'text-rose-400' : 'text-amber-400'}`}>{log.status}</span></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* AI Summary Section */}
                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                            <span>✨</span> AI Executive Analysis
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleExportPdf}
                                disabled={isExporting}
                                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-full transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                {isExporting ? 'Exporting...' : 'Export PDF'}
                            </button>
                            {!aiSummary && (
                                <button 
                                    onClick={handleGenerateAiSummary}
                                    disabled={isGeneratingAiSummary}
                                    className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full transition-all disabled:opacity-50"
                                >
                                    {isGeneratingAiSummary ? 'Analyzing...' : 'Generate Analysis'}
                                </button>
                            )}
                            {!audioUrl && (
                                <button 
                                    onClick={handleGenerateAudio}
                                    disabled={isGeneratingAudio}
                                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-full transition-all disabled:opacity-50 flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                    {isGeneratingAudio ? 'Generating Audio...' : 'Audio Debrief'}
                                </button>
                            )}
                        </div>
                    </div>
                    {audioUrl && (
                        <div className="mb-4">
                            <audio controls className="w-full h-8" src={audioUrl}>
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    )}
                    {aiSummary ? (
                        <div className="text-base text-gray-200 leading-relaxed max-w-none max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                            <MarkdownRenderer
                                content={aiSummary}
                                title={`${report.testName}_Analysis`}
                            />
                            <button 
                                onClick={() => setAiSummary(null)}
                                className="mt-6 text-xs text-gray-500 hover:text-indigo-400 transition-colors block font-medium uppercase tracking-wider"
                            >
                                ← Clear & Regenerate Analysis
                            </button>
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-500 italic">No analysis generated for this test yet. Click the button above to synthesize insights.</p>
                    )}
                </div>

                {/* Hidden Print Container for PDF Export */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                    <div ref={printRef} className="p-8 bg-slate-900 text-white w-[1000px] flex flex-col gap-8">
                        {/* Header */}
                        <div className="border-b border-slate-700 pb-4">
                            <h1 className="text-3xl font-bold text-indigo-400">{report.testName}</h1>
                            <p className="text-gray-400">Test Date: {new Date(report.testDate).toLocaleDateString()}</p>
                        </div>

                        {/* Table View */}
                        <div>
                            <h2 className="text-xl font-bold text-cyan-400 mb-4">Performance Data</h2>
                            <div className="overflow-x-auto border border-slate-700 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-800 text-gray-300">
                                        <tr>
                                            <th className="px-4 py-2 border-b border-slate-700">Subject</th>
                                            <th className="px-4 py-2 border-b border-slate-700">Marks</th>
                                            <th className="px-4 py-2 border-b border-slate-700">Rank</th>
                                            <th className="px-4 py-2 border-b border-slate-700">Correct</th>
                                            <th className="px-4 py-2 border-b border-slate-700">Wrong</th>
                                            <th className="px-4 py-2 border-b border-slate-700">Unanswered</th>
                                            {metricsHeaders.map(h => <th key={h} className="px-4 py-2 border-b border-slate-700">{h}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {subjects.map(subject => {
                                            const data = report[subject];
                                            const metrics = calculateFocusMetrics(data, report.testName);
                                            return (
                                                <tr key={subject} className="hover:bg-slate-800/30">
                                                    <td className="px-4 py-2 font-medium capitalize">{subject}</td>
                                                    <td className="px-4 py-2">{data.marks}</td>
                                                    <td className="px-4 py-2">{data.rank}</td>
                                                    <td className="px-4 py-2">{data.correct}</td>
                                                    <td className="px-4 py-2">{data.wrong}</td>
                                                    <td className="px-4 py-2">{data.unanswered}</td>
                                                    {metricsHeaders.map(metric => (
                                                        <td key={metric} className="px-4 py-2">
                                                            {metric === 'Accuracy (%)' ? metrics.accuracy.toFixed(1) : 
                                                             metric === 'Attempt Rate (%)' ? metrics.attemptRate.toFixed(1) : 
                                                             metric === 'C/W Ratio' ? (metrics.cwRatio === Infinity ? '∞' : metrics.cwRatio.toFixed(2)) :
                                                             metric === 'SPAQ' ? metrics.spaq.toFixed(2) :
                                                             metric === 'Unattempted (%)' ? metrics.unattempted.toFixed(1) :
                                                             metric === 'Negative Impact (%)' ? metrics.negative.toFixed(1) :
                                                             metric === 'Score Potential (%)' ? metrics.scorePotential.toFixed(1) : 'N/A'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Visual View - Charts */}
                        <div className="grid grid-cols-1 gap-8">
                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                                <h3 className="text-lg font-bold text-indigo-300 mb-6">Marks Breakdown</h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={marksData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="subject" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                            <Bar dataKey="marks" name="Marks" radius={[4, 4, 0, 0]}>
                                                {marksData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                                    <h3 className="text-lg font-bold text-indigo-300 mb-6">Question Distribution</h3>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={questionDistData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {questionDistData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                                    <h3 className="text-lg font-bold text-indigo-300 mb-6">Subject Performance Profile</h3>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                                <PolarGrid stroke="#334155" />
                                                <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={12} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={10} />
                                                <Radar
                                                    name="Score Potential"
                                                    dataKey="score"
                                                    stroke="#10b981"
                                                    fill="#10b981"
                                                    fillOpacity={0.6}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                                <h3 className="text-lg font-bold text-indigo-300 mb-6">Accuracy & Attempt Rate</h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={accuracyData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="subject" stroke="#94a3b8" fontSize={12} />
                                            <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                                            <Legend />
                                            <Bar dataKey="accuracy" fill="#0ea5e9" name="Accuracy %" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="attemptRate" fill="#8b5cf6" name="Attempt Rate %" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* AI Summary */}
                        {aiSummary && (
                            <div className="mt-8 p-8 bg-slate-800 rounded-xl border border-slate-700">
                                <h2 className="text-2xl font-bold text-indigo-300 mb-6 flex items-center gap-2">
                                    <span>✨</span> AI Executive Analysis
                                </h2>
                                <div className="max-w-none">
                                    <MarkdownRenderer
                                        content={aiSummary}
                                        title={`${report.testName}_AI_Analysis`}
                                        showExport={false} // Already in a PDF export view
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SubjectPerformanceIndicator: React.FC<{ score: number; average: number; maxScore: number; color: string; }> = ({ score, average, maxScore, color }) => {
    const scorePercentage = maxScore > 0 ? Math.max(0, (score / maxScore) * 100) : 0;
    const averagePercentage = maxScore > 0 ? (average / maxScore) * 100 : 0;

    return (
        <div className="indicator-track group">
            <div className="indicator-bar" style={{ width: `${scorePercentage}%`, backgroundColor: color }}></div>
            <div className="indicator-avg-marker" style={{ left: `${averagePercentage}%`, backgroundColor: '#3b82f6' }}></div>
             <div className="absolute z-10 hidden group-hover:block bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 text-xs text-white bg-slate-900 border border-slate-600 rounded-md shadow-lg w-max">
                <p>Score: {score}</p>
                <p>Average: {average.toFixed(1)}</p>
            </div>
        </div>
    );
};

const ReportCard: React.FC<{
    report: TestReport;
    previousReport?: TestReport;
    subjectAverages: any;
    subjectMaxScores: any;
    getConditionalClass: (value: number, type: 'marks' | 'rank') => string;
    isSelected: boolean;
    isDragged: boolean;
    isDropTarget: boolean;
    onCardClick: () => void;
    onViewQuestionLog: (testId: string) => void;
    onDelete: () => void;
    onDeepDive: () => void;
    isComparisonMode: boolean;
    dragProps: any;
    showTrends?: boolean;
}> = ({ report, previousReport, subjectAverages, subjectMaxScores, getConditionalClass, isSelected, isDragged, isDropTarget, onCardClick, onViewQuestionLog, onDelete, onDeepDive, isComparisonMode, dragProps, showTrends = true }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const indicatorData = [
        { name: 'Physics', score: report.physics.marks, average: subjectAverages.physics, max: subjectMaxScores.physics, color: SUBJECT_COLORS.physics },
        { name: 'Chemistry', score: report.chemistry.marks, average: subjectAverages.chemistry, max: subjectMaxScores.chemistry, color: SUBJECT_COLORS.chemistry },
        { name: 'Maths', score: report.maths.marks, average: subjectAverages.maths, max: subjectMaxScores.maths, color: SUBJECT_COLORS.maths },
    ];
    
    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];

    const renderTrend = (current: number, previous: number | undefined, inverse: boolean = false) => {
        if (!showTrends || previous === undefined) return null;
        const diff = current - previous;
        if (diff === 0) return <span className="text-gray-500 text-xs ml-1">-</span>;
        const isPositive = diff > 0;
        const isGood = inverse ? !isPositive : isPositive;
        
        // Calculate percentage change
        const percentChange = previous !== 0 ? (diff / Math.abs(previous)) * 100 : 0;
        const percentText = percentChange !== 0 ? ` (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)` : '';

        return (
            <span className={`text-xs ml-1 ${isGood ? 'text-green-400' : 'text-red-400'}`} title={`Previous: ${previous}${percentText}`}>
                {isPositive ? '▲' : '▼'} {Math.abs(diff).toFixed(diff % 1 === 0 ? 0 : 1)}
                <span className="opacity-70 text-[10px] ml-0.5">{percentText}</span>
            </span>
        );
    };

    return (
        <div
            {...dragProps}
            onClick={onCardClick}
            className={`report-card bg-slate-800/70 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col ${isComparisonMode ? 'comparison-mode' : ''} ${isSelected ? 'selected' : ''} ${isDragged ? 'dragging' : ''} ${isDropTarget ? 'drop-target' : ''}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-cyan-300">{report.testName}</h3>
                    <p className="text-xs text-gray-400">{new Date(report.testDate + "T00:00:00").toLocaleDateString()}</p>
                    {report.tags && report.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {report.tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-slate-700 text-gray-300 px-2 py-0.5 rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-1 rounded-full hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center my-4">
                <div><p className="text-xs text-gray-400">Marks</p><p className={`text-2xl font-semibold ${getConditionalClass(report.total.marks, 'marks')}`}>{report.total.marks}{renderTrend(report.total.marks, previousReport?.total.marks)}</p></div>
                <div><p className="text-xs text-gray-400">Rank</p><p className={`text-2xl font-semibold ${getConditionalClass(report.total.rank, 'rank')}`}>{report.total.rank}{renderTrend(report.total.rank, previousReport?.total.rank, true)}</p></div>
                <div><p className="text-xs text-gray-400">Accuracy</p><p className="text-2xl font-semibold">{report.totalMetrics?.accuracy.toFixed(1)}<span className="text-lg">%</span>{renderTrend(report.totalMetrics?.accuracy || 0, previousReport?.totalMetrics?.accuracy)}</p></div>
            </div>

            <div className="w-full space-y-2">
                 <p className="text-xs text-center text-gray-500 -mb-1">Subject Performance (vs. Avg)</p>
                 {indicatorData.map(d => (
                     <div key={d.name} className="indicator-container grid grid-cols-4 items-center gap-2 text-xs">
                        <span className="text-gray-400 col-span-1">{d.name}</span>
                        <div className="col-span-3">
                            <SubjectPerformanceIndicator score={d.score} average={d.average} maxScore={d.max} color={d.color} />
                        </div>
                     </div>
                 ))}
            </div>

            <div className={`card-details ${isExpanded ? 'expanded' : ''} border-t border-slate-700/50`}>
                 <div className="space-y-3">
                    {subjects.map(subject => (
                        <div key={subject} className="text-xs">
                            <h4 className="font-semibold text-cyan-400 capitalize mb-1 flex justify-between items-center">
                                <span>{subject}</span>
                                <span className="text-[10px] font-normal text-gray-500">
                                    {renderTrend(report[subject].marks, previousReport?.[subject]?.marks)}
                                </span>
                            </h4>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-1">
                                <span className="text-gray-400">Marks:</span> <span className="font-medium text-white">{report[subject].marks}</span>
                                <span className="text-gray-400">Rank:</span> <span className="font-medium text-white">{report[subject].rank}{renderTrend(report[subject].rank, previousReport?.[subject]?.rank, true)}</span>
                                <span className="text-gray-400">Acc %:</span> <span className="font-medium text-white">{(report[`${subject}Metrics` as keyof TestReport] as any)?.accuracy?.toFixed(1) ?? 'N/A'}{renderTrend((report[`${subject}Metrics` as keyof TestReport] as any)?.accuracy || 0, (previousReport?.[`${subject}Metrics` as keyof TestReport] as any)?.accuracy)}</span>
                                <span className="text-gray-400">Correct:</span> <span className="font-medium text-green-400">{report[subject].correct}</span>
                                <span className="text-gray-400">Wrong:</span> <span className="font-medium text-red-400">{report[subject].wrong}</span>
                                <span className="text-gray-400">Unans:</span> <span className="font-medium text-gray-300">{report[subject].unanswered}</span>
                            </div>
                        </div>
                    ))}
                 </div>
                 <div className="flex gap-2 mt-4">
                    <button onClick={(e) => { e.stopPropagation(); onViewQuestionLog(report.id); }} className="flex-1 text-xs bg-indigo-600/50 hover:bg-indigo-600 text-white font-semibold py-1 px-3 rounded-full">View Question Log</button>
                    <button onClick={(e) => { e.stopPropagation(); onDeepDive(); }} className="flex-1 text-xs bg-cyan-600/50 hover:bg-cyan-600 text-white font-semibold py-1 px-3 rounded-full">Deep Dive</button>
                 </div>
                 <div className="mt-4 pt-2 border-t border-slate-700/30 flex justify-end">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="text-[10px] text-red-400/60 hover:text-red-400 hover:underline transition-colors flex items-center gap-1"
                        title="Permanently delete this report"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Report
                    </button>
                 </div>
            </div>
        </div>
    );
};


export const DetailedReportsView: React.FC<DetailedReportsViewProps> = ({ allReports, filteredReports, setReports, onViewQuestionLog, onDeleteReport, apiKey, logs }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'testDate', direction: 'descending' });
    const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [enableConditionalFormatting, setEnableConditionalFormatting] = useState(false);
    const [enableTrendIndicators, setEnableTrendIndicators] = useState(false);
    const [isComparisonModeEnabled, setIsComparisonModeEnabled] = useState(false); // Changed default to false
    const [focusReport, setFocusReport] = useState<TestReport | null>(null);
    const [reportToDelete, setReportToDelete] = useState<string | null>(null);

    const [draggedReportId, setDraggedReportId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

    const comparisonReports = useMemo(() => {
        if (selectedForCompare.size < 2) return null;
        const ids = Array.from(selectedForCompare);
        return filteredReports.filter(r => ids.includes(r.id));
    }, [selectedForCompare, filteredReports]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
        setSortConfig({ key, direction });
    };

    const handleCardClick = (report: TestReport) => {
        if (isComparisonModeEnabled) {
            setSelectedForCompare(prev => {
                const newSet = new Set(prev);
                if (newSet.has(report.id)) {
                    newSet.delete(report.id);
                } else {
                    newSet.add(report.id);
                }
                return newSet;
            });
        } else {
            setFocusReport(report);
        }
    };

    const handleExport = () => { exportReportsToCsv(filteredReports); };
    
    const confirmDelete = () => {
        if (reportToDelete) {
            onDeleteReport(reportToDelete);
            setReportToDelete(null);
        }
    };

    // --- Drag & Drop Handlers (Strictly for 2-item comparison) ---
    const handleDragStart = (e: React.DragEvent, reportId: string) => { e.dataTransfer.setData('text/plain', reportId); setDraggedReportId(reportId); };
    const handleDragOver = (e: React.DragEvent, reportId: string) => { e.preventDefault(); if (reportId !== draggedReportId) setDropTargetId(reportId); };
    const handleDragLeave = () => setDropTargetId(null);
    const handleDrop = (e: React.DragEvent, dropReportId: string) => {
        e.preventDefault();
        const dragReportId = e.dataTransfer.getData('text/plain');
        if (dragReportId && dragReportId !== dropReportId) {
            // Strictly set only these two for Drag & Drop comparison
            setSelectedForCompare(new Set([dragReportId, dropReportId]));
            setIsCompareModalOpen(true);
        }
        setDropTargetId(null);
    };
    const handleDragEnd = () => { setDraggedReportId(null); setDropTargetId(null); };

    const { sortedData, quartiles, subjectAverages, subjectMaxScores } = useMemo(() => {
        const getQuartiles = (data: number[]) => {
            const sorted = data.slice().sort((a, b) => a - b);
            const q1 = sorted[Math.floor(sorted.length / 4)];
            const q3 = sorted[Math.ceil(sorted.length * (3 / 4)) - 1];
            return { q1, q3 };
        };
        const marksQuartiles = getQuartiles(filteredReports.map(r => r.total.marks));
        const rankQuartiles = getQuartiles(filteredReports.map(r => r.total.rank));
        
        const subjectTotals = filteredReports.reduce((acc, r) => {
            acc.physics += r.physics.marks; acc.chemistry += r.chemistry.marks; acc.maths += r.maths.marks; return acc;
        }, { physics: 0, chemistry: 0, maths: 0 });
        
        const subjectAverages = filteredReports.length > 0 ? { 
            physics: subjectTotals.physics / filteredReports.length, 
            chemistry: subjectTotals.chemistry / filteredReports.length, 
            maths: subjectTotals.maths / filteredReports.length,
        } : { physics: 0, chemistry: 0, maths: 0 };

        const subjectMaxes = filteredReports.reduce((acc, r) => {
            acc.physics = Math.max(acc.physics, r.physics.marks);
            acc.chemistry = Math.max(acc.chemistry, r.chemistry.marks);
            acc.maths = Math.max(acc.maths, r.maths.marks);
            return acc;
        }, { physics: -Infinity, chemistry: -Infinity, maths: -Infinity });

        const subjectMaxScores = {
            physics: Math.max(30, subjectMaxes.physics * 1.1),
            chemistry: Math.max(30, subjectMaxes.chemistry * 1.1),
            maths: Math.max(30, subjectMaxes.maths * 1.1),
        };
        
        const dataToSort = [...filteredReports];
        dataToSort.sort((a, b) => {
            const getNestedValue = (obj: any, path: string) => path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
            let aValue = getNestedValue(a, sortConfig.key);
            let bValue = getNestedValue(b, sortConfig.key);
            if (aValue === undefined || aValue === null) aValue = -Infinity;
            if (bValue === undefined || bValue === null) bValue = -Infinity;
            if (typeof aValue === 'number' && typeof bValue === 'number') return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            if (String(aValue) < String(bValue)) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (String(aValue) > String(bValue)) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });

        return { sortedData: dataToSort, quartiles: { marks: marksQuartiles, rank: rankQuartiles }, subjectAverages, subjectMaxScores };
    }, [filteredReports, sortConfig]);
    
    const getConditionalClass = (value: number, type: 'marks' | 'rank') => {
        if (!enableConditionalFormatting) return '';
        const q = quartiles[type];
        if (type === 'marks') {
            if (value >= q.q3) return 'text-green-300';
            if (value <= q.q1) return 'text-red-300';
        } else if (type === 'rank') {
            if (value <= q.q1) return 'text-green-300';
            if (value >= q.q3) return 'text-red-300';
        }
        return '';
    };

    const sortOptions: {key: SortKey, label: string}[] = [
        { key: 'testDate', label: 'Test Date' },
        { key: 'testName', label: 'Test Name' },
        { key: 'total.marks', label: 'Total Marks' },
        { key: 'total.rank', label: 'Total Rank' },
        { key: 'totalMetrics.accuracy', label: 'Accuracy' },
    ];

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-cyan-300">Detailed Test Reports</h2>
                <div className="flex items-center gap-4">
                     <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={isComparisonModeEnabled} 
                            onChange={() => {
                                setIsComparisonModeEnabled(p => !p);
                                setSelectedForCompare(new Set()); // Clear selection on mode change
                            }} 
                            className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-cyan-500 rounded focus:ring-cyan-500" 
                        /> 
                        Enable Comparison
                    </label>
                    <button onClick={() => setIsCompareModalOpen(true)} disabled={selectedForCompare.size < 2 || !isComparisonModeEnabled} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Compare Selected ({selectedForCompare.size})</button>
                    <button onClick={handleExport} title="Export to CSV" className="bg-green-600 hover:bg-green-700 text-white font-bold p-2 rounded-full h-10 w-10 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                </div>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-md mb-4 flex flex-wrap gap-x-6 gap-y-3 items-center text-sm">
                <div className="flex items-center gap-2">
                    <label className="text-gray-400">Sort by:</label>
                    <select value={sortConfig.key} onChange={e => requestSort(e.target.value as SortKey)} className="bg-slate-700 p-1 rounded-md border border-slate-600">
                        {sortOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                    </select>
                    <button onClick={() => setSortConfig(prev => ({...prev, direction: prev.direction === 'ascending' ? 'descending' : 'ascending'}))} className="p-1 bg-slate-700 rounded-md border border-slate-600">
                        {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                    </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={enableConditionalFormatting} onChange={() => setEnableConditionalFormatting(p => !p)} className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-cyan-500 rounded focus:ring-cyan-500" /> Enable Color Formatting</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={enableTrendIndicators} onChange={() => setEnableTrendIndicators(p => !p)} className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-cyan-500 rounded focus:ring-cyan-500" /> Enable Trend Indicators</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {useMemo(() => {
                    const chronologicallySorted = [...allReports].sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
                    return sortedData.map(report => {
                        const dragProps = isComparisonModeEnabled ? {
                            draggable: true,
                            onDragStart: (e: React.DragEvent) => handleDragStart(e, report.id),
                            onDragEnd: handleDragEnd,
                            onDragOver: (e: React.DragEvent) => handleDragOver(e, report.id),
                            onDragLeave: handleDragLeave,
                            onDrop: (e: React.DragEvent) => handleDrop(e, report.id),
                        } : { draggable: false };

                        const currentIndex = chronologicallySorted.findIndex(r => r.id === report.id);
                        const previousReport = currentIndex > 0 ? chronologicallySorted[currentIndex - 1] : undefined;

                        return (
                            <ReportCard
                                key={report.id}
                                report={report}
                                previousReport={previousReport}
                                subjectAverages={subjectAverages}
                                subjectMaxScores={subjectMaxScores}
                                getConditionalClass={getConditionalClass}
                                isSelected={selectedForCompare.has(report.id)}
                                isDragged={draggedReportId === report.id}
                                isDropTarget={dropTargetId === report.id}
                                onCardClick={() => handleCardClick(report)}
                                onViewQuestionLog={onViewQuestionLog}
                                onDelete={() => setReportToDelete(report.id)}
                                onDeepDive={() => setFocusReport(report)}
                                isComparisonMode={isComparisonModeEnabled}
                                dragProps={dragProps}
                                showTrends={enableTrendIndicators}
                            />
                        );
                    });
                }, [sortedData, allReports, isComparisonModeEnabled, selectedForCompare, draggedReportId, dropTargetId, subjectAverages, subjectMaxScores, getConditionalClass, onViewQuestionLog])}
            </div>

            {sortedData.length === 0 && <p className="text-center text-gray-400 py-8">No reports found for the selected criteria.</p>}
            
            <ComparisonModal isOpen={isCompareModalOpen && !!comparisonReports} reports={comparisonReports} onClose={() => { setIsCompareModalOpen(false); }}/>
            {focusReport && <FocusModeModal report={focusReport} allReports={allReports} setReports={setReports} onClose={() => setFocusReport(null)} apiKey={apiKey} logs={logs} />}
            <DeleteConfirmationModal isOpen={!!reportToDelete} onClose={() => setReportToDelete(null)} onConfirm={confirmDelete} />
        </div>
    );
};