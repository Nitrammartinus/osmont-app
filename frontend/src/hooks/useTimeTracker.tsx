import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const formatDuration = (minutes: number) => {
    if (isNaN(minutes)) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
};

interface TimeTrackerContextType {
    currentUser: User | null;
    // FIX: Add setCurrentUser to the context type for use in other components like Header.
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
    userForStopConfirmation: User | null;
    processQRCode: (qrText: string) => { success: boolean; message: string; };
    handleManualLogin: (username:string, password:string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: () => void;
    isLoading: boolean;
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const useTimeTracker = () => {
    const context = useContext(TimeTrackerContext);
    if (!context) throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    return context;
};

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/users`),
                fetch(`${API_BASE_URL}/projects`),
                fetch(`${API_BASE_URL}/active-sessions`),
                fetch(`${API_BASE_URL}/sessions/completed`),
            ]);
            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setActiveSessions(await activeSessionsRes.json());
            setCompletedSessions(await completedSessionsRes.json());
        } catch (error) {
            console.error("Failed to fetch data from API", error);
            alert("Nepodarilo sa načítať dáta zo servera. Skontrolujte pripojenie a obnovte stránku.");
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    // Initial data fetch and polling for active sessions
    useEffect(() => {
        fetchData();
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/active-sessions`);
                setActiveSessions(await res.json());
            } catch (error) {
                console.error("Failed to poll active sessions", error);
            }
        }, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        const timerInterval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - new Date(session.startTime).getTime();
            });
            setSessionTimers(updatedTimers);
        }, 1000);
        return () => clearInterval(timerInterval);
    }, [activeSessions]);

    const processQRCode = useCallback((qrText: string): { success: boolean; message: string; } => {
        // FIX: Removed async from handleUserScan as it doesn't perform any await operations, resolving the return type mismatch.
        const handleUserScan = (userId: string) => {
            const user = users.find(u => u.id === userId && !u.blocked);
            if (!user) return { success: false, message: 'Neplatný alebo zablokovaný QR kód používateľa.' };
            
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
                return { success: true, message: `Nájdená aktívna relácia pre ${user.name}.` };
            } else {
                setCurrentUser(user);
                return { success: true, message: `Prihlásený ako ${user.name}.` };
            }
        };

        const handleProjectScan = async (projectId: string) => {
            if (!currentUser) return { success: false, message: 'Pred skenovaním projektu sa prosím prihláste.' };
            
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (!project) return { success: false, message: 'Neplatný alebo uzavretý QR kód projektu.' };

            try {
                const response = await fetch(`${API_BASE_URL}/active-sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, projectId: project.id }),
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Nepodarilo sa spustiť reláciu.');
                }
                await fetchData(); // Refresh all data
                setCurrentUser(null);
                return { success: true, message: `Relácia pre ${project.name} spustená.` };
            } catch (error: any) {
                return { success: false, message: error.message };
            }
        };

        if (qrText.startsWith('USER_ID:')) {
            return handleUserScan(qrText.substring('USER_ID:'.length));
        } else if (qrText.startsWith('PROJECT_ID:')) {
            handleProjectScan(qrText.substring('PROJECT_ID:'.length));
            return { success: true, message: 'Spracováva sa...' };
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions, fetchData]);

    const handleManualLogin = useCallback(async (username:string, password:string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                 const err = await response.json();
                 throw new Error(err.error);
            }
            const user = await response.json();
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
             alert(`Prihlásenie zlyhalo: ${error}`);
             return false;
        }
    }, [activeSessions]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            const response = await fetch(`${API_BASE_URL}/active-sessions/user/${user.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Nepodarilo sa zastaviť reláciu.');
            await fetchData(); // Refresh all data
        } catch (error) {
            console.error("Chyba pri zastavovaní relácie:", error);
            alert("Chyba pri zastavovaní relácie.");
        }
    }, [fetchData]);
    
    const addUser = async (user: Partial<User>) => {
        await fetch(`${API_BASE_URL}/users`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        await fetchData();
    };

    const updateUser = async (user: User) => {
        await fetch(`${API_BASE_URL}/users/${user.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        await fetchData();
    };
    
    const deleteUser = async (userId: string) => {
        await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
        await fetchData();
    };

    const addProject = async (project: Partial<Project>) => {
        await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        await fetchData();
    };

    const updateProject = async (project: Project) => {
        await fetch(`${API_BASE_URL}/projects/${project.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project)
        });
        await fetchData();
    };

    const deleteProject = async (projectId: string) => {
        await fetch(`${API_BASE_URL}/projects/${projectId}`, { method: 'DELETE' });
        await fetchData();
    };
    
    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Timestamp', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(';'),
            ...completedSessions.map(s => `"${new Date(s.timestamp).toLocaleString('sk-SK')}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes}`)
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `export_casu_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [completedSessions]);
    
    const projectEvaluation = useMemo((): Record<string, ProjectEvaluationData> => {
        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach(project => {
            const projectSessions = completedSessions.filter(s => s.project_id === project.id).map(s => ({
                ...s,
                duration_formatted: formatDuration(s.duration_minutes)
            }));
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
            const firstSession = projectSessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
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

    const canAccessEvaluation = currentUser?.role === 'manager' || currentUser?.role === 'admin';
    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    return (
        <TimeTrackerContext.Provider value={{
            currentUser, setCurrentUser, users, projects, activeSessions, completedSessions, sessionTimers, currentView,
            setCurrentView, projectEvaluation, canAccessEvaluation, isAdmin, isManager, userForStopConfirmation,
            processQRCode, handleManualLogin, stopSessionForUser, exportToExcel, isLoading,
            addUser, updateUser, deleteUser, addProject, updateProject, deleteProject
        }}>
            {children}
        </TimeTrackerContext.Provider>
    );
};
