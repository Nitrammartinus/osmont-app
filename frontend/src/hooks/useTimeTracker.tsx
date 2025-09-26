import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData } from '../types';

const API_URL = import.meta.env.VITE_API_URL;

const formatDuration = (minutes: number) => {
    if (isNaN(minutes)) return '0h 0m';
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
    
    // Functions
    processQRCode: (qrText: string) => { success: boolean; message: string; };
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    stopSessionForUser: (user: User) => void;
    exportToExcel: () => void;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;

    // User Management
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    
    // Project Management
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
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersRes, projectsRes, sessionsRes] = await Promise.all([
                fetch(`${API_URL}/users`),
                fetch(`${API_URL}/projects`),
                fetch(`${API_URL}/sessions`),
            ]);
            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setCompletedSessions(await sessionsRes.json());
        } catch (error) {
            console.error("Nepodarilo sa načítať dáta zo servera:", error);
            alert("Chyba: Nepodarilo sa pripojiť k serveru. Skúste obnoviť stránku.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        // This is a temporary solution for active sessions, as they are not persisted on the backend.
        // A full solution would involve WebSockets or more complex state management.
        const interval = setInterval(() => {
            const now = Date.now();
            const updatedTimers: Record<number, number> = {};
            activeSessions.forEach(session => {
                updatedTimers[session.id] = now - session.startTime;
            });
            setSessionTimers(updatedTimers);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSessions]);
    
    // User Management
    const addUser = async (newUser: Partial<User>) => {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });
        if (response.ok) {
            const addedUser = await response.json();
            setUsers(prev => [...prev, addedUser]);
        } else {
             alert('Chyba: Nepodarilo sa pridať používateľa.');
        }
    };

    const updateUser = async (userToUpdate: User) => {
        const response = await fetch(`${API_URL}/users/${userToUpdate.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userToUpdate)
        });
        if (response.ok) {
            const updatedUser = await response.json();
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        } else {
            alert('Chyba: Nepodarilo sa aktualizovať používateľa.');
        }
    };
    
    const deleteUser = async (userId: string) => {
        const response = await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
        if (response.ok) {
            setUsers(prev => prev.filter(u => u.id !== userId));
        } else {
            alert('Chyba: Nepodarilo sa vymazať používateľa.');
        }
    };
    
    // Project Management
    const addProject = async (newProject: Partial<Project>) => {
        const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProject)
        });
        if (response.ok) {
            const addedProject = await response.json();
            setProjects(prev => [...prev, addedProject]);
        } else {
             alert('Chyba: Nepodarilo sa pridať projekt.');
        }
    };
    
    const updateProject = async (projectToUpdate: Project) => {
        const response = await fetch(`${API_URL}/projects/${projectToUpdate.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectToUpdate)
        });
        if (response.ok) {
            const updatedProject = await response.json();
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
        } else {
             alert('Chyba: Nepodarilo sa aktualizovať projekt.');
        }
    };
    
    const deleteProject = async (projectId: string) => {
        const response = await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' });
        if (response.ok) {
            setProjects(prev => prev.filter(p => p.id !== projectId));
        } else {
             alert('Chyba: Nepodarilo sa vymazať projekt.');
        }
    };

    const processQRCode = useCallback((qrText: string): { success: boolean; message: string; } => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId);
            if (!user) return { success: false, message: 'Neplatný QR kód používateľa.' };
            if (user.blocked) return { success: false, message: 'Tento používateľ je zablokovaný.' };
            
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
                return { success: true, message: `Nájdená aktívna relácia pre ${user.name}.` };
            } else {
                setCurrentUser(user);
                return { success: true, message: `Prihlásený ako ${user.name}.` };
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Pred skenovaním projektu sa musíte prihlásiť.' };
            }
            
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId);
            if (!project) return { success: false, message: 'Neplatný QR kód projektu.' };
            if (project.closed) return { success: false, message: 'Tento projekt je uzavretý.' };
            
            const newSession: ActiveSession = {
                id: Date.now(),
                userId: currentUser.id,
                userName: currentUser.name,
                projectId: project.id,
                projectName: project.name,
                startTime: Date.now(),
            };
            setActiveSessions(prev => [...prev, newSession]);
            setCurrentUser(null);
            return { success: true, message: `Spustená relácia pre projekt ${project.name}.` };
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions]);

    const handleManualLogin = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const { error } = await response.json();
                alert(`Chyba prihlásenia: ${error}`);
                return false;
            }
            const { user } = await response.json();
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (err) {
            alert('Chyba pri komunikácii so serverom.');
            return false;
        }
    };

    const stopSessionForUser = async (user: User) => {
        const sessionToStop = activeSessions.find(s => s.userId === user.id);
        if (sessionToStop) {
            const durationMinutes = Math.round((Date.now() - sessionToStop.startTime) / 60000);
            const newCompletedSession = {
                timestamp: new Date(sessionToStop.startTime).toISOString(),
                employee_id: user.id,
                employee_name: user.name,
                project_id: sessionToStop.projectId,
                project_name: sessionToStop.projectName,
                duration_minutes: durationMinutes,
            };
            const response = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCompletedSession)
            });
            if(response.ok) {
                const savedSession = await response.json();
                setCompletedSessions(prev => [...prev, savedSession]);
                setActiveSessions(prev => prev.filter(s => s.id !== sessionToStop.id));
            } else {
                alert('Chyba: Nepodarilo sa uložiť reláciu na server.');
            }
        }
    };

    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne ukončené relácie na export!');
            return;
        }
        const headers = ['Timestamp', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(','),
            ...completedSessions.map(s => `"${s.timestamp}","${s.employee_id}","${s.employee_name}","${s.project_id}","${s.project_name}",${s.duration_minutes}`)
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sledovanie_casu_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, [completedSessions]);
    
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
            
            const costPerHour = totalHours > 0 ? project.budget / totalHours : 0;
            const timeVariance = project.estimatedHours != null ? totalHours - project.estimatedHours : null;
            
            let progressTowardsDeadline = 0;
            const firstSession = projectSessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
            if (firstSession) {
                const startDate = new Date(firstSession.timestamp).getTime();
                const deadlineDate = new Date(project.deadline).getTime();
                const today = Date.now();
                if (deadlineDate > startDate) {
                    const totalDuration = deadlineDate - startDate;
                    const elapsedDuration = today - startDate;
                    progressTowardsDeadline = Math.min(100, Math.max(0, (elapsedDuration / totalDuration) * 100));
                }
            }


            evaluation[project.id] = {
                ...project,
                totalTime,
                uniqueUsers,
                sessions: projectSessions.length,
                averageSession: projectSessions.length > 0 ? totalTime / projectSessions.length : 0,
                userBreakdown,
                allSessions: projectSessions.map(s => ({...s, duration_formatted: formatDuration(s.duration_minutes) })),
                costPerHour,
                progressTowardsDeadline,
                timeVariance,
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
        setCurrentUser,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
