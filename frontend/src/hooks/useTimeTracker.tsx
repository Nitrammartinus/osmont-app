import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

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
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    processQRCode: (qrText: string) => { success: boolean; message: string; };
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
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
    if (!context) {
        throw new Error('useTimeTracker musí byť použitý v rámci TimeTrackerProvider');
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
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_URL}/users`),
                fetch(`${API_URL}/projects`),
                fetch(`${API_URL}/active-sessions`),
                fetch(`${API_URL}/sessions/completed`),
            ]);

            if (!usersRes.ok || !projectsRes.ok || !activeSessionsRes.ok || !completedSessionsRes.ok) {
                throw new Error('Nepodarilo sa načítať počiatočné dáta');
            }

            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setActiveSessions(await activeSessionsRes.json());
            setCompletedSessions(await completedSessionsRes.json());

        } catch (error) {
            console.error("Chyba pri načítavaní dát zo servera:", error);
            alert("Nepodarilo sa načítať dáta zo servera. Skontrolujte pripojenie a obnovte stránku.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - new Date(session.startTime).getTime();
            });
            setSessionTimers(updatedTimers);
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSessions]);

    const addUser = async (user: Partial<User>) => {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to add user');
            }
            await fetchData();
        } catch (error) {
            console.error(error);
            alert(`Chyba pri pridávaní používateľa: ${error}`);
        }
    };
    
    const updateUser = async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
            });
            if (!response.ok) {
                 const err = await response.json();
                throw new Error(err.error || 'Failed to update user');
            }
            await fetchData();
        } catch (error) {
            console.error(error);
            alert(`Chyba pri aktualizácii používateľa: ${error}`);
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            const response = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete user');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Chyba pri mazaní používateľa.');
        }
    };

    const addProject = async (project: Partial<Project>) => {
        try {
            const response = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project),
            });
            if (!response.ok) throw new Error('Failed to add project');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Chyba pri pridávaní projektu.');
        }
    };

    const updateProject = async (project: Project) => {
        try {
            const response = await fetch(`${API_URL}/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project),
            });
            if (!response.ok) throw new Error('Failed to update project');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Chyba pri aktualizácii projektu.');
        }
    };

    const deleteProject = async (projectId: string) => {
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to delete project');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Chyba pri mazaní projektu.');
        }
    };

    const processQRCode = useCallback((qrText: string): { success: boolean; message: string; } => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId);
            if (!user) {
                return { success: false, message: 'Neplatný QR kód používateľa.' };
            }
            if (user.blocked) {
                return { success: false, message: 'Používateľ je zablokovaný.' };
            }

            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
                return { success: true, message: `Nájdená aktívna relácia pre ${user.name}.` };
            } else {
                setCurrentUser(user);
                return { success: true, message: `Prihlásený ako ${user.name}.` };
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
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                return { success: false, message: 'Neplatný QR kód projektu.' };
            }
            if (project.closed) {
                return { success: false, message: 'Projekt je uzatvorený.' };
            }
            
            const startSession = async () => {
                try {
                    const response = await fetch(`${API_URL}/active-sessions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: currentUser.id, projectId: project.id })
                    });
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || 'Failed to start session');
                    }
                    await fetchData();
                    setCurrentUser(null);
                } catch (error) {
                    console.error(error);
                    alert(`Chyba pri začatí relácie: ${error}`);
                }
            };

            startSession();
            return { success: true, message: `Začala sa relácia pre ${project.name}.` };
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions, fetchData]);
    
    const handleManualLogin = useCallback(async (username:string, password:string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                alert(errorData.error === 'User is blocked' ? 'Používateľ je zablokovaný!' : 'Neplatné meno alebo heslo!');
                return false;
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
            console.error(error);
            alert('Chyba pri prihlasovaní. Skúste to znova.');
            return false;
        }
    }, [activeSessions]);
    
    const stopSessionForUser = useCallback(async (user: User) => {
        const sessionToStop = activeSessions.find(s => s.userId === user.id);
        if (sessionToStop) {
            try {
                const response = await fetch(`${API_URL}/active-sessions/user/${user.id}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('Failed to stop session');
                await fetchData();
            } catch (error) {
                console.error(error);
                alert('Chyba pri zastavení relácie.');
            }
        }
    }, [activeSessions, fetchData]);

    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Časová Značka', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(';'),
            ...completedSessions.map(s => `"${s.timestamp}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes}`)
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `export_sledovania_casu_${new Date().toISOString().split('T')[0]}.csv`;
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

    const value: TimeTrackerContextType = {
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
        userForStopConfirmation,
        setUserForStopConfirmation,
        processQRCode,
        handleManualLogin,
        stopSessionForUser,
        exportToExcel,
        isLoading,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
    };
    
    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
