import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, ProjectEvaluationData, CostCenter } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// FIX: Export formatTime and add isNaN check for robustness.
export const formatTime = (milliseconds: number) => {
    if (isNaN(milliseconds)) return '00:00:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// FIX: Export formatDuration to allow reuse in other components.
export const formatDuration = (minutes: number) => {
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
    costCenters: CostCenter[];
    activeSessions: ActiveSession[];
    completedSessions: CompletedSession[];
    sessionTimers: Record<number, number>;
    projectEvaluation: Record<string, ProjectEvaluationData>;
    canAccessEvaluation: boolean;
    isAdmin: boolean;
    isManager: boolean;
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    isLoading: boolean;
    error: string | null;
    
    // Functions
    fetchData: () => Promise<void>;
    processQRCode: (qrText: string) => Promise<void>;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    startSession: (projectId: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: (sessionsToExport?: CompletedSession[]) => void;
    
    // User CRUD
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: Partial<User> & { id: string }) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    
    // Project CRUD
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;

    // Cost Center CRUD
    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (id: number, name: string) => Promise<void>;
    deleteCostCenter: (id: number) => Promise<void>;
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
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [initialDataRes, activeSessionsRes, completedSessionsRes] = await Promise.all([
                fetch(`${API_URL}/api/initial-data`),
                fetch(`${API_URL}/api/active-sessions`),
                fetch(`${API_URL}/api/completed-sessions`)
            ]);

            if (!initialDataRes.ok || !activeSessionsRes.ok || !completedSessionsRes.ok) {
                const initialError = !initialDataRes.ok ? await initialDataRes.text() : '';
                const activeError = !activeSessionsRes.ok ? await activeSessionsRes.text() : '';
                const completedError = !completedSessionsRes.ok ? await completedSessionsRes.text() : '';
                throw new Error(`Failed to fetch data from server. ${initialError} ${activeError} ${completedError}`);
            }

            const initialData = await initialDataRes.json();
            const active = await activeSessionsRes.json();
            const completed = await completedSessionsRes.json();
            
            setUsers(initialData.users);
            setProjects(initialData.projects);
            setCostCenters(initialData.costCenters);
            setActiveSessions(active);
            setCompletedSessions(completed);

        } catch (e: any) {
            setError(e.message || 'Nepodarilo sa pripojiť k serveru. Skontrolujte prosím svoje pripojenie a skúste to znova.');
            console.error(e);
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

    const handleManualLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Login failed');
            }
            const user: User = await response.json();
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (e: any) {
            alert(e.message);
            return false;
        }
    }, [activeSessions]);

    const startSession = useCallback(async (projectId: string) => {
        if (!currentUser) {
            alert('Please log in to start a session.');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/api/active-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, projectId }),
            });
            if (!response.ok) throw new Error('Failed to start session');
            await fetchData();
            setCurrentUser(null);
        } catch (e: any) {
            alert(e.message);
        }
    }, [currentUser, fetchData]);

    const processQRCode = useCallback(async (qrText: string) => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                const existingSession = activeSessions.find(session => session.userId === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
            } else {
                alert('Invalid or blocked user QR code.');
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                alert('Please log in before scanning a project.');
                return;
            }
            const existingUserSession = activeSessions.find(session => session.userId === currentUser.id);
            if (existingUserSession) {
                alert('You already have an active session. Please authenticate again to stop it.');
                return;
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                await startSession(projectId);
            } else {
                alert('Invalid or closed project QR code.');
            }
        } else {
            alert('Unrecognized QR code format.');
        }
    }, [users, currentUser, projects, activeSessions, startSession]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/api/stop-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            if (!response.ok) throw new Error('Failed to stop session');
            await fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    }, [fetchData]);

    const exportToExcel = useCallback((sessionsToExport?: CompletedSession[]) => {
        const sessions = sessionsToExport || completedSessions;
        if (sessions.length === 0) {
            alert('No completed sessions to export!');
            return;
        }
        const headers = ['Timestamp', 'Employee ID', 'Employee Name', 'Project ID', 'Project Name', 'Duration (minutes)'];
        const csvContent = [
            headers.join(','),
            ...sessions.map(s => `"${s.timestamp}","${s.employee_id}","${s.employee_name}","${s.project_id}","${s.project_name}",${s.duration_minutes}`)
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [completedSessions]);

    // --- CRUD Functions ---
    const addUser = async (user: Partial<User>) => { await fetch(`${API_URL}/api/users`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(user) }); await fetchData(); };
    const updateUser = async (user: Partial<User> & { id: string }) => { await fetch(`${API_URL}/api/users/${user.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(user) }); await fetchData(); };
    const deleteUser = async (userId: string) => { await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' }); await fetchData(); };
    
    const addProject = async (project: Partial<Project>) => { await fetch(`${API_URL}/api/projects`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(project) }); await fetchData(); };
    const updateProject = async (project: Project) => { await fetch(`${API_URL}/api/projects/${project.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(project) }); await fetchData(); };
    const deleteProject = async (projectId: string) => { await fetch(`${API_URL}/api/projects/${projectId}`, { method: 'DELETE' }); await fetchData(); };

    const addCostCenter = async (name: string) => { await fetch(`${API_URL}/api/cost-centers`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name }) }); await fetchData(); };
    const updateCostCenter = async (id: number, name: string) => { await fetch(`${API_URL}/api/cost-centers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name }) }); await fetchData(); };
    const deleteCostCenter = async (id: number) => { await fetch(`${API_URL}/api/cost-centers/${id}`, { method: 'DELETE' }); await fetchData(); };
    // --- End CRUD ---

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
            
            const costPerHour = totalHours > 0 && project.budget ? project.budget / totalHours : 0;
            const timeVariance = project.estimated_hours != null ? totalHours - project.estimated_hours : null;
            const workProgressPercentage = project.estimated_hours && project.estimated_hours > 0 ? (totalHours / project.estimated_hours) * 100 : null;

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

    const value: TimeTrackerContextType = {
        currentUser,
        setCurrentUser,
        users,
        projects,
        costCenters,
        activeSessions,
        completedSessions,
        sessionTimers,
        projectEvaluation,
        canAccessEvaluation,
        isAdmin,
        isManager,
        userForStopConfirmation,
        setUserForStopConfirmation,
        isLoading,
        error,
        fetchData,
        processQRCode,
        handleManualLogin,
        startSession,
        stopSessionForUser,
        exportToExcel,
        getProjectEvaluation,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
