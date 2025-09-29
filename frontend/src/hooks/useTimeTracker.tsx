import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';
import { User, Project, ActiveSession, CompletedSession, CostCenter, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

export const formatDuration = (minutes: number) => {
    if (isNaN(minutes)) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
};

const API_URL = import.meta.env.VITE_API_URL;

interface TimeTrackerContextType {
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    users: User[];
    projects: Project[];
    activeSessions: ActiveSession[];
    completedSessions: CompletedSession[];
    costCenters: CostCenter[];
    userForStopConfirmation: User | null;
    setUserForStopConfirmation: React.Dispatch<React.SetStateAction<User | null>>;
    isLoading: boolean;
    
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    processQRCode: (qrText: string) => Promise<void>;
    startSession: (projectId: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;
    
    addUser: (userData: Partial<User>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    toggleUserBlock: (userId: string) => Promise<void>;
    
    addProject: (projectData: Partial<Project>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    toggleProjectStatus: (projectId: string) => Promise<void>;

    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (center: CostCenter) => Promise<void>;
    deleteCostCenter: (centerId: number) => Promise<void>;

    exportToExcel: (sessionsToExport: CompletedSession[]) => void;
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
            const storedUser = localStorage.getItem('currentUser');
            return storedUser ? JSON.parse(storedUser) : null;
        } catch { return null; }
    });
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const getAuthHeaders = () => {
        if (!currentUser) return {};
        return {
            'X-User-Id': currentUser.id,
            'X-User-Role': currentUser.role,
        };
    };

    const fetchData = useCallback(async () => {
        if (!currentUser) {
            // Fetch only public/general data if needed, or do nothing
            // For this app, only active sessions are relevant when not logged in
             try {
                const activeRes = await fetch(`${API_URL}/sessions/active`);
                setActiveSessions(await activeRes.json());
            } catch (error) {
                 console.error("Failed to fetch active sessions", error);
            }
            setIsLoading(false);
            return;
        };

        setIsLoading(true);
        try {
            const headers = getAuthHeaders();
            const [usersRes, projectsRes, activeRes, completedRes, centersRes] = await Promise.all([
                fetch(`${API_URL}/users`, { headers }),
                fetch(`${API_URL}/projects`, { headers }),
                fetch(`${API_URL}/sessions/active`, { headers }),
                fetch(`${API_URL}/sessions/completed`, { headers }),
                fetch(`${API_URL}/cost-centers`, { headers }),
            ]);

            if (!usersRes.ok || !projectsRes.ok || !activeRes.ok || !completedRes.ok || !centersRes.ok) {
                throw new Error('Network response was not ok');
            }

            setUsers(await usersRes.json());
            setProjects(await projectsRes.json());
            setActiveSessions(await activeRes.json());
            setCompletedSessions(await completedRes.json());
            setCostCenters(await centersRes.json());
        } catch (error) {
            console.error("Nepodarilo sa načítať dáta zo servera.", error);
            alert("Nepodarilo sa načítať dáta zo servera. Skúste obnoviť stránku.");
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Poll for updates every 10 seconds
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    const handleManualLogin = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) { return false; }
            const user: User = await response.json();
            const existingSession = (await (await fetch(`${API_URL}/sessions/active`)).json()).find((s: ActiveSession) => s.user_id === user.id);
            if (existingSession) {
                setUserForStopConfirmation(user);
            } else {
                setCurrentUser(user);
            }
            return true;
        } catch (error) { return false; }
    };
    
    const processQRCode = async (qrText: string) => {
        const trimmedText = qrText.trim();
        if (trimmedText.startsWith('USER_ID:')) {
            const userId = trimmedText.substring('USER_ID:'.length);
            const response = await fetch(`${API_URL}/users/${userId}`); // Need a get user by ID endpoint
             if(response.ok) {
                const user: User = await response.json();
                if (user.blocked) {
                    alert("Tento používateľ je zablokovaný."); return;
                }
                const existingSession = activeSessions.find(s => s.user_id === user.id);
                if (existingSession) {
                    setUserForStopConfirmation(user);
                } else {
                    setCurrentUser(user);
                }
            } else {
                alert("Neplatný QR kód používateľa.");
            }
        } else if (trimmedText.startsWith('PROJECT_ID:')) {
            if (!currentUser) { alert("Prosím, prihláste sa pred skenovaním projektu."); return; }
            const projectId = trimmedText.substring('PROJECT_ID:'.length);
            await startSession(projectId);
        } else {
            alert("Nerozpoznaný formát QR kódu.");
        }
    };
    
    const startSession = async (projectId: string) => {
        if (!currentUser) return;
        
        // Frontend check for closed project
        const project = projects.find(p => p.id === projectId);
        if (project && project.closed) {
            alert("Projekt je uzatvorený a nie je možné preň spustiť novú reláciu.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/sessions/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ userId: currentUser.id, projectId }),
            });
            if (response.ok) {
                setCurrentUser(null);
                fetchData();
            } else {
                const error = await response.json();
                alert(`Chyba: ${error.message}`);
            }
        } catch (error) {
            alert("Chyba pri spúšťaní relácie.");
        }
    };

    const stopSessionForUser = async (user: User) => {
        try {
            const response = await fetch(`${API_URL}/sessions/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({ userId: user.id }),
            });
            if (response.ok) {
                fetchData();
            } else {
                 const error = await response.json();
                alert(`Chyba: ${error.message}`);
            }
        } catch (error) {
            alert("Chyba pri zastavovaní relácie.");
        }
    };

    const addUser = async (userData: Partial<User>) => { await fetch(`${API_URL}/users`, { method: 'POST', headers: {'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(userData) }); fetchData(); };
    const updateUser = async (user: User) => { await fetch(`${API_URL}/users/${user.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(user) }); fetchData(); };
    const deleteUser = async (userId: string) => { if (window.confirm('Naozaj chcete zmazať tohto používateľa?')) { await fetch(`${API_URL}/users/${userId}`, { method: 'DELETE', headers: getAuthHeaders() }); fetchData(); }};
    const toggleUserBlock = async (userId: string) => { await fetch(`${API_URL}/users/${userId}/toggle-block`, { method: 'PUT', headers: getAuthHeaders() }); fetchData(); };
    
    const addProject = async (projectData: Partial<Project>) => { await fetch(`${API_URL}/projects`, { method: 'POST', headers: {'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(projectData)}); fetchData(); };
    const updateProject = async (project: Project) => { await fetch(`${API_URL}/projects/${project.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify(project) }); fetchData(); };
    const deleteProject = async (projectId: string) => { if (window.confirm('Naozaj chcete zmazať tento projekt?')) { await fetch(`${API_URL}/projects/${projectId}`, { method: 'DELETE', headers: getAuthHeaders() }); fetchData(); }};
    const toggleProjectStatus = async (projectId: string) => { await fetch(`${API_URL}/projects/${projectId}/toggle-status`, { method: 'PUT', headers: getAuthHeaders() }); fetchData(); };

    const addCostCenter = async (name: string) => { await fetch(`${API_URL}/cost-centers`, { method: 'POST', headers: {'Content-Type': 'application/json', ...getAuthHeaders()}, body: JSON.stringify({ name }) }); fetchData(); };
    const updateCostCenter = async (center: CostCenter) => { await fetch(`${API_URL}/cost-centers/${center.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json', ...getAuthHeaders()}, body: JSON.stringify({ name: center.name }) }); fetchData(); };
    const deleteCostCenter = async (centerId: number) => { await fetch(`${API_URL}/cost-centers/${centerId}`, { method: 'DELETE', headers: getAuthHeaders() }); fetchData(); };

    const exportToExcel = (sessionsToExport: CompletedSession[]) => {
        if (sessionsToExport.length === 0) {
            alert('Žiadne relácie na export!');
            return;
        }
        const headers = ['Dátum', 'Čas', 'ID Zamestnanca', 'Meno Zamestnanca', 'ID Projektu', 'Názov Projektu', 'Trvanie (minúty)', 'Trvanie'];
        const csvContent = [
            headers.join(';'),
            ...sessionsToExport.map(s => [
                `"${new Date(s.timestamp).toLocaleDateString('sk-SK')}"`,
                 `"${new Date(s.timestamp).toLocaleTimeString('sk-SK')}"`,
                `"${s.employee_id}"`,
                `"${s.employee_name}"`,
                `"${s.project_id}"`,
                `"${s.project_name}"`,
                s.duration_minutes,
                `"${formatDuration(s.duration_minutes)}"`
            ].join(';'))
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `time_tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };


    const value = {
        currentUser, setCurrentUser, users, projects, activeSessions, completedSessions, costCenters,
        userForStopConfirmation, setUserForStopConfirmation,
        handleManualLogin, processQRCode, startSession, stopSessionForUser,
        addUser, updateUser, deleteUser, toggleUserBlock,
        addProject, updateProject, deleteProject, toggleProjectStatus,
        addCostCenter, updateCostCenter, deleteCostCenter,
        exportToExcel,
        isLoading,
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
