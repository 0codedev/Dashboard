
import React, { useState, useEffect } from 'react';
import type { View, GlobalFilter, UserProfile, Toast } from '../../types';
import { GlobalFilterBar } from '../GlobalFilterBar';
import { Button } from '../common/Button';
import { ToastContainer } from '../common/Toast';

interface AppShellProps {
    view: View;
    setView: (view: View) => void;
    userProfile: UserProfile;
    globalFilter: GlobalFilter;
    setGlobalFilter: (filter: GlobalFilter) => void;
    availableTestTypes: string[];
    availableSubTypes: string[];
    toasts: Toast[];
    setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
    children: React.ReactNode;
}

const NavItem: React.FC<{
    viewId: View;
    label: string;
    currentView: View;
    setView: (view: View) => void;
    children: React.ReactNode;
    onClick?: () => void;
}> = ({ viewId, label, currentView, setView, children, onClick }) => {
    const isActive = viewId === currentView;
    return (
        <div className="sidebar-tooltip-container w-full px-2">
            <div 
                className={`relative w-full rounded-xl transition-colors duration-200 ${isActive ? 'bg-slate-800' : ''}`}
            >
                {isActive && (
                    <div 
                        className="absolute -left-2 top-1/2 -translate-y-1/2 h-8 w-1 bg-cyan-400 rounded-r-full"
                        style={{boxShadow: '0 0 8px rgba(34, 211, 238, 0.7)'}}
                    ></div>
                )}
                <button
                    onClick={() => { setView(viewId); if (onClick) onClick(); }}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    className="sidebar-button group w-full h-12 flex items-center justify-center rounded-lg"
                >
                    <div className={`transition-colors ${isActive ? 'sidebar-icon-active' : 'sidebar-icon-inactive group-hover:sidebar-icon-active'}`}>
                        {children}
                    </div>
                </button>
            </div>

            {/* Tooltip */}
            <div className="sidebar-tooltip absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-slate-800 text-slate-100 text-xs font-semibold rounded-md shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                {label}
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-800 border-l border-b border-slate-700 transform rotate-45"></div>
            </div>
        </div>
    );
};

const navItems: { id: View, label: string, icon: React.ReactNode }[] = [
    { id: 'daily-planner', label: 'Daily Planner', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { id: 'dashboard', label: 'Dashboard', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { id: 'syllabus', label: 'Syllabus', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'detailed-reports', label: 'Reports', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: 'deep-analysis', label: 'Deep Analysis', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { id: 'root-cause', label: 'Root Cause', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
    { id: 'question-log-editor', label: 'Logs', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { id: 'ai-assistant', label: 'AI Coach', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> },
    { id: 'data-entry', label: 'Add Report', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'achievements', label: 'Awards', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg> },
];

const CommandPalette: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    setView: (view: View) => void; 
}> = ({ isOpen, onClose, setView }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const commands = [
        { id: 'daily-planner', label: 'Go to Daily Planner', category: 'Navigation', action: () => setView('daily-planner') },
        { id: 'dashboard', label: 'Go to Dashboard', category: 'Navigation', action: () => setView('dashboard') },
        { id: 'root-cause', label: 'Analyze Root Causes', category: 'Analysis', action: () => setView('root-cause') },
        { id: 'add-report', label: 'Add New Test Report', category: 'Action', action: () => setView('data-entry') },
        { id: 'ai-chat', label: 'Ask AI Coach', category: 'Action', action: () => setView('ai-assistant') },
    ];

    const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setSelectedIndex(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center border-b border-slate-800 px-4">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input
                        ref={inputRef}
                        className="w-full bg-transparent border-none py-4 px-3 text-gray-200 focus:outline-none text-lg placeholder-gray-600"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                    {filteredCommands.length > 0 ? (
                        <ul className="py-2">
                            {filteredCommands.map((cmd, index) => (
                                <li
                                    key={cmd.id}
                                    className={`px-4 py-3 flex justify-between items-center cursor-pointer ${index === selectedIndex ? 'bg-[rgb(var(--color-primary-rgb))] text-white' : 'text-gray-300 hover:bg-slate-800'}`}
                                    onClick={() => { cmd.action(); onClose(); }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <span>{cmd.label}</span>
                                    <span className={`text-xs opacity-60 ${index === selectedIndex ? 'text-white' : 'text-gray-500'}`}>{cmd.category}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="px-4 py-6 text-center text-gray-500">No results found.</div>
                    )}
                </div>
                <div className="bg-slate-800/50 px-4 py-2 text-xs text-gray-500 border-t border-slate-800 flex justify-between">
                    <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded">↑↓</kbd> to navigate</span>
                    <span><kbd className="bg-slate-700 px-1.5 py-0.5 rounded">↵</kbd> to select</span>
                </div>
            </div>
        </div>
    );
};

export const AppShell: React.FC<AppShellProps> = ({ view, setView, userProfile, globalFilter, setGlobalFilter, availableTestTypes, availableSubTypes, toasts, setToasts, children }) => {
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsPaletteOpen(prev => !prev);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="relative z-10 flex h-full w-full bg-slate-900">
            <ToastContainer toasts={toasts} setToasts={setToasts} />
            <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} setView={setView} />
            
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 z-50 w-16 bg-[#0F172A] border-r border-slate-800 flex flex-col items-center py-4
                transform transition-transform duration-300 ease-in-out md:transform-none
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="w-10 h-10 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-center text-cyan-400 font-bold text-lg shadow-lg mb-6 shrink-0">J</div>
                
                <nav aria-label="Main Navigation" className="flex-grow flex flex-col gap-y-2 w-full items-center overflow-y-auto md:overflow-visible hide-scrollbar">
                    {navItems.map(item => (
                        <NavItem 
                            key={item.id} 
                            viewId={item.id} 
                            label={item.label} 
                            currentView={view} 
                            setView={setView} 
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            {item.icon}
                        </NavItem>
                    ))}
                </nav>

                <div className="mt-auto pt-4 w-full flex flex-col items-center">
                     <NavItem 
                        viewId="settings" 
                        label="Settings" 
                        currentView={view} 
                        setView={setView} 
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </NavItem>
                </div>
            </aside>
            
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <header className="h-16 bg-slate-900 border-b border-slate-800 flex-shrink-0 flex items-center px-4 z-30 relative justify-between">
                    {/* Mobile Menu Button */}
                    <button 
                        className="md:hidden text-gray-400 hover:text-white p-2 -ml-2"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Centered Filter Bar */}
                    <div className="flex-1 flex justify-center px-2 overflow-x-auto md:overflow-visible hide-scrollbar">
                        <GlobalFilterBar filter={globalFilter} setFilter={setGlobalFilter} testTypes={availableTestTypes} subTypes={availableSubTypes} />
                    </div>
                    
                    {/* Right Actions */}
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                        <button 
                            className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                            onClick={() => setIsPaletteOpen(true)}
                            title="Search"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                        
                        <div className="h-6 w-[1px] bg-slate-800 mx-1"></div>

                        <div className="flex items-center gap-2">
                            <span className="hidden md:block text-sm font-medium text-slate-300 max-w-[100px] truncate text-right">
                                {userProfile.name || 'Student'}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </header>

                <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 bg-transparent focus:outline-none">
                    {children}
                </main>
            </div>
        </div>
    );
};
