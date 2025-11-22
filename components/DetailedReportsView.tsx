import React, { useMemo, useState, useEffect } from 'react';
import type { TestReport, SubjectData } from '../types';
import { exportReportsToCsv } from '../services/sheetParser';
import { SUBJECT_COLORS } from '../constants';

interface DetailedReportsViewProps {
    allReports: TestReport[];
    filteredReports: TestReport[];
    setReports: React.Dispatch<React.SetStateAction<TestReport[]>>;
    onViewQuestionLog: (testId: string) => void;
    onDeleteReport: (testId: string) => void;
}

type SortKey =
  | 'testName'
  | 'testDate'
  | 'total.marks'
  | 'total.rank'
  | 'totalMetrics.accuracy';

type SortDirection = 'ascending' | 'descending';

// --- Helper Functions ---

const calculateFocusMetrics = (data: SubjectData) => {
    const totalQuestions = data.correct + data.wrong + data.unanswered + data.partial;
    if (totalQuestions === 0) return { accuracy: 0, attemptRate: 0, cwRatio: 0, spaq: 0, unattempted: 0, negative: 0, scorePotential: 0 };

    const attempted = data.correct + data.wrong + data.partial;
    const accuracy = (data.correct + data.wrong) > 0 ? (data.correct / (data.correct + data.wrong)) * 100 : 0;
    const attemptRate = (attempted / totalQuestions) * 100;
    const cwRatio = data.wrong > 0 ? data.correct / data.wrong : data.correct > 0 ? Infinity : 0;
    const spaq = attempted > 0 ? data.marks / attempted : 0;
    const unattempted = (data.unanswered / totalQuestions) * 100;
    
    // Assuming +4/-1 marking for these illustrative metrics
    const potentialPositive = data.correct * 4;
    const negative = potentialPositive > 0 ? (data.wrong * 1) / potentialPositive : 0;
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

const ComparisonModal: React.FC<{ reports: TestReport[] | null, onClose: () => void, isOpen: boolean }> = ({ reports, onClose, isOpen }) => {
    if (!isOpen || !reports || reports.length === 0) return null;
    
    // Sort reports by date to show progression left-to-right
    const sortedReports = [...reports].sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-2xl w-11/12 max-w-6xl border border-slate-700 animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-cyan-300">Multi-Test Comparison</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="overflow-auto flex-grow custom-scrollbar">
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
}> = ({ report: reportProp, allReports, setReports, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [originalReport, setOriginalReport] = useState<TestReport | null>(null);

    // This finds the most up-to-date version of the report from the main state
    const report = useMemo(() => allReports.find(r => r.id === reportProp?.id), [allReports, reportProp]);

    useEffect(() => {
        // Auto-recalculate totals whenever a subject changes in edit mode
        if (isEditing && report) {
            const newTotal: SubjectData = { marks: 0, rank: report.total.rank, correct: 0, wrong: 0, unanswered: 0, partial: 0 };
            const subjects: ('physics' | 'chemistry' | 'maths')[] = ['physics', 'chemistry', 'maths'];
            subjects.forEach(sub => {
                newTotal.marks += report[sub].marks;
                newTotal.correct += report[sub].correct;
                newTotal.wrong += report[sub].wrong;
                newTotal.unanswered += report[sub].unanswered;
                newTotal.partial += report[sub].partial;
            });
            // To prevent infinite loops, only update if the total has actually changed
            if (JSON.stringify(newTotal) !== JSON.stringify(report.total)) {
                handleFieldChange('total', newTotal);
            }
        }
    }, [isEditing, report?.physics, report?.chemistry, report?.maths]);

    if (!report) return null;

    const handleFieldChange = (field: keyof TestReport | 'physics' | 'chemistry' | 'maths' | 'total', value: any) => {
        const updatedReport = { ...report, [field]: value };
        const updatedAllReports = allReports.map(r => (r.id === updatedReport.id ? updatedReport : r));
        setReports(updatedAllReports);
    };

    const handleSubjectFieldChange = (subject: 'physics' | 'chemistry' | 'maths', field: keyof SubjectData, value: number) => {
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
            <div className="bg-slate-900 p-6 rounded-lg shadow-2xl w-11/12 max-w-7xl border border-slate-700 animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    {isEditing ? (
                        <div className="flex gap-4 items-center">
                            <input type="text" value={report.testName} onChange={e => handleFieldChange('testName', e.target.value)} className="text-2xl font-bold text-cyan-300 bg-slate-700 p-1 rounded-md"/>
                            <input type="date" value={report.testDate} onChange={e => handleFieldChange('testDate', e.target.value)} className="text-sm text-gray-400 bg-slate-700 p-1 rounded-md"/>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-2xl font-bold text-cyan-300">{report.testName}</h2>
                            <p className="text-sm text-gray-400">{new Date(report.testDate + "T00:00:00").toLocaleDateString()}</p>
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
                            <button onClick={handleEditClick} className="p-2 rounded-full hover:bg-slate-700 text-gray-400 hover:text-cyan-300" title="Edit Report">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                            </button>
                        )}
                        <button onClick={handleClose} className="text-gray-400 hover:text-white text-3xl leading-none">&times;</button>
                    </div>
                </div>
                <div className="overflow-x-auto">
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
                                const metrics = calculateFocusMetrics(data);
                                return (
                                    <tr key={subject}>
                                        <td className="subject-label capitalize">{subject}</td>
                                        {isEditing && subject !== 'total' ? (
                                            <>
                                                <td><input type="number" value={data.marks} onChange={e => handleSubjectFieldChange(subject, 'marks', parseInt(e.target.value))} /></td>
                                                <td><input type="number" value={data.rank} onChange={e => handleSubjectFieldChange(subject, 'rank', parseInt(e.target.value))} /></td>
                                                <td><input type="number" value={data.correct} onChange={e => handleSubjectFieldChange(subject, 'correct', parseInt(e.target.value))} /></td>
                                                <td><input type="number" value={data.wrong} onChange={e => handleSubjectFieldChange(subject, 'wrong', parseInt(e.target.value))} /></td>
                                                <td><input type="number" value={data.unanswered} onChange={e => handleSubjectFieldChange(subject, 'unanswered', parseInt(e.target.value))} /></td>
                                                <td><input type="number" value={data.partial} onChange={e => handleSubjectFieldChange(subject, 'partial', parseInt(e.target.value))} /></td>
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
            <div className="indicator-avg-marker" style={{ left: `${averagePercentage}%` }}></div>
             <div className="absolute z-10 hidden group-hover:block bottom-full mb-2 left-1/2 -translate-x-1/2 p-2 text-xs text-white bg-slate-900 border border-slate-600 rounded-md shadow-lg w-max">
                <p>Score: {score}</p>
                <p>Average: {average.toFixed(1)}</p>
            </div>
        </div>
    );
};

const ReportCard: React.FC<{
    report: TestReport;
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
}> = ({ report, subjectAverages, subjectMaxScores, getConditionalClass, isSelected, isDragged, isDropTarget, onCardClick, onViewQuestionLog, onDelete, onDeepDive, isComparisonMode, dragProps }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const indicatorData = [
        { name: 'Physics', score: report.physics.marks, average: subjectAverages.physics, max: subjectMaxScores.physics, color: SUBJECT_COLORS.physics },
        { name: 'Chemistry', score: report.chemistry.marks, average: subjectAverages.chemistry, max: subjectMaxScores.chemistry, color: SUBJECT_COLORS.chemistry },
        { name: 'Maths', score: report.maths.marks, average: subjectAverages.maths, max: subjectMaxScores.maths, color: SUBJECT_COLORS.maths },
    ];
    
    const subjects: ('physics' | 'chemistry' | 'maths' | 'total')[] = ['physics', 'chemistry', 'maths', 'total'];

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
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="p-1 rounded-full hover:bg-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center my-4">
                <div><p className="text-xs text-gray-400">Marks</p><p className={`text-2xl font-semibold ${getConditionalClass(report.total.marks, 'marks')}`}>{report.total.marks}</p></div>
                <div><p className="text-xs text-gray-400">Rank</p><p className={`text-2xl font-semibold ${getConditionalClass(report.total.rank, 'rank')}`}>{report.total.rank}</p></div>
                <div><p className="text-xs text-gray-400">Accuracy</p><p className="text-2xl font-semibold">{report.totalMetrics?.accuracy.toFixed(1)}<span className="text-lg">%</span></p></div>
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
                            <h4 className="font-semibold text-cyan-400 capitalize mb-1">{subject}</h4>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-1">
                                <span className="text-gray-400">Marks:</span> <span className="font-medium text-white">{report[subject].marks}</span>
                                <span className="text-gray-400">Rank:</span> <span className="font-medium text-white">{report[subject].rank}</span>
                                <span className="text-gray-400">Acc %:</span> <span className="font-medium text-white">{report[`${subject}Metrics`]?.accuracy.toFixed(1) ?? 'N/A'}</span>
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


export const DetailedReportsView: React.FC<DetailedReportsViewProps> = ({ allReports, filteredReports, setReports, onViewQuestionLog, onDeleteReport }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'testDate', direction: 'descending' });
    const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [enableConditionalFormatting, setEnableConditionalFormatting] = useState(true);
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sortedData.map(report => {
                    const dragProps = isComparisonModeEnabled ? {
                        draggable: true,
                        onDragStart: (e: React.DragEvent) => handleDragStart(e, report.id),
                        onDragEnd: handleDragEnd,
                        onDragOver: (e: React.DragEvent) => handleDragOver(e, report.id),
                        onDragLeave: handleDragLeave,
                        onDrop: (e: React.DragEvent) => handleDrop(e, report.id),
                    } : { draggable: false };

                    return (
                        <ReportCard
                            key={report.id}
                            report={report}
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
                        />
                    );
                })}
            </div>

            {sortedData.length === 0 && <p className="text-center text-gray-400 py-8">No reports found for the selected criteria.</p>}
            
            <ComparisonModal isOpen={isCompareModalOpen && !!comparisonReports} reports={comparisonReports} onClose={() => { setIsCompareModalOpen(false); }}/>
            <FocusModeModal report={focusReport} allReports={allReports} setReports={setReports} onClose={() => setFocusReport(null)} />
            <DeleteConfirmationModal isOpen={!!reportToDelete} onClose={() => setReportToDelete(null)} onConfirm={confirmDelete} />
        </div>
    );
};