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
  name: string;
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
  startTime: string; // Comes from DB as ISO string
}

export interface CompletedSession {
  id: number;
  timestamp: string;
  employee_id: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  duration_minutes: number;
  duration_formatted: string;
}

export interface UserBreakdown {
    name: string;
    totalTime: number;
    sessions: number;
}

export interface ProjectEvaluationData extends Project {
    totalTime: number; // in period
    uniqueUsers: number; // in period
    sessions: number; // in period
    averageSession: number; // in period
    userBreakdown: Record<string, UserBreakdown>; // in period
    allSessions: CompletedSession[]; // in period
    costPerHour: number; // lifetime
    // Fix: Replaced progressTowardsDeadline with workProgressPercentage for a more accurate metric.
    workProgressPercentage: number; // lifetime
    timeVariance: number | null; // lifetime
}
