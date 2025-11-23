import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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

// --- Helper Components ---

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
    isInvalid?: boolean;
}> = ({ value, onChange, type = 'text', className, isInvalid }) => {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
            className={`w-full bg-transparent p-1 border ${isInvalid ? 'border-red-500/80' : 'border-transparent'} focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none text-center ${className}`}
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
            className="w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none text-center"
        >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    );
};

type SortKey = keyof QuestionLog | 'testName' | 'date';
type SortDirection = 'ascending' | 'descending';

// --- Advanced Header Component ---

interface AdvancedHeaderProps {
    title: string;
    field: SortKey;
    currentSort: { key: SortKey; direction: SortDirection } | null;
    onSort: (key: SortKey) => void;
    onFilter: (field: string, values: Set<string>) => void;
    uniqueValues: string[];
    activeFilters: Set<string>;
}

const AdvancedHeader: React.FC<AdvancedHeaderProps> = ({ title, field, currentSort, onSort, onFilter, uniqueValues, activeFilters }) => {
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [tempSelected, setTempSelected] = useState<Set<string>>(new Set(activeFilters));
    const menuRef = useRef<HTMLDivElement>(null);

    // Sync temp state when props change
    useEffect(() => {
        setTempSelected(new Set(activeFilters));
    }, [activeFilters]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        if (isFilterOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isFilterOpen]);

    const isSorted = currentSort?.key === field;
    const sortIcon = isSorted ? (currentSort?.direction === 'ascending' ? '▲' : '▼') : '';
    const hasActiveFilter = activeFilters.size > 0;

    const filteredValues = uniqueValues.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleApply = () => {
        onFilter(String(field), tempSelected);
        setIsFilterOpen(false);
    };

    const toggleValue = (val: string) => {
        const next = new Set(tempSelected);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        setTempSelected(next);
    };

    const handleSelectAll = () => {
        if (tempSelected.size === uniqueValues.length) setTempSelected(new Set()); // Deselect all
        else setTempSelected(new Set(uniqueValues)); // Select all
    };

    return (
        <th className="p-3 font-semibold text-gray-300 uppercase tracking-wider relative group select-none text-center">
            <div className="flex items-center justify-center gap-2">
                <span 
                    className={`cursor-pointer hover:text-white flex items-center gap-1 transition-colors ${isSorted ? 'text-cyan-400' : ''}`}
                    onClick={() => onSort(field)}
                >
                    {title}
                    {sortIcon && <span className="text-[10px]">{sortIcon}</span>}
                </span>
                <button 
                    className={`p-1 rounded hover:bg-slate-700 transition-all ${hasActiveFilter ? 'text-cyan-400 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-100'}`}
                    onClick={(e) => { e.stopPropagation(); setIsFilterOpen(!isFilterOpen); }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {isFilterOpen && (
                <div ref={menuRef} className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 flex flex-col text-xs font-normal text-gray-300 animate-scale-in text-left">
                    <div className="p-2 border-b border-slate-700 space-y-2">
                        <input 
                            type="text" 
                            placeholder={`Search ${title}...`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-1.5 focus:ring-1 focus:ring-cyan-500 outline-none"
                            autoFocus
                        />
                        <button 
                            onClick={() => onSort(field)}
                            className="w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-gray-400 hover:text-white flex items-center gap-2"
                        >
                            <span>↕</span> Toggle Sort
                        </button>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 p-1.5 rounded transition-colors">
                            <input 
                                type="checkbox" 
                                checked={tempSelected.size === uniqueValues.length && uniqueValues.length > 0} 
                                onChange={handleSelectAll}
                                className="rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span className="font-bold">(Select All)</span>
                        </label>
                        {filteredValues.map(val => (
                            <label key={val} className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 p-1.5 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={tempSelected.has(val)} 
                                    onChange={() => toggleValue(val)}
                                    className="rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                                />
                                <span className="truncate">{val || '(Empty)'}</span>
                            </label>
                        ))}
                        {filteredValues.length === 0 && <p className="text-gray-500 text-center py-2">No matches</p>}
                    </div>

                    <div className="p-2 border-t border-slate-700 flex justify-between gap-2 bg-slate-900/50 rounded-b-lg">
                        <button 
                            onClick={() => { setTempSelected(new Set()); onFilter(String(field), new Set()); setIsFilterOpen(false); }}
                            className="px-3 py-1.5 hover:text-white transition-colors text-gray-400"
                        >
                            Clear
                        </button>
                        <button 
                            onClick={handleApply}
                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium shadow-lg shadow-cyan-500/20"
                        >
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </th>
    );
};

// --- Intelligent Quick Stats Sidebar (Floating Panel) ---

const QuickStatsSidebar: React.FC<{ selectedLogs: Set<string>; logs: QuestionLog[] }> = ({ selectedLogs, logs }) => {
    const stats = useMemo(() => {
        if (selectedLogs.size === 0) return null;
        
        // Filter logs based on selection
        const selected = logs.filter(l => selectedLogs.has(`${l.testId}-${l.questionNumber}`));
        const count = selected.length;
        const marks = selected.reduce((acc, l) => acc + l.marksAwarded, 0);
        
        const correct = selected.filter(l => l.status === QuestionStatus.FullyCorrect).length;
        const wrong = selected.filter(l => l.status === QuestionStatus.Wrong).length;
        const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0;

        // Mode Error Reason
        const reasons: Record<string, number> = {};
        selected.forEach(l => {
            if (l.reasonForError) reasons[l.reasonForError] = (reasons[l.reasonForError] || 0) + 1;
        });
        const topReasonEntry = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
        
        // Subject Breakdown
        const subjects: Record<string, number> = { physics: 0, chemistry: 0, maths: 0 };
        selected.forEach(l => { if(subjects[l.subject] !== undefined) subjects[l.subject]++; });

        return { count, marks, accuracy, topReason: topReasonEntry, subjects };
    }, [selectedLogs, logs]);

    // Floating panel design
    return (
        <div 
            className={`fixed right-6 top-24 bottom-24 w-80 bg-slate-800/95 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl transform transition-all duration-500 ease-in-out z-40 overflow-hidden ${selectedLogs.size > 0 ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}
        >
            {stats && (
                <div className="flex flex-col h-full">
                    <div className="p-5 border-b border-slate-700 bg-slate-900/50">
                        <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-2">
                            <span className="text-lg">⚡</span> Selection Analysis
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-1">{stats.count} items selected</p>
                    </div>
                    
                    <div className="p-5 space-y-6 overflow-y-auto flex-grow custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-700 text-center">
                                <p className="text-[10px] text-gray-400 uppercase">Net Score</p>
                                <p className={`text-2xl font-mono font-bold ${stats.marks >= 0 ? 'text-white' : 'text-red-400'}`}>
                                    {stats.marks > 0 ? '+' : ''}{stats.marks}
                                </p>
                            </div>
                            <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-700 text-center">
                                <p className="text-[10px] text-gray-400 uppercase">Accuracy</p>
                                <p className="text-2xl font-mono font-bold text-white">{stats.accuracy.toFixed(0)}%</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs text-gray-400 font-bold uppercase text-center">Dominant Error</p>
                            <div className="bg-red-900/20 p-3 rounded-lg border border-red-900/30 flex items-center justify-between">
                                <span className="text-sm font-medium text-red-200 truncate">{stats.topReason ? stats.topReason[0] : 'None'}</span>
                                {stats.topReason && <span className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded-full">{stats.topReason[1]}</span>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs text-gray-400 font-bold uppercase text-center">Subject Mix</p>
                            <div className="flex h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full" style={{width: `${(stats.subjects.physics / stats.count)*100}%`}}></div>
                                <div className="bg-yellow-500 h-full" style={{width: `${(stats.subjects.chemistry / stats.count)*100}%`}}></div>
                                <div className="bg-red-500 h-full" style={{width: `${(stats.subjects.maths / stats.count)*100}%`}}></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-400 px-1">
                                <span className="text-green-400">P: {stats.subjects.physics}</span>
                                <span className="text-yellow-400">C: {stats.subjects.chemistry}</span>
                                <span className="text-red-400">M: {stats.subjects.maths}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Main Component ---

export const QuestionLogEditor: React.FC<QuestionLogEditorProps> = ({ logs, reports, setLogs, activeLogFilter, setActiveLogFilter }) => {
    const [selectedTest, setSelectedTest] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'date', direction: 'descending' });
    const [smartFilter, setSmartFilter] = useState<string | null>(null);
    
    // Advanced Filters
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Selection & Range Selection State
    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
    const lastSelectedId = useRef<string | null>(null); // For Shift+Click logic

    // Bulk edit state
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
        setHistory(prev => [...prev.slice(-9), currentLogs]); 
        setFuture([]);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previousState = history[history.length - 1];
        setFuture(prev => [logs, ...prev]);
        setLogs(previousState);
        setHistory(history.slice(0, -1));
    };

    const handleRedo = () => {
        if (future.length === 0) return;
        const nextState = future[0];
        setHistory(prev => [...prev, logs]);
        setLogs(nextState);
        setFuture(future.slice(1));
    };

    const handleRecalculateMarks = () => {
        pushToHistory(logs);
        setLogs(prevLogs => prevLogs.map(log => {
            const newMarks = calculateMarks(log.status, log.questionType);
            if (newMarks !== null) return { ...log, marksAwarded: newMarks };
            return log;
        }));
    };

    const handleExport = () => {
        exportLogsToCsv(logs, reports);
    };

    const reportInfoMap = useMemo(() => {
        const map = new Map<string, { name: string, date: string }>();
        reports.forEach(r => map.set(r.id, { name: r.testName, date: r.testDate }));
        return map;
    }, [reports]);

    const getTestInfo = useCallback((testId: string) => {
        return reportInfoMap.get(testId) || { name: 'Unknown Test', date: '' };
    }, [reportInfoMap]);

    // Helper to get unique values for a column (for Advanced Header)
    const getUniqueValues = useCallback((key: SortKey) => {
        const set = new Set<string>();
        logs.forEach(log => {
            let val: any;
            if (key === 'testName' || key === 'date') {
                const info = getTestInfo(log.testId);
                val = key === 'testName' ? info.name : info.date;
            } else {
                val = log[key as keyof QuestionLog];
            }
            if (val !== undefined && val !== null) set.add(String(val));
        });
        return Array.from(set).sort();
    }, [logs, getTestInfo]);

    const handleColumnFilter = (field: string, values: Set<string>) => {
        setColumnFilters(prev => {
            const next = { ...prev };
            if (values.size === 0) delete next[field];
            else next[field] = values;
            return next;
        });
        setCurrentPage(1);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        setSelectedTest('all');
        setSmartFilter(null);
        setColumnFilters({});
        setActiveLogFilter(null);
        setCurrentPage(1);
    };

    const hasActiveFilters = useMemo(() => {
        return searchTerm !== '' || selectedTest !== 'all' || smartFilter !== null || Object.keys(columnFilters).length > 0 || activeLogFilter !== null;
    }, [searchTerm, selectedTest, smartFilter, columnFilters, activeLogFilter]);

    const filteredLogs = useMemo(() => {
        let logsToFilter = logs;

        // AI Filter
        if (activeLogFilter) {
            logsToFilter = logsToFilter.filter(log => {
                return Object.entries(activeLogFilter).every(([key, value]) => {
                    if (!value) return true;
                    return String(log[key as keyof QuestionLog]).toLowerCase() === String(value).toLowerCase();
                });
            });
        }
        
        // Smart Filters
        if (smartFilter) {
            if (smartFilter === 'highImpact') logsToFilter = logsToFilter.filter(log => log.marksAwarded < 0);
            else if (smartFilter === 'careless') logsToFilter = logsToFilter.filter(log => log.reasonForError === ErrorReason.SillyMistake || log.reasonForError === ErrorReason.MisreadQuestion);
        }

        // Global Search
        const lowercasedSearch = searchTerm.toLowerCase();
        logsToFilter = logsToFilter.filter(log => 
            (selectedTest === 'all' || log.testId === selectedTest) &&
            (searchTerm.trim() === '' ||
             log.questionNumber.toString().includes(lowercasedSearch) ||
             log.topic.toLowerCase().includes(lowercasedSearch))
        );

        // Advanced Column Filters
        if (Object.keys(columnFilters).length > 0) {
            logsToFilter = logsToFilter.filter(log => {
                return Object.entries(columnFilters).every(([key, selectedValues]) => {
                    const values = selectedValues as Set<string>;
                    if (values.size === 0) return true;
                    
                    let val: any;
                    if (key === 'testName' || key === 'date') {
                        const info = getTestInfo(log.testId);
                        val = key === 'testName' ? info.name : info.date;
                    } else {
                        val = log[key as keyof QuestionLog];
                    }
                    return values.has(String(val ?? ''));
                });
            });
        }

        return logsToFilter;
    }, [logs, selectedTest, searchTerm, activeLogFilter, smartFilter, columnFilters, getTestInfo]);
    
    const sortedLogs = useMemo(() => {
        const dataToSort = [...filteredLogs];
        if (!sortConfig) return dataToSort;

        return dataToSort.sort((a, b) => {
            let aValue: any, bValue: any;

            if (sortConfig.key === 'testName' || sortConfig.key === 'date') {
                const infoA = getTestInfo(a.testId);
                const infoB = getTestInfo(b.testId);
                aValue = sortConfig.key === 'testName' ? infoA.name : infoA.date;
                bValue = sortConfig.key === 'testName' ? infoB.name : infoB.date;
            } else {
                aValue = a[sortConfig.key as keyof QuestionLog];
                bValue = b[sortConfig.key as keyof QuestionLog];
            }

            if (sortConfig.key === 'date') {
                return sortConfig.direction === 'ascending' ? new Date(aValue).getTime() - new Date(bValue).getTime() : new Date(bValue).getTime() - new Date(aValue).getTime();
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }

            return sortConfig.direction === 'ascending' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
        });
    }, [filteredLogs, sortConfig, getTestInfo]);
    
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedLogs, currentPage]);
    
    const totalPages = Math.ceil(sortedLogs.length / ITEMS_PER_PAGE);

    const requestSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev?.key === key && prev.direction === 'ascending') return { key, direction: 'descending' };
            if (prev?.key === key && prev.direction === 'descending') return null; // Cycle: Asc -> Desc -> None
            return { key, direction: 'ascending' };
        });
    };

    const handleUpdate = (qNumber: number, testId: string, field: keyof QuestionLog, value: any) => {
        pushToHistory(logs);
        setLogs(prevLogs =>
            prevLogs.map(log => {
                if (log.questionNumber === qNumber && log.testId === testId) {
                    const updatedLog = { ...log, [field]: value };
                    if (field === 'status' || field === 'questionType') {
                        const newMarks = calculateMarks(updatedLog.status, updatedLog.questionType);
                        if (newMarks !== null) updatedLog.marksAwarded = newMarks;
                    }
                    return updatedLog;
                }
                return log;
            })
        );
    };

    // Advanced Selection Handlers
    const toggleSelectLog = (logId: string, event: React.MouseEvent<HTMLInputElement>) => {
        setSelectedLogs(prev => {
            const newSet = new Set(prev);
            
            // Shift-Click Logic (Range Selection)
            if (event.shiftKey && lastSelectedId.current) {
                const allIds = paginatedLogs.map(l => `${l.testId}-${l.questionNumber}`);
                const startIdx = allIds.indexOf(lastSelectedId.current);
                const endIdx = allIds.indexOf(logId);
                
                if (startIdx !== -1 && endIdx !== -1) {
                    const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
                    const rangeIds = allIds.slice(min, max + 1);
                    const shouldSelect = !newSet.has(logId); // Match target state
                    
                    rangeIds.forEach(id => {
                        if (shouldSelect) newSet.add(id);
                        else newSet.delete(id);
                    });
                }
            } else {
                // Normal Toggle
                if (newSet.has(logId)) newSet.delete(logId);
                else newSet.add(logId);
            }
            
            lastSelectedId.current = logId;
            return newSet;
        });
    };
    
    const toggleSelectAllOnPage = () => {
        const allPageIds = paginatedLogs.map(log => `${log.testId}-${log.questionNumber}`);
        const allSelected = allPageIds.every(id => selectedLogs.has(id));
        
        setSelectedLogs(prev => {
            const next = new Set(prev);
            allPageIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
            return next;
        });
    };

    const handleBulkUpdate = () => {
        if (selectedLogs.size === 0) return;
        pushToHistory(logs);
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

                    if (bulkStatus || bulkQuestionType) {
                        const newMarks = calculateMarks(updatedLog.status, updatedLog.questionType);
                        if (newMarks !== null) updatedLog.marksAwarded = newMarks;
                    }
                    return updatedLog;
                }
                return log;
            })
        );
        handleBulkCancel();
    };

    const handleBulkCancel = () => {
        setSelectedLogs(new Set());
        setBulkTopic(''); setBulkErrorReason(''); setBulkStatus(''); setBulkQuestionType(''); setBulkSubject(''); setBulkTestId('');
    };

    // Data Validation
    const isRowValid = (log: QuestionLog) => {
        // Example: If Wrong, marks shouldn't be positive
        if (log.status === QuestionStatus.Wrong && log.marksAwarded > 0) return false;
        // Example: If Unanswered, marks should be 0 (usually)
        if (log.status === QuestionStatus.Unanswered && log.marksAwarded !== 0) return false;
        return true;
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

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 relative">
            <datalist id="topic-suggestions">
                {useMemo(() => {
                    const topics = new Set<string>();
                    logs.forEach(l => { if (l.topic && l.topic !== 'N/A') topics.add(l.topic); });
                    return Array.from(topics).sort().map(t => <option key={t} value={t} />);
                }, [logs])}
            </datalist>

            <h2 className="text-2xl font-bold mb-4 text-cyan-300">Question Log Editor</h2>
            
            {activeLogFilter && (
                <div className="bg-indigo-900/50 p-3 rounded-lg mb-4 flex justify-between items-center">
                    <p className="text-indigo-200 text-sm">Filtered by AI Assistant.</p>
                    <button onClick={() => setActiveLogFilter(null)} className="bg-indigo-600 hover:bg-indigo-500 text-white py-1 px-3 rounded text-sm">Clear Filter</button>
                </div>
            )}
            
            <div className="p-3 bg-slate-800/60 rounded-md mb-4 flex flex-wrap gap-4 items-center text-sm">
                 <span className="font-semibold text-gray-300">Smart Filters:</span>
                 <div className="flex gap-2">
                     <button onClick={() => setSmartFilter(null)} className={`px-3 py-1 rounded-full text-xs font-semibold ${!smartFilter ? 'bg-cyan-600 text-white' : 'bg-slate-700'}`}>All</button>
                     <button onClick={() => setSmartFilter('highImpact')} className={`px-3 py-1 rounded-full text-xs font-semibold ${smartFilter === 'highImpact' ? 'bg-cyan-600 text-white' : 'bg-slate-700'}`}>High-Impact Errors</button>
                     <button onClick={() => setSmartFilter('careless')} className={`px-3 py-1 rounded-full text-xs font-semibold ${smartFilter === 'careless' ? 'bg-cyan-600 text-white' : 'bg-slate-700'}`}>Careless Mistakes</button>
                 </div>
            </div>

            <div className="mb-4 flex justify-between items-center flex-wrap gap-4">
                <div className="flex gap-4 items-center">
                     <div>
                        <select value={selectedTest} onChange={e => setSelectedTest(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-md p-2 focus:outline-none">
                            <option value="all">All Tests</option>
                            {[...new Set(logs.map(l => l.testId))].map(id => <option key={id} value={id}>{getTestInfo(id).name}</option>)}
                        </select>
                    </div>
                     <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-700 border border-slate-600 rounded-md p-2 focus:outline-none w-64" />
                     {hasActiveFilters && (
                        <button onClick={clearAllFilters} className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded border border-red-800/50 transition-colors" title="Clear All Filters">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                     )}
                </div>
                <div className="flex gap-2">
                    <button onClick={handleRecalculateMarks} className="p-2 bg-slate-700 hover:bg-cyan-600 text-gray-400 hover:text-white rounded border border-slate-600" title="Recalculate Marks">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                    <button onClick={handleUndo} disabled={history.length === 0} className="p-2 bg-slate-700 hover:bg-slate-600 text-gray-400 hover:text-white rounded disabled:opacity-30" title="Undo">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </button>
                    <button onClick={handleRedo} disabled={future.length === 0} className="p-2 bg-slate-700 hover:bg-slate-600 text-gray-400 hover:text-white rounded disabled:opacity-30" title="Redo">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                        </svg>
                    </button>
                    <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex gap-2">Export CSV</button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="min-w-full bg-slate-800 text-sm">
                    <thead className="bg-slate-700/50">
                        <tr>
                            <th className="p-3 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={toggleSelectAllOnPage} 
                                    checked={paginatedLogs.length > 0 && paginatedLogs.every(l => selectedLogs.has(`${l.testId}-${l.questionNumber}`))} 
                                    className="form-checkbox h-4 w-4 bg-slate-600 border-slate-500 text-cyan-500 rounded focus:ring-cyan-500"
                                />
                            </th>
                           {headers.map(header => (
                               <AdvancedHeader
                                    key={header.key}
                                    title={header.title}
                                    field={header.key}
                                    currentSort={sortConfig}
                                    onSort={requestSort}
                                    onFilter={handleColumnFilter}
                                    uniqueValues={getUniqueValues(header.key)}
                                    activeFilters={columnFilters[header.key] || new Set()}
                               />
                           ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedLogs.map(log => {
                            const testInfo = getTestInfo(log.testId);
                            const logId = `${log.testId}-${log.questionNumber}`;
                            const isSelected = selectedLogs.has(logId);
                            const isValid = isRowValid(log);

                            return (
                                <tr key={logId} className={`border-b border-slate-700 ${isSelected ? 'bg-cyan-900/20' : 'hover:bg-slate-700/50'}`}>
                                    <td className="p-2 text-center">
                                        <input type="checkbox" checked={isSelected} onClick={(e) => toggleSelectLog(logId, e)} className="form-checkbox h-4 w-4 bg-slate-600 border-slate-500 text-cyan-500 rounded focus:ring-cyan-500 cursor-pointer" readOnly />
                                    </td>
                                    <td className="p-2 whitespace-nowrap text-center">{testInfo.date ? new Date(testInfo.date).toLocaleDateString() : ''}</td>
                                    <td className="p-2 whitespace-nowrap text-center">{testInfo.name}</td>
                                    <td className="p-2 capitalize text-center">{log.subject}</td>
                                    <td className="p-2 text-center">{log.questionNumber}</td>
                                    <td className="p-1 min-w-[180px]">
                                        <SelectCell value={log.questionType} onChange={v => handleUpdate(log.questionNumber, log.testId, 'questionType', v)} options={Object.values(QuestionType)} />
                                    </td>
                                    <td className="p-1 min-w-[150px]">
                                         <SelectCell value={log.status} onChange={v => handleUpdate(log.questionNumber, log.testId, 'status', v)} options={Object.values(QuestionStatus)} />
                                    </td>
                                    <td className="p-1 w-40">
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="w-12 flex-shrink-0">
                                                <EditableCell value={log.marksAwarded} onChange={v => handleUpdate(log.questionNumber, log.testId, 'marksAwarded', v)} type="number" isInvalid={!isValid} />
                                            </div>
                                            <div className="flex-grow max-w-[80px]"><MarksBar marks={log.marksAwarded} type={log.questionType} /></div>
                                        </div>
                                    </td>
                                    <td className="p-1 min-w-[180px]">
                                        <input type="text" value={log.topic} onChange={e => handleUpdate(log.questionNumber, log.testId, 'topic', e.target.value)} list="topic-suggestions" className="w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none text-center" />
                                    </td>
                                    <td className="p-1 min-w-[150px]">
                                        <SelectCell value={log.reasonForError || ''} onChange={v => handleUpdate(log.questionNumber, log.testId, 'reasonForError', v)} options={['', ...Object.values(ErrorReason)]} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            {totalPages > 1 && (
                <div className="mt-4 flex justify-between items-center text-sm">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50">Previous</button>
                    <span className="text-gray-400">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50">Next</button>
                </div>
            )}

            {/* Floating Bulk Edit Bar */}
            <div className={`fixed bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out ${selectedLogs.size > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="container mx-auto px-4">
                    <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-t-lg shadow-2xl border-t border-x border-slate-600 flex flex-wrap gap-4 items-center justify-between">
                        <p className="font-semibold text-cyan-200">{selectedLogs.size} logs selected.</p>
                        <div className="flex flex-wrap gap-2 items-center">
                             <input type="text" list="topic-suggestions" placeholder="New Topic" value={bulkTopic} onChange={e => setBulkTopic(e.target.value)} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm focus:ring-cyan-500 w-32" />
                            <select value={bulkErrorReason} onChange={e => setBulkErrorReason(e.target.value as ErrorReason)} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm w-32"><option value="">Reason</option>{Object.values(ErrorReason).map(r => <option key={r} value={r}>{r}</option>)}</select>
                            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as QuestionStatus)} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm w-28"><option value="">Status</option>{Object.values(QuestionStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                            <select value={bulkQuestionType} onChange={e => setBulkQuestionType(e.target.value as QuestionType)} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm w-32"><option value="">Type</option>{Object.values(QuestionType).map(qt => <option key={qt} value={qt}>{qt}</option>)}</select>
                             <select value={bulkSubject} onChange={e => setBulkSubject(e.target.value as any)} className="bg-slate-700 border border-slate-600 rounded p-2 text-sm w-24"><option value="">Subject</option><option value="physics">Physics</option><option value="chemistry">Chemistry</option><option value="maths">Maths</option></select>
                            <button onClick={handleBulkCancel} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded text-sm">Cancel</button>
                            <button onClick={handleBulkUpdate} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded text-sm shadow-lg shadow-cyan-500/20">Apply</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Sidebar */}
            <QuickStatsSidebar selectedLogs={selectedLogs} logs={logs} />
        </div>
    );
};