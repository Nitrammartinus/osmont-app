import React, { useState, useEffect, useRef, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData } from '../types';
// import { INITIAL_USERS, INITIAL_PROJECTS } from '../constants';

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
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    projects: Project[];
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
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
    handleManualLogin: (username:string, password:string) => boolean;
    stopSessionForUser: (user: User) => void;
    exportToExcel: () => void;
    getProjectEvaluation: () => Record<string, ProjectEvaluationData>;
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
    
    // Load state from localStorage or use initial values
    const [users, setUsers] = useState<User[]>(() => {
        try {
            const localData = localStorage.getItem('timeTracker-users');
            // FIX: Use empty array as fallback instead of INITIAL_USERS
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Failed to parse users from localStorage", error);
            // FIX: Use empty array as fallback instead of INITIAL_USERS
            return [];
        }
    });

    const [projects, setProjects] = useState<Project[]>(() => {
        try {
            const localData = localStorage.getItem('timeTracker-projects');
            // FIX: Use empty array as fallback instead of INITIAL_PROJECTS
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Failed to parse projects from localStorage", error);
            // FIX: Use empty array as fallback instead of INITIAL_PROJECTS
            return [];
        }
    });

    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>(() => {
        try {
            const localData = localStorage.getItem('timeTracker-activeSessions');
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Failed to parse active sessions from localStorage", error);
            return [];
        }
    });

    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>(() => {
        try {
            const localData = localStorage.getItem('timeTracker-completedSessions');
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            console.error("Failed to parse completed sessions from localStorage", error);
            return [];
        }
    });

    // Save state to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('timeTracker-users', JSON.stringify(users));
        } catch (error) {
            console.error("Failed to save users to localStorage", error);
        }
    }, [users]);

    useEffect(() => {
        try {
            localStorage.setItem('timeTracker-projects', JSON.stringify(projects));
        } catch (error) {
            console.error("Failed to save projects to localStorage", error);
        }
    }, [projects]);

    useEffect(() => {
        try {
            localStorage.setItem('timeTracker-activeSessions', JSON.stringify(activeSessions));
        } catch (error) {
            console.error("Failed to save active sessions to localStorage", error);
        }
    }, [activeSessions]);

    useEffect(() => {
        try {
            localStorage.setItem('timeTracker-completedSessions', JSON.stringify(completedSessions));
        } catch (error) {
            console.error("Failed to save completed sessions to localStorage", error);
        }
    }, [completedSessions]);


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
                setCurrentUser(null); // Log out user after starting a session
                return { success: true, message: `Started session for ${project.name}.` };
            } else {
                return { success: false, message: 'Invalid or closed project QR code.' };
            }
        } else {
            return { success: false, message: 'Unrecognized QR code format.' };
        }
    }, [users, currentUser, projects, activeSessions, setActiveSessions]);

    const handleManualLogin = useCallback((username:string, password:string): boolean => {
        const user = users.find(u => u.username === username && u.password === password && !u.blocked);
        if (user) {
            const existingSession = activeSessions.find(session => session.userId === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } else {
            alert('Invalid username or password, or user is blocked!');
            return false;
        }
    }, [users, activeSessions]);

    const stopSessionForUser = useCallback((user: User) => {
        const sessionToStop = activeSessions.find(s => s.userId === user.id);
        if (sessionToStop) {
            const durationMinutes = Math.round((Date.now() - sessionToStop.startTime) / 60000);
            const newCompletedSession: CompletedSession = {
                timestamp: new Date(sessionToStop.startTime).toISOString(),
                employee_id: user.id,
                employee_name: user.name,
                project_id: sessionToStop.projectId,
                project_name: sessionToStop.projectName,
                duration_minutes: durationMinutes,
                duration_formatted: formatDuration(durationMinutes)
            };
            setCompletedSessions(prev => [...prev, newCompletedSession]);
            setActiveSessions(prev => prev.filter(s => s.id !== sessionToStop.id));
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
            
            // Advanced Metrics
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
        setUsers,
        projects,
        setProjects,
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
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
