const { Pool } = require('pg');
const { initialUsers, initialProjects, initialCostCenters, initialUserCostCenters } = require('./initialData');

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

        // Vytvorenie tabuliek, ak neexistujú
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

        console.log('Tables created or already exist.');

        // Naplnenie dátami, ak je databáza prázdna
        const res = await client.query('SELECT COUNT(*) FROM users');
        if (res.rows[0].count === '0') {
            console.log('Database is empty, seeding initial data...');

            // Vloženie stredísk a mapovanie nových ID
            const centerIdMap = {}; // { oldId: newId }
            for (const center of initialCostCenters) {
                const insertRes = await client.query('INSERT INTO cost_centers (name) VALUES ($1) RETURNING id', [center.name]);
                const newId = insertRes.rows[0].id;
                centerIdMap[center.id] = newId;
            }
            console.log('Cost centers seeded successfully.');

            // Vloženie používateľov
            for (const user of initialUsers) {
                await client.query(
                    'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [user.id, user.name, user.username, user.password, user.role, user.blocked, user.can_select_project_manually]
                );
            }
            console.log('Users seeded successfully.');
            
            // Vloženie projektov s použitím nových ID stredísk
            for (const project of initialProjects) {
                const newCostCenterId = centerIdMap[project.cost_center_id];
                 await client.query(
                    'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [project.id, project.name, project.budget, project.deadline, project.closed, project.estimated_hours, newCostCenterId]
                );
            }
            console.log('Projects seeded successfully.');

            // Vloženie prepojení používateľov a stredísk s použitím nových ID
            for (const ucc of initialUserCostCenters) {
                const newCenterId = centerIdMap[ucc.center_id];
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [ucc.user_id, newCenterId]);
            }
            console.log('User-cost center links seeded successfully.');
        } else {
             console.log('Database already contains data, skipping seed.');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during database initialization:', err);
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { pool, initializeDatabase };