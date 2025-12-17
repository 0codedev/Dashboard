
import React from 'react';

// Declare KaTeX on window object since it's loaded via CDN
declare global {
    interface Window {
        katex: any;
    }
}

interface MarkdownRendererProps {
    content: string;
    className?: string;
    baseTextSize?: string;
    baseTextColor?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
    content, 
    className = '',
    baseTextSize = 'text-sm md:text-base',
    baseTextColor = 'text-slate-300'
}) => {
    if (!content) return null;

    const renderInline = (text: string) => {
        // Regex Breakdown:
        // 1. Code: `...`
        // 2. Block Math: $$...$$
        // 3. Inline Math: $...$ (non-greedy)
        // 4. Bold: **...**
        // 5. Italic: *...*
        const parts = text.split(/(`[^`]+`|\$\$[^$]+\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
        
        return parts.map((part, index) => {
            // Code
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={index} className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-700 shadow-sm">{part.slice(1, -1)}</code>;
            }
            // Block Math
            if (part.startsWith('$$') && part.endsWith('$$')) {
                const math = part.slice(2, -2);
                try {
                    if (window.katex) {
                        const html = window.katex.renderToString(math, { 
                            throwOnError: false, 
                            displayMode: true 
                        });
                        return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="block my-2 text-center" />;
                    }
                } catch (e) {
                    console.error("KaTeX error", e);
                }
                return <div key={index} className="font-mono text-cyan-200 bg-slate-900 p-2 rounded text-center">{math}</div>; // Fallback
            }
            // Inline Math
            if (part.startsWith('$') && part.endsWith('$')) {
                const math = part.slice(1, -1);
                try {
                    if (window.katex) {
                        const html = window.katex.renderToString(math, { 
                            throwOnError: false, 
                            displayMode: false 
                        });
                        return <span key={index} dangerouslySetInnerHTML={{ __html: html }} className="mx-1" />;
                    }
                } catch (e) {
                    console.error("KaTeX error", e);
                }
                return <span key={index} className="font-mono text-cyan-200">{part}</span>; // Fallback
            }
            // Bold
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="text-white font-bold tracking-wide">{part.slice(2, -2)}</strong>;
            }
            // Italic
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={index} className="text-indigo-200 italic font-medium">{part.slice(1, -1)}</em>;
            }
            // Regular Text
            return <span key={index}>{part}</span>;
        });
    };

    const renderTable = (rows: string[], keyIndex: number) => {
        // Basic Markdown Table Parser
        if (rows.length < 2) return null; // Need at least header and separator

        // Filter out empty strings that result from split if there are leading/trailing pipes
        const cleanRow = (r: string) => {
            // Remove leading/trailing pipes if present
            let content = r.trim();
            if (content.startsWith('|')) content = content.substring(1);
            if (content.endsWith('|')) content = content.substring(0, content.length - 1);
            return content.split('|').map(c => c.trim());
        };

        const headers = cleanRow(rows[0]);
        // rows[1] is the separator line (e.g. |---|), skip it
        const bodyRows = rows.slice(2).map(cleanRow);

        return (
            <div key={`table-${keyIndex}`} className="overflow-x-auto my-4 rounded-lg border border-slate-700/50 shadow-sm">
                <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-800 text-slate-200 font-bold uppercase tracking-wider text-xs">
                        <tr>
                            {headers.map((h, idx) => (
                                <th key={idx} className="px-4 py-3 border-b border-slate-700 whitespace-nowrap bg-slate-800/80">{renderInline(h)}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 bg-slate-900/30 text-slate-300">
                        {bodyRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
                                {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="px-4 py-2 border-r border-slate-700/30 last:border-r-0">{renderInline(cell)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listStack: React.ReactNode[] = [];
    let inList = false;
    let tableBuffer: string[] = [];
    let inTable = false;

    const flushList = (keyPrefix: number) => {
        if (listStack.length > 0) {
            elements.push(<ul key={`ul-${keyPrefix}`} className="space-y-2 my-4 pl-2">{listStack}</ul>);
            listStack = [];
        }
        inList = false;
    };

    const flushTable = (keyPrefix: number) => {
        if (tableBuffer.length > 0) {
            elements.push(renderTable(tableBuffer, keyPrefix));
            tableBuffer = [];
        }
        inTable = false;
    };

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        
        // Handle Table Detection
        if (trimmed.startsWith('|')) {
            if (!inTable) {
                flushList(i); // Close any open list
                inTable = true;
            }
            tableBuffer.push(trimmed);
            return;
        } else if (inTable) {
            flushTable(i);
        }

        // Handle Injected HTML (e.g. Footer)
        if (trimmed.startsWith('<div')) {
             if (inList) flushList(i);
             elements.push(<div key={i} dangerouslySetInnerHTML={{ __html: line }} />);
             return;
        }

        // Handle Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
            const isOrdered = /^\d+\.\s/.test(trimmed);
            const content = trimmed.replace(/^[-*]\s|^\d+\.\s/, '');
            
            listStack.push(
                <li key={`li-${i}`} className={`ml-4 pl-2 relative ${isOrdered ? 'list-decimal text-slate-400 marker:text-cyan-500 marker:font-bold' : 'list-none'}`}>
                    {!isOrdered && (
                        <span className="absolute left-[-1.2rem] top-[0.6rem] w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"></span>
                    )}
                    <span className={`${baseTextColor} leading-relaxed block`}>{renderInline(content)}</span>
                </li>
            );
            inList = true;
            return;
        }

        // Close list if we encounter non-list item
        if (inList) flushList(i);

        // Headers
        if (trimmed.startsWith('###')) {
            elements.push(
                <h3 key={i} className="text-lg font-bold text-cyan-400 mt-6 mb-3 border-b border-slate-700/50 pb-2 flex items-center gap-2 group">
                    <span className="text-cyan-500/30 text-sm group-hover:text-cyan-500/60 transition-colors">#</span> 
                    {renderInline(trimmed.replace(/^#+\s/, ''))}
                </h3>
            );
        } else if (trimmed.startsWith('##')) {
            elements.push(
                <h2 key={i} className="text-xl font-bold text-white mt-8 mb-4 pb-2 border-b border-slate-600 flex items-center gap-2">
                    <span className="w-1 h-6 bg-cyan-500 rounded-full"></span>
                    {renderInline(trimmed.replace(/^#+\s/, ''))}
                </h2>
            );
        } 
        // Blockquotes
        else if (trimmed.startsWith('>')) {
            elements.push(
                <blockquote key={i} className="border-l-4 border-indigo-500 pl-4 py-3 my-5 bg-gradient-to-r from-indigo-900/20 to-transparent rounded-r-lg italic text-indigo-100/90 text-sm leading-relaxed shadow-sm">
                    <span className="text-indigo-400 font-bold mr-2">💡 Insight:</span>
                    {renderInline(trimmed.replace(/^>\s?/, ''))}
                </blockquote>
            );
        } 
        // Horizontal Rule
        else if (trimmed === '---' || trimmed === '***') {
            elements.push(<hr key={i} className="border-slate-700 my-6" />);
        }
        // Paragraphs
        else if (trimmed.length > 0) {
            // Check if it's a key-value pair line (e.g., "Label: Value") for special formatting
            if (/^(\*\*.*?\*\*|[^:]+):/.test(trimmed) && trimmed.length < 100 && !trimmed.includes('\n')) {
                 const [key, ...rest] = trimmed.split(':');
                 elements.push(
                    <p key={i} className={`${baseTextColor} ${baseTextSize} leading-relaxed my-1`}>
                        <span className="text-cyan-100 font-semibold">{renderInline(key)}:</span>
                        <span className="ml-1 opacity-90">{renderInline(rest.join(':'))}</span>
                    </p>
                 );
            } else {
                elements.push(<p key={i} className={`${baseTextColor} ${baseTextSize} leading-relaxed my-2 font-normal tracking-wide`}>{renderInline(trimmed)}</p>);
            }
        } else {
            // Empty line spacing
            elements.push(<div key={i} className="h-2"></div>);
        }
    });

    // Flush remaining structures
    if (inList) flushList(lines.length);
    if (inTable) flushTable(lines.length);

    return <div className={`font-sans ${className}`}>{elements}</div>;
};
