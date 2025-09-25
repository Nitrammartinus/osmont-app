
export type UserRole = 'employee' | 'manager' | 'admin';
export type View = 'tracking' | 'evaluation' | 'userManagement' | 'projectManagement';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  blocked: boolean;
}

export interface Project {
  id: string;
  name:string;
  budget: number;
  deadline: string;
  closed: boolean;
  estimatedHours?: number;
}

export interface ActiveSession {
  id: number;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  startTime: number;
  project: Project;
}

export interface CompletedSession {
  timestamp: string;
  employee_id: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  duration_minutes: number;
  duration_formatted: string;
}

export interface QRCodeData {
  type: 'user' | 'project';
  id: string;
  name: string;
  content: string;
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
    progressTowardsDeadline: number;
    timeVariance: number | null;
}
