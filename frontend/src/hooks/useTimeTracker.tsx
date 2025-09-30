
import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Project, ActiveSession, CompletedSession, ProjectEvaluationData, CostCenter, UserBreakdown } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const formatDuration = (minutes: number) => {
    if (isNaN(minutes) || minutes < 0) return '0h 0m';
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
    canAccessEvaluation: boolean;
    isAdmin: boolean;
    isManager: boolean;
    userForStopConfirmation: User | null;
    isLoading: boolean;
    
    processQRCode: (qrText: string) => Promise<void>;
    handleManualLogin: (username: string, password: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    
    addUser: (user: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    
    addProject: (project: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    toggleProjectStatus: (projectId: string) => Promise<void>;

    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (center: CostCenter) => Promise<void>;

    exportToExcel: (sessionsToExport: CompletedSession[]) => void;
}

const TimeTrackerContext = createContext<TimeTrackerContextType | undefined>(undefined);

export const useTimeTracker = () => {
    const context = useContext(TimeTrackerContext);
    if (!context) throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
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
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const getAuthHeaders = useCallback(() => {
        if (!currentUser) return {};
        return {
            'Content-Type': 'application/json',
            'X-User-Id': currentUser.id,
            'X-User-Role': currentUser.role,
        };
    }, [currentUser]);

    const fetchData = useCallback(async () => {
        if (!currentUser) {
            setIsLoading(false);
            return;
        }
        try {
            const headers = getAuthHeaders();
            const [usersRes, projectsRes, completedRes, costCentersRes] = await Promise.all([
                currentUser.role === 'admin' ? fetch(`${API_BASE_URL}/users`, { headers }) : Promise.resolve(null),
                fetch(`${API_BASE_URL}/projects`, { headers }),
                currentUser.role !== 'employee' ? fetch(`${API_BASE_URL}/sessions/completed`, { headers }) : Promise.resolve(null),
                currentUser.role !== 'employee' ? fetch(`${API_BASE_URL}/cost-centers`, { headers }) : Promise.resolve(null),
            ]);

            if (usersRes) setUsers(await usersRes.json());
            if (projectsRes.ok) setProjects(await projectsRes.json());
            if (completedRes) setCompletedSessions(await completedRes.json());
            if (costCentersRes) setCostCenters(await costCentersRes.json());

        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            alert("Nepodarilo sa načítať dáta zo servera. Skúste obnoviť stránku.");
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, getAuthHeaders]);
    
    const fetchActiveSessions = useCallback(async () => {
        if (!currentUser) return;
        try {
            const res = await fetch(`${API_BASE_URL}/active-sessions`, { headers: getAuthHeaders() });
            if (res.ok) {
                setActiveSessions(await res.json());
            }
        } catch (error) {
            console.error("Failed to fetch active sessions:", error);
        }
    }, [currentUser, getAuthHeaders]);

    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, [currentUser]);
    
    useEffect(() => {
        if (!currentUser) return;
        fetchActiveSessions();
        const interval = setInterval(fetchActiveSessions, 5000);
        return () => clearInterval(interval);
    }, [currentUser, fetchActiveSessions]);

    useEffect(() => {
        const interval = setInterval(() => {
            setSessionTimers(prev => {
                const now = Date.now();
                const newTimers: Record<number, number> = {};
                activeSessions.forEach(session => {
                    newTimers[session.id] = now - new Date(session.start_time).getTime();
                });
                return newTimers;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSessions]);

    const handleManualLogin = useCallback(async (username: string, password: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (res.ok) {
                const user: User = await res.json();
                const activeRes = await fetch(`${API_BASE_URL}/active-sessions`, { 
                    headers: { 'X-User-Id': user.id, 'X-User-Role': user.role } 
                });
                const allActiveSessions: ActiveSession[] = await activeRes.json();
                const existingSession = allActiveSessions.find(s => s.user_id === user.id);
                
                if (existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
            } else {
                alert('Nesprávne meno alebo heslo.');
            }
        } catch (error) {
            alert('Chyba pripojenia na server.');
        }
    }, []);
    
    const processQRCode = useCallback(async (qrText: string) => {
        const trimmedText = qrText.trim();
        if (trimmedText.startsWith('USER_ID:')) {
             const userId = trimmedText.substring('USER_ID:'.length);
             const userRes = await fetch(`${API_BASE_URL}/users/${userId}`); // Potrebujeme nový endpoint
             if(userRes.ok){
                const userToConfirm: User = await userRes.json();
                const activeRes = await fetch(`${API_BASE_URL}/active-sessions`, { 
                    headers: { 'X-User-Id': userToConfirm.id, 'X-User-Role': userToConfirm.role } 
                });
                const allActiveSessions: ActiveSession[] = await activeRes.json();
                const existingSession = allActiveSessions.find(s => s.user_id === userToConfirm.id);

                if(existingSession){
                    setUserForStopConfirmation(userToConfirm);
                } else {
                    setCurrentUser(userToConfirm);
                }
             } else {
                alert('Neplatný QR kód používateľa.');
             }
        } else if (trimmedText.startsWith('PROJECT_ID:')) {
            if (!currentUser) {
                alert('Prosím, prihláste sa pred skenovaním projektu.');
                return;
            }
            const projectId = trimmedText.substring('PROJECT_ID:'.length);
            const project = projects.find(p => p.id === projectId);
            if (!project) {
                 alert('Neplatný QR kód projektu.');
                 return;
            }
            if (project.closed) {
                 alert('Projekt je uzatvorený a nie je možné preň spustiť novú reláciu.');
                 return;
            }

            try {
                await fetch(`${API_BASE_URL}/active-sessions`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ projectId }),
                });
                setCurrentUser(null);
                setUserForStopConfirmation(null);
                navigate('/');
            } catch (error) {
                 alert('Nepodarilo sa spustiť reláciu.');
            }
        } else {
            alert('Neznámy formát QR kódu.');
        }
    }, [currentUser, projects, getAuthHeaders, navigate]);

    const stopSessionForUser = useCallback(async (user: User) => {
        try {
            const res = await fetch(`${API_BASE_URL}/active-sessions/user/${user.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (res.ok) {
                fetchActiveSessions();
            } else {
                alert('Nepodarilo sa ukončiť reláciu.');
            }
        } catch (error) {
            alert('Chyba pripojenia na server pri ukončovaní relácie.');
        }
    }, [getAuthHeaders, fetchActiveSessions]);
    
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
                return `"${date.toLocaleDateString()}";"${date.toLocaleTimeString()}";"${s.employee_id}";"${s.employee_name}";"${s.project_id}";"${s.project_name}";${s.duration_minutes};"${formatDuration(s.duration_minutes)}"`
            })
        ].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }, []);

    const getProjectEvaluation = useCallback((): Record<string, ProjectEvaluationData> => {
        const evaluation: Record<string, ProjectEvaluationData> = {};
        projects.forEach((project:Project) => {
            const projectSessions = completedSessions.filter(s => s.project_id === project.id);
            const totalTime = projectSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
            const totalHours = totalTime / 60;
            const uniqueUsers = [...new Set(projectSessions.map(s => s.employee_id))].length;

            const userBreakdown: Record<string, UserBreakdown> = {};
            projectSessions.forEach((session: CompletedSession) => {
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
    
    const addUser = async (user: Partial<User>) => {};
    const updateUser = async (user: User) => {};
    const addProject = async (project: Partial<Project>) => {};
    const updateProject = async (project: Project) => {};

    const toggleProjectStatus = async (projectId: string) => {
         try {
            const res = await fetch(`${API_BASE_URL}/projects/${projectId}/toggle-status`, { method: 'PUT', headers: getAuthHeaders() });
            if (res.ok) fetchData();
        } catch (e) { alert('Chyba pri zmene stavu projektu.'); }
    };
    const addCostCenter = async (name: string) => {
        try {
            const res = await fetch(`${API_BASE_URL}/cost-centers`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name }) });
            if (res.ok) fetchData();
        } catch (e) { alert('Chyba pri pridávaní strediska.'); }
    };
    const updateCostCenter = async (center: CostCenter) => {
        try {
            const res = await fetch(`${API_BASE_URL}/cost-centers/${center.id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ name: center.name }) });
            if (res.ok) fetchData();
        } catch (e) { alert('Chyba pri úprave strediska.'); }
    };

    const projectEvaluation = useMemo(() => getProjectEvaluation(), [getProjectEvaluation]);

    const canAccessEvaluation = currentUser?.role === 'manager' || currentUser?.role === 'admin';
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
        addUser,
        updateUser,
        addProject,
        updateProject,
        toggleProjectStatus,
        addCostCenter,
        updateCostCenter
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
