const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// API Endpoints
// --- USERS ---
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, username, role, blocked FROM users ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/users', async (req, res) => {
    const { id, name, username, password, role } = req.body;
    if (!name || !username || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (id, name, username, password, role, blocked) VALUES ($1, $2, $3, $4, $5, false) RETURNING id, name, username, role, blocked',
            [id, name, username, hashedPassword, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, blocked } = req.body;
    try {
        // Fetch current user data first to handle partial updates
        const existingUserRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (existingUserRes.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const existingUser = existingUserRes.rows[0];

        // Merge new data
        const updatedUser = {
            name: name !== undefined ? name : existingUser.name,
            username: username !== undefined ? username : existingUser.username,
            role: role !== undefined ? role : existingUser.role,
            blocked: blocked !== undefined ? blocked : existingUser.blocked,
        };

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await pool.query(
                'UPDATE users SET name = $1, username = $2, password = $3, role = $4, blocked = $5 WHERE id = $6 RETURNING id, name, username, role, blocked',
                [updatedUser.name, updatedUser.username, hashedPassword, updatedUser.role, updatedUser.blocked, id]
            );
            res.json(result.rows[0]);
        } else {
            const result = await pool.query(
                'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4 WHERE id = $5 RETURNING id, name, username, role, blocked',
                [updatedUser.name, updatedUser.username, updatedUser.role, updatedUser.blocked, id]
            );
            res.json(result.rows[0]);
        }
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = result.rows[0];
        if (user.blocked) {
            return res.status(403).json({ error: 'User is blocked' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// --- PROJECTS ---
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/projects', async (req, res) => {
    const { id, name, budget, deadline, closed, estimatedHours } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO projects (id, name, budget, deadline, closed, "estimatedHours") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, name, budget, deadline, closed, estimatedHours]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { name, budget, deadline, closed, estimatedHours } = req.body;
    try {
        const result = await pool.query(
            'UPDATE projects SET name = $1, budget = $2, deadline = $3, closed = $4, "estimatedHours" = $5 WHERE id = $6 RETURNING *',
            [name, budget, deadline, closed, estimatedHours, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});


// --- SESSIONS ---
app.get('/api/sessions/completed', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// --- ACTIVE SESSIONS ---
app.get('/api/active-sessions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                a.id, 
                a.user_id AS "userId",
                u.name AS "userName",
                a.project_id AS "projectId",
                p.name AS "projectName",
                a.start_time AS "startTime"
            FROM active_sessions a
            JOIN users u ON a.user_id = u.id
            JOIN projects p ON a.project_id = p.id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error fetching active sessions' });
    }
});

app.post('/api/active-sessions', async (req, res) => {
    const { userId, projectId } = req.body;
    if (!userId || !projectId) {
        return res.status(400).json({ error: 'User ID and Project ID are required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO active_sessions (user_id, project_id, start_time) VALUES ($1, $2, NOW()) RETURNING *',
            [userId, projectId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
         if (err.code === '23505') { // unique_violation on user_id
            return res.status(409).json({ error: 'User already has an active session.' });
        }
        res.status(500).json({ error: 'Database error starting session' });
    }
});

// Stop session: Deletes active session and creates a completed session
app.delete('/api/active-sessions/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find the active session for the user
        const activeSessionRes = await client.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        if (activeSessionRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'No active session found for this user' });
        }
        const activeSession = activeSessionRes.rows[0];

        // Get user and project names
        const userRes = await client.query('SELECT name FROM users WHERE id = $1', [activeSession.user_id]);
        const projectRes = await client.query('SELECT name FROM projects WHERE id = $1', [activeSession.project_id]);
        const userName = userRes.rows[0].name;
        const projectName = projectRes.rows[0].name;

        // Calculate duration
        const startTime = new Date(activeSession.start_time);
        const durationMinutes = Math.round((Date.now() - startTime.getTime()) / 60000);
        
        // Create completed session
        await client.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [startTime, activeSession.user_id, userName, activeSession.project_id, projectName, durationMinutes]
        );
        
        // Delete active session
        await client.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);

        await client.query('COMMIT');
        res.status(204).send();

    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Database transaction failed' });
    } finally {
        client.release();
    }
});


const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(port, () => {
            console.log(`Server beží na porte ${port}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
