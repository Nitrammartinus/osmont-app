const { Pool } = require('pg');
const { seedDatabase } = require('./initialData');

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

    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL,
        blocked BOOLEAN NOT NULL DEFAULT false
      );
    `;

    const createProjectsTable = `
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        budget INT NOT NULL,
        deadline DATE NOT NULL,
        closed BOOLEAN NOT NULL DEFAULT false,
        "estimatedHours" INT
      );
    `;

    const createCompletedSessionsTable = `
      CREATE TABLE IF NOT EXISTS completed_sessions (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        employee_id VARCHAR(50) REFERENCES users(id),
        employee_name VARCHAR(100),
        project_id VARCHAR(50) REFERENCES projects(id),
        project_name VARCHAR(100),
        duration_minutes INT NOT NULL
      );
    `;
    
    const createActiveSessionsTable = `
      CREATE TABLE IF NOT EXISTS active_sessions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        start_time TIMESTAMPTZ NOT NULL
      );
    `;

    await client.query(createUsersTable);
    await client.query(createProjectsTable);
    await client.query(createCompletedSessionsTable);
    await client.query(createActiveSessionsTable);

    console.log('Tables created or already exist.');

    // Check if database is empty and needs seeding
    const res = await client.query('SELECT COUNT(*) FROM users');
    if (res.rows[0].count === '0') {
      console.log('Database is empty, seeding initial data...');
      await seedDatabase(client);
    } else {
      console.log('Database already contains data, skipping seed.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err.stack);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initializeDatabase };
