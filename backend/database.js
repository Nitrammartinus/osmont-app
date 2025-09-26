const { Pool } = require('pg');
const { seedDatabase } = require('./initialData');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        blocked BOOLEAN NOT NULL DEFAULT false
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        budget INT NOT NULL,
        deadline DATE NOT NULL,
        closed BOOLEAN NOT NULL DEFAULT false,
        "estimatedHours" INT
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS completed_sessions (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        employee_id VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        project_id VARCHAR(255) NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        duration_minutes INT NOT NULL
      );
    `);

    console.log("Tables created or already exist.");

    // Check if seeding is needed
    const res = await client.query('SELECT COUNT(*) FROM users');
    if (res.rows[0].count === '0') {
      console.log('Database is empty, seeding initial data...');
      await seedDatabase(client);
    } else {
      console.log('Database already contains data, skipping seed.');
    }

  } catch (err) {
    console.error('Error creating tables', err.stack);
  } finally {
    client.release();
  }
};

module.exports = { pool, createTables };
