import React, { useState, useEffect, useCallback, useMemo, useContext, createContext } from 'react';
import { User, Project, ActiveSession, CompletedSession, View, ProjectEvaluationData, CostCenter } from '../types';

// API helpers
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = {
    async get(endpoint: string) {
        const response = await fetch(`${API_URL}/${endpoint}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server error');
        }
        return response.json();
    },
    async post(endpoint: string, data: any) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server error');
        }
        return response.json();
    },
    async put(endpoint: string, data: any) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Server error');
        }
        return response.json();
    },
    async delete(endpoint: string) {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'DELETE'
        });
        if (!response.ok && response.status !== 204) {
             const error = await response.json();
            throw new Error(error.message || 'Server error');
        }
        return response;
    }
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
    costCenters: CostCenter[];
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
    
    login: (username: string, password: string) => Promise<boolean>;
    processQRCode: (qrText: string) => Promise<void>;
    startSession: (projectId: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    
    addUser: (user: Omit<User, 'id' | 'blocked'>) => Promise<boolean>;
    updateUser: (user: User) => Promise<boolean>;
    deleteUser: (userId: string) => Promise<boolean>;

    addProject: (project: Omit<Project, 'id'|'closed'>) => Promise<boolean>;
    updateProject: (project: Project) => Promise<boolean>;
    deleteProject: (projectId: string) => Promise<boolean>;

    addCostCenter: (center: Omit<CostCenter, 'id'>) => Promise<boolean>;
    updateCostCenter: (center: CostCenter) => Promise<boolean>;
    deleteCostCenter: (centerId: string) => Promise<boolean>;

    exportToExcel: (sessionsToExport: CompletedSession[]) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const useTimeTracker = () => {
    const context = useContext(TimeTrackerContext);
    if (!context) throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    return context;
};

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        try {
            const storedUser = sessionStorage.getItem('timeTracker-currentUser');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch {
            return null;
        }
    });
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [currentView, setCurrentView] = useState<View>('tracking');
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);

    useEffect(() => {
        if (currentUser) {
            sessionStorage.setItem('timeTracker-currentUser', JSON.stringify(currentUser));
        } else {
            sessionStorage.removeItem('timeTracker-currentUser');
        }
    }, [currentUser]);

    const fetchAllData = useCallback(async () => {
        if (!currentUser) {
            setUsers([]);
            setProjects([]);
            setCostCenters([]);
            setCompletedSessions([]);
            return;
        }
        try {
            const [
                fetchedUsers,
                fetchedProjects,
                fetchedCostCenters,
                fetchedCompletedSessions,
            ] = await Promise.all([
                currentUser.role === 'admin' ? api.get('users') : Promise.resolve([]),
                api.post('projects/filtered', { userRole: currentUser.role, userId: currentUser.id }),
                api.get('cost-centers'),
                api.post('sessions/completed/filtered', { userRole: currentUser.role, userId: currentUser.id }),
            ]);

            setUsers(fetchedUsers);
            setProjects(fetchedProjects);
            setCostCenters(fetchedCostCenters);
            setCompletedSessions(fetchedCompletedSessions);
        } catch (error) {
            console.error("Failed to fetch data", error);
            alert((error as Error).message);
        }
    }, [currentUser]);

    const fetchActiveSessions = useCallback(async () => {
        try {
            const fetchedActiveSessions = await api.get('sessions/active');
            setActiveSessions(fetchedActiveSessions);
        } catch (error) {
            console.error("Failed to fetch active sessions", error);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 5000);
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

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const user = await api.post('login', { username, password });
            const userActiveSession = (await api.get('sessions/active')).find((s: ActiveSession) => s.user_id === user.id);
            if (userActiveSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    
    const processQRCode = async (qrText: string): Promise<void> => {
        try {
            if (qrText.startsWith('USER_ID:')) {
                const userId = qrText.substring('USER_ID:'.length);
                const allUsers = await api.get('users');
                const user = allUsers.find((u:User) => u.id === userId);
                if (!user || user.blocked) throw new Error('Neplatný alebo zablokovaný QR kód používateľa.');

                const existingSession = (await api.get('sessions/active')).find((session: ActiveSession) => session.user_id === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
            } else if (qrText.startsWith('PROJECT_ID:')) {
                if (!currentUser) throw new Error('Pred skenovaním projektu sa musíte prihlásiť.');
                
                const existingUserSession = activeSessions.find(session => session.user_id === currentUser.id);
                if (existingUserSession) throw new Error('Už máte aktívnu reláciu. Pre jej zastavenie sa znova prihláste.');
                
                const projectId = qrText.substring('PROJECT_ID:'.length);
                await startSession(projectId);

            } else {
                throw new Error('Nerozpoznaný formát QR kódu.');
            }
        } catch (error) {
            alert((error as Error).message);
        }
    };
    
    const startSession = async (projectId: string) => {
        if (!currentUser) return;
        try {
            const allProjects = await api.post('projects/filtered', { userRole: currentUser.role, userId: currentUser.id });
            const project = allProjects.find((p: Project) => p.id === projectId);
            if (!project || project.closed) throw new Error("Neplatný alebo uzatvorený projekt.");
            
            await api.post('sessions/start', {
                userId: currentUser.id,
                userName: currentUser.name,
                projectId: project.id,
                projectName: project.name
            });
            await fetchActiveSessions();
            setCurrentUser(null);
            alert(`Relácia pre projekt ${project.name} bola spustená.`);
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const stopSessionForUser = async (user: User) => {
        try {
            await api.post('sessions/stop', { userId: user.id });
            await fetchActiveSessions();
            await fetchAllData();
        } catch (error) {
            alert((error as Error).message);
        }
    };

    const addUser = async (user: Omit<User, 'id' | 'blocked'>): Promise<boolean> => {
        try {
            const newUser = { ...user, id: `user${Date.now()}` };
            await api.post('users', newUser);
            await fetchAllData();
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    const updateUser = async (user: User): Promise<boolean> => {
        try {
            await api.put(`users/${user.id}`, user);
            await fetchAllData();
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    const deleteUser = async (userId: string): Promise<boolean> => {
         try {
            await api.delete(`users/${userId}`);
            await fetchAllData();
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    const addProject = async (project: Omit<Project, 'id'|'closed'>): Promise<boolean> => {
         try {
            const newProject = { ...project, id: `proj${Date.now()}` };
            await api.post('projects', newProject);
            await fetchAllData();
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    const updateProject = async (project: Project): Promise<boolean> => {
         try {
            await api.put(`projects/${project.id}`, project);
            await fetchAllData();
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    const deleteProject = async (projectId: string): Promise<boolean> => {
         try {
            await api.delete(`projects/${projectId}`);
            await fetchAllData();
            return true;
        } catch (error) {
            alert((error as Error).message);
            return false;
        }
    };
    const addCostCenter = async (center: Omit<CostCenter, 'id'>): Promise<boolean> => {
        try {
            const newCenter = { ...center, id: `center${Date.now()}` };
            await api.post('cost-centers', newCenter);
            await fetchAllData();
            return true;
        } catch(error) {
            alert((error as Error).message);
            return false;
        }
    };
    const updateCostCenter = async (center: CostCenter): Promise<boolean> => {
         try {
            await api.put(`cost-centers/${center.id}`, center);
            await fetchAllData();
            return true;
        } catch(error) {
            alert((error as Error).message);
            return false;
        }
    };
    const deleteCostCenter = async (centerId: string): Promise<boolean> => {
         try {
            await api.delete(`cost-centers/${centerId}`);
            await fetchAllData();
            return true;
        } catch(error) {
            alert((error as Error).message);
            return false;
        }
    };

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
                timeVariance,
                workProgressPercentage
            };
        });
        return evaluation;
    }, [projects, completedSessions]);

    const projectEvaluation = useMemo(() => getProjectEvaluation(), [getProjectEvaluation]);

    const isAdmin = currentUser?.role === 'admin';
    const isManager = currentUser?.role === 'manager';
    const canAccessEvaluation = isManager || isAdmin;

    const exportToExcel = useCallback((sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('Žiadne dáta na export.');
            return;
        }
        const headers = ['Timestamp', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)'];
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => `"${s.timestamp}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes}`)
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, []);

    const value = {
        currentUser,
        setCurrentUser,
        users,
        projects,
        costCenters,
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
        login,
        processQRCode,
        startSession,
        stopSessionForUser,
        addUser,
        updateUser,
        deleteUser,
        addProject,
        updateProject,
        deleteProject,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        exportToExcel,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
