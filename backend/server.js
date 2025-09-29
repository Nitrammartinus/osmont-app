const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { getDb, initDb } = require('./database');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const apiRouter = express.Router();

// Helper to get user cost centers
const getUserCostCenters = async (userId) => {
    const db = getDb();
    const result = await db.query(
        `SELECT cc.id, cc.name FROM cost_centers cc
         JOIN user_cost_centers ucc ON cc.id = ucc.center_id
         WHERE ucc.user_id = $1`,
        [userId]
    );
    return result.rows;
};

// Middleware to get user from request body (for filtering)
const getUserFromRequest = async (req) => {
    // In a real app, you would get this from a JWT token
    // For simplicity, we'll pass it in the body for GET requests with filtering
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    if (!userId || !userRole) return null;

    const user = { id: userId, role: userRole, costCenters: [] };
    if (user.role !== 'admin') {
         user.costCenters = await getUserCostCenters(userId);
    }
    return user;
};


// LOGIN
apiRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
        const user = result.rows[0];
        if (user.blocked) {
            return res.status(403).json({ message: 'Používateľ je zablokovaný.' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
        
        // CRITICAL FIX: Fetch and attach cost centers to the user object on login
        const costCenters = await getUserCostCenters(user.id);
        const { password: _, ...userWithoutPassword } = user;

        res.json({ ...userWithoutPassword, costCenters });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: 'Chyba servera pri prihlasovaní.', error: err.message });
    }
});


// USERS
apiRouter.get('/users', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query("SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name");
        const users = result.rows;
        // For each user, get their cost centers
        for (const user of users) {
            user.costCenters = await getUserCostCenters(user.id);
        }
        res.json(users);
    } catch (err) {
        console.error("Get users error:", err);
        res.status(500).json({ message: 'Chyba pri načítavaní používateľov.', error: err.message });
    }
});

apiRouter.post('/users', async (req, res) => {
    const { name, username, password, role, can_select_project_manually } = req.body;
    if (!name || !username || !password || !role) {
        return res.status(400).json({ message: 'Chýbajú povinné údaje.' });
    }
    const db = getDb();
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.query(
            "INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, username, role, blocked, can_select_project_manually",
            [`user${Date.now()}`, name, username, hashedPassword, role, false, can_select_project_manually || false]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (err) {
        console.error("Add user error:", err);
        res.status(500).json({ message: 'Chyba pri pridávaní používateľa.', error: err.message });
    }
});

apiRouter.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, role, blocked, can_select_project_manually, costCenters, password } = req.body;
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        let updatedUser;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updatedUser = await client.query(
                "UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5, password = $6 WHERE id = $7 RETURNING id, name, username, role, blocked, can_select_project_manually",
                [name, username, role, blocked, can_select_project_manually, hashedPassword, id]
            );
        } else {
             updatedUser = await client.query(
                "UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5 WHERE id = $6 RETURNING id, name, username, role, blocked, can_select_project_manually",
                [name, username, role, blocked, can_select_project_manually, id]
            );
        }

        // Update cost centers
        await client.query("DELETE FROM user_cost_centers WHERE user_id = $1", [id]);
        if (costCenters && costCenters.length > 0) {
            for (const center of costCenters) {
                await client.query(
                    "INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)",
                    [id, center.id]
                );
            }
        }
        
        await client.query('COMMIT');
        
        const finalUser = updatedUser.rows[0];
        finalUser.costCenters = await getUserCostCenters(id); // Get updated centers
        res.json(finalUser);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Update user error:", err);
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa.', error: err.message });
    } finally {
        client.release();
    }
});

apiRouter.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDb();
    try {
        await db.query("DELETE FROM users WHERE id = $1", [id]);
        res.status(204).send();
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({ message: 'Chyba pri mazaní používateľa.', error: err.message });
    }
});

apiRouter.put('/users/:id/toggle-block', async (req, res) => {
    const { id } = req.params;
    const db = getDb();
    try {
        const result = await db.query("UPDATE users SET blocked = NOT blocked WHERE id = $1 RETURNING *", [id]);
        res.json(result.rows[0]);
    } catch (err) {
         console.error("Toggle block error:", err);
        res.status(500).json({ message: 'Chyba pri zmene stavu blokovania.', error: err.message });
    }
});


