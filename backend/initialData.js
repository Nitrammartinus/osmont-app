const bcrypt = require('bcrypt');

const seedInitialData = async (client) => {
    try {
        // Hashing passwords
        const saltRounds = 10;
        const adminPass = await bcrypt.hash('admin123', saltRounds);
        const johnPass = await bcrypt.hash('password123', saltRounds);
        const janePass = await bcrypt.hash('password456', saltRounds);
        const mikePass = await bcrypt.hash('password789', saltRounds);
        const sarahPass = await bcrypt.hash('password101', saltRounds);

        // Seed Users
        const users = [
            { id: 'admin001', name: 'Admin User', username: 'admin', password: adminPass, role: 'admin', blocked: false, can_select_project_manually: true },
            { id: 'user123', name: 'John Doe', username: 'john', password: johnPass, role: 'employee', blocked: false, can_select_project_manually: false },
            { id: 'user456', name: 'Jane Smith', username: 'jane', password: janePass, role: 'manager', blocked: false, can_select_project_manually: true },
            { id: 'user789', name: 'Mike Johnson', username: 'mike', password: mikePass, role: 'employee', blocked: false, can_select_project_manually: false },
            { id: 'user101', name: 'Sarah Wilson', username: 'sarah', password: sarahPass, role: 'manager', blocked: false, can_select_project_manually: true },
        ];
        for (const user of users) {
            await client.query(
                'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [user.id, user.name, user.username, user.password, user.role, user.blocked, user.can_select_project_manually]
            );
        }
        console.log('Users seeded successfully.');

        // Seed Cost Centers
        const costCenters = [
            { id: 'center01', name: 'Vývoj' },
            { id: 'center02', name: 'Marketing' },
            { id: 'center03', name: 'Prevádzka' },
        ];
        for (const center of costCenters) {
            await client.query('INSERT INTO cost_centers (id, name) VALUES ($1, $2)', [center.id, center.name]);
        }
        console.log('Cost centers seeded successfully.');

        // Seed User-CostCenter Assignments
        const userCenterAssignments = [
            { userId: 'user123', centerId: 'center01' }, // John Doe -> Vývoj
            { userId: 'user456', centerId: 'center01' }, // Jane Smith -> Vývoj
            { userId: 'user456', centerId: 'center02' }, // Jane Smith -> Marketing
            { userId: 'user789', centerId: 'center03' }, // Mike Johnson -> Prevádzka
            { userId: 'user101', centerId: 'center02' }, // Sarah Wilson -> Marketing
        ];
        for (const assignment of userCenterAssignments) {
            await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [assignment.userId, assignment.centerId]);
        }
        console.log('User-CostCenter assignments seeded successfully.');
        
        // Seed Projects
        const projects = [
            { id: 'proj001', name: 'Website Redesign', budget: 15000, deadline: '2025-12-15', closed: false, estimated_hours: 200, cost_center_id: 'center01' },
            { id: 'proj002', name: 'Mobile App Development', budget: 25000, deadline: '2025-11-30', closed: false, estimated_hours: 400, cost_center_id: 'center01' },
            { id: 'proj003', name: 'Marketing Campaign', budget: 8000, deadline: '2025-10-20', closed: true, estimated_hours: 80, cost_center_id: 'center02' },
            { id: 'proj004', name: 'Database Optimization', budget: 12000, deadline: '2025-12-01', closed: false, estimated_hours: 150, cost_center_id: 'center03' }
        ];
        for (const project of projects) {
            await client.query(
                'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [project.id, project.name, project.budget, project.deadline, project.closed, project.estimated_hours, project.cost_center_id]
            );
        }
        console.log('Projects seeded successfully.');

    } catch (err) {
        console.error('Error seeding data', err);
        throw err;
    }
};

module.exports = { seedInitialData };
