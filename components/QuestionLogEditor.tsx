
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

const MarksBar: React.FC<{ marks: number; type: string; log: QuestionLog }> = ({ marks, type, log }) => {
    const scheme = getMarkingScheme(type, log);
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

const ConfidenceSlider: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
    // Color scale from Red (0) to Green (100)
    const getColor = (v: number) => {
        if (v < 50) return 'accent-red-500';
        if (v < 80) return 'accent-yellow-500';
        return 'accent-green-500';
    };

    return (
        <div className="flex flex-col items-center w-full group relative">
             <div className="flex items-center w-full gap-2">
                <input 
                    type="range" 
                    min="0" max="100" step="10" 
                    value={value || 0} 
                    onChange={e => onChange(parseInt(e.target.value))}
                    className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${getColor(value || 0)}`}
                    title={`Confidence: ${value}%`}
                />
                <span className="text-[10px] w-6 text-right font-mono text-gray-400">{value}%</span>
            </div>
            {/* Tooltip on hover */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 text-[9px] px-1 py-0.5 rounded text-gray-300 border border-slate-700 whitespace-nowrap z-50">
                Confidence Level
            </div>
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
            onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
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

// Replaces SelectCell for fields that allow custom entry (Type, Reason)
const DataListInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, options, placeholder, className }) => {
    const listId = useMemo(() => `list-${Math.random().toString(36).substr(2, 9)}`, []);
    
    return (
        <>
            <input
                list={listId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none text-center ${className}`}
            />
            <datalist id={listId}>
                {options.map((opt) => <option key={opt} value={opt} />)}
            </datalist>
        </>
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
    width?: string;
}

