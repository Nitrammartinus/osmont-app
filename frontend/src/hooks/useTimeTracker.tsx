import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData } from '../types';

const API_URL = '/api';

const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

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
        throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
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
            console.error("Failed to parse active sessions from localStorage", error);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('timeTracker-activeSessions', JSON.stringify(activeSessions));
        } catch (error) {
            console.error("Failed to save active sessions to localStorage", error);
        }
    }, [activeSessions]);

    const fetchData = useCallback(async () => {
        try {
            const [usersRes, projectsRes, sessionsRes] = await Promise.all([
                fetch(`${API_URL}/users`),
                fetch(`${API_URL}/projects`),
                fetch(`${API_URL}/sessions`),
            ]);
            if (!usersRes.ok || !projectsRes.ok || !sessionsRes.ok) {
                throw new Error('Failed to fetch initial data');
            }
            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setCompletedSessions(await sessionsRes.json());
        } catch (error) {
            console.error(error);
            alert('Failed to load data from server. Please check your connection and refresh the page.');
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

        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userToAdd),
        });

        if (!response.ok) {
            const err = await response.json();
            alert(`Failed to add user: ${err.error}`);
            return false;
        }
        const addedUser = await response.json();
        const userForState = { ...addedUser };
        delete userForState.password;
        setUsers(prev => [...prev, userForState]);
        return true;
    };

    const updateUser = async (user: User) => {
        await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
        });
        const userForState = { ...user };
        delete userForState.password;
        setUsers(prev => prev.map(u => (u.id === user.id ? userForState : u)));
    };

    const deleteUser = async (userId: string) => {
        await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
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
        const response = await fetch(`${API_URL}/projects`, {
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
        await fetch(`${API_URL}/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(project),
        });
        setProjects(prev => prev.map(p => (p.id === project.id ? project : p)));
    };

    const deleteProject = async (projectId: string) => {
        await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' });
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
                    return { success: true, message: `Active session found for ${user.name}.` };
                } else {
                    setCurrentUser(user);
                    return { success: true, message: `Logged in as ${user.name}.` };
                }
            } else {
                return { success: false, message: 'Invalid or blocked user QR code.' };
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Please log in before scanning a project.' };
            }
            const existingUserSession = activeSessions.find(session => session.userId === currentUser.id);
            if (existingUserSession) {
                return { success: false, message: 'You already have an active session. Please authenticate again to stop it.' };
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
                return { success: true, message: `Started session for ${project.name}.` };
            } else {
                return { success: false, message: 'Invalid or closed project QR code.' };
            }
        } else {
            return { success: false, message: 'Unrecognized QR code format.' };
        }
    }, [users, currentUser, projects, activeSessions]);

    const handleManualLogin = useCallback(async (username:string, password:string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                alert('Invalid username or password, or user is blocked!');
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
            console.error("Login failed:", error);
            alert('An error occurred during login. Please try again.');
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
            const response = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCompletedSession),
            });
            if (response.ok) {
                const savedSession = await response.json();
                setCompletedSessions(prev => [...prev, savedSession]);
                setActiveSessions(prev => prev.filter(s => s.id !== sessionToStop.id));
            } else {
                alert('Failed to save session to the server.');
            }
        }
    }, [activeSessions]);

    const exportToExcel = useCallback(() => {
        if (completedSessions.length === 0) {
            alert('No completed sessions to export!');
            return;
        }
        const headers = ['Timestamp', 'Employee ID', 'Employee Name', 'Project ID', 'Project Name', 'Duration (minutes)'];
        const csvContent = [
            headers.join(','),
            ...completedSessions.map(s => `"${s.timestamp}","${s.employee_id}","${s.employee_name}","${s.project_id}","${s.project_name}",${s.duration_minutes}`)
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
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
