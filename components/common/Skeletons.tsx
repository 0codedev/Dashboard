import React from 'react';

export const SkeletonChart = () => (
  <div className="w-full h-full flex flex-col justify-end gap-2 p-4 animate-shimmer rounded-lg">
     <div className="flex justify-between items-end h-3/4 gap-2">
        <div className="w-1/5 h-2/3 bg-slate-700/30 rounded-t-md"></div>
        <div className="w-1/5 h-3/4 bg-slate-700/30 rounded-t-md"></div>
        <div className="w-1/5 h-1/2 bg-slate-700/30 rounded-t-md"></div>
        <div className="w-1/5 h-4/5 bg-slate-700/30 rounded-t-md"></div>
        <div className="w-1/5 h-3/5 bg-slate-700/30 rounded-t-md"></div>
     </div>
     <div className="w-full h-1 bg-slate-700/30 rounded-full"></div>
  </div>
);

export const SkeletonRadar = () => (
    <div className="w-full h-full flex items-center justify-center animate-shimmer rounded-lg">
         <div className="relative w-48 h-48 rounded-full border-4 border-slate-700/30 flex items-center justify-center">
             <div className="w-32 h-32 rounded-full border-4 border-slate-700/30"></div>
             <div className="absolute w-1 h-full bg-slate-700/30"></div>
             <div className="absolute h-1 w-full bg-slate-700/30"></div>
         </div>
    </div>
);

export const SkeletonMetric = () => (
    <div className="h-full flex flex-col justify-between p-1 animate-shimmer rounded-lg">
        <div className="h-4 w-24 bg-slate-700/30 rounded mb-2"></div>
        <div className="h-8 w-16 bg-slate-700/30 rounded"></div>
        <div className="h-3 w-full bg-slate-700/30 rounded mt-2"></div>
    </div>
);