import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
// FIX: Add UserBreakdown to the import list.
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData, UserBreakdown } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

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
    
    const fetchData = useCallback(async (isInitial = false) => {
        if (isInitial) setIsLoading(true);
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_URL}/api/users`),
                fetch(`${API_URL}/api/projects`),
                fetch(`${API_URL}/api/active-sessions`),
                fetch(`${API_URL}/api/sessions/completed`),
            ]);

            if (!usersRes.ok || !projectsRes.ok || !activeSessionsRes.ok || !completedSessionsRes.ok) {
                 throw new Error('Network response was not ok');
            }

            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const activeSessionsData = await activeSessionsRes.json();
            const completedSessionsData = await completedSessionsRes.json();

            const formattedCompletedSessions = completedSessionsData.map((s: any) => ({
                ...s,
                duration_formatted: formatDuration(s.duration_minutes),
            }));

            setUsers(usersData);
            setProjects(projectsData);
            setActiveSessions(activeSessionsData);
            setCompletedSessions(formattedCompletedSessions);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            if (isInitial) alert("Nepodarilo sa pripojiť k serveru. Skontrolujte prosím svoje internetové pripojenie a obnovte stránku.");
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const intervalId = setInterval(() => fetchData(false), 5000); // Poll every 5 seconds
        return () => clearInterval(intervalId);
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                const startTime = new Date(session.startTime).getTime();
                updatedTimers[session.id] = now - startTime;
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
                alert(`Chyba pri pridaní používateľa: ${err.error}`);
            }
        } catch (error) { console.error(error); alert('Nepodarilo sa pridať používateľa.'); }
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
                alert(`Chyba pri aktualizácii používateľa: ${err.error}`);
            }
        } catch (error) { console.error(error); alert('Nepodarilo sa aktualizovať používateľa.'); }
    };

    const deleteUser = async (userId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchData();
            } else {
                alert('Chyba pri mazaní používateľa.');
            }
        } catch (error) { console.error(error); alert('Nepodarilo sa vymazať používateľa.'); }
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
                alert('Chyba pri pridaní projektu.');
            }
        } catch (error) { console.error(error); alert('Nepodarilo sa pridať projekt.'); }
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
                alert('Chyba pri aktualizácii projektu.');
            }
        } catch (error) { console.error(error); alert('Nepodarilo sa aktualizovať projekt.'); }
    };

    const deleteProject = async (projectId: string) => {
        try {
            const res = await fetch(`${API_URL}/api/projects/${projectId}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchData();
            } else {
                alert('Chyba pri mazaní projektu.');
            }
        } catch (error) { console.error(error); alert('Nepodarilo sa vymazať projekt.'); }
    };

    const startSession = async (projectId: string) => {
        if (!currentUser) return { success: false, message: 'Žiaden používateľ nie je prihlásený.'};
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
        const trimmedText = qrText.trim();
        if (trimmedText.startsWith('USER_ID:')) {
            const userId = trimmedText.substring('USER_ID:'.length);
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
        } else if (trimmedText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Pred skenovaním projektu sa prosím prihláste.' };
            }
            if (activeSessions.some(session => session.userId === currentUser.id)) {
                 return { success: false, message: 'Už máte aktívnu reláciu. Pre jej zastavenie sa prosím znova overte.' };
            }
            const projectId = trimmedText.substring('PROJECT_ID:'.length);
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
            // Lifetime calculations
            const allProjectSessions = completedSessions.filter(s => s.project_id === project.id);
            const lifetimeTotalTime = allProjectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const lifetimeTotalHours = lifetimeTotalTime / 60;
            const costPerHour = lifetimeTotalHours > 0 ? project.budget / lifetimeTotalHours : 0;
            const timeVariance = project.estimatedHours != null ? lifetimeTotalHours - project.estimatedHours : null;
            const workProgressPercentage = (project.estimatedHours && lifetimeTotalHours > 0) ? Math.min(100, (lifetimeTotalHours / project.estimatedHours) * 100) : 0;

            // In-period calculations (for display)
            const uniqueUsers = [...new Set(allProjectSessions.map(s => s.employee_id))].length;
            const userBreakdown: Record<string, UserBreakdown> = {};
            allProjectSessions.forEach(session => {
                if (!userBreakdown[session.employee_id]) {
                    userBreakdown[session.employee_id] = { name: session.employee_name, totalTime: 0, sessions: 0 };
                }
                userBreakdown[session.employee_id].totalTime += session.duration_minutes;
                userBreakdown[session.employee_id].sessions += 1;
            });

            evaluation[project.id] = {
                ...project,
                totalTime: lifetimeTotalTime,
                uniqueUsers,
                sessions: allProjectSessions.length,
                averageSession: allProjectSessions.length > 0 ? lifetimeTotalTime / allProjectSessions.length : 0,
                userBreakdown,
                allSessions: allProjectSessions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
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
