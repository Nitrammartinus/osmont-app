import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, UserRole, CostCenter } from '../types';

// Helper function to format time from seconds to HH:MM:SS
export const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

interface TimeTrackerContextType {
    users: User[];
    projects: Project[];
    costCenters: CostCenter[];
    activeSessions: ActiveSession[];
    completedSessions: CompletedSession[];
    currentUser: User | null;
    isLoading: boolean;
    isAdmin: boolean;
    isManager: boolean;
    sessionTimers: { [sessionId: number]: number };
    userForStopConfirmation: User | null;
    
    setCurrentUser: (user: User | null) => void;
    handleManualLogin: (username: string, pass: string) => Promise<boolean>;
    processQRCode: (qrCode: string) => { success: boolean; message: string };
    
    addUser: (userData: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;

    addProject: (projectData: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    toggleProjectStatus: (projectId: string) => Promise<void>;

    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (id: number, name: string) => Promise<void>;
    deleteCostCenter: (id: number) => Promise<void>;
    
    stopSessionForUser: (user: User) => Promise<void>;
    setUserForStopConfirmation: (user: User | null) => void;
    
    projectEvaluation: Record<string, any>;
    exportToExcel: (sessions: CompletedSession[]) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [currentUser, setCurrentUserInternal] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionTimers, setSessionTimers] = useState<{ [sessionId: number]: number }>({});
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    const fetchApi = useCallback(async (url: string, options: RequestInit = {}) => {
        try {
            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json', ...options.headers },
                ...options,
            });
            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                } else {
                    const errorText = await response.text();
                    console.error("Server returned non-JSON error:", errorText);
                    throw new Error(`Chyba servera: ${response.status} ${response.statusText}`);
                }
            }
            if (response.status === 204) return null;
            return await response.json();
        } catch (error) {
            console.error(`API call failed for ${url}:`, error);
            alert(`Chyba: ${error instanceof Error ? error.message : 'Nastala neznáma chyba.'}`);
            return null;
        }
    }, []);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        const [initialData, activeSessionsData] = await Promise.all([
            fetchApi('/api/initial-data'),
            fetchApi('/api/active-sessions')
        ]);

        if (initialData) {
            setUsers(initialData.users || []);
            setProjects(initialData.projects || []);
            setCostCenters(initialData.costCenters || []);
            setCompletedSessions(initialData.completedSessions || []);
        }
        if (activeSessionsData) {
            setActiveSessions(activeSessionsData);
        }
        
        const savedUserJson = localStorage.getItem('currentUser');
        if (savedUserJson) {
            const savedUser = JSON.parse(savedUserJson);
             if (savedUser.role === 'admin' || savedUser.role === 'manager') {
                setCurrentUserInternal(savedUser);
            } else {
                localStorage.removeItem('currentUser');
            }
        }
        
        setIsLoading(false);
    }, [fetchApi]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const setCurrentUser = (user: User | null) => {
        setCurrentUserInternal(user);
        if (user && (user.role === 'admin' || user.role === 'manager')) {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
            localStorage.removeItem('currentUser');
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSessions(prevSessions => {
                const newTimers: { [key: number]: number } = {};
                let hasChanged = false;
                
                prevSessions.forEach(session => {
                    const startTime = new Date(session.startTime).getTime();
                    const now = new Date().getTime();
                    const elapsedSeconds = Math.floor((now - startTime) / 1000);
                    newTimers[session.id] = elapsedSeconds;
                    if (sessionTimers[session.id] !== elapsedSeconds) {
                        hasChanged = true;
                    }
                });

                if (hasChanged) {
                    setSessionTimers(newTimers);
                }
                return prevSessions;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [activeSessions, sessionTimers]);

    const handleManualLogin = async (username: string, pass: string) => {
        const user = await fetchApi('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password: pass }),
        });
        if (user) {
            setCurrentUser(user);
            return true;
        }
        return false;
    };
    
    const startSession = async (userId: string, projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            alert('Projekt nenájdený!');
            return;
        }
        if (project.closed) {
            alert('Tento projekt je uzatvorený a nie je možné na ňom začať pracovať.');
            return;
        }
        
        const newSession = await fetchApi('/api/active-sessions', {
            method: 'POST',
            body: JSON.stringify({ userId, projectId })
        });
        
        if (newSession) {
            await loadInitialData(); // Reload all data to get latest session state
        }
        const user = users.find(u => u.id === userId);
        if(user && user.role === 'employee') {
            setCurrentUser(null);
        }
    };
    
    const stopSessionForUser = async (user: User) => {
        await fetchApi(`/api/active-sessions/${user.id}`, { method: 'DELETE' });
        await loadInitialData();
    };

    const processQRCode = (qrCode: string): { success: boolean, message: string } => {
        if (qrCode.startsWith('USER_ID:')) {
            const userId = qrCode.split(':')[1];
            const user = users.find(u => u.id === userId);
            if (user) {
                if (user.blocked) return { success: false, message: 'Tento používateľ je zablokovaný.' };
                setCurrentUser(user);
                return { success: true, message: 'Prihlásenie úspešné.' };
            }
            return { success: false, message: 'Používateľ nenájdený.' };
        } else if (qrCode.startsWith('PROJECT_ID:')) {
            if (!currentUser) return { success: false, message: 'Musíte byť prihlásený, aby ste mohli začať smenu.' };
            const projectId = qrCode.split(':')[1];
            startSession(currentUser.id, projectId);
            return { success: true, message: 'Smena spustená.' };
        }
        return { success: false, message: 'Neznámy formát QR kódu.' };
    };

    // --- User Management ---
    const addUser = async (userData: Partial<User>) => {
        const newUser = await fetchApi('/api/users', { method: 'POST', body: JSON.stringify(userData) });
        if(newUser) setUsers(prev => [...prev, newUser]);
    };
    const updateUser = async (user: User) => {
        const updatedUser = await fetchApi(`/api/users/${user.id}`, { method: 'PUT', body: JSON.stringify(user) });
        if(updatedUser) setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    };
    const deleteUser = async (userId: string) => {
        if (confirm('Naozaj chcete vymazať tohto používateľa?')) {
            await fetchApi(`/api/users/${userId}`, { method: 'DELETE' });
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    };

    // --- Project Management ---
    const addProject = async (projectData: Partial<Project>) => {
        const newProject = await fetchApi('/api/projects', { method: 'POST', body: JSON.stringify(projectData) });
        if(newProject) setProjects(prev => [...prev, newProject]);
    };
    const updateProject = async (project: Project) => {
        const updatedProject = await fetchApi(`/api/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
        if(updatedProject) setProjects(prev => prev.map(p => p.id === project.id ? updatedProject : p));
    };
    const deleteProject = async (projectId: string) => {
        if (confirm('Naozaj chcete vymazať tento projekt?')) {
            await fetchApi(`/api/projects/${projectId}`, { method: 'DELETE' });
            setProjects(prev => prev.filter(p => p.id !== projectId));
        }
    };
    const toggleProjectStatus = async (projectId: string) => {
        const updatedProject = await fetchApi(`/api/projects/${projectId}/toggle-status`, { method: 'PUT' });
        if (updatedProject) {
            setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
        }
    };

    // --- Cost Center Management ---
    const addCostCenter = async (name: string) => {
        const newCenter = await fetchApi('/api/cost-centers', { method: 'POST', body: JSON.stringify({ name }) });
        if (newCenter) setCostCenters(prev => [...prev, newCenter]);
    };
    const updateCostCenter = async (id: number, name: string) => {
        const updatedCenter = await fetchApi(`/api/cost-centers/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
        if (updatedCenter) setCostCenters(prev => prev.map(c => c.id === id ? updatedCenter : c));
    };
    const deleteCostCenter = async (id: number) => {
         if (confirm('Naozaj chcete vymazať toto stredisko?')) {
            await fetchApi(`/api/cost-centers/${id}`, { method: 'DELETE' });
            setCostCenters(prev => prev.filter(c => c.id !== id));
        }
    };

    // --- Evaluation ---
    const projectEvaluation = useMemo(() => {
        const evaluation: Record<string, any> = {};
        projects.forEach(p => {
            const projectSessions = completedSessions.filter(s => s.project_id === p.id);
            const totalTime = projectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const userBreakdown: Record<string, any> = {};
            projectSessions.forEach(s => {
                if (!userBreakdown[s.employee_id]) {
                    userBreakdown[s.employee_id] = { name: s.employee_name, totalTime: 0, sessions: 0 };
                }
                userBreakdown[s.employee_id].totalTime += s.duration_minutes;
                userBreakdown[s.employee_id].sessions += 1;
            });
            const costPerHour = p.budget && totalTime > 0 ? p.budget / (totalTime / 60) : 0;
            const workProgressPercentage = p.estimated_hours ? ((totalTime / 60) / p.estimated_hours) * 100 : null;
            const timeVariance = p.estimated_hours ? (totalTime / 60) - p.estimated_hours : null;

            evaluation[p.id] = {
                ...p,
                totalTime,
                uniqueUsers: Object.keys(userBreakdown).length,
                sessions: projectSessions.length,
                averageSession: projectSessions.length > 0 ? totalTime / projectSessions.length : 0,
                userBreakdown,
                allSessions: projectSessions,
                costPerHour,
                workProgressPercentage,
                timeVariance
            };
        });
        return evaluation;
    }, [projects, completedSessions]);
    
    const exportToExcel = (sessions: CompletedSession[]) => {
        const headers = ['Projekt ID', 'Názov Projektu', 'Zamestnanec ID', 'Meno Zamestnanca', 'Dátum', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(';'),
            ...sessions.map(s => `"${s.project_id}";"${s.project_name}";"${s.employee_id}";"${s.employee_name}";"${new Date(s.timestamp).toLocaleString()}";${s.duration_minutes}`)
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'report_dat.csv';
        link.click();
    };

    return (
        <TimeTrackerContext.Provider value={{
            users, projects, costCenters, activeSessions, completedSessions, currentUser, isLoading, isAdmin, isManager, sessionTimers, userForStopConfirmation,
            setCurrentUser, handleManualLogin, processQRCode, addUser, updateUser, deleteUser, addProject, updateProject, deleteProject, toggleProjectStatus,
            stopSessionForUser, setUserForStopConfirmation, projectEvaluation, exportToExcel,
            addCostCenter, updateCostCenter, deleteCostCenter
        }}>
            {children}
        </TimeTrackerContext.Provider>
    );
};

export const useTimeTracker = (): TimeTrackerContextType => {
    const context = useContext(TimeTrackerContext);
    if (context === undefined) {
        throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    }
    return context;
};