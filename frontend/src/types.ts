export type UserRole = 'employee' | 'manager' | 'admin';
export type View = 'tracking' | 'evaluation' | 'userManagement' | 'projectManagement' | 'costCenterManagement';

export interface CostCenter {
  id: string;
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
  costCenters?: string[]; // Array of cost center IDs
}

export interface Project {
  id: string;
  name:string;
  budget: number;
  deadline: string;
  closed: boolean;
  estimated_hours?: number;
  cost_center_id: string;
}

export interface ActiveSession {
  id: number;
  user_id: string;
  user_name: string;
  project_id: string;
  project_name: string;
  start_time: string; // Comes as ISO string from DB
  cost_center_id: string;
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
