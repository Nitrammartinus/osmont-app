const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper function to get user cost centers
const getUserCostCenters = async (client, userId) => {
    const res = await client.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.center_id);
};

// --- AUTH ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const client = await pool.connect();
    try {
        const userRes = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
        const user = userRes.rows[0];
        if (user.blocked) {
            return res.status(403).json({ message: 'Používateľ je zablokovaný.' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const costCenters = await getUserCostCenters(client, user.id);
            const { password, ...userToReturn } = user;
            res.json({ ...userToReturn, costCenters });
        } else {
            res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Chyba servera pri prihlasovaní.' });
    } finally {
        client.release();
    }
});

// --- INITIAL DATA ---
app.get('/api/initial-data', async (req, res) => {
    const client = await pool.connect();
    try {
        const usersRes = await client.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const projectsRes = await client.query('SELECT * FROM projects ORDER BY name');
        const costCentersRes = await client.query('SELECT * FROM cost_centers ORDER BY name');
        const userCostCentersRes = await client.query('SELECT * FROM user_cost_centers');
        
        const usersWithCostCenters = usersRes.rows.map(user => {
            const centers = userCostCentersRes.rows
                .filter(ucc => ucc.user_id === user.id)
                .map(ucc => ucc.center_id);
            return { ...user, costCenters: centers };
        });

        res.json({
            users: usersWithCostCenters,
            projects: projectsRes.rows,
            costCenters: costCentersRes.rows,
        });
    } catch (err) {
        console.error('Error fetching initial data:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní počiatočných dát.' });
    } finally {
        client.release();
    }
});


// --- SESSIONS ---
app.get('/api/active-sessions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.user_id AS "userId", u.name AS "userName", s.project_id AS "projectId", p.name AS "projectName", s.start_time AS "startTime", p.cost_center_id AS "costCenterId"
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
            ORDER BY s.start_time DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching active sessions:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní aktívnych relácií.' });
    }
});

app.post('/api/active-sessions', async (req, res) => {
    const { userId, projectId } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO active_sessions (user_id, project_id, start_time) VALUES ($1, $2, NOW()) RETURNING *',
            [userId, projectId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error starting session:', err);
        res.status(500).json({ message: 'Chyba pri spúšťaní relácie.' });
    }
});

app.post('/api/stop-session', async (req, res) => {
    const { userId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const activeSessionRes = await client.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        if (activeSessionRes.rows.length === 0) {
            return res.status(404).json({ message: 'Nenašla sa žiadna aktívna relácia pre tohto používateľa.' });
        }
        const activeSession = activeSessionRes.rows[0];

        const userRes = await client.query('SELECT name FROM users WHERE id = $1', [activeSession.user_id]);
        const projectRes = await client.query('SELECT name FROM projects WHERE id = $1', [activeSession.project_id]);
        const userName = userRes.rows[0].name;
        const projectName = projectRes.rows[0].name;

        const durationMinutes = Math.round((new Date() - new Date(activeSession.start_time)) / 60000);

        await client.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [activeSession.start_time, activeSession.user_id, userName, activeSession.project_id, projectName, durationMinutes]
        );

        await client.query('DELETE FROM active_sessions WHERE id = $1', [activeSession.id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Relácia bola úspešne ukončená.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error stopping session:', err);
        res.status(500).json({ message: 'Chyba pri ukončovaní relácie.' });
    } finally {
        client.release();
    }
});

app.get('/api/completed-sessions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching completed sessions:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní ukončených relácií.' });
    }
});

// --- USERS ---
app.post('/api/users', async (req, res) => {
    const { name, username, password, role, blocked, can_select_project_manually, costCenters } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ message: 'Meno, používateľské meno a heslo sú povinné.' });
    }
    const client = await pool.connect();
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query('BEGIN');
        const userRes = await client.query(
            'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [`user${Date.now()}`, name, username, hashedPassword, role, !!blocked, !!can_select_project_manually]
        );
        const newUserId = userRes.rows[0].id;

        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [newUserId, centerId]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ id: newUserId, name, username, role, blocked, can_select_project_manually, costCenters });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding user:', err);
        res.status(500).json({ message: 'Chyba pri pridávaní používateľa.' });
    } finally {
        client.release();
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, blocked, can_select_project_manually, costCenters } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const fields = [];
        const values = [];
        let queryIndex = 1;

        if (name) { fields.push(`name = $${queryIndex++}`); values.push(name); }
        if (username) { fields.push(`username = $${queryIndex++}`); values.push(username); }
        if (role) { fields.push(`role = $${queryIndex++}`); values.push(role); }
        if (blocked !== undefined) { fields.push(`blocked = $${queryIndex++}`); values.push(blocked); }
        if (can_select_project_manually !== undefined) { fields.push(`can_select_project_manually = $${queryIndex++}`); values.push(can_select_project_manually); }
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            fields.push(`password = $${queryIndex++}`);
            values.push(hashedPassword);
        }

        if (fields.length > 0) {
            values.push(id);
            const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${queryIndex}`;
            await client.query(query, values);
        }

        // Update cost centers
        await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Používateľ bol úspešne aktualizovaný.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error updating user ${id}:`, err);
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa.' });
    } finally {
        client.release();
    }
});


app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`Error deleting user ${id}:`, err);
        res.status(500).json({ message: 'Chyba pri mazaní používateľa.' });
    }
});


// --- PROJECTS ---
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM projects ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching projects:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní projektov.' });
    }
});

app.post('/api/projects', async (req, res) => {
    const { name, budget, deadline, estimated_hours, cost_center_id } = req.body;
    if (!name || !deadline || !cost_center_id) {
        return res.status(400).json({ message: 'Názov, deadline a stredisko sú povinné.' });
    }
    try {
        const newId = `proj${Date.now()}`;
        const result = await pool.query(
            'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, false, $5, $6) RETURNING *',
            [newId, name, budget, deadline, estimated_hours, cost_center_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding project:', err);
        res.status(500).json({ message: 'Chyba pri pridávaní projektu.' });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { name, budget, deadline, closed, estimated_hours, cost_center_id } = req.body;
    try {
        const result = await pool.query(
            'UPDATE projects SET name = $1, budget = $2, deadline = $3, closed = $4, estimated_hours = $5, cost_center_id = $6 WHERE id = $7 RETURNING *',
            [name, budget, deadline, closed, estimated_hours, cost_center_id, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error updating project ${id}:`, err);
        res.status(500).json({ message: 'Chyba pri aktualizácii projektu.' });
    }
});


app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`Error deleting project ${id}:`, err);
        res.status(500).json({ message: 'Chyba pri mazaní projektu.' });
    }
});


// --- COST CENTERS ---
app.get('/api/cost-centers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cost_centers ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching cost centers:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní stredísk.' });
    }
});

app.post('/api/cost-centers', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO cost_centers (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding cost center:', err);
        res.status(500).json({ message: 'Chyba pri pridávaní strediska.' });
    }
});

app.put('/api/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE cost_centers SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(`Error updating cost center ${id}:`, err);
        res.status(500).json({ message: 'Chyba pri aktualizácii strediska.' });
    }
});

app.delete('/api/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // You might want to add checks here to ensure a cost center isn't deleted if it's in use
        await pool.query('DELETE FROM cost_centers WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) {
        console.error(`Error deleting cost center ${id}:`, err);
        res.status(500).json({ message: 'Chyba pri mazaní strediska.' });
    }
});

// --- START SERVER ---
const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(port, () => {
            console.log(`Server beží na porte ${port}`);
        });
    } catch (err) {
        console.error('Failed to initialize database and start server:', err);
        process.exit(1);
    }
};

startServer();
