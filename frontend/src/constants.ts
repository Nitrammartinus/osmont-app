import { User, Project } from './types';

export const INITIAL_USERS: User[] = [
    { id: 'admin001', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin', blocked: false, can_select_project_manually: true, costCenters: [] },
    { id: 'user123', name: 'John Doe', username: 'john', password: 'password123', role: 'employee', blocked: false, can_select_project_manually: false, costCenters: [] },
    { id: 'user456', name: 'Jane Smith', username: 'jane', password: 'password456', role: 'manager', blocked: false, can_select_project_manually: true, costCenters: [] },
    { id: 'user789', name: 'Mike Johnson', username: 'mike', password: 'password789', role: 'employee', blocked: false, can_select_project_manually: false, costCenters: [] },
    { id: 'user101', name: 'Sarah Wilson', username: 'sarah', password: 'password101', role: 'manager', blocked: false, can_select_project_manually: true, costCenters: [] },
    { id: 'user202', name: 'Tom Brown', username: 'tom', password: 'password202', role: 'employee', blocked: false, can_select_project_manually: false, costCenters: [] }
];

export const INITIAL_PROJECTS: Project[] = [
    { id: 'proj001', name: 'Website Redesign', budget: 15000, deadline: '2024-12-15', closed: false, estimated_hours: 200, cost_center_id: 1 },
    { id: 'proj002', name: 'Mobile App Development', budget: 25000, deadline: '2024-11-30', closed: false, estimated_hours: 400, cost_center_id: 1 },
    { id: 'proj003', name: 'Marketing Campaign', budget: 8000, deadline: '2024-10-20', closed: true, estimated_hours: 80, cost_center_id: 2 },
    { id: 'proj004', name: 'Database Optimization', budget: 12000, deadline: '2024-12-01', closed: false, estimated_hours: 150, cost_center_id: 3 }
];
