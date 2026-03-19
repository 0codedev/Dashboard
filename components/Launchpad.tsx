import React from 'react';

const tools = [
    {
        name: "ExamGoal",
        url: "https://room.examgoal.com/",
        description: "JEE Previous Year Questions",
        icon: "🎯"
    },
    {
        name: "MARKS App",
        url: "https://web.getmarks.app/",
        description: "Chapter-wise Practice",
        icon: "📝"
    },
    {
        name: "Desmos",
    url: "https://www.desmos.com/calculator",
    description: "Advanced Graphing Calculator",
    icon: "📈",
    category: "Math"
    },
    {
    name: "Wolfram Alpha",
    url: "https://www.wolframalpha.com/",
    description: "Step-by-step Math Solver",
    icon: "🤖",
    category: "Math"
    },
  // --- PHYSICS & VISUALIZATION ---
    {
    name: "PhET Sims",
    url: "https://phet.colorado.edu/",
    description: "Interactive Physics Simulators",
    icon: "⚡",
    category: "Physics"
    },
  // --- CHEMISTRY ---
   {
    name: "MolView",
    url: "https://molview.org/",
    description: "3D Organic Chemistry Viewer",
    icon: "🧬",
    category: "Chemistry"
   },
   {
    name: "PTable",
    url: "https://ptable.com/",
    description: "Dynamic Periodic Trends",
    icon: "🧪",
    category: "Chemistry"
   }
];

export const Launchpad: React.FC = () => {
    return (
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Launchpad</h1>
                <p className="text-gray-400">Quick access to your essential study tools and resources.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool, index) => (
                    <a 
                        key={index} 
                        href={tool.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="group block p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:bg-slate-800 hover:border-cyan-500/50 transition-all duration-300 shadow-lg hover:shadow-cyan-900/20"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-slate-700/50 group-hover:bg-cyan-500/10 transition-colors text-2xl">
                                {tool.icon}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-100 group-hover:text-cyan-400 transition-colors mb-1">
                                    {tool.name}
                                </h3>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    {tool.description}
                                </p>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};
