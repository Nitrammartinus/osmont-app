import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData, UserRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

const formatDuration = (minutes: number) => {
    if (isNaN(minutes)) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
};

interface TimeTrackerContextType {
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    users: User[];
    projects: Project[];
    activeSessions: ActiveSession[];
    completedSessions: CompletedSession[];
    sessionTimers: Record<number, number>;
    currentView: View;
    setCurrentView: React.Dispatch<React.SetStateAction<View>>;
    projectEvaluation: Record<string, ProjectEvaluationData>;
    canAccessEvaluation: boolean;
    isAdmin: boolean;
    isManager: boolean;
    isLoading: boolean;
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    
    processQRCode: (qrText: string) => { success: boolean; message?: string; };
    handleManualLogin: (username:string, password:string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    
    exportToExcel: () => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const useTimeTracker = () => {
    const context = useContext(TimeTrackerContext);
    if (!context) {
        throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    }
    return context;
};

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/users`),
                fetch(`${API_BASE_URL}/projects`),
                fetch(`${API_BASE_URL}/active-sessions`),
                fetch(`${API_BASE_URL}/sessions/completed`),
            ]);

            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const activeSessionsData = await activeSessionsRes.json();
            const completedSessionsData = await completedSessionsRes.json();

            setUsers(usersData);
            setProjects(projectsData);
            setActiveSessions(activeSessionsData.map((s: any) => ({ ...s, startTime: new Date(s.startTime).getTime() })));
            setCompletedSessions(completedSessionsData.map((s: any) => ({...s, duration_formatted: formatDuration(s.duration_minutes)})));

        } catch (error) {
            console.error("Nepodarilo sa načítať počiatočné dáta", error);
            alert("Nepodarilo sa pripojiť k serveru. Skontrolujte pripojenie a obnovte stránku.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - session.startTime;
            });
            setSessionTimers(updatedTimers);
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSessions]);

    const handleManualLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const error = await response.json();
                alert(error.error || 'Neplatné používateľské meno alebo heslo.');
                return false;
            }
            const user = await response.json();
            const existingSession = activeSessions.find(s => s.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            console.error('Prihlásenie zlyhalo', error);
            alert('Prihlásenie zlyhalo. Nepodarilo sa pripojiť k serveru.');
            return false;
        }
    }, [activeSessions]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            const response = await fetch(`${API_BASE_URL}/active-sessions/user/${user.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Nepodarilo sa zastaviť reláciu');
            await fetchData();
        } catch (error) {
            console.error('Nepodarilo sa zastaviť reláciu', error);
            alert('Nepodarilo sa zastaviť reláciu na serveri.');
        }
    }, [fetchData]);

    const processQRCode = useCallback((qrText: string): { success: boolean; message: string; } => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                const existingSession = activeSessions.find(session => session.userId === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                    return { success: true, message: `Nájdená aktívna relácia pre ${user.name}.` };
                } else {
                    setCurrentUser(user);
                    return { success: true, message: `Prihlásený ako ${user.name}.` };
                }
            } else {
                return { success: false, message: 'Neplatný alebo zablokovaný QR kód používateľa.' };
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Pred skenovaním projektu sa prosím prihláste.' };
            }
            const existingUserSession = activeSessions.find(session => session.userId === currentUser.id);
            if (existingUserSession) {
                return { success: false, message: 'Už máte aktívnu reláciu. Pre jej zastavenie sa prosím znova overte.' };
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                const startSession = async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/active-sessions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: currentUser.id, projectId: project.id })
                        });
                        if (!response.ok) throw new Error('Nepodarilo sa spustiť reláciu');
                        await fetchData();
                        setCurrentUser(null);
                    } catch (error) {
                        console.error(error);
                        alert('Nepodarilo sa spustiť reláciu na serveri.');
                    }
                };
                startSession();
                return { success: true, message: `Spustená relácia pre ${project.name}.` };
            } else {
                return { success: false, message: 'Neplatný alebo uzatvorený QR kód projektu.' };
            }
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions, fetchData]);

    const addUser = async (user: Partial<User>) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) throw new Error('Nepodarilo sa pridať používateľa');
            await fetchData();
        } catch (error) {
            console.error('Chyba pri pridávaní používateľa:', error);
            alert('Nepodarilo sa pridať používateľa na serveri.');
        }
    };
    
    const updateUser = async (user: User) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) throw new Error('Nepodarilo sa aktualizovať používateľa');
            await fetchData();
        } catch (error) {
            console.error('Chyba pri aktualizácii používateľa:', error);
            alert('Nepodarilo sa aktualizovať používateľa na serveri.');
        }
    };
    
    const deleteUser = async (userId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Nepodarilo sa vymazať používateľa');
            await fetchData();
        } catch (error) {
            console.error('Chyba pri mazaní používateľa:', error);
            alert('Nepodarilo sa vymazať používateľa na serveri.');
        }
    };
    
    const addProject = async (project: Partial<Project>) => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if (!response.ok) throw new Error('Nepodarilo sa pridať projekt');
            await fetchData();
        } catch (error) {
            console.error('Chyba pri pridávaní projektu:', error);
            alert('Nepodarilo sa pridať projekt na serveri.');
        }
    };
    
    const updateProject = async (project: Project) => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if (!response.ok) throw new Error('Nepodarilo sa aktualizovať projekt');
            await fetchData();
        } catch (error) {
            console.error('Chyba pri aktualizácii projektu:', error);
            alert('Nepodarilo sa aktualizovať projekt na serveri.');
        }
    };

    const deleteProject = async (projectId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Nepodarilo sa vymazať projekt');
            await fetchData();
        } catch (error) {
            console.error('Chyba pri mazaní projektu:', error);
            alert('Nepodarilo sa vymazať projekt na serveri.');
        }
    };

    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Timestamp', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(','),
            ...completedSessions.map(s => `"${s.timestamp}","${s.employee_id}","${s.employee_name}","${s.project_id}","${s.project_name}",${s.duration_minutes}`)
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [completedSessions]);
    
    const getProjectEvaluation = useCallback((): Record<string, ProjectEvaluationData> => {
        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach(project => {
            const projectSessions = completedSessions.filter(s => s.project_id === project.id);
            const totalTime = projectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const totalHours = totalTime / 60;
            const uniqueUsers = [...new Set(projectSessions.map(s => s.employee_id))].length;

            const userBreakdown: ProjectEvaluationData['userBreakdown'] = {};
            projectSessions.forEach(session => {
                if (!userBreakdown[session.employee_id]) {
                    userBreakdown[session.employee_id] = { name: session.employee_name, totalTime: 0, sessions: 0 };
                }
                userBreakdown[session.employee_id].totalTime += session.duration_minutes;
                userBreakdown[session.employee_id].sessions += 1;
            });
            
            const costPerHour = totalHours > 0 ? project.budget / totalHours : 0;
            const timeVariance = project.estimatedHours != null ? totalHours - project.estimatedHours : null;
            
            let progressTowardsDeadline = 0;
            const firstSession = [...projectSessions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
            if (firstSession) {
                const startDate = new Date(firstSession.timestamp).getTime();
                const deadlineDate = new Date(project.deadline).getTime();
                const today = Date.now();
                if (deadlineDate > startDate) {
                    const totalDuration = deadlineDate - startDate;
                    const elapsedDuration = today - startDate;
                    progressTowardsDeadline = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));
                }
            }

            evaluation[project.id] = {
                ...project,
                totalTime,
                uniqueUsers,
                sessions: projectSessions.length,
                averageSession: projectSessions.length > 0 ? totalTime / projectSessions.length : 0,
                userBreakdown,
                allSessions: projectSessions,
                costPerHour,
                progressTowardsDeadline,
                timeVariance,
            };
        });
        return evaluation;
    }, [projects, completedSessions]);

    const projectEvaluation = useMemo(() => getProjectEvaluation(), [getProjectEvaluation]);

    const canAccessEvaluation = currentUser?.role === 'manager' || currentUser?.role === 'admin';
    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    const value = {
        currentUser,
        setCurrentUser,
        users,
        projects,
        activeSessions,
        completedSessions,
        sessionTimers,
        currentView,
        setCurrentView,
        projectEvaluation,
        canAccessEvaluation,
        isAdmin,
        isManager,
        isLoading,
        userForStopConfirmation,
        setUserForStopConfirmation,
        processQRCode,
        handleManualLogin,
        stopSessionForUser,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        exportToExcel,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
