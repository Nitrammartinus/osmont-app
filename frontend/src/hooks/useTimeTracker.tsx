import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, CostCenter, ProjectEvaluationData, UserBreakdown } from '../types';

// API base URL from environment variables
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const formatDuration = (minutes: number): string => {
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
    currentView: View;
    setCurrentView: React.Dispatch<React.SetStateAction<View>>;
    projectEvaluation: Record<string, ProjectEvaluationData>;
    canAccessEvaluation: boolean;
    isAdmin: boolean;
    isManager: boolean;
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    processQRCode: (qrText: string) => Promise<{ success: boolean; message: string; }>;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    stopSessionForUser: (user: User) => Promise<void>;
    exportToExcel: (sessionsToExport: CompletedSession[]) => void;
    
    // User Management
    addUser: (user: Omit<User, 'id' | 'blocked'>) => Promise<boolean>;
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
            const userJson = sessionStorage.getItem('timeTracker-currentUser');
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
    
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    const isAdmin = useMemo(() => currentUser?.role === 'admin', [currentUser]);
    const isManager = useMemo(() => currentUser?.role === 'manager', [currentUser]);
    const canAccessEvaluation = useMemo(() => isAdmin || isManager, [isAdmin, isManager]);

    useEffect(() => {
        if (currentUser) {
            sessionStorage.setItem('timeTracker-currentUser', JSON.stringify(currentUser));
        } else {
            sessionStorage.removeItem('timeTracker-currentUser');
            setCurrentView('tracking');
        }
    }, [currentUser]);

    const fetchUsers = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const response = await fetch(`${API_URL}/users`);
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error(error);
        }
    }, [isAdmin]);

    const fetchProjects = useCallback(async () => {
        if (!currentUser) { setProjects([]); return; };
        try {
            const response = await fetch(`${API_URL}/projects/filtered`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRole: currentUser.role, userId: currentUser.id })
            });
            if (!response.ok) throw new Error('Failed to fetch projects');
            const data = await response.json();
            setProjects(data);
        } catch (error) {
            console.error(error);
        }
    }, [currentUser]);
    
    const fetchActiveSessions = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/sessions/active`);
            if (!response.ok) throw new Error('Failed to fetch active sessions');
            const data = await response.json();
            setActiveSessions(data);
        } catch (error) {
            console.error(error);
        }
    }, []);

    const fetchCompletedSessions = useCallback(async () => {
         if (!currentUser) { setCompletedSessions([]); return; };
        try {
            const response = await fetch(`${API_URL}/sessions/completed/filtered`, {
                 method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userRole: currentUser.role, userId: currentUser.id })
            });
            if (!response.ok) throw new Error('Failed to fetch completed sessions');
            const data = await response.json();
            setCompletedSessions(data);
        } catch (error) {
            console.error(error);
        }
    }, [currentUser]);

    const fetchCostCenters = useCallback(async () => {
        if (!isAdmin && !isManager) return;
        try {
            const response = await fetch(`${API_URL}/cost-centers`);
            if (!response.ok) throw new Error('Failed to fetch cost centers');
            const data = await response.json();
            setCostCenters(data);
        } catch (error) {
            console.error(error);
        }
    }, [isAdmin, isManager]);

    useEffect(() => {
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 5000); // Poll for active sessions
        return () => clearInterval(interval);
    }, [fetchActiveSessions]);
    
    useEffect(() => {
        if (currentUser) {
            fetchProjects();
            fetchCompletedSessions();
            if (isAdmin || isManager) {
                fetchCostCenters();
            }
            if (isAdmin) {
                fetchUsers();
            }
        } else {
            // Clear data on logout
            setUsers([]);
            setProjects([]);
            setCompletedSessions([]);
            setCostCenters([]);
        }
    }, [currentUser, fetchProjects, fetchCompletedSessions, fetchUsers, fetchCostCenters, isAdmin, isManager]);


    const handleManualLogin = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (!response.ok) {
                const error = await response.json();
                alert(error.message || 'Login failed');
                return false;
            }
            const user: User = await response.json();
            const res = await fetch(`${API_URL}/sessions/active`);
            const allActiveSessions: ActiveSession[] = await res.json();
            const existingSession = allActiveSessions.find(s => s.user_id === user.id);
            
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            console.error(error);
            alert('An error occurred during login.');
            return false;
        }
    };
    
    const findUserById = useCallback(async (userId: string) => {
        let user = users.find(u => u.id === userId);
        if (!user) {
            try {
                // This is a workaround because only admins can fetch all users
                const res = await fetch(`${API_URL}/users`);
                const allUsers: User[] = await res.json();
                user = allUsers.find((u) => u.id === userId);
            } catch (e) { console.error(e); }
        }
        return user;
    }, [users]);

    const processQRCode = async (qrText: string): Promise<{ success: boolean; message: string; }> => {
        if (qrText.startsWith('USER_ID:')) {
            const userId = qrText.substring('USER_ID:'.length);
            try {
                const res = await fetch(`${API_URL}/sessions/active`);
                const allActiveSessions: ActiveSession[] = await res.json();
                const existingSession = allActiveSessions.find(s => s.user_id === userId);

                if (existingSession) {
                    const user = await findUserById(userId);
                     if (user) {
                        setUserForStopConfirmation(user);
                        return { success: true, message: `Active session found for ${user.name}.` };
                     } else {
                        return { success: false, message: 'Could not identify user for active session.' };
                     }
                }
                alert("Please use manual login. QR code login is for stopping sessions only.");
                return { success: false, message: 'Please log in manually.' };
            } catch (error) {
                 return { success: false, message: 'Error processing user QR code.' };
            }
        } else if (qrText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                return { success: false, message: 'Please log in before scanning a project.' };
            }
            const existingUserSession = activeSessions.find(s => s.user_id === currentUser.id);
            if (existingUserSession) {
                return { success: false, message: 'You already have an active session. Please authenticate again to stop it.' };
            }
            const projectId = qrText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId && !p.closed);
            if (project) {
                try {
                    const response = await fetch(`${API_URL}/sessions/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: currentUser.id,
                            userName: currentUser.name,
                            projectId: project.id,
                            projectName: project.name,
                        })
                    });
                    if (!response.ok) throw new Error("Failed to start session");
                    await fetchActiveSessions(); // Refresh active sessions
                    setCurrentUser(null);
                    return { success: true, message: `Started session for ${project.name}.` };
                } catch (error) {
                    console.error(error);
                    return { success: false, message: 'Could not start session on server.' };
                }
            } else {
                return { success: false, message: 'Invalid or closed project QR code.' };
            }
        }
        return { success: false, message: 'Unrecognized QR code format.' };
    };

    const stopSessionForUser = async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/sessions/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            if (!response.ok) throw new Error("Failed to stop session");
            await fetchActiveSessions();
            if (canAccessEvaluation) {
                await fetchCompletedSessions();
            }
        } catch (error) {
            console.error(error);
            alert('Failed to stop the session.');
        }
    };

    const exportToExcel = (sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('No completed sessions to export!');
            return;
        }
        const headers = ['Timestamp', 'Employee ID', 'Employee Name', 'Project ID', 'Project Name', 'Duration (minutes)', 'Duration (formatted)'];
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => {
                const row = [
                     `"${new Date(s.timestamp).toLocaleString('sk-SK')}"`,
                     `"${s.employee_id}"`,
                     `"${s.employee_name}"`,
                     `"${s.project_id}"`,
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
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
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
                allSessions: projectSessions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
                costPerHour,
                workProgressPercentage,
                timeVariance,
            };
        });
        return evaluation;
    }, [projects, completedSessions]);

    const projectEvaluation = useMemo(() => getProjectEvaluation(), [getProjectEvaluation]);

    // CRUD functions
    const addUser = async (userData: Omit<User, 'id' | 'blocked'>) => {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...userData, id: `user${Date.now()}` })
            });
            if (!response.ok) throw new Error('Failed to add user');
            await fetchUsers();
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to add user.');
            return false;
        }
    };
    
    const updateUser = async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/users/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!response.ok) throw new Error('Failed to update user');
            await fetchUsers();
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to update user.');
            return false;
        }
    };

    const deleteUser = async (userId: string) => {
        try {
            const response = await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete user');
            await fetchUsers();
        } catch (error) {
            console.error(error);
            alert('Failed to delete user.');
        }
    };

    const addProject = async (projectData: Omit<Project, 'id' | 'closed'>) => {
        try {
            const response = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...projectData, id: `proj${Date.now()}` })
            });
            if (!response.ok) throw new Error('Failed to add project');
            await fetchProjects();
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to add project.');
            return false;
        }
    };

    const updateProject = async (project: Project) => {
        try {
            const response = await fetch(`${API_URL}/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(project)
            });
            if (!response.ok) throw new Error('Failed to update project');
            await fetchProjects();
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to update project.');
            return false;
        }
    };

    const deleteProject = async (projectId: string) => {
        try {
            const response = await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete project');
            await fetchProjects();
        } catch (error) {
            console.error(error);
            alert('Failed to delete project.');
        }
    };

    const addCostCenter = async (center: Omit<CostCenter, 'id'>) => {
        try {
            const response = await fetch(`${API_URL}/cost-centers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...center, id: `center${Date.now()}` })
            });
            if (!response.ok) throw new Error('Failed to add cost center');
            await fetchCostCenters();
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to add cost center.');
            return false;
        }
    };
    
    const updateCostCenter = async (center: CostCenter) => {
        try {
            const response = await fetch(`${API_URL}/cost-centers/${center.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(center)
            });
            if (!response.ok) throw new Error('Failed to update cost center');
            await fetchCostCenters();
            return true;
        } catch (error) {
            console.error(error);
            alert('Failed to update cost center.');
            return false;
        }
    };

    const deleteCostCenter = async (centerId: string) => {
        try {
            const response = await fetch(`${API_URL}/cost-centers/${centerId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete cost center');
            await fetchCostCenters();
        } catch (error) {
            console.error(error);
            alert('Failed to delete cost center. Make sure it is not assigned to any projects.');
        }
    };

    const value: TimeTrackerContextType = {
        currentUser,
        setCurrentUser,
        users,
        projects,
        activeSessions,
        completedSessions,
        costCenters,
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
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
