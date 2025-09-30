const initialCostCenters = [
    { id: 1, name: 'Vývoj' },
    { id: 2, name: 'Marketing' },
    { id: 3, name: 'Prevádzka' },
];

const initialUsers = [
    { id: 'admin001', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin', blocked: false, can_select_project_manually: true },
    { id: 'user123', name: 'John Doe', username: 'john', password: 'password123', role: 'employee', blocked: false, can_select_project_manually: false },
    { id: 'user456', name: 'Jane Smith', username: 'jane', password: 'password456', role: 'manager', blocked: false, can_select_project_manually: true },
    { id: 'user789', name: 'Mike Johnson', username: 'mike', password: 'password789', role: 'employee', blocked: false, can_select_project_manually: true },
];

const userCostCenterMapping = [
    { userId: 'admin001', centerId: 1 },
    { userId: 'admin001', centerId: 2 },
    { userId: 'admin001', centerId: 3 },
    { userId: 'user123', centerId: 1 },
    { userId: 'user456', centerId: 1 },
    { userId: 'user456', centerId: 2 },
    { userId: 'user789', centerId: 3 },
];

const initialProjects = [
    { id: 'proj001', name: 'Website Redesign', budget: 15000, deadline: '2025-12-15', closed: false, estimated_hours: 200, cost_center_id: 1 },
    { id: 'proj002', name: 'Mobile App Development', budget: 25000, deadline: '2025-11-30', closed: false, estimated_hours: 400, cost_center_id: 1 },
    { id: 'proj003', name: 'Marketing Campaign', budget: 8000, deadline: '2025-10-20', closed: true, estimated_hours: 80, cost_center_id: 2 },
    { id: 'proj004', name: 'Database Optimization', budget: 12000, deadline: '2025-12-01', closed: false, estimated_hours: 150, cost_center_id: 3 }
];

module.exports = { initialUsers, initialProjects, initialCostCenters, userCostCenterMapping };
