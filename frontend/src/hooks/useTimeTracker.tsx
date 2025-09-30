import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Project, ActiveSession, CompletedSession, ProjectEvaluationData, CostCenter, UserBreakdown } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

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
    canAccessEvaluation: boolean;
    isAdmin: boolean;
    isManager: boolean;
    isLoading: boolean;
    error: string | null;
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    processQRCode: (qrText: string) => Promise<void>;
    handleManualLogin: (username: string, password: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    startSession: (projectId: string) => Promise<void>;
    exportToExcel: (sessionsToExport: CompletedSession[]) => void;
    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (id: number, name: string) => Promise<void>;
    deleteCostCenter: (id: number) => Promise<void>;
    addUser: (user: Omit<User, 'id' | 'blocked' | 'costCenters'> & { costCenters: number[] }) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id' | 'closed'>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    toggleProjectStatus: (projectId: string) => Promise<void>;
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
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/initial-data`);
            if (!response.ok) {
                const errorHtml = await response.text();
                console.error("Server Error HTML:", errorHtml)
                throw new Error(`Nepodarilo sa načítať dáta zo servera. ${response.statusText}`);
            }
            const data = await response.json();
            setUsers(data.users);
            setProjects(data.projects);
            setCostCenters(data.costCenters);
            setCompletedSessions(data.completedSessions);
        } catch (err) {
             setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchActiveSessions = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/active-sessions`);
            if (response.ok) {
                const data = await response.json();
                setActiveSessions(data);
            }
        } catch (err) {
            console.error("Failed to fetch active sessions", err);
        }
    }, []);


    useEffect(() => {
        fetchData();
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 5000);
        return () => clearInterval(interval);
    }, [fetchData, fetchActiveSessions]);


    useEffect(() => {
        const timerInterval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - new Date(session.startTime).getTime();
            });
            setSessionTimers(updatedTimers);
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [activeSessions]);
    
    const handleManualLogin = async (username: string, password: string) => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Chyba pri prihlasovaní');
            }
            const user: User = await response.json();
            const existingSession = activeSessions.find(s => s.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };
    
    const processQRCode = async (qrText: string) => {
        const text = qrText.trim();
        if (text.startsWith('USER_ID:')) {
            const userId = text.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId);
            if (user) {
                 if (user.blocked) {
                    alert('Používateľ je zablokovaný.');
                    return;
                }
                const existingSession = activeSessions.find(s => s.userId === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
            } else {
                alert('Neplatný QR kód používateľa.');
            }
        } else if (text.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                alert('Prosím, najprv sa prihláste.');
                return;
            }
            const projectId = text.substring('PROJECT_ID:'.length);
            await startSession(projectId);
        } else {
            alert('Nerozpoznaný formát QR kódu.');
        }
    };
    
    const startSession = async (projectId: string) => {
        if (!currentUser) {
            alert('Prosím, najprv sa prihláste.');
            return;
        }
        
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            alert("Projekt neexistuje.");
            return;
        }
        if (project.closed) {
            alert("Projekt je uzatvorený a nie je možné preň spustiť novú reláciu.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/active-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, projectId }),
            });
            if (!response.ok) throw new Error('Nepodarilo sa spustiť reláciu.');
            await fetchActiveSessions();
            setCurrentUser(null);
        } catch (err) {
            // No alert needed, just log out the user
            setCurrentUser(null);
        }
    };


    const stopSessionForUser = async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/active-sessions/${user.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Nepodarilo sa ukončiť reláciu.');
            
            await fetchActiveSessions();
            const completedResponse = await fetch(`${API_URL}/initial-data`);
            const data = await completedResponse.json();
            setCompletedSessions(data.completedSessions);

        } catch (err) {
            alert(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };

    const exportToExcel = (sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('Žiadne relácie na export!');
            return;
        }
        const headers = ['Dátum', 'Čas', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)', 'Trvanie (formátované)'];
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => {
                const date = new Date(s.timestamp);
                const durationFormatted = `${Math.floor(s.duration_minutes / 60)}h ${s.duration_minutes % 60}m`;
                return `"${date.toLocaleDateString()}";"${date.toLocaleTimeString()}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes};"${durationFormatted}"`;
            })
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };
    
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
            
            const costPerHour = totalHours > 0 && project.budget ? project.budget / totalHours : 0;
            const timeVariance = project.estimated_hours != null ? totalHours - project.estimated_hours : null;
            const workProgressPercentage = project.estimated_hours && project.estimated_hours > 0 ? (totalHours / project.estimated_hours) * 100 : 0;


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
    
    // --- Cost Center Management ---
    const addCostCenter = async (name: string) => {
        const response = await fetch(`${API_URL}/cost-centers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (response.ok) {
            const newCenter = await response.json();
            setCostCenters(prev => [...prev, newCenter].sort((a,b) => a.name.localeCompare(b.name)));
        } else {
            alert("Nepodarilo sa pridať stredisko.");
        }
    };
    const updateCostCenter = async (id: number, name: string) => {
        const response = await fetch(`${API_URL}/cost-centers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });
        if (response.ok) {
            const updatedCenter = await response.json();
            setCostCenters(prev => prev.map(c => c.id === id ? updatedCenter : c));
        } else {
            alert("Nepodarilo sa upraviť stredisko.");
        }
    };
    const deleteCostCenter = async (id: number) => {
        if(window.confirm('Naozaj chcete vymazať toto stredisko?')) {
            const response = await fetch(`${API_URL}/cost-centers/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setCostCenters(prev => prev.filter(c => c.id !== id));
            } else {
                alert("Nepodarilo sa vymazať stredisko. Uistite sa, že nie je priradené k žiadnemu projektu.");
            }
        }
    };
    
    // --- User Management ---
    const addUser = async (user: Omit<User, 'id' | 'blocked' | 'costCenters'> & { costCenters: number[] }) => {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
        });
        if (response.ok) {
            const newUser = await response.json();
            setUsers(prev => [...prev, newUser].sort((a,b) => a.name.localeCompare(b.name)));
        } else {
             alert((await response.json()).message || "Nepodarilo sa pridať používateľa.");
        }
    };
    const updateUser = async (userToUpdate: User) => {
        const response = await fetch(`${API_URL}/users/${userToUpdate.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userToUpdate),
        });
        if (response.ok) {
            const updatedUser = await response.json();
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u));
        } else {
             alert("Nepodarilo sa upraviť používateľa.");
        }
    };
    const deleteUser = async (userId: string) => {
        if (window.confirm('Naozaj chcete vymazať tohto používateľa?')) {
            const response = await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
            if (response.ok) {
                setUsers(prev => prev.filter(u => u.id !== userId));
            } else {
                alert("Nepodarilo sa vymazať používateľa.");
            }
        }
    };

    // --- Project Management ---
     const addProject = async (project: Omit<Project, 'id' | 'closed'>) => {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project),
        });
        if (response.ok) {
            const newProject = await response.json();
            setProjects(prev => [...prev, newProject].sort((a,b) => a.name.localeCompare(b.name)));
        } else {
             alert((await response.json()).message || "Nepodarilo sa pridať projekt.");
        }
    };
    const updateProject = async (project: Project) => {
        const response = await fetch(`${API_URL}/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project),
        });
        if (response.ok) {
            const updatedProject = await response.json();
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        } else {
             alert("Nepodarilo sa upraviť projekt.");
        }
    };
    const deleteProject = async (projectId: string) => {
        if (window.confirm('Naozaj chcete vymazať tento projekt?')) {
            const response = await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' });
            if (response.ok) {
                setProjects(prev => prev.filter(p => p.id !== projectId));
            } else {
                alert("Nepodarilo sa vymazať projekt.");
            }
        }
    };
    const toggleProjectStatus = async (projectId: string) => {
        const response = await fetch(`${API_URL}/projects/${projectId}/toggle-status`, { method: 'PUT' });
        if (response.ok) {
            const updatedProject = await response.json();
            setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
        } else {
            alert("Nepodarilo sa zmeniť stav projektu.");
        }
    };
    

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
        costCenters,
        sessionTimers,
        projectEvaluation,
        canAccessEvaluation,
        isAdmin,
        isManager,
        isLoading,
        error,
        userForStopConfirmation,
        setUserForStopConfirmation,
        processQRCode,
        handleManualLogin,
        stopSessionForUser,
        startSession,
        exportToExcel,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        toggleProjectStatus,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};