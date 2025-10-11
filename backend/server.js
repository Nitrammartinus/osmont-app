const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Helper function to get user's cost centers
const getUserCostCenters = async (userId) => {
    const res = await pool.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
    return res.rows.map(row => row.center_id);
};

// --- AUTH ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (user && !user.blocked && (await bcrypt.compare(password, user.password))) {
            const costCenters = await getUserCostCenters(user.id);
            const { password, ...userWithoutPassword } = user;
            res.json({ ...userWithoutPassword, costCenters });
        } else {
            res.status(401).json({ message: 'Neplatné meno alebo heslo, alebo je používateľ zablokovaný.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba servera' });
    }
});

// --- INITIAL DATA ---
app.get('/api/initial-data', async (req, res) => {
     try {
        const usersRes = await pool.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const projectsRes = await pool.query('SELECT * FROM projects ORDER BY name');
        const costCentersRes = await pool.query('SELECT * FROM cost_centers ORDER BY name');
        const userCostCentersRes = await pool.query('SELECT * FROM user_cost_centers');
        const completedSessionsRes = await pool.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');

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
            completedSessions: completedSessionsRes.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Chyba pri načítavaní počiatočných dát" });
    }
});


// --- USERS ---
app.post('/api/users', async (req, res) => {
    const { name, username, role, password, can_select_project_manually, costCenters } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ message: 'Meno, používateľské meno a heslo sú povinné.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserRes = await client.query(
            'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [`user${Date.now()}`, name, username, hashedPassword, role, false, can_select_project_manually]
        );
        const newUser = newUserRes.rows[0];

        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [newUser.id, centerId]);
            }
        }
        
        await client.query('COMMIT');
        const { password: pw, ...userWithoutPassword } = newUser;
        res.status(201).json({ ...userWithoutPassword, costCenters });

    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ message: 'Používateľ s týmto menom už existuje.' });
        }
        console.error(err);
        res.status(500).json({ message: 'Chyba pri pridávaní používateľa' });
    } finally {
        client.release();
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, role, blocked, can_select_project_manually, password, costCenters } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let hashedPassword = null;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const currentUserRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        if (currentUserRes.rows.length === 0) {
            return res.status(404).json({ message: 'Používateľ nenájdený' });
        }
        
        const finalPassword = hashedPassword || currentUserRes.rows[0].password;

        const updatedUser = await client.query(
            'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5, password = $6 WHERE id = $7 RETURNING *',
            [name, username, role, blocked, can_select_project_manually, finalPassword, id]
        );
        
        await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }
        
        await client.query('COMMIT');
        const { password: pw, ...userWithoutPassword } = updatedUser.rows[0];
        res.json({ ...userWithoutPassword, costCenters });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa' });
    } finally {
        client.release();
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleteRes = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (deleteRes.rowCount === 0) {
            return res.status(404).json({ message: 'Používateľ nenájdený' });
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri mazaní používateľa' });
    }
});


// --- ACTIVE SESSIONS ---
app.get('/api/active-sessions', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.id, 
                s.user_id as "userId", 
                u.name as "userName", 
                s.project_id as "projectId",
                p.name as "projectName",
                p.cost_center_id as "costCenterId",
                s.start_time as "startTime"
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba servera' });
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
        console.error(err);
        res.status(500).json({ message: 'Chyba servera' });
    }
});

app.delete('/api/active-sessions/:userId', async (req, res) => {
    const { userId } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const activeSessionRes = await client.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        const activeSession = activeSessionRes.rows[0];
        if (!activeSession) {
            return res.status(404).json({ message: 'Aktívna relácia nenájdená' });
        }

        const userRes = await client.query('SELECT name FROM users WHERE id = $1', [activeSession.user_id]);
        const projectRes = await client.query('SELECT name FROM projects WHERE id = $1', [activeSession.project_id]);
        const userName = userRes.rows[0].name;
        const projectName = projectRes.rows[0].name;

        const durationMinutes = Math.round((new Date() - new Date(activeSession.start_time)) / 60000);

        await client.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [activeSession.start_time, activeSession.user_id, userName, activeSession.project_id, projectName, durationMinutes]
        );

        await client.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
        
        await client.query('COMMIT');
        res.status(204).send();

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Chyba pri ukončovaní relácie' });
    } finally {
        client.release();
    }
});

// --- COST CENTERS ---
app.get('/api/cost-centers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cost_centers ORDER BY name');
        res.json(result.rows);
    } catch(err) {
        res.status(500).json({ message: "Error fetching cost centers" });
    }
});
app.post('/api/cost-centers', async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query('INSERT INTO cost_centers (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch(err) {
        res.status(500).json({ message: "Error adding cost center" });
    }
});
app.put('/api/cost-centers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const result = await pool.query('UPDATE cost_centers SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        res.json(result.rows[0]);
    } catch(err) {
        res.status(500).json({ message: "Error updating cost center" });
    }
});
app.delete('/api/cost-centers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM cost_centers WHERE id = $1', [id]);
        res.status(204).send();
    } catch(err) {
        res.status(500).json({ message: "Error deleting cost center" });
    }
});


// --- PROJECTS ---
app.post('/api/projects', async (req, res) => {
    const { name, budget, deadline, estimated_hours, cost_center_id } = req.body;
    if (!name || !deadline || cost_center_id === undefined) {
        return res.status(400).json({ message: 'Názov, deadline a stredisko sú povinné.' });
    }
    try {
        const newProjectRes = await pool.query(
            'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [`proj${Date.now()}`, name, budget, deadline, false, estimated_hours, cost_center_id]
        );
        res.status(201).json(newProjectRes.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri pridávaní projektu' });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { name, budget, deadline, estimated_hours, cost_center_id } = req.body;
    if (!name || !deadline || cost_center_id === undefined) {
        return res.status(400).json({ message: 'Názov, deadline a stredisko sú povinné.' });
    }
    try {
        const updatedProjectRes = await pool.query(
            'UPDATE projects SET name = $1, budget = $2, deadline = $3, estimated_hours = $4, cost_center_id = $5 WHERE id = $6 RETURNING *',
            [name, budget, deadline, estimated_hours, cost_center_id, id]
        );
        if (updatedProjectRes.rows.length === 0) {
            return res.status(404).json({ message: 'Projekt nenájdený' });
        }
        res.json(updatedProjectRes.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri aktualizácii projektu' });
    }
});


app.put('/api/projects/:id/toggle-status', async (req, res) => {
    try {
        const { id } = req.params;
        const projectRes = await pool.query('SELECT closed FROM projects WHERE id = $1', [id]);
        if (projectRes.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
        }
        const newStatus = !projectRes.rows[0].closed;
        const result = await pool.query('UPDATE projects SET closed = $1 WHERE id = $2 RETURNING *', [newStatus, id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error toggling project status" });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleteRes = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        if (deleteRes.rowCount === 0) {
            return res.status(404).json({ message: 'Projekt nenájdený' });
        }
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri mazaní projektu' });
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