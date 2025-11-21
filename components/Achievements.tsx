
import React, { useState, useMemo, useEffect } from 'react';
import type { Achievement, GamificationState } from '../types';
import { ACHIEVEMENT_CONFIG } from '../achievements';

interface AchievementsProps {
  gamificationState: GamificationState;
  achievements: Achievement[];
  levelInfo: {
    currentLevelXP: number;
    xpForNextLevel: number;
    progress: number;
  };
}

// --- Rank Logic ---
const RANKS = [
    { threshold: 1, title: "Novice Aspirant", color: "text-slate-400", border: "border-slate-500", bg: "bg-slate-900" },
    { threshold: 5, title: "Diligent Student", color: "text-emerald-400", border: "border-emerald-500", bg: "bg-emerald-900/20" },
    { threshold: 10, title: "Concept Builder", color: "text-cyan-400", border: "border-cyan-500", bg: "bg-cyan-900/20" },
    { threshold: 20, title: "Problem Slayer", color: "text-blue-400", border: "border-blue-500", bg: "bg-blue-900/20" },
    { threshold: 30, title: "Rank Chaser", color: "text-purple-400", border: "border-purple-500", bg: "bg-purple-900/20" },
    { threshold: 40, title: "JEE Master", color: "text-amber-400", border: "border-amber-500", bg: "bg-amber-900/20" },
    { threshold: 50, title: "Grandmaster", color: "text-rose-400", border: "border-rose-500", bg: "bg-rose-900/20" },
];

const getRank = (level: number) => {
    return RANKS.slice().reverse().find(r => level >= r.threshold) || RANKS[0];
};

// --- Daily Bounties (Mocked for frontend demo, ideally persisted in DB) ---
const DAILY_BOUNTIES = [
    { id: 'b1', title: "Morning Consistency", desc: "Complete a task before 9 AM", xp: 50, icon: "🌅", completed: true },
    { id: 'b2', title: "Error Hunter", desc: "Log 3 analysis entries", xp: 75, icon: "🔍", completed: false },
    { id: 'b3', title: "Deep Work", desc: "Complete a 45m Focus Session", xp: 100, icon: "🧠", completed: false },
];

