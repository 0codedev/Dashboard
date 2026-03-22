import React, { useState, useEffect } from 'react';
import { Reflection } from '../types';
import { analyzeReflection } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Tag, Target, Link as LinkIcon, Sparkles, Plus, Search, Calendar, Trash2 } from 'lucide-react';

interface ReflectionsTabProps {
    apiKey: string;
    reflections: Reflection[];
    setReflections: React.Dispatch<React.SetStateAction<Reflection[]>>;
}

export const ReflectionsTab: React.FC<ReflectionsTabProps> = ({ apiKey, reflections, setReflections }) => {
    const [selectedReflection, setSelectedReflection] = useState<Reflection | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSave = async () => {
        if (!newContent.trim()) return;
        setIsAnalyzing(true);
        
        try {
            const analysis = await analyzeReflection(newContent, apiKey);
            
            const newReflection: Reflection = {
                id: `ref-${Date.now()}`,
                timestamp: Date.now(),
                content: newContent,
                tags: analysis.tags,
                aiSummary: analysis.summary,
                actionItems: analysis.actionItems,
                relatedTopics: analysis.relatedTopics,
                mood: analysis.mood
            };

            setReflections(prev => [newReflection, ...prev]);
            setIsCreating(false);
            setNewContent('');
            setSelectedReflection(newReflection);
        } catch (error) {
            console.error("Failed to analyze reflection", error);
            // Fallback save without AI
            const newReflection: Reflection = {
                id: `ref-${Date.now()}`,
                timestamp: Date.now(),
                content: newContent,
                tags: [],
            };
            setReflections(prev => [newReflection, ...prev]);
            setIsCreating(false);
            setNewContent('');
            setSelectedReflection(newReflection);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDelete = (id: string) => {
        setReflections(prev => prev.filter(r => r.id !== id));
        if (selectedReflection?.id === id) {
            setSelectedReflection(null);
        }
    };

    const filteredReflections = reflections.filter(r => 
        r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const getMoodEmoji = (mood?: string) => {
        switch (mood) {
            case 'eureka': return '💡';
            case 'frustrated': return '😫';
            case 'confident': return '😎';
            case 'confused': return '🤔';
            default: return '📝';
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">
            {/* Sidebar List */}
            <div className="w-1/3 glass-panel rounded-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <PenTool className="w-5 h-5 text-indigo-400" />
                            Journal
                        </h2>
                        <button 
                            onClick={() => { setIsCreating(true); setSelectedReflection(null); setNewContent(''); }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors"
                            title="New Reflection"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search reflections..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {filteredReflections.length === 0 ? (
                        <div className="text-center text-slate-500 mt-8">
                            No reflections found.
                        </div>
                    ) : (
                        filteredReflections.map(ref => (
                            <div 
                                key={ref.id}
                                onClick={() => { setSelectedReflection(ref); setIsCreating(false); }}
                                className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedReflection?.id === ref.id ? 'bg-indigo-900/40 border-indigo-500/50' : 'bg-slate-900/40 border-slate-700/50 hover:bg-slate-800'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(ref.timestamp).toLocaleDateString()}
                                    </span>
                                    <span title={ref.mood}>{getMoodEmoji(ref.mood)}</span>
                                </div>
                                <p className="text-sm text-slate-300 line-clamp-2">{ref.content}</p>
                                {ref.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {ref.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">#{tag}</span>
                                        ))}
                                        {ref.tags.length > 3 && <span className="text-[10px] text-slate-500">+{ref.tags.length - 3}</span>}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col">
                {isCreating ? (
                    <div className="p-6 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-white">New Reflection</h2>
                        </div>
                        <textarea
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    handleSave();
                                }
                            }}
                            placeholder="What did you learn today? Any 'Aha!' moments or silly mistakes? (Press Ctrl+Enter to save)"
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-indigo-500 custom-scrollbar mb-4"
                        />
                        <div className="flex justify-end">
                            <button 
                                onClick={handleSave}
                                disabled={isAnalyzing || !newContent.trim()}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Sparkles className="w-4 h-4 animate-spin" />
                                        Analyzing & Saving...
                                    </>
                                ) : (
                                    'Save Reflection'
                                )}
                            </button>
                        </div>
                    </div>
                ) : selectedReflection ? (
                    <div className="p-6 overflow-y-auto custom-scrollbar h-full">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-2xl" title={selectedReflection.mood}>{getMoodEmoji(selectedReflection.mood)}</span>
                                    <span className="text-sm text-slate-400 flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(selectedReflection.timestamp).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {selectedReflection.tags.map(tag => (
                                        <span key={tag} className="text-xs bg-indigo-900/30 text-indigo-300 border border-indigo-700/50 px-2 py-1 rounded-full flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={() => handleDelete(selectedReflection.id)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                title="Delete Reflection"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/50 mb-6">
                            <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedReflection.content}</p>
                        </div>

                        {selectedReflection.aiSummary && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-indigo-900/20 rounded-xl p-5 border border-indigo-500/20">
                                    <h3 className="text-indigo-300 font-semibold flex items-center gap-2 mb-3">
                                        <Sparkles className="w-4 h-4" /> AI Summary
                                    </h3>
                                    <p className="text-sm text-indigo-100/80">{selectedReflection.aiSummary}</p>
                                </div>
                                
                                {selectedReflection.actionItems && selectedReflection.actionItems.length > 0 && (
                                    <div className="bg-emerald-900/20 rounded-xl p-5 border border-emerald-500/20">
                                        <h3 className="text-emerald-300 font-semibold flex items-center gap-2 mb-3">
                                            <Target className="w-4 h-4" /> Action Items
                                        </h3>
                                        <ul className="space-y-2">
                                            {selectedReflection.actionItems.map((item, i) => (
                                                <li key={i} className="text-sm text-emerald-100/80 flex items-start gap-2">
                                                    <span className="text-emerald-500 mt-0.5">•</span> {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {selectedReflection.relatedTopics && selectedReflection.relatedTopics.length > 0 && (
                                    <div className="bg-cyan-900/20 rounded-xl p-5 border border-cyan-500/20 md:col-span-2">
                                        <h3 className="text-cyan-300 font-semibold flex items-center gap-2 mb-3">
                                            <LinkIcon className="w-4 h-4" /> Related Topics
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedReflection.relatedTopics.map((topic, i) => (
                                                <span key={i} className="text-xs bg-cyan-900/40 text-cyan-200 px-2 py-1 rounded">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                        <PenTool className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-semibold text-slate-400 mb-2">Your Learning Journal</h3>
                        <p className="max-w-md">Select a past reflection to review your insights, or create a new one to document your 'Aha!' moments and mistakes.</p>
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="mt-6 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Start Writing
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
