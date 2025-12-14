
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import type { TestReport, QuestionLog, RootCauseFilter, LongTermGoal, QuizQuestion, UserProfile, ExamStrategy } from '../types';
import {
  LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { generateContextualInsight, getAIAnalysis, generateDashboardInsight, generateChartAnalysis, generateOracleDrill } from '../services/geminiService';
import { SUBJECT_CONFIG } from '../constants';
import Modal from './common/Modal';
import CustomTooltip from './common/CustomTooltip';
import { useDashboardKpis } from '../hooks/useDashboardAnalytics';
import { 
    PaperStrategyWidget, 
    StrategicROIWidget, 
    RankPredictorWidget, 
    PercentilePredictorWidget, 
    VolatilityWidget,
    PerformanceTrendWidget,
    SubjectComparisonWidget,
    SubjectRadarWidget,
    CalendarHeatmapWidget,
    RankSimulatorWidget,
    GoalProgressWidget,
    OracleWidget, 
    CalibrationWidget 
} from './DashboardWidgets';
import { CompetitorLeaderboard } from './competitors/CompetitorLeaderboard';
import { Button } from './common/Button';
import { OracleChamber } from './OracleChamber';
import { MarkdownRenderer } from './common/MarkdownRenderer';

interface DashboardProps {
  reports: TestReport[];
  logs: QuestionLog[];
  apiKey: string;
  setView: (view: 'root-cause') => void;
  setRootCauseFilter: (filter: RootCauseFilter) => void;
  onStartFocusSession: (topic: string) => void;
  longTermGoals: LongTermGoal[];
  modelName?: string;
  userProfile: UserProfile;
  onUpdateProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
}

type WidgetId = 'heatmap' | 'performanceTrend' | 'subjectComparison' | 'subjectStrengthsRadar' | 'percentilePredictor' | 'aiAnalysis' | 'strategicROI' | 'paperStrategy' | 'rankPredictor' | 'volatility' | 'rankSimulator' | 'goalProgress' | 'oracle' | 'calibration' | 'competitors';

interface WidgetLayout {
    id: WidgetId;
    visible: boolean;
    size: 'normal' | 'wide';
}

const DEFAULT_DASHBOARD_LAYOUT: WidgetLayout[] = [
    { id: 'oracle', visible: true, size: 'normal' },
    { id: 'calibration', visible: true, size: 'normal' },
    { id: 'competitors', visible: true, size: 'normal' },
    { id: 'heatmap', visible: true, size: 'wide' },
    { id: 'volatility', visible: true, size: 'normal' },
    { id: 'performanceTrend', visible: true, size: 'normal' },
    { id: 'rankSimulator', visible: true, size: 'normal' },
    { id: 'goalProgress', visible: true, size: 'normal' },
    { id: 'strategicROI', visible: true, size: 'wide' },
    { id: 'paperStrategy', visible: true, size: 'wide' },
    { id: 'rankPredictor', visible: true, size: 'wide' },
    { id: 'subjectComparison', visible: true, size: 'normal' },
    { id: 'subjectStrengthsRadar', visible: true, size: 'normal' },
    { id: 'percentilePredictor', visible: true, size: 'normal' },
    { id: 'aiAnalysis', visible: true, size: 'wide' },
];

// ... (Insight Banner and KPI Component imports omitted for brevity, assuming standard imports work in context)
// Re-declaring local components for completeness in file replacement

const InsightBanner: React.FC<{ reports: TestReport[], apiKey: string }> = ({ reports, apiKey }) => {
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchInsight = async () => {
            const cached = sessionStorage.getItem('dashboardDailyInsight');
            const cachedDate = sessionStorage.getItem('dashboardDailyInsightDate');
            const today = new Date().toDateString();

            if (cached && cachedDate === today) {
                setInsight(cached);
                return;
            }

            if (reports.length === 0) return;

            setLoading(true);
            const text = await generateDashboardInsight(reports, apiKey);
            setInsight(text);
            sessionStorage.setItem('dashboardDailyInsight', text);
            sessionStorage.setItem('dashboardDailyInsightDate', today);
            setLoading(false);
        };
        fetchInsight();
    }, [reports, apiKey]);

    if (!insight && !loading) return null;

    return (
        <div className="w-full mb-6 relative group overflow-hidden rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <div className="relative z-10 p-4 flex items-center justify-center text-center">
                {loading ? (
                    <div className="flex items-center gap-2 text-indigo-300 text-sm animate-pulse">
                        <span className="text-xl">✨</span> Analyze Intelligence...
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <p className="text-indigo-200 font-medium text-lg tracking-wide leading-relaxed drop-shadow-md">
                            <span className="mr-2 text-2xl">💡</span> 
                            {insight}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ... (KPICard components etc remain unchanged)
const ReadinessGauge: React.FC<{ score: number }> = ({ score }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    let color = 'text-cyan-400';
    if (score < 40) color = 'text-red-400';
    else if (score < 75) color = 'text-yellow-400';

    return (
        <div className="flex items-center justify-center h-full w-full gap-4">
            <div className="relative w-20 h-20">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 70 70">
                    <circle cx="35" cy="35" r={radius} fill="none" stroke="#334155" strokeWidth="6" />
                    <circle 
                        cx="35" cy="35" r={radius} fill="none" stroke="currentColor" strokeWidth="6" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={offset} 
                        strokeLinecap="round"
                        className={`${color} transition-all duration-1000 ease-out`}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-bold ${color}`}>{score.toFixed(0)}%</span>
                </div>
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold text-white tracking-tight">Exam Ready</span>
                <span className="text-xs text-gray-400">Based on consistency & accuracy</span>
            </div>
        </div>
    );
};

const useCountUp = (endValue: number, duration: number = 1500) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        let frame = 0;
        const frameRate = 1000 / 60;
        const totalFrames = Math.round(duration / frameRate);
        
        const counter = setInterval(() => {
            frame++;
            const progress = (frame / totalFrames);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = endValue * easedProgress;
            
            if (frame === totalFrames) {
                clearInterval(counter);
                setCount(endValue);
            } else {
                setCount(currentValue);
            }
        }, frameRate);

        return () => clearInterval(counter);
    }, [endValue, duration]);
    
    const isRank = Math.abs(endValue) > 1000;
    if (isRank) return Math.round(count).toLocaleString();

    const hasDecimal = endValue % 1 !== 0;
    return hasDecimal ? count.toFixed(1) : Math.round(count).toLocaleString();
};

interface KPICardProps {
  title: string;
  value: number | string;
  suffix?: string;
  subtitle?: string;
  comparison?: { diff: number; trend: 'up' | 'down' | 'flat'; };
  trendData?: { value: number }[];
  isGauge?: boolean;
  action?: { label: string, onClick: () => void };
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = React.memo(({ title, value, suffix = '', comparison, subtitle, trendData, isGauge, action, onClick }) => {
  const isNumeric = typeof value === 'number';
  const animatedValue = useCountUp(isNumeric ? value as number : 0);
  const displayValue = isNumeric ? animatedValue : value;
  
  const trendIcon = comparison?.trend === 'up' ? '▲' : comparison?.trend === 'down' ? '▼' : null;
  const isRank = title.toLowerCase().includes('rank');

  let trendColor = 'text-gray-400';
  let chartColor = '#22d3ee'; // Cyan

  if (comparison?.trend === 'up') {
      trendColor = isRank ? 'text-red-400' : 'text-green-400';
  } else if (comparison?.trend === 'down') {
      trendColor = isRank ? 'text-green-400' : 'text-red-400';
  }

  const formattedDiff = comparison ? `${comparison.diff > 0 ? '+' : ''}${isRank ? Math.round(comparison.diff) : comparison.diff.toFixed(1)}` : '';
  const cardId = `kpi-${title.replace(/\s+/g, '-').toLowerCase()}`;

  if (isGauge && isNumeric) {
      return (
          <div className="bg-slate-800/90 p-3 rounded-lg shadow-lg border border-slate-700 flex flex-col relative overflow-hidden h-28 cursor-default">
              <ReadinessGauge score={value as number} />
          </div>
      )
  }

  return (
    <div 
      className={`group bg-slate-800/90 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col justify-between flex-1 transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-500/20 relative overflow-hidden h-28 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className={`relative z-10 flex flex-col h-full justify-between pointer-events-none transition-opacity duration-300 ${trendData ? 'group-hover:opacity-0' : ''}`}>
        <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
            <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold text-white tracking-tight">{displayValue}{suffix}</p>
                {comparison && comparison.trend !== 'flat' && (
                    <span className={`text-[10px] font-bold ${trendColor} flex items-center bg-slate-900/50 px-1.5 rounded-full backdrop-blur-sm border border-slate-700/50`}>
                    {trendIcon} {Math.abs(Number(formattedDiff))}
                    </span>
                )}
            </div>
        </div>
      
        {(comparison || subtitle) && !action && (
            <p className="text-[9px] text-gray-500 font-medium tracking-wide">{subtitle ? subtitle : 'vs. Average'}</p>
        )}
        
        {action && (
            <div className="mt-auto pt-2 pointer-events-auto">
                <button onClick={(e) => { 
                    e.stopPropagation(); 
                    action.onClick();
                }} 
                className="relative z-20 text-[10px] bg-slate-700/80 hover:bg-cyan-600 text-white px-2 py-1 rounded transition-colors flex items-center gap-1 w-max border border-slate-600 font-semibold">
                    <span className="text-yellow-300">⚡</span> {action.label}
                </button>
            </div>
        )}
      </div>

      {trendData && (
        <div className="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 35, right: -1, left: -1, bottom: 0 }}>
              <defs>
                  <linearGradient id={`gradient-${cardId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.5}/>
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
                  </linearGradient>
              </defs>
              <YAxis domain={['dataMin - (dataMax - dataMin) * 0.1', 'dataMax + (dataMax - dataMin) * 0.1']} hide reversed={isRank} />
              <Area 
                type="natural" 
                dataKey="value" 
                stroke={chartColor} 
                strokeWidth={2} 
                fill={`url(#gradient-${cardId})`} 
                baseValue={isRank ? "dataMax" : "dataMin"}
                animationDuration={500} 
                isAnimationActive={true}
                activeDot={{ r: 5, fill: 'white', stroke: chartColor, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-cyan-400/50" style={{ filter: 'blur(3px)' }}></div>
        </div>
      )}
    </div>
  );
});

const ChartCard: React.FC<{ 
    title: React.ReactNode; 
    children: React.ReactNode; 
    isEditing?: boolean; 
    isDragging?: boolean; 
    onChartClick?: () => void; 
    actionButton?: React.ReactNode; 
    onInfoClick?: () => void; 
    headerControls?: React.ReactNode;
    onHide?: () => void;
    onResize?: () => void;
    className?: string;
    insightText?: string;
    isInsightLoading?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}> = ({ title, children, isEditing, isDragging, onChartClick, actionButton, onInfoClick, headerControls, onHide, onResize, className, insightText, isInsightLoading, onMouseEnter, onMouseLeave }) => (
    <div
        className={`bg-slate-800/50 p-4 rounded-lg shadow-lg border border-slate-700 flex flex-col h-full transition-all duration-300 relative ${isDragging ? 'shadow-[rgba(var(--color-primary-rgb),0.5)] opacity-50' : ''} ${!isEditing && onChartClick ? 'cursor-pointer hover:shadow-[rgba(var(--color-primary-rgb),0.2)] hover:-translate-y-1' : ''} ${isEditing ? 'ring-2 ring-dashed ring-slate-500 cursor-move' : ''} ${className || ''}`}
        onClick={() => { if (!isEditing && onChartClick) onChartClick(); }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
    >
         {isEditing && (
            <div className="absolute inset-0 z-20 bg-slate-900/60 flex flex-col items-center justify-center gap-4 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg backdrop-blur-sm">
                <div className="flex gap-2">
                        {onResize && (
                        <button onClick={(e) => { e.stopPropagation(); onResize(); }} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full shadow-lg transition-colors" title="Toggle Size">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" /></svg>
                        </button>
                    )}
                    {onHide && (
                        <button onClick={(e) => { e.stopPropagation(); onHide(); }} className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-colors" title="Hide Widget">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" /></svg>
                        </button>
                    )}
                </div>
                <span className="text-white font-semibold bg-slate-800 px-3 py-1 rounded-full text-sm border border-slate-600">Drag to Move</span>
            </div>
        )}

        <div className="flex justify-between items-start gap-2 mb-2">
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[rgb(var(--color-primary))]">
                    {title}
                </h3>
                {onInfoClick && !isEditing && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onInfoClick(); }} 
                        className="text-gray-400 hover:text-white transition-colors"
                        title="What is this?"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                )}
            </div>
            <div className="flex items-center gap-2">
                {headerControls && !isEditing && <div onClick={e => e.stopPropagation()}>{headerControls}</div>}
                {actionButton && !isEditing && <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>{actionButton}</div>}
            </div>
        </div>
        <div className="flex-grow h-full relative" onClick={e => e.stopPropagation()}>
            {children}
            {(insightText || isInsightLoading) && (
              <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm flex items-center justify-center p-4 rounded-lg animate-fade-in transition-opacity z-10 pointer-events-none">
                {isInsightLoading ? (
                  <div className="flex items-center gap-2 text-indigo-300">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  <p className="text-sm text-indigo-200 text-center"><span className="font-bold">💡 AI Insight:</span> {insightText}</p>
                )}
              </div>
            )}
        </div>
    </div>
);

// --- KPI Detail Modal ---
const KPIModal: React.FC<{ title: string, metricKey: string, reports: TestReport[], onClose: () => void }> = ({ title, metricKey, reports, onClose }) => {
    const data = reports.map(r => {
        // Resolve dotted paths e.g. 'total.marks'
        const val = metricKey.split('.').reduce((o: any, i) => o[i], r);
        return { name: r.testName, value: val };
    });

    const isRank = title.toLowerCase().includes('rank');

    return (
        <Modal isOpen={true} onClose={onClose} title={`${title} Trend Analysis`}>
            <div className="h-80 w-full p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" reversed={isRank} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="value" stroke="#22d3ee" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="p-4 text-sm text-gray-300 bg-slate-800/50 rounded-lg mx-4 mb-4 border border-slate-700">
                <p><strong>Analysis:</strong> This detailed view shows the progression of your {title.toLowerCase()} over time. {isRank ? 'Lower is better.' : 'Higher is better.'} Look for consistent upward trends or plateaus to identify focus areas.</p>
            </div>
        </Modal>
    );
}

export const Dashboard: React.FC<DashboardProps> = ({ reports, logs, apiKey, setView, setRootCauseFilter, onStartFocusSession, longTermGoals, modelName, userProfile, onUpdateProfile }) => {
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [enableAiInsights, setEnableAiInsights] = useState(false);
    const [contextualInsight, setContextualInsight] = useState<{ widgetId: WidgetId | null; text: string; isLoading: boolean }>({ widgetId: null, text: '', isLoading: false });
    const insightTimeoutRef = useRef<number | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<{ content: string; isLoading: boolean; error: string | null }>({ content: '', isLoading: false, error: null });
    const [infoModalContent, setInfoModalContent] = useState<{title: string, content: React.ReactNode} | null>(null);
    const [activeKpiModal, setActiveKpiModal] = useState<{ title: string, metricKey: string } | null>(null);
    
    // Oracle State
    const [isOracleOpen, setIsOracleOpen] = useState(false);
    const [oracleQuestions, setOracleQuestions] = useState<QuizQuestion[]>([]);
    const [isOracleLoading, setIsOracleLoading] = useState(false);

    // State for chart summaries
    const [chartSummaries, setChartSummaries] = useState<{ performance?: string, subject?: string }>({});

    // Robust State Initialization for Layout
    const [layout, setLayout] = useState<WidgetLayout[]>(() => {
        try {
            const savedLayoutString = localStorage.getItem('dashboardWidgetLayout_v7');
            if (savedLayoutString) {
                const parsedLayout = JSON.parse(savedLayoutString);
                if (Array.isArray(parsedLayout)) {
                    // Create a map of saved widgets
                    const savedMap = new Map(parsedLayout.map((w: any) => [w.id, w]));
                    
                    // Merge saved state with defaults (preserving order from saved if possible, adding new defaults)
                    const merged = DEFAULT_DASHBOARD_LAYOUT.map(defaultWidget => {
                        const savedWidget = savedMap.get(defaultWidget.id);
                        return savedWidget ? { ...defaultWidget, ...savedWidget } : defaultWidget;
                    });
                    
                    return merged;
                }
            }
        } catch (e) { 
            console.error("Failed to load dashboard layout", e); 
        }
        return DEFAULT_DASHBOARD_LAYOUT;
    });

    const dragItem = useRef<WidgetId | null>(null);
    const dragOverItem = useRef<WidgetId | null>(null);
    const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
    const [dragOverId, setDragOverId] = useState<WidgetId | null>(null);
    const [enlargedWidget, setEnlargedWidget] = useState<WidgetId | null>(null);

    useEffect(() => {
        try { localStorage.setItem('dashboardWidgetLayout_v7', JSON.stringify(layout)); } catch (e) { console.error("Failed to save layout", e); }
    }, [layout]);

    // ... (Rest of component remains mostly same, just updating the return structure logic if needed)
    
    // Fetch chart summaries once
    useEffect(() => {
        const fetchSummaries = async () => {
            if (!apiKey || reports.length === 0) return;
            const sessionKey = `dashboardChartSummaries_${reports.length}`;
            const cached = sessionStorage.getItem(sessionKey);
            if (cached) {
                setChartSummaries(JSON.parse(cached));
                return;
            }

            // Always use Flash for chart summaries
            const performanceSummary = await generateChartAnalysis("Performance Trend", `Last 5 scores: ${reports.slice(-5).map(r => r.total.marks).join(', ')}`, apiKey);
            // Simple heuristic for subject comparison summary to save API calls or could also call API
            const sub = reports[reports.length - 1];
            const subjectSummary = `In your latest test, Physics: ${sub.physics.marks}, Chem: ${sub.chemistry.marks}, Maths: ${sub.maths.marks}.`;
            const subjectAnalysis = await generateChartAnalysis("Subject Comparison", subjectSummary, apiKey);

            const newSummaries = { performance: performanceSummary, subject: subjectAnalysis };
            setChartSummaries(newSummaries);
            sessionStorage.setItem(sessionKey, JSON.stringify(newSummaries));
        };
        fetchSummaries();
    }, [reports, apiKey]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: WidgetId) => { dragItem.current = id; setDraggingId(id); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, id: WidgetId) => { if (dragItem.current !== id) { dragOverItem.current = id; setDragOverId(id); } };
    const handleDragEnd = () => {
        if (dragItem.current && dragOverItem.current && dragItem.current !== dragOverItem.current) {
            setLayout(prevLayout => {
                const newLayout = [...prevLayout];
                const dragItemIndex = newLayout.findIndex(w => w.id === dragItem.current);
                const dragOverItemIndex = newLayout.findIndex(w => w.id === dragOverItem.current);
                if (dragItemIndex === -1 || dragOverItemIndex === -1) return prevLayout;
                const dragItemContent = newLayout[dragItemIndex];
                newLayout.splice(dragItemIndex, 1);
                newLayout.splice(dragOverItemIndex, 0, dragItemContent);
                return newLayout;
            });
        }
        dragItem.current = null; dragOverItem.current = null; setDraggingId(null); setDragOverId(null);
    };

    const toggleWidgetVisibility = useCallback((widgetId: WidgetId, visible: boolean) => { setLayout(prevLayout => prevLayout.map(w => w.id === widgetId ? { ...w, visible } : w)); }, []);
    const handleToggleWidgetSize = useCallback((widgetId: WidgetId) => { setLayout(prevLayout => prevLayout.map(w => w.id === widgetId ? { ...w, size: w.size === 'normal' ? 'wide' : 'normal' } : w)); }, []);

    const processedReports = useMemo(() => reports.map(r => ({ ...r, testDate: new Date(r.testDate).toLocaleDateString('en-CA'), })).sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime()), [reports]);

    const kpiData = useDashboardKpis(processedReports, logs, longTermGoals);

    // Calculate Readiness for Gauge
    const readinessScore = useMemo(() => {
        const accuracyWeight = 0.4;
        const consistencyWeight = 0.3;
        const scoreTrendWeight = 0.3;
        const accuracyScore = Math.min(100, kpiData.latestAccuracy);
        const consistency = kpiData.consistencyScore;
        let trendScore = 50;
        if (kpiData.scoreComparison?.trend === 'up') trendScore += 20;
        if (kpiData.scoreComparison?.trend === 'down') trendScore -= 20;
        return (accuracyScore * accuracyWeight) + (consistency * consistencyWeight) + (trendScore * scoreTrendWeight);
    }, [kpiData]);

    const historicalAccuracy = useMemo(() => {
        const acc = { physics: 0, chemistry: 0, maths: 0 };
        const counts = { physics: 0, chemistry: 0, maths: 0 };
        reports.forEach(r => {
            (['physics', 'chemistry', 'maths'] as const).forEach(sub => {
                 acc[sub] += r[sub].correct;
                 counts[sub] += (r[sub].correct + r[sub].wrong);
            });
        });
        return {
            physics: counts.physics ? (acc.physics / counts.physics) * 100 : 0,
            chemistry: counts.chemistry ? (acc.chemistry / counts.chemistry) * 100 : 0,
            maths: counts.maths ? (acc.maths / counts.maths) * 100 : 0
        };
    }, [reports]);

    const handleGenerateAiAnalysis = useCallback(async () => {
        if (!apiKey) { setAiAnalysis({ content: '', isLoading: false, error: "API Key not set." }); return; }
        setAiAnalysis({ content: '', isLoading: true, error: null });
        try {
            // Uses the selected model for deep analysis
            const result = await getAIAnalysis(reports, logs, apiKey, modelName);
            setAiAnalysis({ content: result, isLoading: false, error: null });
        } catch (e) {
            setAiAnalysis({ content: '', isLoading: false, error: e instanceof Error ? e.message : 'An unknown error occurred.' });
        }
    }, [apiKey, reports, logs, modelName]);

    // --- ORACLE HANDLER ---
    const handleConsultOracle = useCallback(async () => {
        setIsOracleLoading(true);
        // Identify weak topics manually here or reuse analytics hook logic
        // For simplicity, we calculate on the fly
        const errorCounts: Record<string, {count: number, reasons: Record<string, number>}> = {};
        logs.forEach(l => {
            // Include partially correct as 'wrong' for drill purposes
            if ((l.status === 'Wrong' || l.status === 'Partially Correct') && l.topic && l.topic !== 'N/A') {
                if (!errorCounts[l.topic]) errorCounts[l.topic] = { count: 0, reasons: {} };
                errorCounts[l.topic].count++;
                if (l.reasonForError) {
                    errorCounts[l.topic].reasons[l.reasonForError] = (errorCounts[l.topic].reasons[l.reasonForError] || 0) + 1;
                }
            }
        });

        // Convert to array and sort
        const sortedErrors = Object.entries(errorCounts)
            .map(([topic, data]) => {
                const topReason = Object.entries(data.reasons).sort((a,b) => b[1] - a[1])[0];
                return { topic, count: data.count, reason: topReason ? topReason[0] : 'General Error' };
            })
            .sort((a, b) => b.count - a.count);

        if (sortedErrors.length === 0) {
            alert("The Oracle needs more error data to generate a prophecy.");
            setIsOracleLoading(false);
            return;
        }

        try {
            const questions = await generateOracleDrill(sortedErrors, apiKey, modelName);
            setOracleQuestions(questions);
            setIsOracleOpen(true);
        } catch (e) {
            console.error("Oracle Failed", e);
            alert("The Oracle is currently silent (API Error). Try again.");
        } finally {
            setIsOracleLoading(false);
        }
    }, [logs, apiKey, modelName]);

    // --- SAVE STRATEGY HANDLER ---
    const handleSaveStrategy = (strategy: ExamStrategy) => {
        onUpdateProfile(prev => ({
            ...prev,
            examStrategy: strategy
        }));
        // Note: The parent App.tsx useEffect will handle persisting `userProfile` to localStorage/DB
    };

    const WIDGETS: Record<WidgetId, { title: string; component: React.ReactNode; getDataForInsight: () => string; info: React.ReactNode; }> = {
        oracle: { 
            title: "The Oracle", 
            component: isOracleLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-indigo-300 animate-pulse">
                    <span className="text-4xl mb-2">🔮</span>
                    <p className="text-sm font-bold">Consulting the threads of fate...</p>
                </div>
            ) : <OracleWidget onConsult={handleConsultOracle} />, 
            getDataForInsight: () => "The Oracle predicts your future failure points based on past error logs.", 
            info: "The Oracle generates a custom micro-test based on your most frequent error patterns." 
        },
        calibration: {
            title: "Dunning-Kruger Detector",
            component: <CalibrationWidget logs={logs} />,
            getDataForInsight: () => "Analyze the calibration matrix to identify blind spots where confidence exceeds competence.",
            info: "Maps your confidence vs. actual competence. 'Blind Spots' (High Confidence, Low Score) are dangerous. 'Imposters' (Low Confidence, High Score) need validation."
        },
        competitors: {
            title: "Shadow Competitors",
            component: reports.length > 0 ? <CompetitorLeaderboard report={reports[reports.length-1]} allReports={reports} /> : <div className="flex items-center justify-center h-full text-gray-500">No test data available.</div>,
            getDataForInsight: () => "Analyze performance against simulated AI personas.",
            info: "Compares your latest test score against AI-simulated personas: 'Accuracy Bot' (high accuracy, slow), 'Speedster' (fast, error-prone), and 'AIR 100' (benchmark)."
        },
        heatmap: { title: "Test Activity Heatmap", component: <CalendarHeatmapWidget reports={processedReports} />, getDataForInsight: () => `Analyze activity from ${reports.length} tests over the past year.`, info: "This heatmap shows your test-taking frequency and average score over the past year. Darker shades of cyan indicate higher scores on those days." },
        performanceTrend: { title: "Performance Trend (Total Score)", component: <PerformanceTrendWidget data={processedReports} aiSummary={chartSummaries.performance} />, getDataForInsight: () => `Analyze the score trend: ${processedReports.map(r => r.total.marks).join(', ')}.`, info: "This chart tracks your total score across all tests, showing your overall performance trend over time." },
        subjectComparison: { title: "Subject Marks Comparison", component: <SubjectComparisonWidget data={processedReports} aiSummary={chartSummaries.subject} />, getDataForInsight: () => `Analyze subject contributions for the latest test.`, info: "This stacked bar chart shows the contribution of each subject to your total score in every test, helping you see subject-wise performance at a glance." },
        subjectStrengthsRadar: { title: "Average of Subjects", component: <SubjectRadarWidget data={kpiData.radarData} />, getDataForInsight: () => `Radar plot data: ${JSON.stringify(kpiData.radarData)}.`, info: "Shows the average marks scored in each subject over the last 3 tests." },
        percentilePredictor: { title: "Percentile Predictor", component: kpiData.percentileData ? <PercentilePredictorWidget percentileData={kpiData.percentileData} /> : <div className="flex items-center justify-center h-full text-gray-500">Not enough data.</div>, getDataForInsight: () => `Analyze predicted percentile: ${kpiData.percentileData?.predictedPercentile}`, info: "Shows your trend in percentiles and predicts your future percentile based on current trajectory." },
        rankPredictor: { title: "Bayesian Rank Predictor", component: kpiData.rankPrediction ? <RankPredictorWidget rankPrediction={kpiData.rankPrediction} goalProbability={kpiData.goalProbability} /> : <div className="flex items-center justify-center h-full text-gray-500">Not enough data.</div>, getDataForInsight: () => `Analyze rank prediction range: ${kpiData.rankPrediction?.bestCase} - ${kpiData.rankPrediction?.worstCase}`, info: "Uses a probabilistic model (Monte Carlo simulation) to estimate your likely rank range in the final exam based on your consistency and volatility." },
        strategicROI: { title: "Strategic ROI Engine", component: <StrategicROIWidget data={kpiData.strategicROI} onPointClick={(topic) => onStartFocusSession(topic)}/>, getDataForInsight: () => "Analyze strategic ROI bubble chart.", info: "Classifies topics into 'Quick Wins' (High Impact, Low Effort), 'Big Bets' (High Impact, High Effort), etc. Focus on Quick Wins first." },
        paperStrategy: { title: "Paper Strategy Simulator", component: <PaperStrategyWidget historicalAccuracy={historicalAccuracy} userTargetTimes={userProfile.targetTimePerQuestion} savedStrategy={userProfile.examStrategy} onSave={handleSaveStrategy} />, getDataForInsight: () => "Analyze paper strategy simulation.", info: "Simulate different time allocation strategies to see how they might affect your score, factoring in 'panic' induced accuracy drops." },
        volatility: { title: "Stability Gauge", component: kpiData.volatilityMetrics ? <VolatilityWidget volatilityMetrics={kpiData.volatilityMetrics} /> : <div className="flex items-center justify-center h-full text-gray-500">Not enough data.</div>, getDataForInsight: () => `Analyze volatility sharpe ratio: ${kpiData.volatilityMetrics?.sharpeRatio}`, info: "Measures the stability of your performance. Higher Sharpe Ratio means more consistent high scores." },
        rankSimulator: { title: "What-If Rank Simulator", component: <RankSimulatorWidget rankModel={kpiData.rankModel} currentAvg={kpiData.avgScores} />, getDataForInsight: () => "Analyze rank simulation potential.", info: "Interactive tool to simulate how improving subject scores impacts your predicted rank." },
        goalProgress: { title: "Goal Tracker", component: <GoalProgressWidget goals={longTermGoals} />, getDataForInsight: () => `Analyze goal progress. Completed: ${longTermGoals.filter(g=>g.completed).length}.`, info: "Tracks your progress towards defined long-term milestones." },
        aiAnalysis: { title: "AI Performance Analysis", component: (
            <div className="h-full flex flex-col">
                {aiAnalysis.isLoading && <div className="flex-grow flex items-center justify-center text-gray-400 animate-pulse">Thinking... <span className="text-xs ml-2 text-gray-500">(May take 30s)</span></div>}
                {aiAnalysis.error && <div className="flex-grow flex flex-col items-center justify-center text-red-400"><p>{aiAnalysis.error}</p><button onClick={handleGenerateAiAnalysis} className="mt-2 bg-red-600/50 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-full text-xs">Retry</button></div>}
                {aiAnalysis.content ? <div className="flex-grow overflow-y-auto pr-2"><MarkdownRenderer content={aiAnalysis.content} /></div> : null}
                {!aiAnalysis.content && !aiAnalysis.isLoading && !aiAnalysis.error && (
                    <div className="flex-grow flex items-center justify-center">
                        <button onClick={handleGenerateAiAnalysis} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg">
                            {aiAnalysis.isLoading ? 'Generating...' : 'Generate AI Analysis'}
                        </button>
                    </div>
                )}
            </div>
        ), getDataForInsight: () => "AI analysis has been requested.", info: "This widget provides a comprehensive performance review generated by AI. It analyzes trends, strengths, weaknesses, and gives actionable recommendations based on all your data." },
    };
    
    const hiddenWidgets = DEFAULT_DASHBOARD_LAYOUT.filter(w => !layout.find(l => l.id === w.id)?.visible);

    const handleMouseEnterWidget = useCallback((widgetId: WidgetId) => {
        if (!enableAiInsights) return;
        if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current);
        insightTimeoutRef.current = window.setTimeout(async () => {
            setContextualInsight({ widgetId, isLoading: true, text: '' });
            try {
                const prompt = WIDGETS[widgetId].getDataForInsight();
                // Always use Flash for hover insights to ensure low latency
                const insight = await generateContextualInsight(prompt, apiKey);
                setContextualInsight({ widgetId, isLoading: false, text: insight });
            } catch (error) {
                setContextualInsight({ widgetId: null, isLoading: false, text: '' });
            }
        }, 800);
    }, [enableAiInsights, apiKey, WIDGETS]);
    const handleMouseLeaveWidget = useCallback(() => { if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current); setContextualInsight({ widgetId: null, isLoading: false, text: '' }); }, []);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center flex-wrap gap-4">
                 <h2 className="text-2xl font-bold text-cyan-300">Dashboard</h2>
                 <div className="flex items-center gap-4">
                     <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer" title="Hover over a chart for a quick AI-powered insight.">
                        <input type="checkbox" checked={enableAiInsights} onChange={(e) => setEnableAiInsights(e.target.checked)} className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-cyan-500 rounded focus:ring-cyan-500"/>
                        <span className="hidden sm:inline">AI Insights</span>
                    </label>
                    <Button variant={isCustomizing ? 'primary' : 'secondary'} onClick={() => setIsCustomizing(!isCustomizing)}>{isCustomizing ? 'Done' : 'Customize'}</Button>
                 </div>
            </div>
            
            <InsightBanner reports={reports} apiKey={apiKey} />

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <KPICard 
                    title="Latest Score" 
                    value={kpiData.latestScore} 
                    comparison={kpiData.scoreComparison} 
                    trendData={kpiData.scoreTrend} 
                    onClick={() => setActiveKpiModal({ title: "Total Score", metricKey: "total.marks" })} 
                />
                <KPICard 
                    title="Latest Rank" 
                    value={kpiData.latestRank} 
                    comparison={kpiData.rankComparison} 
                    trendData={kpiData.rankTrend}
                    onClick={() => setActiveKpiModal({ title: "Rank", metricKey: "total.rank" })}
                />
                <KPICard 
                    title="Latest Accuracy" 
                    value={kpiData.latestAccuracy} 
                    suffix="%" 
                    comparison={kpiData.accuracyComparison} 
                    trendData={kpiData.accuracyTrend}
                    onClick={() => setActiveKpiModal({ title: "Accuracy", metricKey: "totalMetrics.accuracy" })}
                />
                <KPICard 
                    title="Weakest Subject" 
                    value={kpiData.strongestSubject.name === 'Physics' ? 'Maths' : 'Physics'} // Heuristic logic placeholder
                    subtitle="Needs Attention"
                    action={{ label: 'Sprint', onClick: () => onStartFocusSession(kpiData.strongestSubject.name === 'Physics' ? 'Maths' : 'Physics') }} 
                />
                <KPICard title="Readiness" value={readinessScore} isGauge />
            </div>

            <div className="flex gap-6 relative">
                <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6" onDragOver={(e) => e.preventDefault()}>
                    {layout.filter(w => w.visible).map((widget) => {
                        const widgetConfig = WIDGETS[widget.id];
                        if (!widgetConfig) return null;
                        const isDraggable = isCustomizing;
                        return (
                            <div key={widget.id} className={`${widget.size === 'wide' ? 'lg:col-span-2' : ''} h-[28rem] ${isDraggable ? 'cursor-move' : ''} ${dragOverId === widget.id && draggingId ? 'drag-over-indicator' : ''}`} draggable={isDraggable} onDragStart={(e) => handleDragStart(e, widget.id)} onDragEnter={(e) => handleDragEnter(e, widget.id)} onDragEnd={handleDragEnd} onDragLeave={() => setDragOverId(null)}>
                                <ChartCard 
                                    title={widgetConfig.title} 
                                    isEditing={isCustomizing} 
                                    isDragging={draggingId === widget.id} 
                                    onChartClick={() => setEnlargedWidget(widget.id)} 
                                    onMouseEnter={() => handleMouseEnterWidget(widget.id)} 
                                    onMouseLeave={handleMouseLeaveWidget} 
                                    insightText={contextualInsight.widgetId === widget.id ? contextualInsight.text : ''} 
                                    isInsightLoading={contextualInsight.widgetId === widget.id && contextualInsight.isLoading} 
                                    onInfoClick={() => setInfoModalContent({title: widgetConfig.title, content: widgetConfig.info})}
                                    onHide={() => toggleWidgetVisibility(widget.id, false)}
                                    onResize={() => handleToggleWidgetSize(widget.id)}
                                >
                                    {widgetConfig.component}
                                </ChartCard>
                            </div>
                        );
                    })}
                </main>

                 {isCustomizing && (
                     <aside className="hidden lg:block w-64 flex-shrink-0 animate-fade-in sticky top-6 h-fit">
                         <div className="bg-slate-800/90 border-dashed border-2 border-slate-600 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Hidden Widgets</h3>
                            <div className="space-y-3 min-h-[100px]">
                                {hiddenWidgets.length === 0 ? <p className="text-sm text-gray-500 text-center italic">All widgets visible</p> : null}
                                {hiddenWidgets.map(defaultWidget => {
                                    const widgetConfig = WIDGETS[defaultWidget.id];
                                    return (
                                        <div key={defaultWidget.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-md border border-slate-700 shadow-sm">
                                            <span className="text-sm text-gray-300 font-medium">{widgetConfig.title}</span>
                                            <Button variant="secondary" size="sm" onClick={() => toggleWidgetVisibility(defaultWidget.id, true)}>Show</Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                         <div className="mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-800/50 text-sm text-blue-200">
                            <p className="flex items-start gap-2">
                                <span className="text-lg">💡</span>
                                <span>Drag widgets to reorder. Use the buttons on widgets to resize or hide them.</span>
                            </p>
                        </div>
                    </aside>
                )}
            </div>
            
             <Modal isOpen={!!enlargedWidget} onClose={() => setEnlargedWidget(null)} title={enlargedWidget ? WIDGETS[enlargedWidget].title : ''}>
                {enlargedWidget ? WIDGETS[enlargedWidget].component : null}
            </Modal>
            
            {/* ORACLE CHAMBER MODAL (Full Screen Override) */}
            {isOracleOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-fade-in">
                    <OracleChamber 
                        questions={oracleQuestions} 
                        onClose={() => setIsOracleOpen(false)} 
                        onComplete={(score) => {
                            console.log("Drill Score:", score);
                        }} 
                    />
                </div>
            )}

            <Modal isOpen={!!infoModalContent} onClose={() => setInfoModalContent(null)} title={infoModalContent?.title || ''} isInfo={true}>
                <div className="text-sm text-gray-300 space-y-2">{infoModalContent?.content}</div>
            </Modal>
            {activeKpiModal && (
                <KPIModal 
                    title={activeKpiModal.title} 
                    metricKey={activeKpiModal.metricKey} 
                    reports={processedReports} 
                    onClose={() => setActiveKpiModal(null)} 
                />
            )}
        </div>
    );
};
