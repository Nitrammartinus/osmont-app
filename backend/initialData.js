
const bcrypt = require('bcrypt');
const saltRounds = 10;

const hashPassword = (password) => {
    return bcrypt.hashSync(password, saltRounds);
};

const initialUsers = [
    { id: 'admin001', name: 'Admin User', username: 'admin', password: hashPassword('admin123'), role: 'admin', blocked: false, can_select_project_manually: true },
    { id: 'user456', name: 'Jane Smith (Manager)', username: 'jane', password: hashPassword('password456'), role: 'manager', blocked: false, can_select_project_manually: true },
    { id: 'user101', name: 'Sarah Wilson (Manager)', username: 'sarah', password: hashPassword('password101'), role: 'manager', blocked: false, can_select_project_manually: true },
    { id: 'user123', name: 'John Doe', username: 'john', password: hashPassword('password123'), role: 'employee', blocked: false, can_select_project_manually: false },
    { id: 'user789', name: 'Mike Johnson', username: 'mike', password: hashPassword('password789'), role: 'employee', blocked: false, can_select_project_manually: true },
    { id: 'user202', name: 'Tom Brown', username: 'tom', password: hashPassword('password202'), role: 'employee', blocked: false, can_select_project_manually: false }
];

const initialCostCenters = [
    { id: 1, name: 'Vývoj' },
    { id: 2, name: 'Marketing' },
    { id: 3, name: 'Prevádzka' }
];

const initialUserCostCenters = [
    // Manažéri vidia svoje strediská
    { user_id: 'user456', center_id: 1 }, // Jane (Vývoj)
    { user_id: 'user101', center_id: 2 }, // Sarah (Marketing)
    // Zamestnanci
    { user_id: 'user123', center_id: 1 }, // John (Vývoj)
    { user_id: 'user789', center_id: 1 }, // Mike (Vývoj)
    { user_id: 'user789', center_id: 2 }, // Mike (aj Marketing)
    { user_id: 'user202', center_id: 3 }, // Tom (Prevádzka)
];

const initialProjects = [
    { id: 'proj001', name: 'Web Redesign', budget: 15000, deadline: '2025-12-15', closed: false, estimated_hours: 200, cost_center_id: 1 },
    { id: 'proj002', name: 'Mobile App', budget: 25000, deadline: '2025-11-30', closed: false, estimated_hours: 400, cost_center_id: 1 },
    { id: 'proj003', name: 'Marketing Kampaň', budget: 8000, deadline: '2025-10-20', closed: true, estimated_hours: 80, cost_center_id: 2 },
    { id: 'proj004', name: 'DB Optimalizácia', budget: 12000, deadline: '2025-12-01', closed: false, estimated_hours: 150, cost_center_id: 3 }
];

module.exports = { initialUsers, initialProjects, initialCostCenters, initialUserCostCenters };
