
import React from 'react';
import type { GlobalFilter } from '../types';
import { TestType, TestSubType } from '../types';
import { Input } from './common/Input';
import { Button } from './common/Button';
import { MultiSelect } from './common/MultiSelect';

interface GlobalFilterBarProps {
    filter: GlobalFilter;
    setFilter: (filter: GlobalFilter) => void;
    testTypes: string[];
    subTypes: string[];
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({ filter, setFilter, testTypes, subTypes }) => {
    const typeOptions = testTypes.map(t => ({ label: t, value: t }));
    const subTypeOptions = subTypes.map(t => ({ label: t, value: t }));
    const subjectOptions = [
        { label: 'Physics', value: 'physics' },
        { label: 'Chemistry', value: 'chemistry' },
        { label: 'Maths', value: 'maths' }
    ];

    const selectedTypes = Array.isArray(filter.type) ? filter.type : (filter.type === 'all' ? [] : [filter.type as string]);
    const selectedSubTypes = Array.isArray(filter.subType) ? filter.subType : (filter.subType === 'all' ? [] : [filter.subType as string]);
    const selectedSubjects = filter.subjects || [];

    return (
        <div className="flex items-center gap-3 text-xs glass-panel p-1.5 rounded-xl flex-wrap">
            <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium px-1">Subjects</span>
                <MultiSelect
                    options={subjectOptions}
                    selectedValues={selectedSubjects}
                    onChange={values => setFilter({ ...filter, subjects: values as any })}
                    placeholder="All Subjects"
                    className="w-32"
                />
            </div>

            <div className="w-[1px] h-4 bg-slate-700"></div>

            <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium px-1">Type</span>
                <MultiSelect
                    options={typeOptions}
                    selectedValues={selectedTypes}
                    onChange={values => setFilter({ ...filter, type: values.length === 0 ? 'all' : values })}
                    placeholder="All Types"
                    className="w-32"
                />
            </div>
            
            <div className="w-[1px] h-4 bg-slate-700"></div>

            <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium px-1">Sub</span>
                <MultiSelect
                    options={subTypeOptions}
                    selectedValues={selectedSubTypes}
                    onChange={values => setFilter({ ...filter, subType: values.length === 0 ? 'all' : values })}
                    placeholder="All SubTypes"
                    className="w-32"
                />
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
                onClick={() => setFilter({ type: 'all', subType: 'all', subjects: [], startDate: '', endDate: '' })}
                className="!text-cyan-500 hover:!text-cyan-400 hover:bg-transparent px-2 h-7"
                title="Reset Filters"
            >
                Reset
            </Button>
        </div>
    );
};
