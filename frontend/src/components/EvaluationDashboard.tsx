import React, { useState, useMemo } from 'react';
import { useTimeTracker, formatDuration } from '../hooks/useTimeTracker';
// FIX: Import the 'Project' type to resolve reference error.
import { ProjectEvaluationData, UserBreakdown, CompletedSession, Project } from '../types';
import { ChevronLeft, Clock, Users, Calendar, DollarSign, Download, BarChart3, TrendingUp, ArrowLeftRight } from './Icons';

const TimeVariance: React.FC<{ variance: number | null }> = ({ variance }) => {
    if (variance === null) {
        return <span className="text-gray-500">N/A</span>;
    }
    const hours = Math.abs(variance).toFixed(1);
    if (variance > 0) {
        return <span className="font-semibold text-red-600">{hours}h presah</span>;
    }
    if (variance < 0) {
        return <span className="font-semibold text-green-600">{hours}h úspora</span>;
    }
    return <span className="font-semibold text-gray-700">Presne podľa plánu</span>;
}

const ProjectDetailsView: React.FC<{ projectData: ProjectEvaluationData; onBack: () => void; }> = ({ projectData, onBack }) => {
    const exportProjectSessionsToCSV = (sessions: CompletedSession[]) => {
        if (sessions.length === 0) {
            alert("Pre tento projekt nie sú žiadne relácie na export.");
            return;
        }
        const headers = ['Dátum', 'Čas', 'Zamestnanec', 'Trvanie', 'Trvanie (minúty)'];
        
        const csvContent = [
            headers.join(';'),
            ...sessions.map(session => [
                `"${new Date(session.timestamp).toLocaleDateString('sk-SK')}"`,
                `"${new Date(session.timestamp).toLocaleTimeString('sk-SK')}"`,
                `"${session.employee_name}"`,
                `"${formatDuration(session.duration_minutes)}"`,
                session.duration_minutes
            ].join(';'))
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `projekt_${projectData.name.replace(/\s+/g, '_')}_relacie.csv`;
        link.click();
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <button onClick={onBack} className="flex items-center text-sm text-blue-600 hover:underline mb-4">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Späť na prehľad vyhodnotení
            </button>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{projectData.name}</h2>
                <p className="text-gray-500 mb-4">Deadline: {new Date(projectData.deadline).toLocaleDateString('sk-SK')}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <InfoCard icon={<Clock />} label="Čas v období" value={formatDuration(projectData.totalTime)} />
                    <InfoCard icon={<Users />} label="Členovia tímu" value={projectData.uniqueUsers.toString()} />
                    <InfoCard icon={<Calendar />} label="Relácie v období" value={projectData.sessions.toString()} />
                    <InfoCard icon={<DollarSign />} label="Cena / Hodina (celkovo)" value={`${projectData.costPerHour.toFixed(2)} €`} />
                    <InfoCard icon={<TrendingUp />} label="Priebeh (podľa hodín)" value={projectData.workProgressPercentage !== null ? `${projectData.workProgressPercentage.toFixed(0)}%` : 'N/A'} />
                    <InfoCard icon={<ArrowLeftRight />} label="Časová odchýlka (celkovo)" value={<TimeVariance variance={projectData.timeVariance} />} />
                </div>
                 <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${projectData.workProgressPercentage || 0}%` }}></div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Časové rozdelenie podľa používateľa (v období)</h3>
                <div className="space-y-3">
                    {Object.values(projectData.userBreakdown).map((userData: UserBreakdown) => (
                        <div key={userData.name} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                            <p className="font-medium text-gray-800">{userData.name}</p>
                            <div className="text-right">
                                <p className="font-semibold">{formatDuration(userData.totalTime)}</p>
                                <p className="text-sm text-gray-500">{userData.sessions} relácií</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Všetky relácie (v období)</h3>
                    <button onClick={() => exportProjectSessionsToCSV(projectData.allSessions)} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm flex items-center">
                        <Download className="w-4 h-4 mr-1" /> Exportovať
                    </button>
                 </div>
                 <div className="space-y-2 max-h-96 overflow-y-auto">
                    {projectData.allSessions.map((session, index) => (
                        <div key={index} className="bg-gray-50 p-2 rounded-lg text-sm flex justify-between">
                            <span>{session.employee_name} dňa {new Date(session.timestamp).toLocaleDateString('sk-SK')}</span>
                            <span className="font-semibold">{formatDuration(session.duration_minutes)}</span>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};

const InfoCard: React.FC<{ icon: React.ReactElement<{ className?: string }>; label: string; value: string | React.ReactNode; }> = ({ icon, label, value }) => (
    <div className="bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center text-gray-600 mb-1">
            {React.cloneElement(icon, { className: "w-4 h-4 mr-2" })}
            <span className="text-sm">{label}</span>
        </div>
        <div className="font-semibold text-gray-800 text-lg">{value}</div>
    </div>
);

const EvaluationDashboard: React.FC = () => {
    const { completedSessions, projects, exportToExcel } = useTimeTracker();
    const [selectedProject, setSelectedProject] = useState<ProjectEvaluationData | null>(null);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    
    const [filteredSessions, evaluationData] = useMemo(() => {
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
        const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Date.now();
        
        const sessionsInPeriod = completedSessions.filter(session => {
            const sessionDate = new Date(session.timestamp).getTime();
            return sessionDate >= start && sessionDate <= end;
        });

        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach((project: Project) => {
            const projectSessions = sessionsInPeriod.filter(s => s.project_id === project.id);
            const allProjectSessions = completedSessions.filter(s => s.project_id === project.id);
            
            const totalTimeInPeriod = projectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const totalLifetime = allProjectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);

            const totalLifetimeHours = totalLifetime / 60;
            const uniqueUsersInPeriod = [...new Set(projectSessions.map(s => s.employee_id))].length;

            const userBreakdown: ProjectEvaluationData['userBreakdown'] = {};
            projectSessions.forEach(session => {
                if (!userBreakdown[session.employee_id]) {
                    userBreakdown[session.employee_id] = { name: session.employee_name, totalTime: 0, sessions: 0 };
                }
                userBreakdown[session.employee_id].totalTime += session.duration_minutes;
                userBreakdown[session.employee_id].sessions += 1;
            });
            
            const costPerHour = totalLifetimeHours > 0 ? project.budget / totalLifetimeHours : 0;
            const timeVariance = project.estimated_hours != null ? totalLifetimeHours - project.estimated_hours : null;
            const workProgressPercentage = project.estimated_hours ? (totalLifetimeHours / project.estimated_hours) * 100 : null;

            if (projectSessions.length > 0) { // Only show projects with activity in the period
                evaluation[project.id] = {
                    ...project,
                    totalTime: totalTimeInPeriod,
                    uniqueUsers: uniqueUsersInPeriod,
                    sessions: projectSessions.length,
                    averageSession: projectSessions.length > 0 ? totalTimeInPeriod / projectSessions.length : 0,
                    userBreakdown,
                    allSessions: projectSessions,
                    costPerHour,
                    workProgressPercentage,
                    timeVariance,
                };
            }
        });
        return [sessionsInPeriod, Object.values(evaluation)];
    }, [projects, completedSessions, startDate, endDate]);

    if (selectedProject) {
        const updatedProjectData = evaluationData.find((p: ProjectEvaluationData) => p.id === selectedProject.id);
        if(updatedProjectData) {
            return <ProjectDetailsView projectData={updatedProjectData} onBack={() => setSelectedProject(null)} />;
        }
        setSelectedProject(null);
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Celkový Prehľad</h2>
                        <p className="text-gray-600">Celkový čas v období: {formatDuration(filteredSessions.reduce((sum, s) => sum + s.duration_minutes, 0))}</p>
                    </div>
                    <button onClick={() => exportToExcel(filteredSessions)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center mt-4 sm:mt-0">
                        <Download className="w-4 h-4 mr-2" /> Exportovať Všetky Dáta
                    </button>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2 items-center flex-wrap">
                    <h3 className="text-md font-semibold text-gray-700 mr-2">Filtrovať podľa dátumu:</h3>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                     <span className="text-gray-500">do</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <button onClick={() => { setStartDate(''); setEndDate(''); }} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg text-sm ml-2">
                        Vyčistiť
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {evaluationData.map((project: ProjectEvaluationData) => (
                    <div key={project.id} onClick={() => setSelectedProject(project)} className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col">
                        <div className="flex-grow">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{project.name}</h3>
                                    {project.closed && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full mt-1">Uzatvorený</span>}
                                </div>
                                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                    {formatDuration(project.totalTime)}
                                </div>
                            </div>
                             <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div className="flex items-center"><Users className="w-4 h-4 mr-2 text-gray-500" /> {project.uniqueUsers} Členovia</div>
                                <div className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-500" /> {project.sessions} Relácie</div>
                                <div className="flex items-center col-span-2"><DollarSign className="w-4 h-4 mr-2 text-gray-500" /> Rozpočet: {project.budget.toLocaleString('sk-SK')} €</div>
                             </div>
                        </div>

                        <div className="mt-auto">
                            <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
                                <span>Priebeh (podľa hodín)</span>
                                <span>{project.workProgressPercentage !== null ? `${project.workProgressPercentage.toFixed(0)}%` : 'N/A'}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${project.workProgressPercentage || 0}%` }}></div>
                            </div>
                             <div className="mt-4 text-center">
                                 <span className="text-blue-600 text-sm font-medium flex items-center justify-center">Zobraziť Detaily <BarChart3 className="w-4 h-4 ml-1" /></span>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
            {evaluationData.length === 0 && (
                 <div className="text-center py-16 bg-white rounded-2xl shadow-xl">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-700">Žiadne dáta o projektoch</h3>
                    <p className="text-gray-500 mt-2">Pre zvolené časové obdobie neexistuje žiadna aktivita.</p>
                </div>
            )}
        </div>
    );
};

export default EvaluationDashboard;
