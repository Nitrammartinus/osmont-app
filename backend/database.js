
const { Pool } = require('pg');
const { initialUsers, initialProjects, initialCostCenters, initialUserCostCenters } = require('./initialData');

// Enhanced configuration for connecting to Neon/Vercel Postgres from a serverless environment
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Neon requires SSL. The connection string should include ?sslmode=require
    // Adding this is a robust way to ensure SSL is enabled, even if the string is incomplete.
    ssl: {
        rejectUnauthorized: false,
    },
    // Recommended pool settings for serverless environments to avoid connection exhaustion
    max: 1, // Only one active connection per function instance
    idleTimeoutMillis: 20000, // Close idle clients after 20 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});


let initializationPromise = null;

const initializeDatabase = () => {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        console.log('Attempting to initialize database...');
        const client = await pool.connect();
        console.log('Database client connected.');
        try {
            await client.query('BEGIN');
            console.log('Transaction started.');

            // Create all tables if they don't exist
            console.log('Creating tables...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    blocked BOOLEAN NOT NULL DEFAULT false,
                    can_select_project_manually BOOLEAN NOT NULL DEFAULT false
                );
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS cost_centers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL
                );
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS projects (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    budget NUMERIC,
                    deadline DATE,
                    closed BOOLEAN NOT NULL DEFAULT false,
                    estimated_hours NUMERIC,
                    cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL
                );
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_cost_centers (
                    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                    center_id INTEGER REFERENCES cost_centers(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, center_id)
                );
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS active_sessions (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE CASCADE,
                    start_time TIMESTAMPTZ NOT NULL
                );
            `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS completed_sessions (
                    id SERIAL PRIMARY KEY,
                    timestamp TIMESTAMPTZ NOT NULL,
                    employee_id VARCHAR(255),
                    employee_name VARCHAR(255),
                    project_id VARCHAR(255),
                    project_name VARCHAR(255),
                    duration_minutes INTEGER
                );
            `);
             await client.query(`
                CREATE TABLE IF NOT EXISTS app_metadata (
                    key VARCHAR(50) PRIMARY KEY,
                    value VARCHAR(50)
                );
             `);
            console.log('Tables created or already exist.');

            // Check if database has been seeded
            const metadataRes = await client.query("SELECT value FROM app_metadata WHERE key = 'is_seeded'");
            if (metadataRes.rows.length === 0) {
                console.log('Database is not seeded. Seeding initial data...');

                // Seed data
                console.log('Seeding cost centers...');
                for (const center of initialCostCenters) {
                    await client.query('INSERT INTO cost_centers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [center.name]);
                }
                
                console.log('Seeding users...');
                for (const user of initialUsers) {
                    await client.query(
                        'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
                        [user.id, user.name, user.username, user.password, user.role, user.blocked, user.can_select_project_manually]
                    );
                }
                
                console.log('Seeding projects...');
                for (const project of initialProjects) {
                     await client.query(
                        'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
                        [project.id, project.name, project.budget, project.deadline, project.closed, project.estimated_hours, project.cost_center_id]
                    );
                }
                
                console.log('Seeding user-cost center links...');
                for (const ucc of initialUserCostCenters) {
                    await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2) ON CONFLICT (user_id, center_id) DO NOTHING', [ucc.user_id, ucc.center_id]);
                }
                
                // Mark database as seeded
                await client.query("INSERT INTO app_metadata (key, value) VALUES ('is_seeded', 'true') ON CONFLICT (key) DO NOTHING");
                console.log('Database seeded successfully.');
            } else {
                 console.log('Database already seeded, skipping.');
            }

            await client.query('COMMIT');
            console.log('Transaction committed successfully. Database is ready.');
        } catch (err) {
            console.log('An error occurred during initialization, rolling back transaction.');
            await client.query('ROLLBACK');
            
            console.error('##################################################');
            console.error('FATAL: DATABASE INITIALIZATION FAILED');
            console.error('##################################################');
            console.error('Error during database initialization:', err);
            console.error('Error Name:', err.name);
            console.error('Error Code:', err.code);
            console.error('Error Message:', err.message);
            console.error('Stack Trace:', err.stack);
            console.error('##################################################');

            initializationPromise = null; // Reset on failure to allow retry
            throw err;
        } finally {
            client.release();
            console.log('Database client released.');
        }
    })();

    return initializationPromise;
};

module.exports = { pool, initializeDatabase };	