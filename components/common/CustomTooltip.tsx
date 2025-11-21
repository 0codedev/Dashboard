
import React from 'react';

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2 bg-slate-800/80 backdrop-blur-sm border border-slate-600/50 rounded-lg shadow-lg text-sm">
                <p className="font-bold text-cyan-400 mb-1">{label}</p>
                {payload.map((p: any, i: number) => {
                    if (p.name?.includes('Band')) return null; 
                    if (Array.isArray(p.value)) return null;
                    if (p.value === null || p.value === undefined) return null;
                    
                    return (
                        <p key={i} style={{ color: p.color || p.fill }}>
                            {`${p.name}: ${formatter ? formatter(p.value) : p.value}`}
                        </p>
                    );
                })}
            </div>
        );
    }
    return null;
};

export default CustomTooltip;
