import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Project, ActiveSession, CompletedSession, CostCenter } from '../types';

// Helper functions
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
    activeSessions: ActiveSession[];
    completedSessions: CompletedSession[];
    costCenters: CostCenter[];
    isLoading: boolean;
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    
    // API functions
    fetchData: () => Promise<void>;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    processQRCode: (qrText: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    startSession: (projectId: string) => Promise<void>;

    // User management
    addUser: (user: Omit<User, 'id' | 'blocked' | 'costCenters'>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    toggleUserBlock: (userId: string) => Promise<void>;

    // Project management
    addProject: (project: Omit<Project, 'id' | 'closed'>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    toggleProjectStatus: (projectId: string) => Promise<void>;

    // Cost center management
    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (center: CostCenter) => Promise<void>;
    deleteCostCenter: (centerId: number) => Promise<void>;

    // Other
    exportToExcel: (sessions: CompletedSession[]) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const useTimeTracker = () => {
    const context = useContext(TimeTrackerContext);
    if (!context) {
        throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    }
    return context;
};

// ... (Rest of the hook implementation)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const item = window.localStorage.getItem('currentUser');
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error("Failed to parse currentUser from localStorage", error);
            return null;
        }
    });
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    const navigate = useNavigate();

    const handleApiCall = useCallback(async (endpoint: string, method: string, body?: any) => {
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                const error = await response.json();
                console.error('API Error:', error);
                alert(`Error: ${error.message || 'An unknown error occurred.'}`);
                return null;
            }
            if (response.status === 204) {
                 return true;
            }
            return response.json();
        } catch (error) {
            console.error(`API call to ${endpoint} failed`, error);
            alert('A network error occurred.');
            return null;
        }
    }, []);

    const fetchData = useCallback(async () => {
        // Don't set loading to true on refetch to avoid flicker
        try {
            // Assuming these endpoints exist on the backend
            const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes, costCentersRes] = await Promise.all([
                fetch(`${API_URL}/users`),
                fetch(`${API_URL}/projects`),
                fetch(`${API_URL}/sessions/active`),
                fetch(`${API_URL}/sessions/completed`),
                fetch(`${API_URL}/cost-centers`),
            ]);

            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setActiveSessions(await activeSessionsRes.json());
            setCompletedSessions(await completedSessionsRes.json());
            setCostCenters(await costCentersRes.json());
        } catch (error) {
            console.error("Failed to fetch initial data", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Set up polling to keep data fresh
        const intervalId = setInterval(fetchData, 30000); 
        return () => clearInterval(intervalId);
    }, [fetchData]);

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    const handleManualLogin = useCallback(async (username: string, password: string): Promise<boolean> => {
        const data = await handleApiCall('/login', 'POST', { username, password });
        if (data) {
            setCurrentUser(data);
            return true;
        }
        return false;
    }, [handleApiCall]);

    const startSession = useCallback(async (projectId: string) => {
        if (!currentUser) {
            alert("Prosím, prihláste sa.");
            return;
        }
        await handleApiCall('/sessions/start', 'POST', { userId: currentUser.id, projectId });
        if(currentUser.role === 'employee') {
            setCurrentUser(null);
        }
        await fetchData();
    }, [currentUser, handleApiCall, fetchData]);

    const processQRCode = useCallback(async (qrText: string) => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            // We use the already fetched users list
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                const existingSession = activeSessions.find(session => session.user_id === user.id);
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
            const existingUserSession = activeSessions.find(session => session.user_id === currentUser.id);
            if (existingUserSession) {
                alert('Už máte aktívnu reláciu. Pre jej zastavenie sa prosím autentifikujte znova.');
                return;
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                await startSession(projectId);
            } else {
                alert('Neplatný alebo uzatvorený QR kód projektu.');
            }
        } else {
            alert('Nerozpoznaný formát QR kódu.');
        }
    }, [users, projects, currentUser, activeSessions, startSession]);

    const stopSessionForUser = useCallback(async (user: User) => {
        await handleApiCall('/sessions/stop', 'POST', { userId: user.id });
        await fetchData();
    }, [handleApiCall, fetchData]);

    const addUser = useCallback(async (user: Omit<User, 'id' | 'blocked' | 'costCenters'>) => {
        await handleApiCall('/users', 'POST', user);
        await fetchData();
    }, [handleApiCall, fetchData]);

    const updateUser = useCallback(async (user: User) => {
        await handleApiCall(`/users/${user.id}`, 'PUT', user);
        await fetchData();
    }, [handleApiCall, fetchData]);

    const deleteUser = useCallback(async (userId: string) => {
        await handleApiCall(`/users/${userId}`, 'DELETE');
        await fetchData();
    }, [handleApiCall, fetchData]);
    
    const toggleUserBlock = useCallback(async (userId: string) => {
        await handleApiCall(`/users/${userId}/toggle-block`, 'PUT');
        await fetchData();
    }, [handleApiCall, fetchData]);
    
    const addProject = useCallback(async (project: Omit<Project, 'id' | 'closed'>) => {
        await handleApiCall('/projects', 'POST', project);
        await fetchData();
    }, [handleApiCall, fetchData]);

    const updateProject = useCallback(async (project: Project) => {
        await handleApiCall(`/projects/${project.id}`, 'PUT', project);
        await fetchData();
    }, [handleApiCall, fetchData]);
    
    const deleteProject = useCallback(async (projectId: string) => {
        await handleApiCall(`/projects/${projectId}`, 'DELETE');
        await fetchData();
    }, [handleApiCall, fetchData]);
    
    const toggleProjectStatus = useCallback(async (projectId: string) => {
        await handleApiCall(`/projects/${projectId}/toggle-status`, 'PUT');
        await fetchData();
    }, [handleApiCall, fetchData]);

    const addCostCenter = useCallback(async (name: string) => {
        await handleApiCall('/cost-centers', 'POST', { name });
        await fetchData();
    }, [handleApiCall, fetchData]);

    const updateCostCenter = useCallback(async (center: CostCenter) => {
        await handleApiCall(`/cost-centers/${center.id}`, 'PUT', center);
        await fetchData();
    }, [handleApiCall, fetchData]);

    const deleteCostCenter = useCallback(async (centerId: number) => {
        await handleApiCall(`/cost-centers/${centerId}`, 'DELETE');
        await fetchData();
    }, [handleApiCall, fetchData]);

    const exportToExcel = useCallback((sessions: CompletedSession[]) => {
        if (sessions.length === 0) {
            alert('Žiadne relácie na export!');
            return;
        }
        const headers = ['Dátum', 'Čas', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)', 'Trvanie (formátované)'];
        const csvContent = [
            headers.join(';'),
            ...sessions.map(s => [
                `"${new Date(s.timestamp).toLocaleDateString('sk-SK')}"`,
                `"${new Date(s.timestamp).toLocaleTimeString('sk-SK')}"`,
                `"${s.employee_id}"`,
                `"${s.employee_name}"`,
                `"${s.project_id}"`,
                `"${s.project_name}"`,
                s.duration_minutes,
                `"${formatDuration(s.duration_minutes)}"`
            ].join(';'))
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, []);

    const value: TimeTrackerContextType = {
        currentUser,
        setCurrentUser,
        users,
        projects,
        activeSessions,
        completedSessions,
        costCenters,
        isLoading,
        userForStopConfirmation,
        setUserForStopConfirmation,
        fetchData,
        handleManualLogin,
        processQRCode,
        stopSessionForUser,
        startSession,
        addUser,
        updateUser,
        deleteUser,
        toggleUserBlock,
        addProject,
        updateProject,
        deleteProject,
        toggleProjectStatus,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        exportToExcel,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
