import React from 'react';

const tools = [
    {
        name: "ExamGoal",
        url: "https://room.examgoal.com/",
        description: "JEE Previous Year Questions with detailed analysis.",
        icon: "🎯",
        category: "Practice"
    },
    {
        name: "MARKS App",
        url: "https://web.getmarks.app/",
        description: "Chapter-wise Practice and Mock Tests by MathonGo.",
        icon: "📝",
        category: "Practice"
    },
    {
        name: "MathonGo (YouTube)",
        url: "https://www.youtube.com/@MathonGo",
        description: "Best resources for JEE Mathematics and strategy.",
        icon: "📐",
        category: "Math"
    },
    {
        name: "JEE Main Official",
        url: "https://jeemain.nta.ac.in/",
        description: "Official NTA portal for JEE Main updates and registration.",
        icon: "🏛️",
        category: "Official"
    },
    {
        name: "JEE Advanced Official",
        url: "https://jeeadv.ac.in/",
        description: "Official portal for JEE Advanced information and results.",
        icon: "🎓",
        category: "Official"
    },
    {
        name: "Mohit Tyagi (YouTube)",
        url: "https://www.youtube.com/@mohittyagi",
        description: "The gold standard for free JEE content (Competishun).",
        icon: "📺",
        category: "Video"
    },
    {
        name: "Physics Galaxy",
        url: "https://www.physicsgalaxy.com/home",
        description: "Ashish Arora's physics resources and concept videos.",
        icon: "🌌",
        category: "Physics"
    },
    {
        name: "Physics Wallah",
        url: "https://www.youtube.com/@PhysicsWallah",
        description: "Comprehensive JEE preparation and motivational content.",
        icon: "⚛️",
        category: "Video"
    },
    {
        name: "CollegePravesh",
        url: "https://www.collegepravesh.com/",
        description: "Essential portal for cutoffs, counseling, and college info.",
        icon: "🏫",
        category: "Counseling"
    },
    {
        name: "Desmos",
        url: "https://www.desmos.com/calculator",
        description: "Advanced Graphing Calculator for visualizing functions.",
        icon: "📈",
        category: "Math"
    },
    {
        name: "Wolfram Alpha",
        url: "https://www.wolframalpha.com/",
        description: "Step-by-step Math Solver and knowledge engine.",
        icon: "🤖",
        category: "Math"
    },
    {
        name: "PhET Sims",
        url: "https://phet.colorado.edu/",
        description: "Interactive Physics and Chemistry Simulators.",
        icon: "⚡",
        category: "Science"
    },
    {
        name: "MolView",
        url: "https://molview.org/",
        description: "3D Organic Chemistry Molecular Viewer.",
        icon: "🧬",
        category: "Chemistry"
    },
    {
        name: "PTable",
        url: "https://ptable.com/",
        description: "Dynamic Periodic Table with properties and trends.",
        icon: "🧪",
        category: "Chemistry"
    },
    {
        name: "r/JEENEETards",
        url: "https://www.reddit.com/r/JEENEETards/",
        description: "The biggest community for JEE/NEET aspirants in India.",
        icon: "🧡",
        category: "Community"
    },
    {
        name: "Embibe",
        url: "https://www.embibe.com/",
        description: "AI-powered mock tests and personalized learning paths.",
        icon: "🧠",
        category: "Practice"
    },
    {
        name: "LibreTexts",
        url: "https://chem.libretexts.org/",
        description: "Open-access textbooks for Chemistry and Physics.",
        icon: "📚",
        category: "Resources"
    },
    {
        name: "NTA Abhyas",
        url: "https://www.nta.ac.in/Abhyas",
        description: "Official NTA mock test platform for JEE preparation.",
        icon: "📱",
        category: "Practice"
    },
    {
        name: "Unacademy JEE",
        url: "https://www.youtube.com/@UnacademyJEE",
        description: "Top-tier lectures and live sessions for all subjects.",
        icon: "🎓",
        category: "Video"
    },
    {
        name: "Vedantu JEE",
        url: "https://www.youtube.com/@JEEVedantu",
        description: "Interactive live classes and problem-solving sessions.",
        icon: "💡",
        category: "Video"
    },
    {
        name: "JEE Adv. Syllabus",
        url: "https://jeeadv.ac.in/syllabus/combined-syllabus.pdf",
        description: "Official JEE Advanced syllabus (PDF). Know your target.",
        icon: "📋",
        category: "Official"
    },
    {
        name: "Formula Sheets",
        url: "https://www.mathongo.com/jee-main/formula-sheet",
        description: "Quick revision formula sheets for all JEE topics.",
        icon: "📝",
        category: "Revision"
    },
    {
        name: "Khan Academy",
        url: "https://www.khanacademy.org/science/class-11-physics-india",
        description: "Master the fundamentals of Physics and Chemistry.",
        icon: "🏫",
        category: "Basics"
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
                        className="group block p-6 glass-panel rounded-2xl hover:border-cyan-500/50 transition-all duration-300 hover:shadow-cyan-900/20"
                    >
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl bg-slate-700/50 group-hover:bg-cyan-500/10 transition-colors text-2xl">
                                {tool.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-semibold text-gray-100 group-hover:text-cyan-400 transition-colors">
                                        {tool.name}
                                    </h3>
                                    {tool.category && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                                            {tool.category}
                                        </span>
                                    )}
                                </div>
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