const BountyCard: React.FC<{ bounty: typeof DAILY_BOUNTIES[0] }> = ({ bounty }) => (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${bounty.completed ? 'bg-green-900/20 border-green-500/30 opacity-75' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}>
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${bounty.completed ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-gray-400'}`}>
                {bounty.icon}
            </div>
            <div>
                <h4 className={`text-sm font-bold ${bounty.completed ? 'text-green-300 line-through' : 'text-gray-200'}`}>{bounty.title}</h4>
                <p className="text-[10px] text-gray-500">{bounty.desc}</p>
            </div>
        </div>
        <div className="text-right">
            <span className="text-xs font-bold text-yellow-400">+{bounty.xp} XP</span>
            {bounty.completed && <div className="text-[10px] text-green-400 font-bold">CLAIMED</div>}
        </div>
    </div>
);

// --- 3D Flip Card Component ---
const AchievementFlipCard: React.FC<{ achievement: Achievement }> = ({ achievement }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const isUnlocked = achievement.unlocked;
  
  // Determine Tier Color based on goal/difficulty (heuristic)
  let tierColor = "bg-gradient-to-br from-slate-700 to-slate-800"; // Common
  let iconGlow = "text-slate-400";
  if (achievement.category === 'Performance') { tierColor = "bg-gradient-to-br from-amber-700/40 to-amber-900/40"; iconGlow = "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"; }
  if (achievement.id === 'deepDiver' || achievement.id === 'sillyMistakeSlayer') { tierColor = "bg-gradient-to-br from-cyan-700/40 to-cyan-900/40"; iconGlow = "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"; }

  // Calculate Progress for locked items (Simulated logic as plain 'progress' might be missing on some)
  const currentCount = achievement.progress || 0;
  const goal = achievement.goal || achievement.tiers?.[0]?.count || 1;
  const percent = Math.min(100, (currentCount / goal) * 100);

  return (
    <div 
        className="group perspective-1000 w-full h-48 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
        onMouseEnter={() => setIsFlipped(true)}
        onMouseLeave={() => setIsFlipped(false)}
    >
      <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
        
        {/* FRONT SIDE */}
        <div className={`absolute inset-0 backface-hidden p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center ${isUnlocked ? tierColor : 'bg-slate-800/50'} shadow-xl`}>
            <div className={`w-16 h-16 mb-3 flex items-center justify-center text-4xl transition-transform duration-300 group-hover:scale-110 ${isUnlocked ? '' : 'opacity-30 grayscale'}`}>
                <span className={isUnlocked ? iconGlow : ''}>{achievement.icon}</span>
            </div>
            <h3 className={`font-bold text-sm ${isUnlocked ? 'text-white' : 'text-gray-500'}`}>{achievement.title}</h3>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{achievement.category}</p>
            {!isUnlocked && (
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden border border-slate-700">
                    <div className="bg-slate-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                </div>
            )}
            {isUnlocked && <div className="absolute top-2 right-2 text-yellow-400 text-xs">★</div>}
        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 p-4 rounded-xl border border-slate-600 bg-slate-900 flex flex-col items-center justify-center text-center shadow-2xl">
            <h3 className="font-bold text-cyan-400 text-sm mb-2">{achievement.title}</h3>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">{achievement.description}</p>
            
            {isUnlocked ? (
                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase">Unlocked</div>
                    <div className="text-xs text-white font-mono">{achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Recently'}</div>
                </div>
            ) : (
                <div className="w-full">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(percent)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full" style={{ width: `${percent}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">Keep going to unlock!</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const HeroSection: React.FC<{ gamificationState: GamificationState, levelInfo: any, rank: any }> = ({ gamificationState, levelInfo, rank }) => (
    <div className="bg-slate-800/50 p-6 rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${rank.bg.replace('/20', '')}`}></div>

        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            {/* Level Circle */}
            <div className="relative w-32 h-32 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="58" fill="none" stroke="#1e293b" strokeWidth="8" />
                    <circle 
                        cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="8" 
                        className={rank.color}
                        strokeDasharray={2 * Math.PI * 58} 
                        strokeDashoffset={(2 * Math.PI * 58) * (1 - levelInfo.progress / 100)} 
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs text-gray-400 uppercase tracking-widest">Level</span>
                    <span className={`text-4xl font-black ${rank.color}`}>{gamificationState.level}</span>
                </div>
            </div>

            {/* Rank Info */}
            <div className="flex-grow text-center md:text-left space-y-2">
                <div className={`inline-block px-3 py-1 rounded-full border ${rank.border} ${rank.bg} ${rank.color} text-xs font-bold uppercase tracking-wider mb-2`}>
                    Current Rank
                </div>
                <h2 className="text-3xl font-bold text-white">{rank.title}</h2>
                <p className="text-gray-400 max-w-md">
                    You are in the top percentile of dedicated students. Keep solving problems to reach <strong className="text-white">Level {gamificationState.level + 1}</strong>.
                </p>
                <div className="pt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{levelInfo.currentLevelXP.toLocaleString()} XP</span>
                        <span>{levelInfo.xpForNextLevel.toLocaleString()} XP</span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${rank.bg.replace('/20', '')} bg-current text-${rank.color.split('-')[1]}-500`} style={{ width: `${levelInfo.progress}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Stats Box */}
            <div className="grid grid-cols-2 gap-4 md:border-l border-slate-700 md:pl-8">
                <div className="text-center">
                    <p className="text-2xl font-bold text-white">{gamificationState.xp.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Total XP</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-white">{gamificationState.streakData?.count || 0}🔥</p>
                    <p className="text-[10px] text-gray-500 uppercase">Day Streak</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-white">{Object.keys(gamificationState.unlockedAchievements).length}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Awards</p>
                </div>
                <div className="text-center">
                    <p className="text-2xl font-bold text-white">{gamificationState.completedTasks}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Tasks Done</p>
                </div>
            </div>
        </div>
    </div>
);

export const Achievements: React.FC<AchievementsProps> = ({ gamificationState, achievements, levelInfo }) => {
  const rank = useMemo(() => getRank(gamificationState.level), [gamificationState.level]);
  
  // Sort achievements: Unlocked first, then by % progress
  const sortedAchievements = useMemo(() => {
      return [...achievements].sort((a, b) => {
          if (a.unlocked && !b.unlocked) return -1;
          if (!a.unlocked && b.unlocked) return 1;
          // If both locked/unlocked, sort by progress (mocked logic for sorting)
          return (b.progress || 0) - (a.progress || 0);
      });
  }, [achievements]);

  return (
    <div className="space-y-8 pb-20">
      {/* Hero Section */}
      <HeroSection gamificationState={gamificationState} levelInfo={levelInfo} rank={rank} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Col: Bounties & Activity */}
          <div className="space-y-6">
              {/* Daily Bounties */}
              <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-cyan-300">Daily Bounties</h3>
                      <span className="text-xs text-gray-500 bg-slate-900 px-2 py-1 rounded">Resets in 12h</span>
                  </div>
                  <div className="space-y-3">
                      {DAILY_BOUNTIES.map(bounty => <BountyCard key={bounty.id} bounty={bounty} />)}
                  </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-700">
                  <h3 className="text-lg font-bold text-gray-300 mb-4">Recent Unlocks</h3>
                  <div className="space-y-4 relative pl-4 border-l border-slate-700">
                      {sortedAchievements.filter(a => a.unlocked).slice(0, 3).map((ach, i) => (
                          <div key={ach.id} className="relative">
                              <div className="absolute -left-[21px] top-1 w-3 h-3 bg-cyan-500 rounded-full border-2 border-slate-800 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                              <p className="text-sm font-semibold text-white">{ach.title}</p>
                              <p className="text-xs text-gray-500">{ach.unlockedAt ? new Date(ach.unlockedAt).toLocaleDateString() : 'Recently'}</p>
                          </div>
                      ))}
                      {sortedAchievements.filter(a => a.unlocked).length === 0 && <p className="text-xs text-gray-500 italic">No achievements unlocked yet. Start your journey!</p>}
                  </div>
              </div>
          </div>

          {/* Right Col: Achievement Grid */}
          <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-white">Trophy Case</h3>
                  <div className="flex gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-slate-800 text-gray-400 border border-slate-700">Total: {achievements.length}</span>
                      <span className="text-xs px-2 py-1 rounded bg-green-900/20 text-green-400 border border-green-900/30">Unlocked: {achievements.filter(a => a.unlocked).length}</span>
                  </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {sortedAchievements.map(ach => (
                  <AchievementFlipCard key={ach.id} achievement={ach} />
                ))}
              </div>
          </div>
      </div>
    </div>
  );
};
