export type UserRole = 'employee' | 'manager' | 'admin';

export interface CostCenter {
  id: number;
  name: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  blocked: boolean;
  can_select_project_manually: boolean;
  costCenters: number[];
}

export interface Project {
  id: string;
  name:string;
  budget: number | null;
  deadline: string | null;
  closed: boolean;
  estimated_hours: number | null;
  cost_center_id: number;
}

export interface ActiveSession {
  id: number;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  startTime: string; // ISO string from server
  costCenterId: number;
}

export interface CompletedSession {
  id?: number;
  timestamp: string;
  employee_id: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  duration_minutes: number;
}

export interface UserBreakdown {
    name: string;
    totalTime: number;
    sessions: number;
}

export interface ProjectEvaluationData extends Project {
    totalTime: number;
    uniqueUsers: number;
    sessions: number;
    averageSession: number;
    userBreakdown: Record<string, UserBreakdown>;
    allSessions: CompletedSession[];
    costPerHour: number;
    workProgressPercentage: number | null;
    timeVariance: number | null;
}
