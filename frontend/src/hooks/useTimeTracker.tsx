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
    
    processQRCode: (qrText: string) => void;
    handleManualLogin: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    startSession: (projectId: string) => Promise<void>;
    stopSessionForUser: (user: User) => Promise<void>;

    exportToExcel: (sessions: CompletedSession[]) => void;
    
    addUser: (user: Omit<User, 'id'>) => Promise<void>;
    updateUser: (user: User) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;

    addProject: (project: Omit<Project, 'id'>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    toggleProjectStatus: (project: Project) => Promise<void>;

    addCostCenter: (name: string) => Promise<void>;
    updateCostCenter: (center: CostCenter) => Promise<void>;
    deleteCostCenter: (centerId: number) => Promise<void>;
}

const TimeTrackerContext = createContext<TimeTrackerContextType>({} as TimeTrackerContextType);

export const useTimeTracker = () => {
    const context = useContext(TimeTrackerContext);
    if (!context) {
        throw new Error('useTimeTracker must be used within a TimeTrackerProvider');
    }
    return context;
};

export const TimeTrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const storedUser = sessionStorage.getItem('currentUser');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [sessionTimers, setSessionTimers] = useState<Record<number, number>>({});
    const [userForStopConfirmation, setUserForStopConfirmation] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/initial-data`);
            if (!response.ok) {
                throw new Error('Nepodarilo sa načítať dáta zo servera.');
            }
            const data = await response.json();
            setUsers(data.users || []);
            setProjects(data.projects || []);
            setActiveSessions(data.activeSessions || []);
            setCompletedSessions(data.completedSessions || []);
            setCostCenters(data.costCenters || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nastala neznáma chyba. Skúste obnoviť stránku.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSessions(prev => {
                const now = Date.now();
                const updatedTimers: Record<number, number> = {};
                prev.forEach(session => {
                    updatedTimers[session.id] = now - new Date(session.start_time).getTime();
                });
                setSessionTimers(updatedTimers);
                return prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);
    
    useEffect(() => {
        // Poll for active sessions to keep synced across devices
        const pollInterval = setInterval(() => {
            fetch(`${API_URL}/active-sessions`)
                .then(res => res.json())
                .then(data => setActiveSessions(data))
                .catch(err => console.error("Polling for active sessions failed", err));
        }, 5000); // Poll every 5 seconds
        
        return () => clearInterval(pollInterval);
    }, []);


    useEffect(() => {
        if (currentUser) {
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            sessionStorage.removeItem('currentUser');
        }
    }, [currentUser]);
    
    // ... (rest of the provider logic will go here)

    // Placeholder for functions to be implemented
    const placeholderAsync = async () => { console.warn("Function not implemented"); };

    const value = {
        currentUser, setCurrentUser, users, projects, activeSessions,
        completedSessions, costCenters, sessionTimers, isLoading, error,
        userForStopConfirmation, setUserForStopConfirmation,
        isAdmin: currentUser?.role === 'admin',
        isManager: currentUser?.role === 'manager',
        canAccessEvaluation: currentUser?.role === 'admin' || currentUser?.role === 'manager',
        
        // These will be replaced by real implementations
        processQRCode: () => {},
        handleManualLogin: async () => false,
        logout: () => {
            setCurrentUser(null);
            navigate('/');
        },
        startSession: placeholderAsync,
        stopSessionForUser: placeholderAsync,
        exportToExcel: () => {},
        addUser: placeholderAsync,
        updateUser: placeholderAsync,
        deleteUser: placeholderAsync,
        addProject: placeholderAsync,
        updateProject: placeholderAsync,
        deleteProject: placeholderAsync,
        toggleProjectStatus: placeholderAsync,
        addCostCenter: placeholderAsync,
        updateCostCenter: placeholderAsync,
        deleteCostCenter: placeholderAsync,
        projectEvaluation: {}
    };

    return <TimeTrackerContext.Provider value={value}>{children}</TimeTrackerContext.Provider>;
};
