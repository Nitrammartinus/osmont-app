const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, createTables } = require('./database');

const app = express();
const port = process.env.PORT || 3001;
const saltRounds = 10;

app.use(cors());
app.use(express.json());

// API Endpoints
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, username, role, blocked FROM users');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

app.post('/api/users', async (req, res) => {
    const { id, name, username, password, role, blocked } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Heslo je povinné' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await pool.query(
            'INSERT INTO users (id, name, username, password, role, blocked) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, username, role, blocked',
            [id, name, username, hashedPassword, role, blocked]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa vytvoriť používateľa' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, blocked } = req.body;

    try {
        const existingUserRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (existingUserRes.rows.length === 0) {
            return res.status(404).json({ error: 'Používateľ nebol nájdený' });
        }
        
        const existingUser = existingUserRes.rows[0];
        const updatedUser = {
            name: name !== undefined ? name : existingUser.name,
            username: username !== undefined ? username : existingUser.username,
            role: role !== undefined ? role : existingUser.role,
            blocked: blocked !== undefined ? blocked : existingUser.blocked,
        };

        if (password) {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const result = await pool.query(
                'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, password = $5 WHERE id = $6 RETURNING id, name, username, role, blocked',
                [updatedUser.name, updatedUser.username, updatedUser.role, updatedUser.blocked, hashedPassword, id]
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
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa aktualizovať používateľa' });
    }
});


app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa vymazať používateľa' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Neplatné prihlasovacie údaje' });
        }
        const user = result.rows[0];
        if (user.blocked) {
            return res.status(403).json({ error: 'Používateľ je zablokovaný' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const { password, ...userWithoutPassword } = user;
            res.json({ user: userWithoutPassword });
        } else {
            res.status(401).json({ error: 'Neplatné prihlasovacie údaje' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});


// Projects
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Interná chyba servera' });
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
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa vytvoriť projekt' });
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
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa aktualizovať projekt' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa vymazať projekt' });
    }
});


// Sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM completed_sessions');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Interná chyba servera' });
    }
});

app.post('/api/sessions', async (req, res) => {
    const { timestamp, employee_id, employee_name, project_id, project_name, duration_minutes } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [timestamp, employee_id, employee_name, project_id, project_name, duration_minutes]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Nepodarilo sa uložiť reláciu' });
    }
});


// Start server
const startServer = async () => {
    await createTables();
    app.listen(port, () => {
        console.log(`Server beží na porte ${port}`);
    });
};

startServer();
