import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, ProjectEvaluationData, CostCenter } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const formatDuration = (minutes: number) => {
    if (isNaN(minutes) || minutes < 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
};

interface TimeTrackerContextType {
    currentUser: User | null;
    users: User[];
    projects: Project[];
    activeSessions: ActiveSession[];
    completedSessions: CompletedSession[];
    costCenters: CostCenter[];
    sessionTimers: Record<number, number>;
    userForStopConfirmation: User | null;
    isLoading: boolean;
    error: string | null;
    isAdmin: boolean;
    isManager: boolean;
    canAccessEvaluation: boolean;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    processQRCode: (qrText: string) => void;
    startSession: (projectId: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    toggleProjectStatus: (project: Project) => Promise<void>;
    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (center: CostCenter) => Promise<void>;
    deleteCostCenter: (centerId: number) => Promise<void>;
    projectEvaluation: Record<string, ProjectEvaluationData>;
    exportToExcel: (sessionsToExport?: CompletedSession[]) => void;
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
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const userJson = localStorage.getItem('timeTracker-currentUser');
            return userJson ? JSON.parse(userJson) : null;
        } catch {
            return null;
        }
    });
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiRequest = useCallback(async (endpoint: string, method: string = 'GET', body: any = null) => {
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (currentUser) {
                headers['x-user-id'] = currentUser.id;
                headers['x-user-role'] = currentUser.role;
            }

            const options: RequestInit = {
                method,
                headers,
            };
            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${API_URL}${endpoint}`, options);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Chyba ${response.status}`);
            }

            if (response.status === 204) {
                return null;
            }

            return response.json();
        } catch (err: any) {
            console.error(`API request failed: ${method} ${endpoint}`, err);
            alert(`Chyba: ${err.message}`);
            throw err; // Re-throw to be caught by calling function if needed
        }
    }, [currentUser]);

    const fetchData = useCallback(async () => {
        // Don't set loading to true on refetches, only on initial load
        if (isLoading) {
             setError(null);
        }
        try {
            const data = await apiRequest('/initial-data');
            setUsers(data.users);
            setProjects(data.projects);
            setActiveSessions(data.activeSessions);
            setCompletedSessions(data.completedSessions);
            setCostCenters(data.costCenters);
        } catch (err: any) {
             if (isLoading) {
                setError(`Nepodarilo sa načítať dáta zo servera. Skontrolujte pripojenie a skúste to znova. (${err.message})`);
             }
        } finally {
            if (isLoading) {
                setIsLoading(false);
            }
        }
    }, [apiRequest, isLoading]);


    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        try {
            if (currentUser) {
                localStorage.setItem('timeTracker-currentUser', JSON.stringify(currentUser));
            } else {
                localStorage.removeItem('timeTracker-currentUser');
            }
        } catch (e) {
            console.error("Failed to update localStorage", e);
        }
    }, [currentUser]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - new Date(session.start_time).getTime();
            });
            setSessionTimers(updatedTimers);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSessions]);

    const handleManualLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
        try {
            const user = await apiRequest('/login', 'POST', { username, password });
            const existingSession = activeSessions.find(s => s.user_id === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            return false;
        }
    }, [apiRequest, activeSessions]);
    
    const logout = useCallback(() => {
        setCurrentUser(null);
    }, []);

    const processQRCode = useCallback(async (qrText: string) => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                const existingSession = activeSessions.find(s => s.user_id === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
            } else {
                alert('Neplatný alebo zablokovaný QR kód používateľa.');
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                alert('Prosím, prihláste sa pred skenovaním projektu.');
                return;
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            await startSession(projectId);
        } else {
            alert('Nerozpoznaný formát QR kódu.');
        }
    }, [users, currentUser, activeSessions, startSession]);

    const startSession = useCallback(async (projectId: string) => {
        if (!currentUser) return;
        try {
            await apiRequest('/start-session', 'POST', { userId: currentUser.id, projectId });
            await fetchData();
            setCurrentUser(null);
        } catch (error) {
            // Error is alerted in apiRequest
        }
    }, [apiRequest, currentUser, fetchData]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            await apiRequest('/stop-session', 'POST', { userId: user.id });
            await fetchData();
        } catch (error) {
            // Error is alerted in apiRequest
        }
    }, [apiRequest, fetchData]);
    
    // User Management
    const addUser = useCallback(async (user: Partial<User>) => {
        try {
            await apiRequest('/users', 'POST', user);
            await fetchData();
        } catch(e) {}
    }, [apiRequest, fetchData]);

    const updateUser = useCallback(async (user: User) => {
        try {
            await apiRequest(`/users/${user.id}`, 'PUT', user);
            await fetchData();
        } catch(e) {}
    }, [apiRequest, fetchData]);
    
    const deleteUser = useCallback(async (userId: string) => {
        if (window.confirm('Naozaj chcete vymazať tohto používateľa?')) {
            try {
                await apiRequest(`/users/${userId}`, 'DELETE');
                await fetchData();
            } catch(e) {}
        }
    }, [apiRequest, fetchData]);

    // Project Management
    const addProject = useCallback(async (project: Partial<Project>) => {
        try {
            await apiRequest('/projects', 'POST', project);
            await fetchData();
        } catch(e) {}
    }, [apiRequest, fetchData]);

    const updateProject = useCallback(async (project: Project) => {
        try {
            await apiRequest(`/projects/${project.id}`, 'PUT', project);
            await fetchData();
        } catch(e) {}
    }, [apiRequest, fetchData]);
    
    const deleteProject = useCallback(async (projectId: string) => {
        if (window.confirm('Naozaj chcete vymazať tento projekt?')) {
            try {
                await apiRequest(`/projects/${projectId}`, 'DELETE');
                await fetchData();
            } catch(e) {}
        }
    }, [apiRequest, fetchData]);

    const toggleProjectStatus = useCallback(async (project: Project) => {
        await updateProject({ ...project, closed: !project.closed });
    }, [updateProject]);

    // Cost Center Management
    const addCostCenter = useCallback(async (name: string) => {
        try {
            await apiRequest('/cost-centers', 'POST', { name });
            await fetchData();
        } catch(e) {}
    }, [apiRequest, fetchData]);

    const updateCostCenter = useCallback(async (center: CostCenter) => {
        try {
            await apiRequest(`/cost-centers/${center.id}`, 'PUT', center);
            await fetchData();
        } catch(e) {}
    }, [apiRequest, fetchData]);
    
    const deleteCostCenter = useCallback(async (centerId: number) => {
         if (window.confirm('Naozaj chcete vymazať toto stredisko?')) {
            try {
                await apiRequest(`/cost-centers/${centerId}`, 'DELETE');
                await fetchData();
            } catch(e) {}
        }
    }, [apiRequest, fetchData]);

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
            const timeVariance = project.estimated_hours != null ? totalHours - project.estimated_hours : null;
            const workProgressPercentage = (project.estimated_hours && totalHours > 0) ? Math.min(100, (totalHours / project.estimated_hours) * 100) : null;
            
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

    const exportToExcel = useCallback((sessionsToExport?: CompletedSession[]) => {
        const sessions = sessionsToExport || completedSessions;
        if (sessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
            return;
        }
        const headers = ['Timestamp', 'ID zamestnanca', 'Meno zamestnanca', 'ID projektu', 'Názov projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(';'),
            ...sessions.map(s => `"${s.timestamp}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes}`)
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [completedSessions]);


    const isAdmin = useMemo(() => currentUser?.role === 'admin', [currentUser]);
    const isManager = useMemo(() => currentUser?.role === 'manager', [currentUser]);
    const canAccessEvaluation = useMemo(() => isAdmin || isManager, [isAdmin, isManager]);

    const value = {
        currentUser,
        users,
        projects,
        activeSessions,
        completedSessions,
        costCenters,
        sessionTimers,
        userForStopConfirmation,
        isLoading,
        error,
        isAdmin,
        isManager,
        canAccessEvaluation,
        setUserForStopConfirmation,
        handleManualLogin,
        logout,
        processQRCode,
        startSession,
        stopSessionForUser,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        toggleProjectStatus,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        projectEvaluation,
        exportToExcel,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
