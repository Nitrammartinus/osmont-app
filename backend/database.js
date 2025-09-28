const { Pool } = require('pg');
const { seedInitialData } = require('./initialData');

let pool;

const getDb = () => {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set!');
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
    return pool;
};

const initializeDatabase = async () => {
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                blocked BOOLEAN NOT NULL DEFAULT false,
                can_select_project_manually BOOLEAN NOT NULL DEFAULT false
            );
        `;

        const createProjectsTable = `
            CREATE TABLE IF NOT EXISTS projects (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                budget NUMERIC NOT NULL,
                deadline DATE NOT NULL,
                closed BOOLEAN NOT NULL DEFAULT false,
                estimated_hours NUMERIC,
                cost_center_id VARCHAR(255)
            );
        `;
        
        const createCompletedSessionsTable = `
            CREATE TABLE IF NOT EXISTS completed_sessions (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ NOT NULL,
                employee_id VARCHAR(255) NOT NULL,
                employee_name VARCHAR(255) NOT NULL,
                project_id VARCHAR(255) NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                duration_minutes INTEGER NOT NULL
            );
        `;

        const createActiveSessionsTable = `
             CREATE TABLE IF NOT EXISTS active_sessions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) UNIQUE NOT NULL,
                user_name VARCHAR(255) NOT NULL,
                project_id VARCHAR(255) NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                start_time TIMESTAMPTZ NOT NULL,
                cost_center_id VARCHAR(255)
            );
        `;
        
        const createCostCentersTable = `
            CREATE TABLE IF NOT EXISTS cost_centers (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            );
        `;

        const createUserCostCentersTable = `
            CREATE TABLE IF NOT EXISTS user_cost_centers (
                user_id VARCHAR(255) NOT NULL,
                center_id VARCHAR(255) NOT NULL,
                PRIMARY KEY (user_id, center_id)
            );
        `;

        await client.query(createUsersTable);
        await client.query(createProjectsTable);
        await client.query(createCompletedSessionsTable);
        await client.query(createActiveSessionsTable);
        await client.query(createCostCentersTable);
        await client.query(createUserCostCentersTable);
        
        console.log('Tables created or already exist.');

        const res = await client.query("SELECT COUNT(*) FROM users;");
        if (res.rows[0].count === '0') {
            console.log('Database is empty, seeding initial data...');
            await seedInitialData(client);
        } else {
            console.log('Database already contains data, skipping seed.');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error initializing database', err);
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { getDb, initializeDatabase };
