const { Pool } = require('pg');
const { initialUsers, initialProjects, initialCostCenters, initialUserCostCenters } = require('./initialData');
const bcrypt = require('bcrypt');

let pool;

const getDb = () => {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set!");
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

const createTables = async () => {
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                blocked BOOLEAN NOT NULL,
                can_select_project_manually BOOLEAN DEFAULT FALSE NOT NULL
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS cost_centers (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                budget INTEGER NOT NULL,
                deadline DATE NOT NULL,
                closed BOOLEAN NOT NULL,
                estimated_hours INTEGER,
                cost_center_id INTEGER REFERENCES cost_centers(id)
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_cost_centers (
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                center_id INTEGER REFERENCES cost_centers(id) ON DELETE CASCADE,
                PRIMARY KEY (user_id, center_id)
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS active_sessions (
                id SERIAL PRIMARY KEY,
                user_id TEXT REFERENCES users(id),
                project_id TEXT REFERENCES projects(id),
                start_time TIMESTAMPTZ NOT NULL
            );
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS completed_sessions (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMPTZ NOT NULL,
                employee_id TEXT REFERENCES users(id),
                employee_name TEXT NOT NULL,
                project_id TEXT REFERENCES projects(id),
                project_name TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL
            );
        `);

        console.log("Tables created or already exist.");
    } catch (err) {
        console.error("Error creating tables", err.stack);
    } finally {
        client.release();
    }
};

const seedDatabase = async () => {
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query("SELECT COUNT(*) FROM users");
        if (res.rows[0].count > 0) {
            console.log("Database already contains data, skipping seed.");
            return;
        }

        console.log("Database is empty, seeding initial data...");

        // Seed users
        for (const user of initialUsers) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            await client.query(
                "INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [user.id, user.name, user.username, hashedPassword, user.role, user.blocked, user.can_select_project_manually]
            );
        }
        console.log("Users seeded successfully.");
        
        // Seed cost centers
        for (const center of initialCostCenters) {
             await client.query(
                "INSERT INTO cost_centers (id, name) VALUES ($1, $2)",
                [center.id, center.name]
            );
        }
        console.log("Cost Centers seeded successfully.");

        // Seed projects
        for (const project of initialProjects) {
            await client.query(
                "INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [project.id, project.name, project.budget, project.deadline, project.closed, project.estimated_hours, project.cost_center_id]
            );
        }
        console.log("Projects seeded successfully.");
        
        // Seed user-cost-center associations
        for (const assoc of initialUserCostCenters) {
            await client.query(
                "INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)",
                [assoc.user_id, assoc.center_id]
            );
        }
        console.log("User-Cost-Center associations seeded successfully.");


        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error seeding database", err.stack);
    } finally {
        client.release();
    }
};

const initDb = async () => {
    await createTables();
    await seedDatabase();
};

module.exports = { getDb, initDb };
