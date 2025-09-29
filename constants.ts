
import { User, Project } from './types';

export const INITIAL_USERS: User[] = [
    { id: 'admin001', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin', blocked: false },
    { id: 'user123', name: 'John Doe', username: 'john', password: 'password123', role: 'employee', blocked: false },
    { id: 'user456', name: 'Jane Smith', username: 'jane', password: 'password456', role: 'manager', blocked: false },
    { id: 'user789', name: 'Mike Johnson', username: 'mike', password: 'password789', role: 'employee', blocked: false },
    { id: 'user101', name: 'Sarah Wilson', username: 'sarah', password: 'password101', role: 'manager', blocked: false },
    { id: 'user202', name: 'Tom Brown', username: 'tom', password: 'password202', role: 'employee', blocked: false }
];

export const INITIAL_PROJECTS: Project[] = [
    { id: 'proj001', name: 'Website Redesign', budget: 15000, deadline: '2024-12-15', closed: false, estimatedHours: 200 },
    { id: 'proj002', name: 'Mobile App Development', budget: 25000, deadline: '2024-11-30', closed: false, estimatedHours: 400 },
    { id: 'proj003', name: 'Marketing Campaign', budget: 8000, deadline: '2024-10-20', closed: true, estimatedHours: 80 },
    { id: 'proj004', name: 'Database Optimization', budget: 12000, deadline: '2024-12-01', closed: false, estimatedHours: 150 }
];