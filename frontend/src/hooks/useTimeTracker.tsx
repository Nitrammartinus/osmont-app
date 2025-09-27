import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData, UserRole } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const apiRequest = async (url: string, options: RequestInit = {}) => {
    try {
        const response = await fetch(`${API_URL}${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `Požiadavka zlyhala so statusom ${response.status}` }));
            throw new Error(errorData.error || `HTTP chyba! status: ${response.status}`);
        }
        if (response.status === 204) {
            return null;
        }
        return response.json();
    } catch (error) {
        console.error('Chyba API požiadavky:', error);
        alert(`Chyba API: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
};

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
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
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
        throw new Error('useTimeTracker musí byť použitý v rámci TimeTrackerProvider');
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

    const fetchData = useCallback(async (isInitialLoad = false) => {
        if(isInitialLoad) setIsLoading(true);
        try {
            const [usersData, projectsData, activeSessionsData, completedSessionsData] = await Promise.all([
                apiRequest('/users'),
                apiRequest('/projects'),
                apiRequest('/active-sessions'),
                apiRequest('/sessions/completed'),
            ]);
            setUsers(usersData);
            setProjects(projectsData);
            setActiveSessions(activeSessionsData.map((s: any) => ({ ...s, startTime: new Date(s.startTime).getTime() })));
            setCompletedSessions(completedSessionsData.map((s: any) => ({ ...s, duration_formatted: formatDuration(s.duration_minutes) })));
        } catch (error) {
            console.error("Nepodarilo sa načítať dáta", error);
        } finally {
            if(isInitialLoad) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(true);
        const pollInterval = setInterval(() => fetchData(false), 5000); // Poll for new data every 5 seconds
        return () => clearInterval(pollInterval);
    }, [fetchData]);

    useEffect(() => {
        const timerInterval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - session.startTime;
            });
            setSessionTimers(updatedTimers);
        }, 1000);
        return () => clearInterval(timerInterval);
    }, [activeSessions]);

    const handleUserScan = (user: User) => {
        const existingSession = activeSessions.find(session => session.userId === user.id);
        
        if (existingSession) {
            // NEW LOGIC: Check role before showing stop confirmation
            if (user.role === 'employee') {
                setUserForStopConfirmation(user);
            } else { // Admin or Manager
                setCurrentUser(user); // Just log them in
            }
        } else {
            setCurrentUser(user);
        }
        return { success: true };
    }
    
    const processQRCode = useCallback((qrText: string): { success: boolean; message?: string; } => {
        const trimmedText = qrText.trim();
        if (trimmedText.startsWith('USER_ID:')) {
            const userId = trimmedText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                return handleUserScan(user);
            } else {
                return { success: false, message: 'Neplatný alebo zablokovaný QR kód používateľa.' };
            }
        } else if (trimmedText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Prosím, prihláste sa pred skenovaním projektu.' };
            }
            const existingUserSession = activeSessions.find(session => session.userId === currentUser.id);
            if (existingUserSession) {
                return { success: false, message: 'Už máte aktívnu reláciu. Prosím, overte sa znova, aby ste ju zastavili.' };
            }
            const projectId = trimmedText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                const startSession = async () => {
                    try {
                        await apiRequest('/active-sessions', { method: 'POST', body: JSON.stringify({ userId: currentUser.id, projectId: project.id }) });
                        await fetchData();
                        setCurrentUser(null);
                        alert(`Relácia pre ${project.name} spustená.`);
                    } catch (error) {
                        // Error is already alerted by apiRequest
                    }
                };
                startSession();
                return { success: true };
            } else {
                return { success: false, message: 'Neplatný alebo uzatvorený QR kód projektu.' };
            }
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions, fetchData]);

    const handleManualLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
        try {
            const user = await apiRequest('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
            if (user) {
                handleUserScan(user); // Use the same logic as QR scan
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }, [activeSessions]);


    const addUser = useCallback(async (user: Partial<User>) => {
        await apiRequest('/users', { method: 'POST', body: JSON.stringify(user) });
        await fetchData();
    }, [fetchData]);

    const updateUser = useCallback(async (user: User) => {
        await apiRequest(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(user) });
        await fetchData();
    }, [fetchData]);

    const deleteUser = useCallback(async (userId: string) => {
        await apiRequest(`/users/${userId}`, { method: 'DELETE' });
        await fetchData();
    }, [fetchData]);

    const addProject = useCallback(async (project: Partial<Project>) => {
        await apiRequest('/projects', { method: 'POST', body: JSON.stringify(project) });
        await fetchData();
    }, [fetchData]);

    const updateProject = useCallback(async (project: Project) => {
        await apiRequest(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
        await fetchData();
    }, [fetchData]);

    const deleteProject = useCallback(async (projectId: string) => {
        await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
        await fetchData();
    }, [fetchData]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            await apiRequest(`/active-sessions/user/${user.id}`, { method: 'DELETE' });
            await fetchData();
        } catch (error) {
            // Error is handled by apiRequest
        }
    }, [fetchData]);

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
        link.download = `export_casu_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [completedSessions]);

    const projectEvaluation = useMemo((): Record<string, ProjectEvaluationData> => {
        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach(project => {
            const projectSessions = completedSessions.filter(s => s.project_id === project.id);
            const totalTime = projectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const totalHours = totalTime / 60;
            const uniqueUsers = [...new Set(projectSessions.map(s => s.employee_id))].length;

            const userBreakdown: Record<string, { name: string, totalTime: number, sessions: number }> = {};
            projectSessions.forEach(session => {
                if (!userBreakdown[session.employee_id]) {
                    userBreakdown[session.employee_id] = { name: session.employee_name, totalTime: 0, sessions: 0 };
                }
                userBreakdown[session.employee_id].totalTime += session.duration_minutes;
                userBreakdown[session.employee_id].sessions += 1;
            });
            
            // FIXED: Progress calculation based on hours worked vs estimated hours
            const workProgressPercentage = (project.estimatedHours && project.estimatedHours > 0)
                ? Math.min(100, (totalHours / project.estimatedHours) * 100)
                : 0;

            const costPerHour = totalHours > 0 ? project.budget / totalHours : 0;
            const timeVariance = project.estimatedHours != null ? totalHours - project.estimatedHours : null;

            evaluation[project.id] = {
                ...project,
                totalTime,
                uniqueUsers,
                sessions: projectSessions.length,
                averageSession: projectSessions.length > 0 ? totalTime / projectSessions.length : 0,
                userBreakdown,
                allSessions: projectSessions.map(s => ({ ...s, duration_formatted: formatDuration(s.duration_minutes) })),
                costPerHour,
                workProgressPercentage, // Use the corrected calculation
                timeVariance,
            };
        });
        return evaluation;
    }, [projects, completedSessions]);

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
        isLoading,
        userForStopConfirmation,
        setUserForStopConfirmation,
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
