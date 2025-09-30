import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Project, ActiveSession, CompletedSession, ProjectEvaluationData, CostCenter, UserBreakdown, UserRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

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
    isAdmin: boolean;
    isManager: boolean;
    userForStopConfirmation: User | null;
    processQRCode: (qrText: string) => void;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: (sessions: CompletedSession[]) => void;
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    toggleProjectStatus: (projectId: string) => Promise<void>;
    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (id: number, name: string) => Promise<void>;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
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
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const navigate = useNavigate();

    const fetchData = useCallback(async (user: User | null) => {
        if (!user) {
            // Fetch only public or general data if needed, or do nothing
            const activeSessionsRes = await fetch(`${API_BASE_URL}/active-sessions`);
            if (activeSessionsRes.ok) setActiveSessions(await activeSessionsRes.json());
            return;
        };

        const body = { userId: user.id, userRole: user.role };

        const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes, costCentersRes] = await Promise.all([
            fetch(`${API_BASE_URL}/users`),
            fetch(`${API_BASE_URL}/projects/filtered`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
            fetch(`${API_BASE_URL}/active-sessions`),
            fetch(`${API_BASE_URL}/sessions/completed/filtered`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
            fetch(`${API_BASE_URL}/cost-centers`),
        ]);

        if (usersRes.ok) setUsers(await usersRes.json());
        if (projectsRes.ok) setProjects(await projectsRes.json());
        if (activeSessionsRes.ok) setActiveSessions(await activeSessionsRes.json());
        if (completedSessionsRes.ok) setCompletedSessions(await completedSessionsRes.json());
        if (costCentersRes.ok) setCostCenters(await costCentersRes.json());
    }, []);

    useEffect(() => {
        setIsLoading(true);
        fetchData(currentUser).finally(() => setIsLoading(false));
    }, [currentUser, fetchData]);

    // Polling for active sessions
    useEffect(() => {
        const interval = setInterval(() => {
             fetch(`${API_BASE_URL}/active-sessions`)
                .then(res => res.ok ? res.json() : [])
                .then(setActiveSessions)
                .catch(err => console.error("Polling active sessions failed:", err));
        }, 5000);
        return () => clearInterval(interval);
    }, []);

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

    const handleManualLogin = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const error = await response.json();
                alert(error.message || 'Neplatné prihlasovacie údaje.');
                return false;
            }
            const user: User = await response.json();
            const existingSession = activeSessions.find(s => s.user_id === user.id);
            if (existingSession) {
                 setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            alert('Chyba pripojenia na server.');
            return false;
        }
    };

    const processQRCode = (qrText: string) => {
        const text = qrText.trim();
        if (text.startsWith('USER_ID:')) {
            const userId = text.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId);
            if (user) {
                if (user.blocked) {
                    alert('Používateľ je zablokovaný.');
                    return;
                }
                const existingSession = activeSessions.find(s => s.user_id === user.id);
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
                alert('Prosím, prihláste sa pred skenovaním projektu.');
                return;
            }
            const existingUserSession = activeSessions.find(s => s.user_id === currentUser.id);
            if (existingUserSession) {
                alert('Už máte aktívnu reláciu. Pre jej zastavenie sa prosím znova prihláste.');
                return;
            }
            const projectId = text.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId);
            if (project) {
                if (project.closed) {
                    alert('Projekt je uzatvorený a nie je možné preň spustiť novú reláciu.');
                    return;
                }
                startSession(currentUser.id, project.id);
            } else {
                alert('Neplatný QR kód projektu.');
            }
        } else {
            alert('Nerozpoznaný formát QR kódu.');
        }
    };

    const startSession = async (userId: string, projectId: string) => {
        try {
            await fetch(`${API_BASE_URL}/active-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, projectId }),
            });
            await fetchData(currentUser); // Refresh data
            setCurrentUser(null);
            setUserForStopConfirmation(null);
        } catch (error) {
            alert('Nepodarilo sa spustiť reláciu.');
        }
    };
    
    const stopSessionForUser = async (user: User) => {
        try {
            await fetch(`${API_BASE_URL}/stop-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            await fetchData(currentUser);
        } catch (error) {
            alert('Nepodarilo sa ukončiť reláciu.');
        }
    };
    
    // CRUD operations
    const addUser = async (user: Partial<User>) => { /* ... API call ... */ };
    const updateUser = async (user: User) => {
         try {
            const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user),
            });
            if (!response.ok) throw new Error("Failed to update user");
            await fetchData(currentUser);
        } catch (error) {
            alert('Nepodarilo sa aktualizovať používateľa.');
        }
    };

    const addProject = async (project: Partial<Project>) => { /* ... API call ... */ };
    const updateProject = async (project: Project) => { /* ... API call ... */ };

    const toggleProjectStatus = async (projectId: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}/toggle-status`, { method: 'PUT' });
            if (!response.ok) throw new Error("Failed to toggle project status");
            await fetchData(currentUser);
        } catch (error) {
            alert('Nepodarilo sa zmeniť stav projektu.');
        }
    };

    const addCostCenter = async (name: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/cost-centers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!response.ok) throw new Error("Failed to add cost center");
            await fetchData(currentUser);
        } catch (error) {
            alert('Nepodarilo sa pridať stredisko.');
        }
    };

    const updateCostCenter = async (id: number, name: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/cost-centers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });
            if (!response.ok) throw new Error("Failed to update cost center");
            await fetchData(currentUser);
        } catch (error) {
            alert('Nepodarilo sa aktualizovať stredisko.');
        }
    };

    const getProjectEvaluation = useCallback((): Record<string, ProjectEvaluationData> => {
        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach((project: Project) => {
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
            const timeVariance = project.estimated_hours != null && project.estimated_hours > 0 ? totalHours - project.estimated_hours : null;
            const workProgressPercentage = project.estimated_hours != null && project.estimated_hours > 0 ? (totalHours / project.estimated_hours) * 100 : null;

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

    const exportToExcel = useCallback((sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('Žiadne relácie na export!');
            return;
        }
        const headers = ['Dátum', 'Čas', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)', 'Trvanie (formát)'];
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => {
                const date = new Date(s.timestamp);
                const durationFormatted = `${Math.floor(s.duration_minutes / 60)}h ${s.duration_minutes % 60}m`;
                return `"${date.toLocaleDateString()}";"${date.toLocaleTimeString()}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes};"${durationFormatted}"`
            })
        ].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, []);

    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';

    const value: TimeTrackerContextType = {
        currentUser,
        setCurrentUser,
        users,
        projects,
        activeSessions,
        completedSessions,
        costCenters,
        sessionTimers,
        projectEvaluation,
        isLoading,
        isAdmin,
        isManager,
        userForStopConfirmation,
        processQRCode,
        handleManualLogin,
        stopSessionForUser,
        exportToExcel,
        addUser,
        updateUser,
        addProject,
        updateProject,
        toggleProjectStatus,
        addCostCenter,
        updateCostCenter,
        setUserForStopConfirmation
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
