
import React from 'react';

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
        // Updated regex to be slightly more robust for bold/italic/code
        const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).filter(Boolean);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="text-white font-bold tracking-wide">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={index} className="text-indigo-200 italic font-medium">{part.slice(1, -1)}</em>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
                return <code key={index} className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-700 shadow-sm">{part.slice(1, -1)}</code>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listStack: React.ReactNode[] = [];
    let inList = false;

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        
        // Handle Injected HTML (e.g. Footer)
        if (trimmed.startsWith('<div')) {
             if (inList && listStack.length > 0) {
                elements.push(<ul key={`ul-${i}`} className="space-y-2 my-4 pl-2">{listStack}</ul>);
                listStack = [];
                inList = false;
            }
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
        if (inList && listStack.length > 0) {
            elements.push(<ul key={`ul-${i}`} className="space-y-2 my-4 pl-2">{listStack}</ul>);
            listStack = [];
            inList = false;
        }

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

    // Flush remaining list
    if (listStack.length > 0) {
        elements.push(<ul key="ul-end" className="space-y-2 my-4 pl-2">{listStack}</ul>);
    }

    return <div className={`font-sans ${className}`}>{elements}</div>;
};
