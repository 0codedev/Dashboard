
import React, { useMemo, useState, useEffect } from 'react';
import type { TestReport } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Area, ScatterChart, Scatter, Cell, LabelList } from 'recharts';
import { SUBJECT_CONFIG } from '../constants';
import Modal from './common/Modal';
import CustomTooltip from './common/CustomTooltip';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { Select } from './common/Select';

interface DeepAnalysisProps {
  reports: TestReport[];
}

interface OverlayConfig {
  trendline: boolean;
  movingAverage: boolean;
  bollingerBands: boolean;
}

const getTrendlineCalculator = (data: { x: number; y: number }[]) => {
    if (data.length < 2) return (_: number) => null;
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const point of data) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumX2 += point.x * point.x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    if (isNaN(slope) || isNaN(intercept)) return (_: number) => null;
    return (x: number) => slope * x + intercept;
};

const ChartCard: React.FC<{ title: string; onClick?: () => void; children: React.ReactNode; className?: string; onInfoClick?: () => void; }> = ({ title, onClick, children, className, onInfoClick }) => {
    const titleWithInfo = (
        <div className="flex items-center gap-2">
            {title}
            {onInfoClick && (
                <Button 
                    variant="ghost"
                    isIconOnly
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onInfoClick(); }} 
                    aria-label="What is this?"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </Button>
            )}
        </div>
    );
    
    return (
        <Card title={titleWithInfo} isInteractive={!!onClick} onClick={onClick} className={className}>
            {children}
        </Card>
    );
};

const chartConfigs = [
    {
        title: "Rank Progression",
        dataKeys: { total: 'total.rank', physics: 'physics.rank', chemistry: 'chemistry.rank', maths: 'maths.rank' },
        domain: ['dataMin', 'auto'], reversed: true,
        info: "This chart tracks your rank over time. A downward trend is positive, indicating improvement against your peers."
    },
    {
        title: "Accuracy (%) Trend",
        dataKeys: { total: 'totalMetrics.accuracy', physics: 'physicsMetrics.accuracy', chemistry: 'chemistryMetrics.accuracy', maths: 'mathsMetrics.accuracy' },
        domain: [0, 100], reversed: false,
        info: "Accuracy measures the ratio of your correct answers to the total number of questions you attempted (correct + wrong). An upward trend is desirable."
    },
    {
        title: "Attempt Rate (%) Trend",
        dataKeys: { total: 'totalMetrics.attemptRate', physics: 'physicsMetrics.attemptRate', chemistry: 'chemistryMetrics.attemptRate', maths: 'mathsMetrics.attemptRate' },
        domain: [0, 100], reversed: false,
        info: "Attempt Rate is the percentage of total questions you answered (correct, wrong, or partial). It reflects your speed and confidence."
    },
    {
        title: "Marks Trend",
        dataKeys: { total: 'total.marks', physics: 'physics.marks', chemistry: 'chemistry.marks', maths: 'maths.marks' },
        domain: ['auto', 'auto'], reversed: false,
        info: "This chart tracks your absolute marks over time. It's the most direct measure of your performance improvement."
    },
];

const customChartMetrics = [
    { value: 'marks', label: 'Marks' },
    { value: 'rank', label: 'Rank' },
    { value: 'correct', label: 'Correct' },
    { value: 'wrong', label: 'Wrong' },
    { value: 'unanswered', label: 'Unanswered' },
    { value: 'partial', label: 'Partial' },
    { value: 'accuracy', label: 'Accuracy (%)' },
    { value: 'attemptRate', label: 'Attempt Rate (%)' },
    { value: 'cwRatio', label: 'Correct/Wrong Ratio' },
    { value: 'spaq', label: 'Score per Attempted Q' },
    { value: 'unattemptedPercent', label: 'Unattempted (%)' },
    { value: 'negativeMarkImpact', label: 'Negative Mark Impact (%)' },
    { value: 'scorePotentialRealized', label: 'Score Potential Realized (%)' },
];

