import pg from 'pg';
import { INITIAL_USERS, INITIAL_PROJECTS } from './initialData.js';

const { Pool } = pg;

// The pool will use the DATABASE_URL environment variable
// on Render, or you can define it locally in a .env file.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Add SSL for production connections if required by your provider (Render does)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initializeDb() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                blocked BOOLEAN NOT NULL DEFAULT false
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                budget NUMERIC NOT NULL,
                deadline DATE NOT NULL,
                closed BOOLEAN NOT NULL DEFAULT false,
                "estimatedHours" NUMERIC
            );

            CREATE TABLE IF NOT EXISTS completed_sessions (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ NOT NULL,
                employee_id TEXT NOT NULL,
                employee_name TEXT NOT NULL,
                project_id TEXT NOT NULL,
                project_name TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                duration_formatted TEXT NOT NULL,
                FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
        `);

        // Seed initial data if tables are empty
        const userCountRes = await client.query('SELECT COUNT(*) as count FROM users');
        if (userCountRes.rows[0].count === '0') {
            console.log('Seeding initial users...');
            for (const user of INITIAL_USERS) {
                await client.query(
                    'INSERT INTO users (id, name, username, password, role, blocked) VALUES ($1, $2, $3, $4, $5, $6)',
                    [user.id, user.name, user.username, user.password, user.role, user.blocked]
                );
            }
        }
        
        const projectCountRes = await client.query('SELECT COUNT(*) as count FROM projects');
        if (projectCountRes.rows[0].count === '0') {
            console.log('Seeding initial projects...');
            for (const project of INITIAL_PROJECTS) {
                await client.query(
                    'INSERT INTO projects (id, name, budget, deadline, closed, "estimatedHours") VALUES ($1, $2, $3, $4, $5, $6)',
                    [project.id, project.name, project.budget, project.deadline, project.closed, project.estimatedHours]
                );
            }
        }
    } finally {
        client.release();
    }
    
    return pool;
}