// PROJECTS
apiRouter.get('/projects', async (req, res) => {
    const db = getDb();
    const user = await getUserFromRequest(req);
    try {
        let query;
        let params = [];
        if (user && user.role === 'admin') {
            query = `SELECT p.*, cc.name as cost_center_name FROM projects p JOIN cost_centers cc ON p.cost_center_id = cc.id ORDER BY p.name`;
        } else if (user && user.costCenters.length > 0) {
            const centerIds = user.costCenters.map(c => c.id);
            query = `SELECT p.*, cc.name as cost_center_name FROM projects p JOIN cost_centers cc ON p.cost_center_id = cc.id WHERE p.cost_center_id = ANY($1) ORDER BY p.name`;
            params = [centerIds];
        } else {
            // No user or user with no cost centers sees no projects
            return res.json([]);
        }

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Get projects error:", err);
        res.status(500).json({ message: 'Chyba pri načítavaní projektov.', error: err.message });
    }
});

// ... other project routes

// SESSIONS (ACTIVE)
apiRouter.get('/sessions/active', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query(`
            SELECT 
                s.id, s.user_id, s.project_id, s.start_time,
                u.name as "userName",
                p.name as "projectName",
                cc.name as "cost_center_name"
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
            JOIN cost_centers cc ON p.cost_center_id = cc.id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Get active sessions error:", err);
        res.status(500).json({ message: 'Chyba pri načítavaní aktívnych relácií.', error: err.message });
    }
});

apiRouter.post('/sessions/start', async (req, res) => {
    const { userId, projectId } = req.body;
    const db = getDb();
    try {
        const newSession = await db.query(
            "INSERT INTO active_sessions (user_id, project_id, start_time) VALUES ($1, $2, NOW()) RETURNING *",
            [userId, projectId]
        );
        res.status(201).json(newSession.rows[0]);
    } catch (err) {
        console.error("Start session error:", err);
        res.status(500).json({ message: 'Chyba pri spúšťaní relácie.', error: err.message });
    }
});

apiRouter.post('/sessions/stop', async (req, res) => {
    const { userId } = req.body;
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const activeSessionRes = await client.query(
            `SELECT s.*, u.name as user_name, p.name as project_name 
            FROM active_sessions s
            JOIN users u on u.id = s.user_id
            JOIN projects p on p.id = s.project_id
            WHERE s.user_id = $1`, [userId]);
        
        if (activeSessionRes.rows.length === 0) {
            return res.status(404).json({ message: "Nenašla sa žiadna aktívna relácia pre tohto používateľa." });
        }
        const session = activeSessionRes.rows[0];

        await client.query("DELETE FROM active_sessions WHERE id = $1", [session.id]);

        const durationMinutes = Math.round((new Date() - new Date(session.start_time)) / 60000);
        
        const completedSession = await client.query(
            `INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [session.start_time, session.user_id, session.user_name, session.project_id, session.project_name, durationMinutes]
        );
        
        await client.query('COMMIT');
        res.status(201).json(completedSession.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Stop session error:", err);
        res.status(500).json({ message: 'Chyba pri zastavovaní relácie.', error: err.message });
    } finally {
        client.release();
    }
});

// SESSIONS (COMPLETED)
apiRouter.get('/sessions/completed', async (req, res) => {
    const db = getDb();
    const user = await getUserFromRequest(req);
     try {
        let query;
        let params = [];
        if (user && user.role === 'admin') {
            query = `SELECT * FROM completed_sessions ORDER BY timestamp DESC`;
        } else if (user && user.costCenters.length > 0) {
            const centerIds = user.costCenters.map(c => c.id);
            query = `SELECT cs.* FROM completed_sessions cs JOIN projects p ON cs.project_id = p.id WHERE p.cost_center_id = ANY($1) ORDER BY cs.timestamp DESC`;
            params = [centerIds];
        } else {
            return res.json([]);
        }

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error("Get completed sessions error:", err);
        res.status(500).json({ message: 'Chyba pri načítavaní ukončených relácií.', error: err.message });
    }
});

// COST CENTERS
apiRouter.get('/cost-centers', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query("SELECT * FROM cost_centers ORDER BY name");
        res.json(result.rows);
    } catch (err) {
        console.error("Get cost centers error:", err);
        res.status(500).json({ message: 'Chyba pri načítavaní stredísk.', error: err.message });
    }
});

// Add the rest of the CRUD operations for projects and cost centers...
// Omitted for brevity but assume they exist and are similar to the users routes

const startServer = async () => {
    try {
        await initDb();
        app.use('/api', apiRouter);
        app.listen(port, () => {
            console.log(`Server beží na porte ${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();
