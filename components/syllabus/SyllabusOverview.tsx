
import React from 'react';
import { UserProfile, QuestionLog } from '../../types';
import { SubjectDonutCard } from '../visualizations/SubjectDonutCard';
import { JEE_SYLLABUS } from '../../constants';

export const SyllabusOverviewWidget: React.FC<{ userProfile: UserProfile; questionLogs: QuestionLog[] }> = ({ userProfile, questionLogs }) => {
    const subjects = ['physics', 'chemistry', 'maths'];

    return (
        <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {subjects.map(subject => {
                    // @ts-ignore
                    const chapters = JEE_SYLLABUS[subject].flatMap(unit => unit.chapters.map(c => c.name));
                    return (
                        <SubjectDonutCard 
                            key={subject}
                            subject={subject}
                            chapters={chapters}
                            userProfile={userProfile}
                            questionLogs={questionLogs}
                        />
                    );
                })}
            </div>
        </div>
    );
};
