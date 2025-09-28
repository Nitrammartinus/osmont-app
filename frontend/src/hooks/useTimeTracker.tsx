import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData, UserBreakdown } from '../types';

// The backend URL is provided by Vite's environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000/api';

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
    processQRCode: (qrText: string) => Promise<{ success: boolean; message: string; }>;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: (sessionsToExport: CompletedSession[]) => void;
    // CRUD functions
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    isLoading: boolean;
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

    const fetchData = useCallback(async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_URL}/users`),
                fetch(`${API_URL}/projects`),
                fetch(`${API_URL}/active-sessions`),
                fetch(`${API_URL}/sessions/completed`),
            ]);

            if (!usersRes.ok || !projectsRes.ok || !activeSessionsRes.ok || !completedSessionsRes.ok) {
                 throw new Error('Failed to fetch data from server.');
            }

            const usersData = await usersRes.json();
            const projectsData = await projectsRes.json();
            const activeSessionsData = await activeSessionsRes.json();
            const completedSessionsData = await completedSessionsRes.json();

            setUsers(usersData);
            setProjects(projectsData);
            setActiveSessions(activeSessionsData);
            setCompletedSessions(
                completedSessionsData.map((s: CompletedSession) => ({
                    ...s,
                    duration_formatted: formatDuration(s.duration_minutes),
                }))
            );
        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert("Nepodarilo sa pripojiť k serveru. Skontrolujte pripojenie a obnovte stránku.");
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, []);
    
     // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Polling for active sessions
    useEffect(() => {
        const pollInterval = setInterval(() => {
            fetch(`${API_URL}/active-sessions`)
                .then(res => res.json())
                .then(data => setActiveSessions(data))
                .catch(err => console.error("Polling for active sessions failed:", err));
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(pollInterval);
    }, []);


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
    
    // --- CRUD Operations ---
    const apiRequest = async (url: string, method: string, body?: any) => {
        try {
            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Neznáma chyba servera' }));
                throw new Error(errorData.error);
            }
            return response;
        } catch (error) {
            console.error(`Error with ${method} ${url}:`, error);
            alert((error as Error).message);
            throw error;
        }
    };

    const addUser = async (user: Partial<User>) => {
        await apiRequest(`${API_URL}/users`, 'POST', user);
        await fetchData(false);
    };

    const updateUser = async (user: User) => {
        await apiRequest(`${API_URL}/users/${user.id}`, 'PUT', user);
        await fetchData(false);
    };

    const deleteUser = async (userId: string) => {
        await apiRequest(`${API_URL}/users/${userId}`, 'DELETE');
        await fetchData(false);
    };
    
    const addProject = async (project: Partial<Project>) => {
        await apiRequest(`${API_URL}/projects`, 'POST', project);
        await fetchData(false);
    };

    const updateProject = async (project: Project) => {
        await apiRequest(`${API_URL}/projects/${project.id}`, 'PUT', project);
        await fetchData(false);
    };

    const deleteProject = async (projectId: string) => {
        await apiRequest(`${API_URL}/projects/${projectId}`, 'DELETE');
        await fetchData(false);
    };

    // --- Auth and Session Logic ---
    const handleManualLogin = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await apiRequest(`${API_URL}/login`, 'POST', { username, password });
            const user = await response.json();
            
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            // Error is already alerted by apiRequest
            return false;
        }
    };

    const processQRCode = async (qrText: string): Promise<{ success: boolean; message: string; }> => {
        const trimmedText = qrText.trim();
        if (trimmedText.startsWith('USER_ID:')) {
            const userId = trimmedText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId);
            if (user) {
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
            } else {
                return { success: false, message: 'Neplatný alebo blokovaný QR kód používateľa.' };
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
            const project = projects.find(p => p.id === projectId);

            if (project) {
                 if (project.closed) {
                    return { success: false, message: 'Projekt je uzatvorený.' };
                }
                try {
                    await apiRequest(`${API_URL}/active-sessions`, 'POST', { userId: currentUser.id, projectId: project.id });
                    await fetchData(false);
                    setCurrentUser(null);
                    return { success: true, message: `Relácia pre ${project.name} spustená.` };
                } catch(e) {
                     return { success: false, message: (e as Error).message };
                }
            } else {
                return { success: false, message: 'Neplatný alebo uzatvorený QR kód projektu.' };
            }
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    };

    const stopSessionForUser = async (user: User) => {
        try {
            await apiRequest(`${API_URL}/active-sessions/user/${user.id}`, 'DELETE');
            await fetchData(false);
        } catch (error) {
            console.error('Failed to stop session:', error);
        }
    };
    
    const exportToExcel = useCallback((sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Dátum', 'Čas', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => {
                const date = new Date(s.timestamp);
                const formattedDate = date.toLocaleDateString('sk-SK');
                const formattedTime = date.toLocaleTimeString('sk-SK');
                return `"${formattedDate}";"${formattedTime}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes}`
            })
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, []);
    
    const getProjectEvaluation = useCallback((): Record<string, ProjectEvaluationData> => {
        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach(project => {
            const projectSessions = completedSessions.filter(s => s.project_id === project.id);
            const totalTime = projectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const totalHours = totalTime / 60;
            const uniqueUsers = [...new Set(projectSessions.map(s => s.employee_id))].length;

            const userBreakdown: Record<string, UserBreakdown> = {};
            projectSessions.forEach(session => {
                if (!userBreakdown[session.employee_id]) {
                    userBreakdown[session.employee_id] = { name: session.employee_name, totalTime: 0, sessions: 0 };
                }
                userBreakdown[session.employee_id].totalTime += session.duration_minutes;
                userBreakdown[session.employee_id].sessions += 1;
            });
            
            const costPerHour = totalHours > 0 ? project.budget / totalHours : 0;
            const timeVariance = project.estimatedHours != null ? totalHours - project.estimatedHours : null;
            
            const workProgressPercentage = project.estimatedHours && project.estimatedHours > 0
                ? Math.min(100, (totalHours / project.estimatedHours) * 100)
                : 0;

            evaluation[project.id] = {
                ...project,
                totalTime: 0, // Will be calculated based on date filter in component
                uniqueUsers: 0, // Will be calculated based on date filter in component
                sessions: 0, // Will be calculated based on date filter in component
                averageSession: 0, // Will be calculated based on date filter in component
                userBreakdown: {}, // Will be calculated based on date filter in component
                allSessions: projectSessions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                costPerHour, // Lifetime metric
                workProgressPercentage, // Lifetime metric
                timeVariance, // Lifetime metric
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
        isLoading,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};