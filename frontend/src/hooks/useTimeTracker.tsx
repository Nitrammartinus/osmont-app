import React, { useState, useEffect, useCallback, useMemo, useContext, createContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Project, ActiveSession, CompletedSession, ProjectEvaluationData, CostCenter, UserBreakdown } from '../types';

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
    costCenters: CostCenter[];
    sessionTimers: Record<number, number>;
    projectEvaluation: Record<string, ProjectEvaluationData>;
    isLoading: boolean;
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    
    // Functions
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    processQRCode: (qrText: string) => Promise<void>;
    startSession: (projectId: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    
    // User Management
    addUser: (user: Omit<User, 'id' | 'blocked' | 'costCenters'>) => Promise<boolean>;
    updateUser: (user: User) => Promise<boolean>;
    deleteUser: (userId: string) => Promise<void>;

    // Project Management
    addProject: (project: Omit<Project, 'id' | 'closed'>) => Promise<boolean>;
    updateProject: (project: Project) => Promise<boolean>;
    deleteProject: (projectId: string) => Promise<void>;

    // Cost Center Management
    addCostCenter: (center: Omit<CostCenter, 'id'>) => Promise<boolean>;
    updateCostCenter: (center: CostCenter) => Promise<boolean>;
    deleteCostCenter: (centerId: string) => Promise<void>;

    // Export
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

export const TimeTrackerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    const navigate = useNavigate();
    
    const fetchData = useCallback(async () => {
        if (!currentUser) {
            setUsers([]);
            setProjects([]);
            setCompletedSessions([]);
            setCostCenters([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const body = JSON.stringify({ userId: currentUser.id, userRole: currentUser.role });
            const headers = { 'Content-Type': 'application/json' };

            const [usersRes, projectsRes, completedRes, costCentersRes] = await Promise.all([
                currentUser.role === 'admin' ? fetch(`${API_URL}/users`) : Promise.resolve(null),
                fetch(`${API_URL}/projects/filtered`, { method: 'POST', headers, body }),
                fetch(`${API_URL}/sessions/completed/filtered`, { method: 'POST', headers, body }),
                currentUser.role === 'admin' ? fetch(`${API_URL}/cost-centers`) : Promise.resolve(null),
            ]);

            if (usersRes) setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setCompletedSessions(await completedRes.json());
            if (costCentersRes) setCostCenters(await costCentersRes.json());

        } catch (error) {
            console.error("Failed to fetch data:", error);
            alert("Nepodarilo sa načítať dáta zo servera. Skúste obnoviť stránku.");
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    const fetchActiveSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/sessions/active`);
            if (res.ok) {
                const data = await res.json();
                setActiveSessions(data);
            }
        } catch (error) {
            console.error("Failed to fetch active sessions:", error);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchActiveSessions();
    }, [fetchData, fetchActiveSessions]);
    
    useEffect(() => {
        const interval = setInterval(fetchActiveSessions, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [fetchActiveSessions]);

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


    const login = useCallback(async (username: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (res.ok) {
                const user: User = await res.json();
                
                // Check for active session for this user
                const activeRes = await fetch(`${API_URL}/sessions/active`);
                const allActiveSessions: ActiveSession[] = await activeRes.json();
                const existingSession = allActiveSessions.find(s => s.user_id === user.id);
                
                if(existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
                return true;
            } else {
                const error = await res.json();
                alert(error.message || 'Prihlásenie zlyhalo.');
                return false;
            }
        } catch (error) {
            console.error("Login failed:", error);
            alert("Chyba pripojenia na server.");
            return false;
        }
    }, []);

    const logout = useCallback(() => {
        setCurrentUser(null);
        setUserForStopConfirmation(null);
        navigate('/');
    }, [navigate]);

    const handleUserScan = useCallback(async (userId: string) => {
        // We can't trust local users state, fetch from server for security
        const res = await fetch(`${API_URL}/users`);
        const allUsers: User[] = await res.json();
        const user = allUsers.find(u => u.id === userId);

        if (user) {
            if (user.blocked) {
                alert('Používateľ je zablokovaný.');
                return;
            }
            const existingSession = activeSessions.find(s => s.user_id === user.id);
            if(existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
        } else {
            alert('Neplatný QR kód používateľa.');
        }
    }, [activeSessions]);

    const startSession = useCallback(async (projectId: string) => {
        if (!currentUser) {
            alert('Pre spustenie relácie musíte byť prihlásený.');
            return;
        }
        
        // Fetch fresh projects to ensure we have the latest data
        const res = await fetch(`${API_URL}/projects/filtered`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, userRole: currentUser.role })
        });
        const currentProjects: Project[] = await res.json();
        const project = currentProjects.find(p => p.id === projectId);
        
        if (!project) {
             alert('Projekt nebol nájdený alebo k nemu nemáte prístup.');
             return;
        }
        if (project.closed) {
             alert('Projekt je uzatvorený a nie je možné preň spustiť novú reláciu.');
             return;
        }

        try {
            const response = await fetch(`${API_URL}/sessions/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    userName: currentUser.name,
                    projectId: project.id,
                    projectName: project.name
                }),
            });
            if (response.ok) {
                await fetchActiveSessions();
                setCurrentUser(null);
            } else {
                const error = await response.json();
                alert(error.message || 'Nepodarilo sa spustiť reláciu.');
            }
        } catch (error) {
            console.error("Failed to start session:", error);
            alert("Chyba pripojenia pri spúšťaní relácie.");
        }
    }, [currentUser, fetchActiveSessions]);

     const processQRCode = useCallback(async (qrText: string) => {
        const trimmedText = qrText.trim();
        if (trimmedText.startsWith('USER_ID:')) {
            const userId = trimmedText.substring('USER_ID:'.length);
            await handleUserScan(userId);
        } else if (trimmedText.startsWith('PROJECT_ID:')) {
            const projectId = trimmedText.substring('PROJECT_ID:'.length);
            await startSession(projectId);
        } else {
            alert('Neplatný QR kód.');
        }
    }, [handleUserScan, startSession]);
    
    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/sessions/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            if (response.ok) {
                await fetchActiveSessions();
                await fetchData(); // Refresh completed sessions
            } else {
                const error = await response.json();
                alert(error.message || 'Nepodarilo sa ukončiť reláciu.');
            }
        } catch (error) {
            console.error("Failed to stop session:", error);
            alert("Chyba pripojenia pri ukončovaní relácie.");
        }
    }, [fetchActiveSessions, fetchData]);

    // Management functions
    const addUser = async (user: Omit<User, 'id' | 'blocked' | 'costCenters'>) => {
        try {
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...user, id: `user${Date.now()}` }),
            });
            if (res.ok) {
                await fetchData();
                return true;
            }
            const error = await res.json();
            alert(`Chyba: ${error.message}`);
            return false;
        } catch(e) { alert("Chyba pripojenia."); return false; }
    };
    const updateUser = async (user: User) => {
        try {
            const res = await fetch(`${API_URL}/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
            });
             if (res.ok) {
                await fetchData();
                alert("Používateľ úspešne aktualizovaný.");
                return true;
            }
            const error = await res.json();
            alert(`Chyba: ${error.message}`);
            return false;
        } catch(e) { alert("Chyba pripojenia."); return false; }
    };
    const deleteUser = async (userId: string) => {
        try {
            await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
            await fetchData();
        } catch(e) { alert("Chyba pripojenia."); }
    };
    const addProject = async (project: Omit<Project, 'id' | 'closed'>) => {
         try {
            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...project, id: `proj${Date.now()}` }),
            });
            if (res.ok) {
                await fetchData();
                return true;
            }
             alert("Nepodarilo sa pridať projekt.");
             return false;
        } catch(e) { alert("Chyba pripojenia."); return false; }
    };
    const updateProject = async (project: Project) => {
        try {
            const res = await fetch(`${API_URL}/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project),
            });
            if (res.ok) {
                await fetchData();
                return true;
            }
             alert("Nepodarilo sa aktualizovať projekt.");
             return false;
        } catch(e) { alert("Chyba pripojenia."); return false; }
    };
    const deleteProject = async (projectId: string) => {
        try {
            await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' });
            await fetchData();
        } catch(e) { alert("Chyba pripojenia."); }
    };

    const addCostCenter = async (center: Omit<CostCenter, 'id'>) => {
         try {
            const res = await fetch(`${API_URL}/cost-centers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...center, id: `center${Date.now()}` }),
            });
            if (res.ok) {
                await fetchData();
                return true;
            }
             alert("Nepodarilo sa pridať stredisko.");
             return false;
        } catch(e) { alert("Chyba pripojenia."); return false; }
    };
     const updateCostCenter = async (center: CostCenter) => {
        try {
            const res = await fetch(`${API_URL}/cost-centers/${center.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(center),
            });
            if (res.ok) {
                await fetchData();
                return true;
            }
             alert("Nepodarilo sa aktualizovať stredisko.");
             return false;
        } catch(e) { alert("Chyba pripojenia."); return false; }
    };
    const deleteCostCenter = async (centerId: string) => {
        try {
            const res = await fetch(`${API_URL}/cost-centers/${centerId}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchData();
            } else {
                const error = await res.json();
                alert(`Chyba: ${error.message}`);
            }
        } catch(e) { alert("Chyba pripojenia."); }
    };

    const exportToExcel = useCallback((sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('Žiadne relácie na exportovanie!');
            return;
        }
        const headers = ['Dátum', 'Čas', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)', 'Trvanie (formát)'];
        
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => {
                const date = new Date(s.timestamp);
                const row = [
                    date.toLocaleDateString('sk-SK'),
                    date.toLocaleTimeString('sk-SK'),
                    s.employee_id,
                    `"${s.employee_name}"`,
                    s.project_id,
                    `"${s.project_name}"`,
                    s.duration_minutes,
                    `"${formatDuration(s.duration_minutes)}"`
                ];
                return row.join(';');
            })
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report_casu_${new Date().toISOString().split('T')[0]}.csv`;
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

    const value: TimeTrackerContextType = {
        currentUser, setCurrentUser,
        users, projects, activeSessions, completedSessions, costCenters,
        sessionTimers, projectEvaluation, isLoading,
        userForStopConfirmation, setUserForStopConfirmation,
        login, logout, processQRCode, startSession, stopSessionForUser,
        addUser, updateUser, deleteUser,
        addProject, updateProject, deleteProject,
        addCostCenter, updateCostCenter, deleteCostCenter,
        exportToExcel,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
