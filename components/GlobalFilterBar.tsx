
import React from 'react';
import type { GlobalFilter } from '../types';
import { TestType, TestSubType } from '../types';
import { Select } from './common/Select';
import { Input } from './common/Input';
import { Button } from './common/Button';


interface GlobalFilterBarProps {
    filter: GlobalFilter;
    setFilter: (filter: GlobalFilter) => void;
    testTypes: string[];
    subTypes: string[];
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({ filter, setFilter, testTypes, subTypes }) => {
    return (
        <div className="flex items-center gap-3 text-xs bg-slate-800/50 p-1.5 rounded-lg border border-slate-800/50">
            <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium px-1">Type</span>
                <Select
                    id="global-type-filter"
                    value={filter.type}
                    onChange={e => setFilter({ ...filter, type: e.target.value as GlobalFilter['type'] })}
                    className="!py-1 !px-2 !text-xs !w-auto bg-slate-900 border-slate-700 text-slate-200 h-7"
                >
                    <option value="all">All Types</option>
                    {testTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </Select>
            </div>
            
            <div className="w-[1px] h-4 bg-slate-700"></div>

            <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium px-1">Sub</span>
                <Select
                    id="global-subtype-filter"
                    value={filter.subType}
                    onChange={e => setFilter({ ...filter, subType: e.target.value as GlobalFilter['subType'] })}
                    className="!py-1 !px-2 !text-xs !w-auto bg-slate-900 border-slate-700 text-slate-200 h-7"
                >
                    <option value="all">All</option>
                    {subTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </Select>
            </div>

            <div className="w-[1px] h-4 bg-slate-700"></div>

            <div className="flex items-center gap-2">
                <Input 
                    type="date" 
                    value={filter.startDate || ''} 
                    onChange={e => setFilter({ ...filter, startDate: e.target.value })}
                    className="!py-1 !px-2 !text-xs !w-auto bg-slate-900 border-slate-700 text-slate-400 h-7 w-24"
                />
                <span className="text-slate-600 text-[10px]">-</span>
                <Input 
                    type="date" 
                    value={filter.endDate || ''}
                    onChange={e => setFilter({ ...filter, endDate: e.target.value })}
                    className="!py-1 !px-2 !text-xs !w-auto bg-slate-900 border-slate-700 text-slate-400 h-7 w-24"
                />
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilter({ type: 'all', subType: 'all', startDate: '', endDate: '' })}
                className="!text-cyan-500 hover:!text-cyan-400 hover:bg-transparent px-2 h-7"
                title="Reset Filters"
            >
                Reset
            </Button>
        </div>
    );
};
