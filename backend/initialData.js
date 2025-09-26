const bcrypt = require('bcrypt');

const seedDatabase = async (client) => {
  try {
    const saltRounds = 10;
    
    const users = [
      { id: 'admin001', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin', blocked: false },
      { id: 'user123', name: 'John Doe', username: 'john', password: 'password123', role: 'employee', blocked: false },
      { id: 'user456', name: 'Jane Smith', username: 'jane', password: 'password456', role: 'manager', blocked: false },
    ];

    for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password, saltRounds);
        await client.query(
            'INSERT INTO users (id, name, username, password, role, blocked) VALUES ($1, $2, $3, $4, $5, $6)',
            [user.id, user.name, user.username, hashedPassword, user.role, user.blocked]
        );
    }
    console.log('Users seeded successfully.');

    const projects = [
      { id: 'proj001', name: 'Website Redesign', budget: 15000, deadline: '2024-12-15', closed: false, estimatedHours: 200 },
      { id: 'proj002', name: 'Mobile App Development', budget: 25000, deadline: '2024-11-30', closed: false, estimatedHours: 400 },
      { id: 'proj003', name: 'Marketing Campaign', budget: 8000, deadline: '2024-10-20', closed: true, estimatedHours: 80 },
    ];
    
    for (const project of projects) {
        await client.query(
            'INSERT INTO projects (id, name, budget, deadline, closed, "estimatedHours") VALUES ($1, $2, $3, $4, $5, $6)',
            [project.id, project.name, project.budget, project.deadline, project.closed, project.estimatedHours]
        );
    }
    console.log('Projects seeded successfully.');

  } catch (err) {
    console.error('Error seeding database:', err.stack);
  }
};

module.exports = { seedDatabase };