const AdvancedHeader: React.FC<AdvancedHeaderProps> = ({ title, field, currentSort, onSort, onFilter, uniqueValues, activeFilters, width }) => {
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [tempSelected, setTempSelected] = useState<Set<string>>(new Set(activeFilters));
    const menuRef = useRef<HTMLDivElement>(null);

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
        if (tempSelected.size === uniqueValues.length) setTempSelected(new Set());
        else setTempSelected(new Set(uniqueValues));
    };

    return (
        <th className={`p-3 font-semibold text-gray-300 uppercase tracking-wider relative group select-none text-center ${width}`}>
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
// (Unchanged from original)
const QuickStatsSidebar: React.FC<{ selectedLogs: Set<string>; logs: QuestionLog[]; onClose: () => void }> = ({ selectedLogs, logs, onClose }) => {
    const stats = useMemo(() => {
        if (selectedLogs.size === 0) return null;
        
        const selected = logs.filter(l => selectedLogs.has(`${l.testId}-${l.questionNumber}`));
        const count = selected.length;
        const marks = selected.reduce((acc, l) => acc + l.marksAwarded, 0);
        
        const correct = selected.filter(l => l.status === QuestionStatus.FullyCorrect).length;
        const wrong = selected.filter(l => l.status === QuestionStatus.Wrong).length;
        const accuracy = (correct + wrong) > 0 ? (correct / (correct + wrong)) * 100 : 0;

        const reasons: Record<string, number> = {};
        selected.forEach(l => {
            if (l.reasonForError) reasons[l.reasonForError] = (reasons[l.reasonForError] || 0) + 1;
        });
        const topReasonEntry = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
        
        const subjects: Record<string, number> = { physics: 0, chemistry: 0, maths: 0 };
        selected.forEach(l => { if(subjects[l.subject] !== undefined) subjects[l.subject]++; });

        return { count, marks, accuracy, topReason: topReasonEntry, subjects };
    }, [selectedLogs, logs]);

    return (
        <div 
            className={`fixed right-6 top-24 bottom-24 w-80 bg-slate-800/95 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl transform transition-all duration-500 ease-in-out z-40 overflow-hidden ${selectedLogs.size > 0 ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}
        >
            {stats && (
                <div className="flex flex-col h-full relative">
                    <button 
                        onClick={onClose} 
                        className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-50 p-1 bg-slate-700/50 rounded-full hover:bg-slate-600"
                        title="Deselect All"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>

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
    
    const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
    const lastSelectedId = useRef<string | null>(null);

    // Bulk edit state
    const [bulkTopic, setBulkTopic] = useState('');
    const [bulkErrorReason, setBulkErrorReason] = useState('');
    const [bulkStatus, setBulkStatus] = useState<QuestionStatus | ''>('');
    const [bulkQuestionType, setBulkQuestionType] = useState('');
    const [bulkSubject, setBulkSubject] = useState<'physics' | 'chemistry' | 'maths' | ''>('');
    const [bulkTestId, setBulkTestId] = useState<string>('');
    const [bulkConfidence, setBulkConfidence] = useState<number>(0);

    const [history, setHistory] = useState<QuestionLog[][]>([]);
    const [future, setFuture] = useState<QuestionLog[][]>([]);

    // Dynamic Lists for Dropdowns
    const uniqueQuestionTypes = useMemo(() => {
        const types = new Set(Object.values(QuestionType)); // Standard values from Enum
        logs.forEach(l => { if (l.questionType) types.add(l.questionType as any); });
        return Array.from(types).sort();
    }, [logs]);

    const uniqueErrorReasons = useMemo(() => {
        const reasons = new Set(Object.values(ErrorReason)); // Standard values
        logs.forEach(l => { if (l.reasonForError) reasons.add(l.reasonForError as any); });
        return Array.from(reasons).sort();
    }, [logs]);

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
            const updatedLog = { ...log };
            
            // Backfill marking scheme if explicit fields are missing
            if (updatedLog.positiveMarks === undefined || updatedLog.negativeMarks === undefined) {
                const scheme = getMarkingScheme(updatedLog.questionType, updatedLog);
                updatedLog.positiveMarks = scheme.correct;
                updatedLog.negativeMarks = scheme.wrong;
            }

            // Calculate marks using new/existing scheme
            const newMarks = calculateMarks(updatedLog.status, updatedLog.questionType, updatedLog);
            if (newMarks !== null) updatedLog.marksAwarded = newMarks;
            
            return updatedLog;
        }));
    };

    const handleExport = () => { exportLogsToCsv(logs, reports); };

    const reportInfoMap = useMemo(() => {
        const map = new Map<string, { name: string, date: string }>();
        reports.forEach(r => map.set(r.id, { name: r.testName, date: r.testDate }));
        return map;
    }, [reports]);

    const getTestInfo = useCallback((testId: string) => {
        return reportInfoMap.get(testId) || { name: 'Unknown Test', date: '' };
    }, [reportInfoMap]);

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
        if (activeLogFilter) {
            logsToFilter = logsToFilter.filter(log => {
                return Object.entries(activeLogFilter).every(([key, value]) => {
                    if (!value) return true;
                    return String(log[key as keyof QuestionLog]).toLowerCase() === String(value).toLowerCase();
                });
            });
        }
        if (smartFilter) {
            if (smartFilter === 'highImpact') logsToFilter = logsToFilter.filter(log => log.marksAwarded < 0);
            else if (smartFilter === 'careless') logsToFilter = logsToFilter.filter(log => log.reasonForError === ErrorReason.SillyMistake || log.reasonForError === ErrorReason.MisreadQuestion);
        }
        const lowercasedSearch = searchTerm.toLowerCase();
        logsToFilter = logsToFilter.filter(log => 
            (selectedTest === 'all' || log.testId === selectedTest) &&
            (searchTerm.trim() === '' ||
             log.questionNumber.toString().includes(lowercasedSearch) ||
             log.topic.toLowerCase().includes(lowercasedSearch))
        );
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
            if (sortConfig.key === 'date') return sortConfig.direction === 'ascending' ? new Date(aValue).getTime() - new Date(bValue).getTime() : new Date(bValue).getTime() - new Date(aValue).getTime();
            if (typeof aValue === 'number' && typeof bValue === 'number') return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
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
            if (prev?.key === key && prev.direction === 'descending') return null;
            return { key, direction: 'ascending' };
        });
    };

    const handleUpdate = (qNumber: number, testId: string, field: keyof QuestionLog, value: any) => {
        pushToHistory(logs);
        setLogs(prevLogs =>
            prevLogs.map(log => {
                if (log.questionNumber === qNumber && log.testId === testId) {
                    const updatedLog = { ...log, [field]: value };
                    if (field === 'status' || field === 'questionType' || field === 'positiveMarks' || field === 'negativeMarks') {
                        // If questionType string has markings like "Type (+4, -1)", 
                        // marksAwarded will recalculate automatically via calculateMarks utility
                        // AND/OR if positive/negativeMarks are set explicitly.
                        const newMarks = calculateMarks(updatedLog.status, updatedLog.questionType, updatedLog);
                        if (newMarks !== null) updatedLog.marksAwarded = newMarks;
                    }
                    return updatedLog;
                }
                return log;
            })
        );
    };

    const toggleSelectLog = (logId: string, event: React.MouseEvent<HTMLInputElement>) => {
        setSelectedLogs(prev => {
            const newSet = new Set(prev);
            if (event.shiftKey && lastSelectedId.current) {
                const allIds = paginatedLogs.map(l => `${l.testId}-${l.questionNumber}`);
                const startIdx = allIds.indexOf(lastSelectedId.current);
                const endIdx = allIds.indexOf(logId);
                if (startIdx !== -1 && endIdx !== -1) {
                    const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
                    const rangeIds = allIds.slice(min, max + 1);
                    const shouldSelect = !newSet.has(logId);
                    rangeIds.forEach(id => { if (shouldSelect) newSet.add(id); else newSet.delete(id); });
                }
            } else {
                if (newSet.has(logId)) newSet.delete(logId); else newSet.add(logId);
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
                    if (bulkSubject) updatedLog.subject = bulkSubject;
                    if (bulkTestId) updatedLog.testId = bulkTestId;
                    if (bulkConfidence > 0) updatedLog.confidence = bulkConfidence;
                    
                    if (bulkQuestionType) {
                        updatedLog.questionType = bulkQuestionType;
                        // Parse if type string contains marks e.g. "Custom (+10, -2)"
                        const scheme = getMarkingScheme(bulkQuestionType); 
                        // Note: getMarkingScheme extracts from string if defined there
                        // We can optionally force update explicit positive/negative fields if matched
                        // But getMarkingScheme only returns {correct, wrong}.
                        // We should check if the string matches pattern to update explicit fields
                        const match = bulkQuestionType.match(/\(\s*\+(\d+)\s*,\s*(-?\d+)\s*\)/);
                        if (match) {
                            updatedLog.positiveMarks = parseInt(match[1], 10);
                            updatedLog.negativeMarks = parseInt(match[2], 10);
                        }
                    }

                    // Recalculate marks if status or type changed
                    if (bulkStatus || bulkQuestionType) {
                        const newMarks = calculateMarks(updatedLog.status, updatedLog.questionType, updatedLog);
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
        setBulkTopic(''); setBulkErrorReason(''); setBulkStatus(''); setBulkQuestionType(''); setBulkSubject(''); setBulkTestId(''); setBulkConfidence(0);
    };

    const isRowValid = (log: QuestionLog) => {
        if (log.status === QuestionStatus.Wrong && log.marksAwarded > 0) return false;
        if (log.status === QuestionStatus.Unanswered && log.marksAwarded !== 0) return false;
        return true;
    };

    const headers: { title: string; key: SortKey; width?: string }[] = [
        { title: 'Date', key: 'date' },
        { title: 'Test Name', key: 'testName' },
        { title: 'Subject', key: 'subject' },
        { title: 'Q. No.', key: 'questionNumber' },
        { title: 'Question Type', key: 'questionType' },
        { title: 'Status', key: 'status' },
        { title: 'Marks Awarded', key: 'marksAwarded' },
        { title: 'Confidence', key: 'confidence' as SortKey, width: 'w-24' },
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
                    <button onClick={handleRecalculateMarks} className="p-2 bg-slate-700 hover:bg-cyan-600 text-gray-400 hover:text-white rounded border border-slate-600 flex items-center gap-1" title="Recalculate Marks & Auto-fill Missing">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        <span className="text-xs font-bold hidden sm:inline">Recalculate</span>
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
                                    width={header.width}
                               />
                           ))}
                           <th className="p-3 font-semibold text-gray-300 text-center w-14" title="Positive Marks">+ve</th>
                           <th className="p-3 font-semibold text-gray-300 text-center w-14" title="Negative Marks">-ve</th>
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
                                        <DataListInput
                                            value={log.questionType || ''}
                                            onChange={v => handleUpdate(log.questionNumber, log.testId, 'questionType', v)}
                                            options={uniqueQuestionTypes}
                                        />
                                    </td>
                                    <td className="p-1 min-w-[150px]">
                                         <SelectCell value={log.status} onChange={v => handleUpdate(log.questionNumber, log.testId, 'status', v)} options={Object.values(QuestionStatus)} />
                                    </td>
                                    <td className="p-1 w-40">
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="w-12 flex-shrink-0">
                                                <EditableCell value={log.marksAwarded} onChange={v => handleUpdate(log.questionNumber, log.testId, 'marksAwarded', v)} type="number" isInvalid={!isValid} />
                                            </div>
                                            <div className="flex-grow max-w-[80px]"><MarksBar marks={log.marksAwarded} type={log.questionType} log={log} /></div>
                                        </div>
                                    </td>
                                    <td className="p-1 min-w-[100px]">
                                        <ConfidenceSlider 
                                            value={log.confidence || 0}
                                            onChange={(val) => handleUpdate(log.questionNumber, log.testId, 'confidence', val)}
                                        />
                                    </td>
                                    <td className="p-1 min-w-[180px]">
                                        <input type="text" value={log.topic} onChange={e => handleUpdate(log.questionNumber, log.testId, 'topic', e.target.value)} list="topic-suggestions" className="w-full bg-transparent p-1 border border-transparent focus:border-cyan-500 focus:bg-slate-700 rounded-md focus:outline-none text-center" />
                                    </td>
                                    <td className="p-1 min-w-[150px]">
                                        <DataListInput 
                                            value={log.reasonForError || ''} 
                                            onChange={v => handleUpdate(log.questionNumber, log.testId, 'reasonForError', v)} 
                                            options={uniqueErrorReasons}
                                        />
                                    </td>
                                    <td className="p-1 w-14">
                                        <EditableCell 
                                            value={log.positiveMarks ?? ''} 
                                            onChange={v => handleUpdate(log.questionNumber, log.testId, 'positiveMarks', v)} 
                                            type="number"
                                            className="text-green-400 font-bold"
                                        />
                                    </td>
                                    <td className="p-1 w-14">
                                        <EditableCell 
                                            value={log.negativeMarks ?? ''} 
                                            onChange={v => handleUpdate(log.questionNumber, log.testId, 'negativeMarks', v)} 
                                            type="number" 
                                            className="text-red-400 font-bold"
                                        />
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

            {/* Floating Bulk Edit Bar (Glassmorphism) */}
            <div className={`fixed bottom-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out ${selectedLogs.size > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="container mx-auto px-4 pb-4">
                    <div className="bg-slate-800/90 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-600/50 flex flex-wrap gap-4 items-center justify-between ring-1 ring-white/10">
                        <p className="font-semibold text-cyan-200 flex items-center gap-2"><span className="bg-cyan-900/50 px-2 py-0.5 rounded border border-cyan-700/50">{selectedLogs.size}</span> logs selected</p>
                        <div className="flex flex-wrap gap-2 items-center">
                             <input type="text" list="topic-suggestions" placeholder="Set Topic" value={bulkTopic} onChange={e => setBulkTopic(e.target.value)} className="bg-slate-700/50 border border-slate-600 rounded p-2 text-sm focus:ring-cyan-500 w-32 text-white placeholder-gray-400" />
                            
                            <DataListInput 
                                value={bulkErrorReason} 
                                onChange={setBulkErrorReason} 
                                options={uniqueErrorReasons} 
                                placeholder="Set Reason"
                                className="bg-slate-700/50 border-slate-600 w-32 text-left px-2"
                            />

                            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as QuestionStatus)} className="bg-slate-700/50 border border-slate-600 rounded p-2 text-sm w-28 text-white"><option value="">Set Status</option>{Object.values(QuestionStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                            
                            <div className="flex items-center gap-2 px-2 bg-slate-700/50 rounded border border-slate-600" title="Set Bulk Confidence">
                                <span className="text-xs text-gray-400">Conf:</span>
                                <input type="range" min="0" max="100" step="10" value={bulkConfidence} onChange={e => setBulkConfidence(parseInt(e.target.value))} className="w-16 h-1 bg-slate-500 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                                <span className="text-xs w-6">{bulkConfidence}%</span>
                            </div>

                            <DataListInput 
                                value={bulkQuestionType} 
                                onChange={setBulkQuestionType} 
                                options={uniqueQuestionTypes} 
                                placeholder="Set Type (+4,-1)"
                                className="bg-slate-700/50 border-slate-600 w-40 text-left px-2"
                            />

                             <select value={bulkSubject} onChange={e => setBulkSubject(e.target.value as any)} className="bg-slate-700/50 border border-slate-600 rounded p-2 text-sm w-24 text-white"><option value="">Subject</option><option value="physics">Physics</option><option value="chemistry">Chemistry</option><option value="maths">Maths</option></select>
                            
                            <div className="h-8 w-px bg-slate-600 mx-2"></div>
                            
                            <button onClick={handleBulkCancel} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded text-sm border border-slate-600 transition-colors">Cancel</button>
                            <button onClick={handleBulkUpdate} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded text-sm shadow-lg shadow-cyan-500/20 border border-cyan-500 transition-all transform hover:scale-105">Apply All</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Sidebar */}
            <QuickStatsSidebar selectedLogs={selectedLogs} logs={logs} onClose={() => setSelectedLogs(new Set())} />
        </div>
    );
};
