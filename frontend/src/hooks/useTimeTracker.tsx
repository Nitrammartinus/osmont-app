import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData, UserRole } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';

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
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    processQRCode: (qrText: string) => Promise<{ success: boolean; message: string; }>;
    stopSessionForUser: (user: User) => Promise<void>;
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    exportToExcel: () => void;
    startSession: (projectId: string) => Promise<void>;
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
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [isLoading, setIsLoading] = useState(true);
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_URL}/api/users`),
                fetch(`${API_URL}/api/projects`),
                fetch(`${API_URL}/api/active-sessions`),
                fetch(`${API_URL}/api/sessions/completed`),
            ]);
            
            if (!usersRes.ok || !projectsRes.ok || !activeSessionsRes.ok || !completedSessionsRes.ok) {
                throw new Error("Network response was not ok");
            }

            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const activeSessionsData = await activeSessionsRes.json();
            const completedSessionsData = await completedSessionsRes.json();
            
            setUsers(usersData);
            setProjects(projectsData);
            setActiveSessions(activeSessionsData);
            setCompletedSessions(completedSessionsData.map((s: any) => ({ ...s, duration_formatted: formatDuration(s.duration_minutes) })));
            
        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert("Nepodarilo sa načítať dáta zo servera. Skúste obnoviť stránku.");
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
                updatedTimers[session.id] = now - new Date(session.startTime).getTime();
            });
            setSessionTimers(updatedTimers);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSessions]);

    const handleManualLogin = useCallback(async (username:string, password:string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!response.ok) {
                const err = await response.json();
                alert(err.error || 'Neplatné prihlasovacie údaje alebo je používateľ zablokovaný.');
                return false;
            }
            const user: User = await response.json();
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            console.error(error);
            alert('Pri prihlásení nastala chyba.');
            return false;
        }
    }, [activeSessions]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/api/active-sessions/user/${user.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to stop session');
            await fetchData(); // Refetch all data to get updated state
        } catch (error) {
            console.error('Error stopping session', error);
            alert('Nepodarilo sa zastaviť reláciu.');
        }
    }, [fetchData]);

    const processQRCode = useCallback(async (qrText: string): Promise<{ success: boolean; message: string; }> => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                if (user.role !== 'employee') {
                    return { success: false, message: 'Iba zamestnanci môžu začať relácie sledovania cez QR kód.' };
                }
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
            if (!currentUser || currentUser.role !== 'employee') {
                return { success: false, message: 'Prosím, prihláste sa ako zamestnanec pred skenovaním projektu.' };
            }
            const existingUserSession = activeSessions.find(session => session.userId === currentUser.id);
            if (existingUserSession) {
                return { success: false, message: 'Už máte aktívnu reláciu. Prosím, overte sa znova, aby ste ju zastavili.' };
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                try {
                    await startSession(projectId);
                    return { success: true, message: `Relácia pre ${project.name} bola spustená.` };
                } catch (error) {
                    return { success: false, message: `Nepodarilo sa spustiť reláciu.` };
                }
            } else {
                return { success: false, message: 'Neplatný alebo uzavretý QR kód projektu.' };
            }
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions]);
    
    const startSession = async (projectId: string) => {
        if (!currentUser) throw new Error("No user logged in");
        try {
            const response = await fetch(`${API_URL}/api/active-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, projectId })
            });
            if (!response.ok) throw new Error('Failed to start session');
            await fetchData();
            setCurrentUser(null);
        } catch (error) {
            console.error('Error starting session', error);
            alert('Nepodarilo sa spustiť reláciu.');
            throw error;
        }
    };

    const addUser = async (user: Partial<User>) => {
        try {
            const response = await fetch(`${API_URL}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) throw new Error('Failed to add user');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa pridať používateľa.');
        }
    };

    const updateUser = async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) throw new Error('Failed to update user');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa aktualizovať používateľa.');
        }
    };
    
    const deleteUser = async (userId: string) => {
        try {
            const response = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete user');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa vymazať používateľa.');
        }
    };

    const addProject = async (project: Partial<Project>) => {
        try {
            const response = await fetch(`${API_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if (!response.ok) throw new Error('Failed to add project');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa pridať projekt.');
        }
    };

    const updateProject = async (project: Project) => {
        try {
            const response = await fetch(`${API_URL}/api/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if (!response.ok) throw new Error('Failed to update project');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa aktualizovať projekt.');
        }
    };

    const deleteProject = async (projectId: string) => {
        try {
            const response = await fetch(`${API_URL}/api/projects/${projectId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete project');
            await fetchData();
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa vymazať projekt.');
        }
    };

    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Timestamp', 'Employee ID', 'Employee Name', 'Project ID', 'Project Name', 'Duration (minutes)'];
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
            
            let workProgressPercentage = 0;
            if (project.estimatedHours && project.estimatedHours > 0) {
                workProgressPercentage = Math.min(100, (totalHours / project.estimatedHours) * 100);
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
                workProgressPercentage,
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
        handleManualLogin,
        processQRCode,
        stopSessionForUser,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        exportToExcel,
        startSession,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
