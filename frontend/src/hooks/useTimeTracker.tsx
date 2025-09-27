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
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    isLoading: boolean;
    
    processQRCode: (qrText: string) => Promise<{ success: boolean; message: string; }>;
    handleManualLogin: (username:string, password:string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: () => void;
    
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
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_URL}/api/users`),
                fetch(`${API_URL}/api/projects`),
                fetch(`${API_URL}/api/active-sessions`),
                fetch(`${API_URL}/api/sessions/completed`),
            ]);
            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const activeSessionsData = await activeSessionsRes.json();
            const completedSessionsData = await completedSessionsRes.json();

            const formattedActiveSessions = activeSessionsData.map((s: any) => ({
                ...s,
                startTime: new Date(s.startTime).getTime(),
            }));

            const formattedCompletedSessions = completedSessionsData.map((s: any) => ({
                ...s,
                duration_formatted: formatDuration(s.duration_minutes),
            }));

            setUsers(usersData);
            setProjects(projectsData);
            setActiveSessions(formattedActiveSessions);
            setCompletedSessions(formattedCompletedSessions);
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            alert("Could not connect to the server. Please check your connection and refresh the page.");
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

    const addUser = async (user: Partial<User>) => {
        try {
            const res = await fetch(`${API_URL}/api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (res.ok) {
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Error adding user: ${err.error}`);
            }
        } catch (error) { console.error(error); alert('Failed to add user.'); }
    };
    
    const updateUser = async (user: User) => {
        try {
            const res = await fetch(`${API_URL}/api/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if(res.ok) {
                await fetchData();
            } else {
                const err = await res.json();
                alert(`Error updating user: ${err.error}`);
            }
        } catch (error) { console.error(error); alert('Failed to update user.'); }
    };

    const deleteUser = async (userId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
            } else {
                alert('Error deleting user.');
            }
        } catch (error) { console.error(error); alert('Failed to delete user.'); }
    };

    const addProject = async (project: Partial<Project>) => {
        try {
            const res = await fetch(`${API_URL}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if (res.ok) {
                await fetchData();
            } else {
                alert('Error adding project.');
            }
        } catch (error) { console.error(error); alert('Failed to add project.'); }
    };
    
    const updateProject = async (project: Project) => {
        try {
            const res = await fetch(`${API_URL}/api/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if(res.ok) {
                await fetchData();
            } else {
                alert('Error updating project.');
            }
        } catch (error) { console.error(error); alert('Failed to update project.'); }
    };

    const deleteProject = async (projectId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/projects/${projectId}`, { method: 'DELETE' });
            if (res.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
            } else {
                alert('Error deleting project.');
            }
        } catch (error) { console.error(error); alert('Failed to delete project.'); }
    };

    const startSession = async (projectId: string) => {
        if (!currentUser) return { success: false, message: 'No user logged in.'};
        try {
            const res = await fetch(`${API_URL}/api/active-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, projectId })
            });
            if (res.ok) {
                await fetchData(); 
                setCurrentUser(null);
                return { success: true, message: 'Relácia spustená.' };
            } else {
                const err = await res.json();
                return { success: false, message: `Chyba pri spustení relácie: ${err.error}` };
            }
        } catch (error) {
            console.error(error);
            return { success: false, message: 'Nepodarilo sa spustiť reláciu.' };
        }
    };

    const stopSessionForUser = async (user: User) => {
        try {
            const res = await fetch(`${API_URL}/api/active-sessions/user/${user.id}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchData(); 
            } else {
                alert('Chyba pri zastavení relácie.');
            }
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa zastaviť reláciu.');
        }
    };
    
    const handleManualLogin = async (username:string, password:string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if(res.ok) {
                const user = await res.json();
                if (activeSessions.some(s => s.userId === user.id)) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
                return true;
            } else {
                const err = await res.json();
                alert(`Prihlásenie zlyhalo: ${err.error}`);
                return false;
            }
        } catch(e) {
            alert('Požiadavka na prihlásenie zlyhala. Skontrolujte pripojenie k serveru.');
            return false;
        }
    };

    const processQRCode = async (qrText: string): Promise<{ success: boolean; message: string; }> => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                if (activeSessions.some(session => session.userId === user.id)) {
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
            if (activeSessions.some(session => session.userId === currentUser.id)) {
                 return { success: false, message: 'Už máte aktívnu reláciu. Pre jej zastavenie sa prosím znova overte.' };
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                return await startSession(projectId);
            } else {
                return { success: false, message: 'Neplatný alebo uzatvorený QR kód projektu.' };
            }
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    };
    
    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Timestamp', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
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
    
    const projectEvaluation = useMemo((): Record<string, ProjectEvaluationData> => {
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
            const workProgressPercentage = (project.estimatedHours && totalHours > 0) ? Math.min(100, (totalHours / project.estimatedHours) * 100) : 0;
            
            evaluation[project.id] = {
                ...project,
                totalTime,
                uniqueUsers,
                sessions: projectSessions.length,
                averageSession: projectSessions.length > 0 ? totalTime / projectSessions.length : 0,
                userBreakdown,
                allSessions: projectSessions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                costPerHour,
                workProgressPercentage,
                timeVariance,
            };
        });
        return evaluation;
    }, [projects, completedSessions]);

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
        userForStopConfirmation,
        setUserForStopConfirmation,
        isLoading,
        processQRCode,
        handleManualLogin,
        stopSessionForUser,
        exportToExcel,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
