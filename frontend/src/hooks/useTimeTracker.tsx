import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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
    processQRCode: (qrText: string) => { success: boolean; message: string; };
    handleManualLogin: (username:string, password:string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: () => void;
    getProjectEvaluation: () => Record<string, ProjectEvaluationData>;
    addUser: (user: Partial<User>) => Promise<boolean>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    addProject: (project: Partial<Project>) => Promise<boolean>;
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
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);

    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(() => {
        try {
            const localData = localStorage.getItem('timeTracker-activeSessions');
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Nepodarilo sa načítať aktívne relácie z localStorage", error);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('timeTracker-activeSessions', JSON.stringify(activeSessions));
        } catch (error) {
            console.error("Nepodarilo sa uložiť aktívne relácie do localStorage", error);
        }
    }, [activeSessions]);

    const fetchData = useCallback(async () => {
        try {
            const [usersRes, projectsRes, sessionsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/users`),
                fetch(`${API_BASE_URL}/projects`),
                fetch(`${API_BASE_URL}/sessions`),
            ]);
            if (!usersRes.ok || !projectsRes.ok || !sessionsRes.ok) {
                throw new Error('Nepodarilo sa načítať počiatočné dáta');
            }
            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setCompletedSessions(await sessionsRes.json());
        } catch (error) {
            console.error(error);
            alert('Nepodarilo sa načítať dáta zo servera. Skontrolujte pripojenie a obnovte stránku.');
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
                updatedTimers[session.id] = now - session.startTime;
            });
            setSessionTimers(updatedTimers);
        }, 1000);

        return () => clearInterval(interval);
    }, [activeSessions]);

    const addUser = async (newUser: Partial<User>) => {
        const userToAdd = {
            id: `user${Date.now()}`,
            name: newUser.name!,
            username: newUser.username!,
            password: newUser.password!,
            role: newUser.role || 'employee',
        };

        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userToAdd),
        });

        if (!response.ok) {
            const err = await response.json();
            alert(`Nepodarilo sa pridať používateľa: ${err.error}`);
            return false;
        }
        const addedUser = await response.json();
        const userForState = { ...addedUser };
        delete userForState.password;
        setUsers(prev => [...prev, userForState]);
        return true;
    };

    const updateUser = async (user: User) => {
        await fetch(`${API_BASE_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
        });
        const userForState = { ...user };
        delete userForState.password;
        setUsers(prev => prev.map(u => (u.id === user.id ? userForState : u)));
    };

    const deleteUser = async (userId: string) => {
        await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
        setUsers(prev => prev.filter(u => u.id !== userId));
    };

    const addProject = async (newProject: Partial<Project>) => {
        const projectToAdd = {
            id: `proj${Date.now()}`,
            name: newProject.name!,
            budget: Number(newProject.budget),
            deadline: newProject.deadline!,
            estimatedHours: Number(newProject.estimatedHours) || undefined,
        };
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectToAdd),
        });
        if(!response.ok) return false;
        const addedProject = await response.json();
        setProjects(prev => [...prev, addedProject]);
        return true;
    };
    
    const updateProject = async (project: Project) => {
        await fetch(`${API_BASE_URL}/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project),
        });
        setProjects(prev => prev.map(p => (p.id === project.id ? project : p)));
    };

    const deleteProject = async (projectId: string) => {
        await fetch(`${API_BASE_URL}/projects/${projectId}`, { method: 'DELETE' });
        setProjects(prev => prev.filter(p => p.id !== projectId));
    };

    const processQRCode = useCallback((qrText: string): { success: boolean; message: string; } => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            const user = users.find(u => u.id === userId && !u.blocked);
            if (user) {
                const existingSession = activeSessions.find(session => session.userId === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                    return { success: true, message: `Nájdená aktívna relácia pre ${user.name}.` };
                } else {
                    setCurrentUser(user);
                    return { success: true, message: `Prihlásený ako ${user.name}.` };
                }
            } else {
                return { success: false, message: 'Neplatný alebo zablokovaný QR kód používateľa.' };
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Prosím, prihláste sa pred skenovaním projektu.' };
            }
            const existingUserSession = activeSessions.find(session => session.userId === currentUser.id);
            if (existingUserSession) {
                return { success: false, message: 'Už máte aktívnu reláciu. Prosím, overte sa znova, aby ste ju zastavili.' };
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                const newSession: ActiveSession = {
                    id: Date.now(),
                    userId: currentUser.id,
                    userName: currentUser.name,
                    projectId: project.id,
                    projectName: project.name,
                    startTime: Date.now(),
                    project: project
                };
                setActiveSessions(prev => [...prev, newSession]);
                setCurrentUser(null);
                return { success: true, message: `Spustená relácia pre ${project.name}.` };
            } else {
                return { success: false, message: 'Neplatný alebo uzavretý QR kód projektu.' };
            }
        } else {
            return { success: false, message: 'Nerozpoznaný formát QR kódu.' };
        }
    }, [users, currentUser, projects, activeSessions]);

    const handleManualLogin = useCallback(async (username:string, password:string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                alert('Neplatné meno alebo heslo, alebo je používateľ zablokovaný!');
                return false;
            }

            const user = await response.json();
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            console.error("Prihlásenie zlyhalo:", error);
            alert('Počas prihlasovania nastala chyba. Skúste to znova.');
            return false;
        }
    }, [activeSessions]);

    const stopSessionForUser = useCallback(async (user: User) => {
        const sessionToStop = activeSessions.find(s => s.userId === user.id);
        if (sessionToStop) {
            const durationMinutes = Math.round((Date.now() - sessionToStop.startTime) / 60000);
            const newCompletedSession: Omit<CompletedSession, 'id'> = {
                timestamp: new Date(sessionToStop.startTime).toISOString(),
                employee_id: user.id,
                employee_name: user.name,
                project_id: sessionToStop.projectId,
                project_name: sessionToStop.projectName,
                duration_minutes: durationMinutes,
                duration_formatted: formatDuration(durationMinutes)
            };
            const response = await fetch(`${API_BASE_URL}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCompletedSession),
            });
            if (response.ok) {
                const savedSession = await response.json();
                setCompletedSessions(prev => [savedSession, ...prev]);
                setActiveSessions(prev => prev.filter(s => s.id !== sessionToStop.id));
            } else {
                alert('Nepodarilo sa uložiť reláciu na server.');
            }
        }
    }, [activeSessions]);

    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('Žiadne dokončené relácie na export!');
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
                allSessions: projectSessions,
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
        getProjectEvaluation,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
