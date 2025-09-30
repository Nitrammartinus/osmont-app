const { Pool } = require('pg');
const { initialUsers, initialProjects, initialCostCenters, userCostCenterAssignments } = require('./initialData');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS cost_centers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        blocked BOOLEAN NOT NULL DEFAULT false,
        can_select_project_manually BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS user_cost_centers (
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        center_id INTEGER REFERENCES cost_centers(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, center_id)
      );

      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        budget NUMERIC NOT NULL,
        deadline DATE NOT NULL,
        closed BOOLEAN NOT NULL DEFAULT false,
        estimated_hours NUMERIC,
        cost_center_id INTEGER REFERENCES cost_centers(id)
      );

      CREATE TABLE IF NOT EXISTS active_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
        start_time TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS completed_sessions (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        employee_id VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        project_id VARCHAR(255) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        duration_minutes INTEGER NOT NULL
      );
    `);

    console.log('Tables created or already exist.');

    // Seed data if tables are empty
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCount.rows[0].count, 10) === 0) {
      console.log('Database is empty, seeding initial data...');

      // Seed Cost Centers
      for (const center of initialCostCenters) {
        await client.query('INSERT INTO cost_centers (id, name) VALUES ($1, $2)', [center.id, center.name]);
      }
      console.log('Cost centers seeded successfully.');

      // Seed Users
      for (const user of initialUsers) {
        await client.query('INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [user.id, user.name, user.username, user.password, user.role, user.blocked, user.can_select_project_manually]);
      }
      console.log('Users seeded successfully.');

      // Seed User-Cost Center Assignments
      for (const assignment of userCostCenterAssignments) {
        await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [assignment.user_id, assignment.center_id]);
      }
      console.log('User cost center assignments seeded successfully.');
      
      // Seed Projects
      for (const project of initialProjects) {
        await client.query('INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [project.id, project.name, project.budget, project.deadline, project.closed, project.estimated_hours, project.cost_center_id]);
      }
      console.log('Projects seeded successfully.');
    } else {
        console.log('Database already contains data, skipping seed.');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, initializeDatabase };
