
import React from 'react';

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl text-sm">
                <p className="font-bold text-cyan-400 mb-1">{label}</p>
                {payload.map((p: any, i: number) => {
                    if (p.name?.includes('Band')) return null; 
                    if (Array.isArray(p.value)) return null;
                    if (p.value === null || p.value === undefined) return null;
                    
                    return (
                        <p key={i} style={{ color: p.color || p.fill }}>
                            {`${p.name}: ${formatter ? formatter(p.value, p.name, p) : p.value}`}
                        </p>
                    );
                })}
            </div>
        );
    }
    return null;
};

export default CustomTooltip;
