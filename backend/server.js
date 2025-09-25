import express from 'express';
import cors from 'cors';
import { initializeDb } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

let dbPool;

// --- API Endpoints ---

// USERS
app.get('/api/users', async (req, res) => {
    const { rows } = await dbPool.query('SELECT id, name, username, role, blocked FROM users');
    res.json(rows);
});

app.post('/api/users', async (req, res) => {
    const { id, name, username, password, role } = req.body;
    // WARNING: Storing passwords in plaintext is a major security risk. 
    // In a real application, you MUST hash and salt passwords using a library like bcrypt.
    try {
        const { rows } = await dbPool.query(
            'INSERT INTO users (id, name, username, password, role, blocked) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, name, username, password, role, false]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        res.status(400).json({ error: 'Username already exists or invalid data.' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, role, blocked, password } = req.body;
    
    // Dynamically build query for optional password update
    let queryText = 'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4';
    const params = [name, username, role, blocked, id];
    
    if (password) {
        queryText += ', password = $6 WHERE id = $5';
        params.splice(4, 0, password); // Insert password before id
    } else {
        queryText += ' WHERE id = $5';
    }

    try {
        const result = await dbPool.query(queryText, params);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Username already exists or invalid data.' });
    }
});


app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const result = await dbPool.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).send();
});

// LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { rows } = await dbPool.query('SELECT id, name, username, role, blocked FROM users WHERE username = $1 AND password = $2', [username, password]);
    const user = rows[0];
    if (user && !user.blocked) {
        res.json(user);
    } else {
        res.status(401).json({ message: 'Invalid credentials or user is blocked' });
    }
});

// PROJECTS
app.get('/api/projects', async (req, res) => {
    const { rows } = await dbPool.query('SELECT id, name, budget, deadline, closed, "estimatedHours" FROM projects');
    res.json(rows);
});

app.post('/api/projects', async (req, res) => {
    const { id, name, budget, deadline, estimatedHours } = req.body;
    const { rows } = await dbPool.query(
        'INSERT INTO projects (id, name, budget, deadline, closed, "estimatedHours") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id, name, budget, deadline, false, estimatedHours]
    );
    res.status(201).json(rows[0]);
});

app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { name, budget, deadline, closed, estimatedHours } = req.body;
    const result = await dbPool.query(
        'UPDATE projects SET name = $1, budget = $2, deadline = $3, closed = $4, "estimatedHours" = $5 WHERE id = $6',
        [name, budget, deadline, closed, estimatedHours, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project updated successfully' });
});

app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const result = await dbPool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.status(204).send();
});

// SESSIONS
app.get('/api/sessions', async (req, res) => {
    const { rows } = await dbPool.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
    res.json(rows);
});

app.post('/api/sessions', async (req, res) => {
    const { timestamp, employee_id, employee_name, project_id, project_name, duration_minutes, duration_formatted } = req.body;
    const { rows } = await dbPool.query(
        'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes, duration_formatted) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [timestamp, employee_id, employee_name, project_id, project_name, duration_minutes, duration_formatted]
    );
    res.status(201).json(rows[0]);
});

// Start server
(async () => {
    try {
        dbPool = await initializeDb();
        console.log("Database initialized successfully.");
        app.listen(PORT, () => {
            console.log(`Backend server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
})();
