const bcrypt = require('bcrypt');
const saltRounds = 10;

// Passwords are pre-hashed for security
const initialUsers = [
    { id: 'admin001', name: 'Admin User', username: 'admin', password: bcrypt.hashSync('admin123', saltRounds), role: 'admin', blocked: false, can_select_project_manually: true },
    { id: 'user456', name: 'Jane Smith', username: 'jane', password: bcrypt.hashSync('password456', saltRounds), role: 'manager', blocked: false, can_select_project_manually: true },
    { id: 'user123', name: 'John Doe', username: 'john', password: bcrypt.hashSync('password123', saltRounds), role: 'employee', blocked: false, can_select_project_manually: false },
    { id: 'user789', name: 'Mike Johnson', username: 'mike', password: bcrypt.hashSync('password789', saltRounds), role: 'employee', blocked: false, can_select_project_manually: true },
];

const initialCostCenters = [
    { id: 1, name: 'Vývoj' },
    { id: 2, name: 'Marketing' },
    { id: 3, name: 'Interné' },
];

const userCostCenterAssignments = [
    { user_id: 'admin001', center_id: 1 },
    { user_id: 'admin001', center_id: 2 },
    { user_id: 'admin001', center_id: 3 },
    { user_id: 'user456', center_id: 1 }, // Jane (Manager) is in Vývoj
    { user_id: 'user123', center_id: 1 }, // John (Employee) is in Vývoj
    { user_id: 'user789', center_id: 2 }, // Mike (Employee) is in Marketing
];

const initialProjects = [
    { id: 'proj001', name: 'Web Redizajn', budget: 15000, deadline: '2025-12-15', closed: false, estimated_hours: 200, cost_center_id: 1 },
    { id: 'proj002', name: 'Mobilná Aplikácia', budget: 25000, deadline: '2025-11-30', closed: false, estimated_hours: 400, cost_center_id: 1 },
    { id: 'proj003', name: 'Marketingová Kampaň', budget: 8000, deadline: '2025-10-20', closed: true, estimated_hours: 80, cost_center_id: 2 },
    { id: 'proj004', name: 'Optimalizácia Databázy', budget: 12000, deadline: '2025-12-01', closed: false, estimated_hours: 150, cost_center_id: 3 }
];

module.exports = { initialUsers, initialProjects, initialCostCenters, userCostCenterAssignments };
