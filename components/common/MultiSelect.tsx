import React, { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
    options: { label: string; value: string }[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    className?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selectedValues, onChange, placeholder = "Select...", className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (value: string) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    const displayValue = selectedValues.length === 0 
        ? placeholder 
        : selectedValues.length === 1 
            ? options.find(o => o.value === selectedValues[0])?.label || selectedValues[0]
            : `${selectedValues.length} selected`;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                className="w-full flex items-center justify-between bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs h-7 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{displayValue}</span>
                <span className="ml-1 text-slate-400 text-[10px]">▼</span>
            </button>
            
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[150px] bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
                    {options.map(option => (
                        <label key={option.value} className="flex items-center px-3 py-2 hover:bg-slate-700 cursor-pointer text-xs text-slate-200">
                            <input
                                type="checkbox"
                                className="mr-2 form-checkbox h-3 w-3 text-cyan-500 rounded bg-slate-900 border-slate-600 focus:ring-cyan-500 focus:ring-offset-slate-800"
                                checked={selectedValues.includes(option.value)}
                                onChange={() => toggleOption(option.value)}
                            />
                            {option.label}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};
