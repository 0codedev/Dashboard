import React from 'react';

export const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
    <div className="flex items-center">
        <span id={`label-${label.replace(/\s/g, '-')}`} className="text-gray-300 mr-3">{label}</span>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={`label-${label.replace(/\s/g, '-')}`}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-[rgb(var(--color-primary-rgb))] ${
                checked ? 'bg-[rgb(var(--color-primary-rgb))]' : 'bg-slate-600'
            }`}
        >
            <span
                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                    checked ? 'translate-x-7' : 'translate-x-1'
                }`}
            />
        </button>
    </div>
);
