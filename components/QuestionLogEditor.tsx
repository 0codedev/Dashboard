
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { QuestionLog, TestReport, AiFilter } from '../types';
import { QuestionType, QuestionStatus, ErrorReason } from '../types';
import { exportLogsToCsv } from '../services/sheetParser';
import { getMarkingScheme, calculateMarks } from '../utils/metrics';

interface QuestionLogEditorProps {
  logs: QuestionLog[];
  reports: TestReport[];
  setLogs: React.Dispatch<React.SetStateAction<QuestionLog[]>>;
  activeLogFilter: AiFilter | null;
  setActiveLogFilter: (filter: AiFilter | null) => void;
}

const MarksBar: React.FC<{ marks: number; type: QuestionType }> = ({ marks, type }) => {
    const scheme = getMarkingScheme(type);
    const maxPositive = scheme.correct;
    const maxNegative = Math.abs(scheme.wrong);

    let width = 0;
    let colorClass = 'bg-gray-500';
    let justification = 'justify-center';

    if (marks > 0) {
        width = Math.min(100, (marks / maxPositive) * 100);
        colorClass = 'bg-green-500';
        justification = 'justify-start';
    } else if (marks < 0) {
        width = Math.min(100, (Math.abs(marks) / maxNegative) * 100);
        colorClass = 'bg-red-500';
        justification = 'justify-end';
    }

    return (
        <div className={`w-full h-2 bg-slate-600 rounded-full flex overflow-hidden ${justification}`}>
            <div className={`${colorClass} h-full rounded-full`} style={{ width: `${width}%` }}></div>
        </div>
    );
};


const EditableCell: React.FC<{
    value: string | number;
    onChange: (value: any) => void;
    type?: 'text' | 'number';
    className?: string;
}> = ({ value, onChange, type = 'text', className }) => {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
            className={`w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none ${className}`}
        />
    );
};

const SelectCell: React.FC<{
    value: string;
    onChange: (value: any) => void;
    options: readonly string[];
}> = ({ value, onChange, options }) => {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
            className="w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none"
        >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    );
};

type SortKey = keyof QuestionLog | 'testName' | 'date';
type SortDirection = 'ascending' | 'descending';

const SortableHeader: React.FC<{
    title: string;
    sortKey: SortKey;
    sortConfig: { key: SortKey; direction: SortDirection } | null;
    requestSort: (key: SortKey) => void;
}> = ({ title, sortKey, sortConfig, requestSort }) => {
    const isSorted = sortConfig?.key === sortKey;
    const icon = isSorted ? (sortConfig?.direction === 'ascending' ? '▲' : '▼') : '↕';

    return (
        <th
            className="p-3 text-left font-semibold text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-slate-700"
            onClick={() => requestSort(sortKey)}
        >
            {title} <span className="text-xs text-gray-400">{icon}</span>
        </th>
    );
};


