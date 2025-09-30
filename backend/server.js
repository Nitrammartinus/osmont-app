const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Helper function to get user cost centers
const getUserCostCenters = async (userId) => {
    const res = await pool.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
    return res.rows.map(row => row.center_id);
};

// Apply filter based on user role and cost centers
const applyPermissions = (query, user, tableAlias = '') => {
    if (!user || user.role === 'admin') {
        return { filteredQuery: query, params: [] };
    }

    const alias = tableAlias ? `${tableAlias}.` : '';
    let params = [];
    let filteredQuery = query;

    if (user.role === 'manager' || user.role === 'employee') {
        if (query.includes('WHERE')) {
            filteredQuery += ` AND ${alias}cost_center_id = ANY($${params.length + 1})`;
        } else {
            filteredQuery += ` WHERE ${alias}cost_center_id = ANY($${params.length + 1})`;
        }
        params.push(user.costCenters);
    }
    
    return { filteredQuery, params };
};

// --- AUTH ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user.blocked) {
                return res.status(403).json({ message: 'Používateľ je zablokovaný.' });
            }
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                // Fetch cost centers for the user
                user.costCenters = await getUserCostCenters(user.id);
                const { password, ...userWithoutPassword } = user;
                res.json(userWithoutPassword);
            } else {
                res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
            }
        } else {
            res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Chyba servera pri prihlasovaní.' });
    }
});

// --- INITIAL DATA ---
app.get('/api/initial-data', async (req, res) => {
     try {
        const usersRes = await pool.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const projectsRes = await pool.query('SELECT * FROM projects ORDER BY name');
        const costCentersRes = await pool.query('SELECT * FROM cost_centers ORDER BY name');
        
        // Fetch cost centers for each user
        const usersWithCostCenters = await Promise.all(usersRes.rows.map(async (user) => {
            user.costCenters = await getUserCostCenters(user.id);
            return user;
        }));

        res.json({
            users: usersWithCostCenters,
            projects: projectsRes.rows,
            costCenters: costCentersRes.rows,
        });
    } catch (err) {
        console.error('Error fetching initial data:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní počiatočných dát.' });
    }
});


// --- USERS ---
app.post('/api/users', async (req, res) => {
    const { id, name, username, password, role, blocked, can_select_project_manually, costCenters } = req.body;
    if (!id || !name || !username || !password || !role) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRes = await client.query(
            'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, name, username, hashedPassword, role, blocked, can_select_project_manually]
        );
        
        // Handle cost centers
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }
        await client.query('COMMIT');

        const newUser = userRes.rows[0];
        newUser.costCenters = costCenters || [];
        const { password: _, ...userToReturn } = newUser;
        res.status(201).json(userToReturn);
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

        let query = 'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5';
        let values = [name, username, role, blocked, can_select_project_manually];
        
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += `, password = $${values.length + 1}`;
            values.push(hashedPassword);
        }
        
        query += ` WHERE id = $${values.length + 1} RETURNING *`;
        values.push(id);
        
        const userRes = await client.query(query, values);

        // Update cost centers
        await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }
        
        await client.query('COMMIT');

        if (userRes.rows.length > 0) {
            const updatedUser = userRes.rows[0];
            updatedUser.costCenters = costCenters || [];
            const { password: _, ...userToReturn } = updatedUser;
            res.json(userToReturn);
        } else {
            res.status(404).json({ message: 'Používateľ nebol nájdený.' });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating user:', err);
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa.' });
    } finally {
        client.release();
    }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length > 0) {
            res.status(200).json({ message: 'User deleted successfully', id });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ message: 'Error deleting user' });
    }
});

// --- PROJECTS ---
app.post('/api/projects', async (req, res) => {
    const { id, name, budget, deadline, closed, estimated_hours, cost_center_id } = req.body;
     if (!id || !name || !deadline || cost_center_id === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, name, budget || 0, deadline, closed, estimated_hours, cost_center_id]
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
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (err) {
        console.error('Error updating project:', err);
        res.status(500).json({ message: 'Chyba pri aktualizácii projektu.' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length > 0) {
            res.status(200).json({ message: 'Project deleted successfully', id });
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (err) {
        console.error('Error deleting project:', err);
        res.status(500).json({ message: 'Error deleting project' });
    }
});

// --- ACTIVE SESSIONS ---
app.get('/api/active-sessions', async (req, res) => {
    try {
        // Join with users and projects to get names
        const result = await pool.query(`
            SELECT 
                s.id,
                s.user_id AS "userId",
                u.name AS "userName",
                s.project_id AS "projectId",
                p.name AS "projectName",
                s.start_time AS "startTime",
                p.cost_center_id AS "costCenterId"
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
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

// --- COMPLETED SESSIONS ---
app.get('/api/completed-sessions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching completed sessions:', err);
        res.status(500).json({ message: 'Chyba pri načítavaní ukončených relácií.' });
    }
});

app.post('/api/stop-session', async (req, res) => {
    const { userId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const activeSessionRes = await client.query(
            'DELETE FROM active_sessions WHERE user_id = $1 RETURNING *',
            [userId]
        );

        if (activeSessionRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Žiadna aktívna relácia pre tohto používateľa.' });
        }
        
        const session = activeSessionRes.rows[0];
        const user = await client.query('SELECT name FROM users WHERE id = $1', [session.user_id]);
        const project = await client.query('SELECT name FROM projects WHERE id = $1', [session.project_id]);

        const durationMinutes = Math.round((new Date() - new Date(session.start_time)) / 60000);
        const hours = Math.floor(durationMinutes / 60);
        const mins = durationMinutes % 60;
        const durationFormatted = `${hours}h ${mins}m`;

        const completedSessionRes = await client.query(
            `INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes, duration_formatted)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [session.start_time, session.user_id, user.rows[0].name, session.project_id, project.rows[0].name, durationMinutes, durationFormatted]
        );
        
        await client.query('COMMIT');
        res.status(201).json(completedSessionRes.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error stopping session:', err);
        res.status(500).json({ message: 'Chyba pri ukončovaní relácie.' });
    } finally {
        client.release();
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
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Stredisko nebolo nájdené.' });
        }
    } catch (err) {
        console.error('Error updating cost center:', err);
        res.status(500).json({ message: 'Chyba pri aktualizácii strediska.' });
    }
});

app.delete('/api/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cost_centers WHERE id = $1', [id]);
        res.status(200).json({ message: 'Stredisko úspešne vymazané.', id: Number(id) });
    } catch (err) {
        console.error('Error deleting cost center:', err);
        res.status(500).json({ message: 'Chyba pri mazaní strediska. Uistite sa, že nie je priradené k žiadnemu projektu.' });
    }
});


// Start server after DB initialization
const startServer = async () => {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`Server beží na porte ${PORT}`);
    });
};

startServer();