export const DeepAnalysis: React.FC<DeepAnalysisProps> = ({ reports }) => {
    const [modalConfig, setModalConfig] = useState<any | null>(null);
    const [infoModalContent, setInfoModalContent] = useState<{title: string, content: React.ReactNode} | null>(null);

    const [overlayConfig, setOverlayConfig] = useState<OverlayConfig>({
        trendline: false,
        movingAverage: false,
        bollingerBands: false,
    });
    const [customChartConfig, setCustomChartConfig] = useState({ metric: 'marks', type: 'line' });
    const [globalSubjectFilter, setGlobalSubjectFilter] = useState('total');

    const analysisData = useMemo(() => {
        const sortedReports = reports.slice().sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
        
        const getNestedValue = (obj: any, path: string) => path.split('.').reduce((o, i) => (o && o[i] !== undefined ? o[i] : undefined), obj);
        
        const allDataKeysForOverlays = [
            ...Object.values(chartConfigs[0].dataKeys),
            ...Object.values(chartConfigs[1].dataKeys),
            ...Object.values(chartConfigs[2].dataKeys),
            ...customChartMetrics.flatMap(m => 
                Object.keys(SUBJECT_CONFIG).map(subject => {
                    const metricIsFromMetricsObject = [
                        'accuracy', 'attemptRate', 'cwRatio', 'spaq',
                        'unattemptedPercent', 'negativeMarkImpact', 'scorePotentialRealized'
                    ].includes(m.value);
                    return metricIsFromMetricsObject ? `${subject}Metrics.${m.value}` : `${subject}.${m.value}`;
                })
            )
        ];
        const uniqueDataKeys = [...new Set(allDataKeysForOverlays)];

        const dataWithOverlays = sortedReports.map((report, index) => {
            const baseData: any = { ...report, testName: report.testName };

            uniqueDataKeys.forEach(dataKey => {
                const trendlineData = sortedReports.map((r, i) => ({ x: i, y: getNestedValue(r, dataKey) })).filter(d => typeof d.y === 'number' && isFinite(d.y));
                if (trendlineData.length > 1) {
                    const trendlineFunc = getTrendlineCalculator(trendlineData);
                    baseData[`${dataKey}_trend`] = trendlineFunc(index);
                } else {
                    baseData[`${dataKey}_trend`] = null;
                }
                const windowSize = 3;
                if (index >= windowSize - 1) {
                    const window = sortedReports.slice(index - windowSize + 1, index + 1);
                    const windowScores = window.map(r => getNestedValue(r, dataKey)).filter(v => typeof v === 'number' && isFinite(v));
                    if (windowScores.length === windowSize) {
                        const ma = windowScores.reduce((a, b) => a + b, 0) / windowSize;
                        baseData[`${dataKey}_ma`] = ma;
                        const stdDev = Math.sqrt(windowScores.map(x => Math.pow(x - ma, 2)).reduce((a, b) => a + b) / windowSize);
                        baseData[`${dataKey}_bb`] = [ma - 2 * stdDev, ma + 2 * stdDev];
                    } else {
                        baseData[`${dataKey}_ma`] = null;
                        baseData[`${dataKey}_bb`] = null;
                    }
                } else {
                    baseData[`${dataKey}_ma`] = null;
                    baseData[`${dataKey}_bb`] = null;
                }
            });
            return baseData;
        });

        return {
            reports: sortedReports,
            reportsWithOverlays: dataWithOverlays
        };
    }, [reports]);
    
    const openModal = (config: any) => {
        setModalConfig(config);
    };

    const handleCustomChartClick = () => {
        const selectedMetricInfo = customChartMetrics.find(m => m.value === customChartConfig.metric);
        if (!selectedMetricInfo) return;

        const { value: metric, label: metricLabel } = selectedMetricInfo;

        const metricIsFromMetricsObject = [
            'accuracy', 'attemptRate', 'cwRatio', 'spaq',
            'unattemptedPercent', 'negativeMarkImpact', 'scorePotentialRealized'
        ].includes(metric);
        
        const dataKeys = {
            total: metricIsFromMetricsObject ? `totalMetrics.${metric}` : `total.${metric}`,
            physics: metricIsFromMetricsObject ? `physicsMetrics.${metric}` : `physics.${metric}`,
            chemistry: metricIsFromMetricsObject ? `chemistryMetrics.${metric}` : `chemistry.${metric}`,
            maths: metricIsFromMetricsObject ? `mathsMetrics.${metric}` : `maths.${metric}`
        };

        const yAxisDomain: any[] = ['auto', 'auto'];
        if (metric.toLowerCase().includes('percent') || metric === 'accuracy' || metric === 'attemptRate') {
            yAxisDomain[0] = 0;
            yAxisDomain[1] = 100;
        }

        const customModalConfig = {
            title: `Custom Chart: ${metricLabel}`,
            dataKeys: dataKeys,
            domain: yAxisDomain,
            reversed: metric === 'rank',
        };

        openModal(customModalConfig);
    };

    const renderMainChart = (config: typeof chartConfigs[0]) => {
        const dataKey = config.dataKeys[globalSubjectFilter as keyof typeof config.dataKeys];
        const color = SUBJECT_CONFIG[globalSubjectFilter].color;
        const name = SUBJECT_CONFIG[globalSubjectFilter].name;
        
        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysisData.reportsWithOverlays} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="testName" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9CA3AF" domain={config.domain as any} reversed={config.reversed} tickFormatter={(tick) => (tick > 1000 ? `${tick/1000}k` : tick)} />
                    <Tooltip content={<CustomTooltip formatter={(value: number) => value.toFixed(1)} />} />
                    <Legend content={() => <p className="text-center text-sm" style={{ color: color }}>-◇- {name}</p>} />
                    <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 4, fill: color }} activeDot={{ r: 8 }} />
                    {overlayConfig.trendline && <Line type="monotone" dataKey={`${dataKey}_trend`} name={`${name} Trend`} stroke={color} strokeWidth={2} strokeDasharray="5 5" dot={false} legendType="none" />}
                    {overlayConfig.bollingerBands && <Area dataKey={`${dataKey}_bb`} name="Bollinger Band" stroke={color} fill={color} strokeWidth={0} fillOpacity={0.1} isAnimationActive={false} legendType="none" />}
                    {(overlayConfig.movingAverage || overlayConfig.bollingerBands) && <Line type="monotone" dataKey={`${dataKey}_ma`} name={`${name} MA (3)`} stroke={color} strokeWidth={2} opacity={0.8} strokeDasharray="2 6" dot={false} legendType="none" />}
                </LineChart>
            </ResponsiveContainer>
        );
    }

    const renderCustomChart = () => {
        const selectedMetricInfo = customChartMetrics.find(m => m.value === customChartConfig.metric);
        const metric = selectedMetricInfo?.value || 'marks';
        const metricLabel = selectedMetricInfo?.label || 'Marks';
        const subject = globalSubjectFilter;
        const color = SUBJECT_CONFIG[subject].color;
        
        const legendLabel = `${subject.toLowerCase()} ${metricLabel.replace('(%)', '').trim().toLowerCase()}`;

        const metricIsFromMetricsObject = [
            'accuracy', 'attemptRate', 'cwRatio', 'spaq',
            'unattemptedPercent', 'negativeMarkImpact', 'scorePotentialRealized'
        ].includes(metric);
        
        const dataKey = metricIsFromMetricsObject 
            ? `${subject}Metrics.${metric}`
            : `${subject}.${metric}`;
        
        const yAxisDomain: any[] = ['auto', 'auto'];
        if (metric.toLowerCase().includes('percent') || metric === 'accuracy' || metric === 'attemptRate') {
            yAxisDomain[0] = 0;
            yAxisDomain[1] = 100;
        }

        const commonChartProps = {
            data: analysisData.reportsWithOverlays,
            margin: { top: 5, right: 20, left: -10, bottom: 50 }
        };
        
        if (customChartConfig.type === 'bar') {
            return (
                <BarChart {...commonChartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="testName" stroke="#9CA3AF" tick={{fontSize: 10}} angle={-20} textAnchor="end" />
                    <YAxis stroke="#9CA3AF" domain={yAxisDomain} reversed={metric === 'rank'} />
                    <Tooltip content={<CustomTooltip formatter={(value: number) => typeof value === 'number' ? value.toFixed(1) : value} />} />
                    <Legend content={() => <p className="text-center text-sm" style={{ color: color }}>-◇- {legendLabel}</p>} />
                    <Bar dataKey={dataKey} name={legendLabel} fill={color} />
                </BarChart>
            );
        }
        return (
             <LineChart {...commonChartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="testName" stroke="#9CA3AF" tick={{fontSize: 10}} angle={-20} textAnchor="end" />
                <YAxis stroke="#9CA3AF" domain={yAxisDomain} reversed={metric === 'rank'}/>
                <Tooltip content={<CustomTooltip formatter={(value: number) => typeof value === 'number' ? value.toFixed(1) : value} />} />
                <Legend content={() => <p className="text-center text-sm" style={{ color: color }}>-◇- {legendLabel}</p>} />
                <Line 
                    dataKey={dataKey} 
                    name={legendLabel} 
                    stroke={color} 
                    strokeWidth={2} 
                    dot={{ r: 4, fill: '#FFFFFF' }}
                    activeDot={{ r: 8, fill: '#FFFFFF', stroke: color, strokeWidth: 2 }} 
                />
            </LineChart>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-wrap items-center gap-6">
                    <div>
                        <label htmlFor="subject-filter" className="text-sm text-gray-400 mr-2">Filter by Subject</label>
                        <Select id="subject-filter" value={globalSubjectFilter} onChange={e => setGlobalSubjectFilter(e.target.value)}>
                            {Object.keys(SUBJECT_CONFIG).map(key => (<option key={key} value={key}>{SUBJECT_CONFIG[key].name}</option>))}
                        </Select>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">Overlays:</span>
                        <label className="flex items-center gap-2 text-gray-300"><input type="checkbox" checked={overlayConfig.trendline} onChange={e => setOverlayConfig(prev => ({ ...prev, trendline: e.target.checked }))} className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-[rgb(var(--color-primary-rgb))] rounded focus:ring-[rgb(var(--color-primary-rgb))]"/>Trendline</label>
                        <label className="flex items-center gap-2 text-gray-300"><input type="checkbox" checked={overlayConfig.movingAverage} onChange={e => setOverlayConfig(prev => ({ ...prev, movingAverage: e.target.checked }))} className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-[rgb(var(--color-primary-rgb))] rounded focus:ring-[rgb(var(--color-primary-rgb))]"/>Moving Average (3)</label>
                        <label className="flex items-center gap-2 text-gray-300"><input type="checkbox" checked={overlayConfig.bollingerBands} onChange={e => setOverlayConfig(prev => ({ ...prev, bollingerBands: e.target.checked }))} className="form-checkbox h-4 w-4 bg-slate-700 border-slate-600 text-[rgb(var(--color-primary-rgb))] rounded focus:ring-[rgb(var(--color-primary-rgb))]"/>Bollinger Bands</label>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chartConfigs.map(config => (
                    <ChartCard key={config.title} title={config.title} onClick={() => openModal(config)} onInfoClick={() => setInfoModalContent({title: config.title, content: config.info})} className="h-[28rem]">
                        {renderMainChart(config)}
                    </ChartCard>
                ))}
                 <ChartCard title="Custom Chart Builder" className="h-[28rem]" onClick={handleCustomChartClick} onInfoClick={() => setInfoModalContent({title: "Custom Chart Builder", content: "Build your own chart by selecting any metric for any subject. You can also change the chart type between a line and bar graph to visualize data differently."})}>
                    <div className="flex gap-2 mb-4" onClick={(e) => e.stopPropagation()}>
                        <Select value={customChartConfig.metric} onChange={e => setCustomChartConfig(prev => ({ ...prev, metric: e.target.value }))} className="text-sm w-1/2">
                            {customChartMetrics.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </Select>
                        <Select value={customChartConfig.type} onChange={e => setCustomChartConfig(prev => ({ ...prev, type: e.target.value }))} className="text-sm w-1/2">
                            <option value="line">Line Chart</option>
                            <option value="bar">Bar Chart</option>
                        </Select>
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                        {renderCustomChart()}
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {modalConfig && (
                <Modal
                    isOpen={!!modalConfig}
                    onClose={() => setModalConfig(null)}
                    title={modalConfig.title}
                >
                  <ExpandedChartModalContent
                      chartData={modalConfig}
                      allData={analysisData.reportsWithOverlays}
                      overlayConfig={overlayConfig}
                  />
                </Modal>
            )}
            <Modal isOpen={!!infoModalContent} onClose={() => setInfoModalContent(null)} title={infoModalContent?.title || ''} isInfo={true}>
                <div className="text-sm text-gray-300 space-y-2">{infoModalContent?.content}</div>
            </Modal>
        </div>
    );
};

const ExpandedChartModalContent: React.FC<{
  chartData: any;
  allData: any[];
  overlayConfig: OverlayConfig;
}> = ({ chartData, allData, overlayConfig }) => {
    const [visibleSubjects, setVisibleSubjects] = useState<string[]>(['total', 'physics', 'chemistry', 'maths']);
    
    const allSubjects = useMemo(() => Object.keys(SUBJECT_CONFIG), []);
    const areAllSubjectsVisible = useMemo(() => {
        const visibleSet = new Set(visibleSubjects);
        return allSubjects.length === visibleSet.size && allSubjects.every(s => visibleSet.has(s));
    }, [allSubjects, visibleSubjects]);

    const handleToggleAllSubjects = () => {
        if (areAllSubjectsVisible) {
            setVisibleSubjects([]);
        } else {
            setVisibleSubjects(allSubjects);
        }
    };

    const lineConfig = [
        { subjectKey: 'total', name: 'Overall', dataKey: chartData.dataKeys.total, color: SUBJECT_CONFIG.total.color },
        { subjectKey: 'physics', name: 'Physics', dataKey: chartData.dataKeys.physics, color: SUBJECT_CONFIG.physics.color },
        { subjectKey: 'chemistry', name: 'Chemistry', dataKey: chartData.dataKeys.chemistry, color: SUBJECT_CONFIG.chemistry.color },
        { subjectKey: 'maths', name: 'Maths', dataKey: chartData.dataKeys.maths, color: SUBJECT_CONFIG.maths.color },
    ];
    
    const toggleSubject = (subjectKey: string) => {
        setVisibleSubjects(prev => 
            prev.includes(subjectKey) ? prev.filter(s => s !== subjectKey) : [...prev, subjectKey]
        );
    };

    return (
      <>
        <div className="flex justify-end items-center gap-1 flex-wrap mb-4">
            <Button variant="secondary" size="sm" onClick={handleToggleAllSubjects}>{areAllSubjectsVisible ? 'Deselect All' : 'Select All'}</Button>
            {Object.entries(SUBJECT_CONFIG).map(([key, config]) => (
                 <Button 
                    key={key} 
                    size="sm"
                    onClick={() => toggleSubject(key)} 
                    className={`${!visibleSubjects.includes(key) ? 'opacity-40' : ''}`}
                    style={{ backgroundColor: visibleSubjects.includes(key) ? config.color : undefined }}
                >
                    {config.name}
                </Button>
            ))}
        </div>
         <div className="relative w-full h-[calc(100%-4rem)]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={allData} margin={{ top: 5, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="testName" stroke="#9CA3AF" angle={-20} textAnchor="end" height={60}/>
                        <YAxis stroke="#9CA3AF" domain={chartData.domain} reversed={chartData.reversed} />
                        <Tooltip content={<CustomTooltip formatter={(value: number) => value.toFixed(1)} />} />
                        <Legend wrapperStyle={{ color: '#9CA3AF' }}/>
                        {lineConfig.filter(l => visibleSubjects.includes(l.subjectKey)).map(line => <Line key={line.dataKey} type="monotone" dataKey={line.dataKey} name={line.name} stroke={line.color} strokeWidth={2}/>)}
                        {overlayConfig.trendline && lineConfig.filter(l => visibleSubjects.includes(l.subjectKey)).map(line => <Line key={`${line.dataKey}_trend`} dataKey={`${line.dataKey}_trend`} stroke={line.color} opacity={0.7} strokeWidth={1} strokeDasharray="5 5" dot={false} name={`${line.name} Trend`} legendType="none"/>)}
                        {overlayConfig.movingAverage && lineConfig.filter(l => visibleSubjects.includes(l.subjectKey)).map(line => <Line key={`${line.dataKey}_ma`} dataKey={`${line.dataKey}_ma`} stroke={line.color} opacity={0.8} strokeWidth={2} dot={false} name={`${line.name} MA`} legendType="none" strokeDasharray="5 5"/>)}
                        {overlayConfig.bollingerBands && lineConfig.filter(l => visibleSubjects.includes(l.subjectKey)).flatMap(line => [
                            <Line key={`${line.dataKey}_ma_bb`} dataKey={`${line.dataKey}_ma`} stroke={line.color} opacity={0.8} strokeWidth={2} dot={false} name={`${line.name} MA`} legendType="none" strokeDasharray="5 5"/>,
                            <Area key={`${line.dataKey}_bb`} dataKey={`${line.dataKey}_bb`} stroke={line.color} fill={line.color} strokeWidth={0} fillOpacity={0.1} isAnimationActive={false} name={`${line.name} Band`} legendType="none"/>
                        ])}
                    </LineChart>
                </ResponsiveContainer>
            </div>
      </>
    );
};