export const QuestionLogEditor: React.FC<QuestionLogEditorProps> = ({ logs, reports, setLogs, activeLogFilter, setActiveLogFilter }) => {
    const [selectedTest, setSelectedTest] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'date', direction: 'descending' });
    const [smartFilter, setSmartFilter] = useState<string | null>(null);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Bulk edit state
    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
    const [bulkTopic, setBulkTopic] = useState('');
    const [bulkErrorReason, setBulkErrorReason] = useState<ErrorReason | ''>('');
    const [bulkStatus, setBulkStatus] = useState<QuestionStatus | ''>('');
    const [bulkQuestionType, setBulkQuestionType] = useState<QuestionType | ''>('');
    const [bulkSubject, setBulkSubject] = useState<'physics' | 'chemistry' | 'maths' | ''>('');
    const [bulkTestId, setBulkTestId] = useState<string>('');

    // Undo/Redo Stacks
    const [history, setHistory] = useState<QuestionLog[][]>([]);
    const [future, setFuture] = useState<QuestionLog[][]>([]);

    const pushToHistory = (currentLogs: QuestionLog[]) => {
        setHistory(prev => [...prev.slice(-9), currentLogs]); // Keep last 10 states
        setFuture([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        
        setFuture(prev => [logs, ...prev]);
        setLogs(previousState);
        setHistory(newHistory);
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const nextState = future[0];
        const newFuture = future.slice(1);

        setHistory(prev => [...prev, logs]);
        setLogs(nextState);
        setFuture(newFuture);
    };


    const reportInfoMap = useMemo(() => {
        const map = new Map<string, { name: string, date: string }>();
        reports.forEach(r => map.set(r.id, { name: r.testName, date: r.testDate }));
        return map;
    }, [reports]);

    useEffect(() => {
        if (activeLogFilter) {
            setSelectedTest('all');
            setSearchTerm('');
            setSmartFilter(null);
            setCurrentPage(1); // Reset page on filter change
        }
    }, [activeLogFilter]);
    
    useEffect(() => {
        setCurrentPage(1); // Reset page when local filters change
    }, [selectedTest, searchTerm, smartFilter]);

    const getTestInfo = useCallback((testId: string) => {
        return reportInfoMap.get(testId) || { name: 'Unknown Test', date: '' };
    }, [reportInfoMap]);
    
    const uniqueTopics = useMemo(() => {
        const topics = new Set<string>();
        logs.forEach(log => {
            if (log.topic && log.topic !== 'N/A') {
                topics.add(log.topic);
            }
        });
        return Array.from(topics).sort();
    }, [logs]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleSmartFilterClick = (filter: string | null) => {
        setSmartFilter(filter);
        setActiveLogFilter(null);
        setSelectedTest('all');
        setSearchTerm('');
    };

    const recurringGapTopics = useMemo(() => {
        if (smartFilter !== 'recurringGaps') return new Set();
        const topicTestMap = new Map<string, Set<string>>();
        logs.forEach(log => {
            if (log.reasonForError === ErrorReason.ConceptualGap && log.topic !== 'N/A') {
                if (!topicTestMap.has(log.topic)) {
                    topicTestMap.set(log.topic, new Set());
                }
                topicTestMap.get(log.topic)!.add(log.testId);
            }
        });

        const recurringTopics = new Set<string>();
        topicTestMap.forEach((testIds, topic) => {
            if (testIds.size > 1) {
                recurringTopics.add(topic);
            }
        });
        return recurringTopics;
    }, [logs, smartFilter]);

    const filteredLogs = useMemo(() => {
        let logsToFilter = logs;

        if (activeLogFilter) {
            logsToFilter = logsToFilter.filter(log => {
                return Object.entries(activeLogFilter).every(([key, value]) => {
                    if (!value) return true;
                    return String(log[key as keyof QuestionLog]).toLowerCase() === String(value).toLowerCase();
                });
            });
        } else if (smartFilter) {
            if (smartFilter === 'highImpact') {
                logsToFilter = logs.filter(log => log.marksAwarded < 0);
            } else if (smartFilter === 'careless') {
                logsToFilter = logs.filter(log => log.reasonForError === ErrorReason.SillyMistake || log.reasonForError === ErrorReason.MisreadQuestion);
            } else if (smartFilter === 'recurringGaps') {
                logsToFilter = logs.filter(log => log.reasonForError === ErrorReason.ConceptualGap && recurringGapTopics.has(log.topic));
            }
        }

        const lowercasedSearch = searchTerm.toLowerCase();
        return logsToFilter.filter(log => 
            (selectedTest === 'all' || log.testId === selectedTest) &&
            (searchTerm.trim() === '' ||
             log.questionNumber.toString().includes(lowercasedSearch) ||
             log.topic.toLowerCase().includes(lowercasedSearch))
        );
    }, [logs, selectedTest, searchTerm, activeLogFilter, smartFilter, recurringGapTopics]);
    
    const sortedLogs = useMemo(() => {
        const dataToSort = [...filteredLogs];
        // Sort logic remains the same
        if (!sortConfig) return dataToSort;

        return dataToSort.sort((a, b) => {
            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'testName' || sortConfig.key === 'date') {
                const infoA = getTestInfo(a.testId);
                const infoB = getTestInfo(b.testId);
                aValue = sortConfig.key === 'testName' ? infoA.name : infoA.date;
                bValue = sortConfig.key === 'testName' ? infoB.name : infoB.date;
            } else {
                aValue = a[sortConfig.key as keyof QuestionLog];
                bValue = b[sortConfig.key as keyof QuestionLog];
            }

            if (aValue === undefined || aValue === null) aValue = '';
            if (bValue === undefined || bValue === null) bValue = '';

            if (sortConfig.key === 'date') {
                const dateA = new Date(aValue).getTime();
                const dateB = new Date(bValue).getTime();
                if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            }

            const strA = String(aValue).toLowerCase();
            const strB = String(bValue).toLowerCase();
            if (strA < strB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (strA > strB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [filteredLogs, sortConfig, getTestInfo]);
    
    // Pagination data
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedLogs, currentPage]);
    
    const totalPages = Math.ceil(sortedLogs.length / ITEMS_PER_PAGE);

    const handleUpdate = (qNumber: number, testId: string, field: keyof QuestionLog, value: any) => {
        pushToHistory(logs); // Save state before update
        setLogs(prevLogs =>
            prevLogs.map(log => {
                if (log.questionNumber === qNumber && log.testId === testId) {
                    const updatedLog = { ...log, [field]: value };

                    if (field === 'status' || field === 'questionType') {
                        const newMarks = calculateMarks(updatedLog.status, updatedLog.questionType);
                        if (newMarks !== null) {
                            updatedLog.marksAwarded = newMarks;
                        }
                    }
                    return updatedLog;
                }
                return log;
            })
        );
    };

    // Bulk Edit Handlers
    const toggleSelectLog = (logId: string) => {
        setSelectedLogs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(logId)) {
                newSet.delete(logId);
            } else {
                newSet.add(logId);
            }
            return newSet;
        });
    };
    
    const toggleSelectAllOnPage = () => {
        const allPageIds = new Set(paginatedLogs.map(log => `${log.testId}-${log.questionNumber}`));
        const currentSelection = new Set(selectedLogs);
        
        const allSelectedOnPage = paginatedLogs.every(log => currentSelection.has(`${log.testId}-${log.questionNumber}`));

        if (allSelectedOnPage) {
            allPageIds.forEach(id => currentSelection.delete(id));
        } else {
            allPageIds.forEach(id => currentSelection.add(id));
        }
        setSelectedLogs(currentSelection);
    };

    const handleBulkUpdate = () => {
        if (selectedLogs.size === 0) return;
        pushToHistory(logs); // Save state before update
        
        setLogs(prevLogs =>
            prevLogs.map(log => {
                if (selectedLogs.has(`${log.testId}-${log.questionNumber}`)) {
                    const updatedLog = { ...log };
                    if (bulkTopic.trim()) updatedLog.topic = bulkTopic.trim();
                    if (bulkErrorReason) updatedLog.reasonForError = bulkErrorReason;
                    if (bulkStatus) updatedLog.status = bulkStatus;
                    if (bulkQuestionType) updatedLog.questionType = bulkQuestionType;
                    if (bulkSubject) updatedLog.subject = bulkSubject;
                    if (bulkTestId) updatedLog.testId = bulkTestId;
                    return updatedLog;
                }
                return log;
            })
        );
        setSelectedLogs(new Set());
        setBulkTopic('');
        setBulkErrorReason('');
        setBulkStatus('');
        setBulkQuestionType('');
        setBulkSubject('');
        setBulkTestId('');
    };

    const handleBulkCancel = () => {
        setSelectedLogs(new Set());
        setBulkTopic('');
        setBulkErrorReason('');
        setBulkStatus('');
        setBulkQuestionType('');
        setBulkSubject('');
        setBulkTestId('');
    };


    const handleExport = () => {
        exportLogsToCsv(logs, reports);
    };

    const headers: { title: string; key: SortKey }[] = [
        { title: 'Date', key: 'date' },
        { title: 'Test Name', key: 'testName' },
        { title: 'Subject', key: 'subject' },
        { title: 'Q. No.', key: 'questionNumber' },
        { title: 'Question Type', key: 'questionType' },
        { title: 'Status', key: 'status' },
        { title: 'Marks Awarded', key: 'marksAwarded' },
        { title: 'Topic / Chapter', key: 'topic' },
        { title: 'Reason for Error', key: 'reasonForError' },
    ];
    
    const getFilterDisplay = () => {
        if (!activeLogFilter || Object.keys(activeLogFilter).length === 0) return null;
        return Object.entries(activeLogFilter)
            .map(([key, value]) => {
                const formattedKey = key.replace(/([A-Z])/g, ' $1');
                return `<strong class="font-semibold text-white capitalize">${formattedKey}</strong> is "<strong class="font-semibold text-white">${value}</strong>"`;
            })
            .join(' and ');
    };

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700">
            <datalist id="topic-suggestions">
                {uniqueTopics.map(topic => <option key={topic} value={topic} />)}
            </datalist>

            <h2 className="text-2xl font-bold mb-4 text-cyan-300">Question Log Editor</h2>
            
            {activeLogFilter && (
                <div className="bg-indigo-900/50 p-3 rounded-lg mb-4 flex justify-between items-center transition-opacity duration-300">
                    <p className="text-indigo-200 text-sm md:text-base">
                        <span className="font-bold">Filtered from AI Assistant:</span> Showing logs where <span dangerouslySetInnerHTML={{ __html: getFilterDisplay() || '' }} />.
                    </p>
                    <button 
                        onClick={() => setActiveLogFilter(null)} 
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1 px-3 rounded-md transition-colors text-sm flex items-center gap-1 flex-shrink-0"
                    >
                        Clear Filter
                        <span className="text-lg leading-none">&times;</span>
                    </button>
                </div>
            )}
            
            <div className="p-3 bg-slate-800/60 rounded-md mb-4 flex flex-wrap gap-x-4 gap-y-3 items-center text-sm">
                 <span className="font-semibold text-gray-300">Smart Filters:</span>
                 <div className="flex flex-wrap gap-2">
                     <button onClick={() => handleSmartFilterClick(null)} className={`px-3 py-1 rounded-full text-xs font-semibold ${!smartFilter ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>All</button>
                     <button onClick={() => handleSmartFilterClick('highImpact')} className={`px-3 py-1 rounded-full text-xs font-semibold ${smartFilter === 'highImpact' ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>High-Impact Errors</button>
                     <button onClick={() => handleSmartFilterClick('recurringGaps')} className={`px-3 py-1 rounded-full text-xs font-semibold ${smartFilter === 'recurringGaps' ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>Recurring Gaps</button>
                     <button onClick={() => handleSmartFilterClick('careless')} className={`px-3 py-1 rounded-full text-xs font-semibold ${smartFilter === 'careless' ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>Careless Mistakes</button>
                 </div>
            </div>

            <div className="mb-4 flex items-center flex-wrap gap-4">
                {/* Filters */}
                <div className="flex-grow flex items-center flex-wrap gap-4">
                     <div className={`${activeLogFilter || smartFilter ? 'opacity-50 pointer-events-none' : ''}`}>
                        <label htmlFor="test-filter" className="text-sm text-gray-400 mr-2">Filter by Test:</label>
                        <select 
                            id="test-filter" 
                            value={selectedTest} 
                            onChange={e => setSelectedTest(e.target.value)} 
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                            disabled={!!activeLogFilter || !!smartFilter}
                        >
                            <option value="all">All Tests</option>
                            {[...new Set(logs.map(log => log.testId))].map(testId => (
                                <option key={testId} value={testId}>{getTestInfo(testId).name}</option>
                            ))}
                        </select>
                    </div>
                     <div className={`${activeLogFilter || smartFilter ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                            type="text"
                            placeholder="Search by Q.No or Topic..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none w-full sm:w-auto"
                            disabled={!!activeLogFilter || !!smartFilter}
                        />
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex bg-slate-700 rounded-lg border border-slate-600 p-0.5 mr-2">
                        <button 
                            onClick={handleUndo} 
                            disabled={history.length === 0}
                            className="p-2 text-gray-400 hover:text-white hover:bg-slate-600 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Undo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        </button>
                        <button 
                            onClick={handleRedo} 
                            disabled={future.length === 0}
                            className="p-2 text-gray-400 hover:text-white hover:bg-slate-600 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Redo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                        </button>
                    </div>
                    <button onClick={handleExport} title="Export to CSV" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-slate-800 rounded-lg text-sm">
                    <thead className="bg-slate-700/50">
                        <tr>
                            <th className="p-3 w-12 text-center">
                                <input
                                    type="checkbox"
                                    onChange={toggleSelectAllOnPage}
                                    checked={paginatedLogs.length > 0 && paginatedLogs.every(log => selectedLogs.has(`${log.testId}-${log.questionNumber}`))}
                                    className="form-checkbox h-4 w-4 bg-slate-600 border-slate-500 text-cyan-500 rounded focus:ring-cyan-500"
                                    title="Select all on page"
                                />
                            </th>
                           {headers.map(header => (
                               <SortableHeader
                                key={header.key}
                                title={header.title}
                                sortKey={header.key}
                                sortConfig={sortConfig}
                                requestSort={requestSort}
                               />
                           ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedLogs.map(log => {
                            const testInfo = getTestInfo(log.testId);
                            const logId = `${log.testId}-${log.questionNumber}`;
                            const isSelected = selectedLogs.has(logId);
                            return (
                                <tr key={logId} className={`border-b border-slate-700 ${isSelected ? 'bg-cyan-900/20' : 'hover:bg-slate-700/50'}`}>
                                    <td className="p-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectLog(logId)}
                                            className="form-checkbox h-4 w-4 bg-slate-600 border-slate-500 text-cyan-500 rounded focus:ring-cyan-500"
                                        />
                                    </td>
                                    <td className="p-2 whitespace-nowrap">{testInfo.date ? new Date(testInfo.date + "T00:00:00").toLocaleDateString() : ''}</td>
                                    <td className="p-2 whitespace-nowrap">{testInfo.name}</td>
                                    <td className="p-2 capitalize">{log.subject}</td>
                                    <td className="p-2 text-center">{log.questionNumber}</td>
                                    <td className="p-1 min-w-[180px]">
                                        <SelectCell 
                                            value={log.questionType} 
                                            onChange={value => handleUpdate(log.questionNumber, log.testId, 'questionType', value)}
                                            options={Object.values(QuestionType)}
                                        />
                                    </td>
                                    <td className="p-1 min-w-[150px]">
                                         <SelectCell
                                            value={log.status}
                                            onChange={value => handleUpdate(log.questionNumber, log.testId, 'status', value)}
                                            options={Object.values(QuestionStatus)}
                                        />
                                    </td>
                                    <td className="p-1 w-40">
                                        <div className="flex items-center gap-2">
                                            <div className="w-12 flex-shrink-0">
                                                <EditableCell 
                                                    value={log.marksAwarded}
                                                    onChange={value => handleUpdate(log.questionNumber, log.testId, 'marksAwarded', value)}
                                                    type="number"
                                                    className="text-center"
                                                />
                                            </div>
                                            <div className="flex-grow">
                                                <MarksBar marks={log.marksAwarded} type={log.questionType} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-1 min-w-[180px]">
                                        <input
                                            type="text"
                                            value={log.topic}
                                            onChange={e => handleUpdate(log.questionNumber, log.testId, 'topic', e.target.value)}
                                            list="topic-suggestions"
                                            className="w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none"
                                        />
                                    </td>
                                    <td className="p-1 min-w-[150px]">
                                        <SelectCell 
                                            value={log.reasonForError || ''} 
                                            onChange={value => handleUpdate(log.questionNumber, log.testId, 'reasonForError', value)}
                                            options={['', ...Object.values(ErrorReason)]}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
             {sortedLogs.length === 0 && (
                <p className="text-center text-gray-400 py-8">
                    {searchTerm ? `No questions found for "${searchTerm}".` : 'No question logs found for the selected filter.'}
                </p>
            )}

            {totalPages > 1 && (
                <div className="mt-4 flex justify-between items-center text-sm">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-gray-400">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}
             {/* Floating Bulk Edit Bar */}
            <div
                className={`fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300 ease-in-out ${
                    selectedLogs.size > 0 ? 'translate-y-0' : 'translate-y-full'
                }`}
            >
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-slate-800/80 backdrop-blur-sm p-4 rounded-t-lg shadow-2xl border-t border-l border-r border-slate-700 flex flex-wrap gap-4 items-center justify-between">
                        <p className="font-semibold text-cyan-200">{selectedLogs.size} logs selected.</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                             <input
                                type="text"
                                list="topic-suggestions"
                                placeholder="New Topic"
                                value={bulkTopic}
                                onChange={e => setBulkTopic(e.target.value)}
                                className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-cyan-500"
                            />
                            <select
                                value={bulkErrorReason}
                                onChange={e => setBulkErrorReason(e.target.value as ErrorReason | '')}
                                className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-cyan-500"
                            >
                                <option value="">New Error Reason</option>
                                {Object.values(ErrorReason).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select
                                value={bulkStatus}
                                onChange={e => setBulkStatus(e.target.value as QuestionStatus | '')}
                                className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-cyan-500"
                            >
                                <option value="">New Status</option>
                                {Object.values(QuestionStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select
                                value={bulkQuestionType}
                                onChange={e => setBulkQuestionType(e.target.value as QuestionType | '')}
                                className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-cyan-500"
                            >
                                <option value="">New Question Type</option>
                                {Object.values(QuestionType).map(qt => <option key={qt} value={qt}>{qt}</option>)}
                            </select>
                             <select
                                value={bulkSubject}
                                onChange={e => setBulkSubject(e.target.value as 'physics' | 'chemistry' | 'maths' | '')}
                                className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-cyan-500"
                            >
                                <option value="">New Subject</option>
                                <option value="physics">Physics</option>
                                <option value="chemistry">Chemistry</option>
                                <option value="maths">Maths</option>
                            </select>
                            <select
                                value={bulkTestId}
                                onChange={e => setBulkTestId(e.target.value)}
                                className="bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-cyan-500"
                            >
                                <option value="">Move to Test</option>
                                {reports.map(r => <option key={r.id} value={r.id}>{r.testName} ({r.testDate})</option>).reverse()}
                            </select>
                            <button onClick={handleBulkCancel} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg text-sm mr-2">Cancel</button>
                            <button onClick={handleBulkUpdate} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg text-sm">Apply Changes</button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};
