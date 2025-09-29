export type UserRole = 'employee' | 'manager' | 'admin';

export interface CostCenter {
    id: number;
    name: string;
}

export interface User {
    id: string;
    name: string;
    username: string;
    password?: string; // Only for creation/update
    role: UserRole;
    blocked: boolean;
    can_select_project_manually: boolean;
    costCenters: CostCenter[];
}

export interface Project {
    id: string;
    name: string;
    budget: number;
    deadline: string;
    closed: boolean;
    estimated_hours?: number;
    cost_center_id: number;
    cost_center_name?: string; // Joined from DB
}

export interface ActiveSession {
    id: number;
    user_id: string;
    project_id: string;
    start_time: string; // ISO string from DB
    // Joined properties for easier display
    userName: string;
    projectName: string;
    cost_center_name?: string;
}

export interface CompletedSession {
    id: number;
    timestamp: string; // ISO string
    employee_id: string;
    employee_name: string;
    project_id: string;
    project_name: string;
    duration_minutes: number;
}

export interface UserBreakdown {
    name: string;
    totalTime: number; // in minutes
    sessions: number;
}

export interface ProjectEvaluationData extends Project {
    totalTime: number; // in minutes, for the selected period
    uniqueUsers: number;
    sessions: number;
    averageSession: number;
    userBreakdown: Record<string, UserBreakdown>;
    allSessions: CompletedSession[];
    costPerHour: number;
    workProgressPercentage: number | null;
    timeVariance: number | null; // in hours
}
