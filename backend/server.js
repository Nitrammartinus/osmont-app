const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Middleware to get user from request body for filtering
const getUserFromRequest = async (req) => {
    const { userId, userRole } = req.body;
    if (!userId || !userRole) return null;

    const client = await pool.connect();
    try {
        const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return null;
        
        const user = userRes.rows[0];
        
        const centersRes = await client.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
        user.costCenters = centersRes.rows.map(r => r.center_id);

        return user;
    } finally {
        client.release();
    }
}

// LOGIN
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

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
        
        // Dôležité: Načítame a pridáme strediská k používateľovi
        const centersRes = await client.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [user.id]);
        user.costCenters = centersRes.rows.map(r => r.center_id);

        delete user.password; // Nikdy neposielame heslo na frontend
        res.json(user);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba na strane servera.' });
    } finally {
        client.release();
    }
});


// USERS
app.get('/api/users', async (req, res) => {
    const client = await pool.connect();
    try {
        const usersRes = await client.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const users = usersRes.rows;

        // Načítame strediská pre každého používateľa
        for (const user of users) {
            const centersRes = await client.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [user.id]);
            user.costCenters = centersRes.rows.map(r => r.center_id);
        }

        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní používateľov.' });
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

        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await client.query(
                'UPDATE users SET name = $1, username = $2, password = $3, role = $4, blocked = $5, can_select_project_manually = $6 WHERE id = $7',
                [name, username, hashedPassword, role, blocked, can_select_project_manually, id]
            );
        } else {
            await client.query(
                'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5 WHERE id = $6',
                [name, username, role, blocked, can_select_project_manually, id]
            );
        }

        // Aktualizácia stredísk
        await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Používateľ úspešne aktualizovaný.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa.' });
    } finally {
        client.release();
    }
});

// PROJECTS
app.post('/api/projects/filtered', async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(403).json({ message: 'Neoprávnený prístup' });

    const client = await pool.connect();
    try {
        let projectsRes;
        if (user.role === 'admin') {
            // Admin vidí všetky projekty
            projectsRes = await client.query(`
                SELECT p.*, c.name as cost_center_name 
                FROM projects p
                JOIN cost_centers c ON p.cost_center_id = c.id
                ORDER BY p.name
            `);
        } else {
            // Ostatní vidia len projekty zo svojich stredísk
            projectsRes = await client.query(`
                SELECT p.*, c.name as cost_center_name 
                FROM projects p
                JOIN cost_centers c ON p.cost_center_id = c.id
                WHERE p.cost_center_id = ANY($1::int[])
                ORDER BY p.name
            `, [user.costCenters]);
        }
        res.json(projectsRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní projektov.' });
    } finally {
        client.release();
    }
});

app.put('/api/projects/:id/toggle-status', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const projectRes = await client.query('SELECT closed FROM projects WHERE id = $1', [id]);
        if (projectRes.rows.length === 0) {
            return res.status(404).json({ message: 'Projekt nenájdený.' });
        }
        const newStatus = !projectRes.rows[0].closed;
        await client.query('UPDATE projects SET closed = $1 WHERE id = $2', [newStatus, id]);
        res.status(200).json({ message: 'Stav projektu úspešne zmenený.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri zmene stavu projektu.' });
    } finally {
        client.release();
    }
});


// COST CENTERS
app.get('/api/cost-centers', async (req, res) => {
    const client = await pool.connect();
    try {
        const centersRes = await client.query('SELECT * FROM cost_centers ORDER BY name');
        res.json(centersRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní stredísk.' });
    } finally {
        client.release();
    }
});

app.post('/api/cost-centers', async (req, res) => {
    const { name } = req.body;
    const client = await pool.connect();
    try {
        const newCenter = await client.query('INSERT INTO cost_centers (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(newCenter.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri vytváraní strediska.' });
    } finally {
        client.release();
    }
});

app.put('/api/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const client = await pool.connect();
    try {
        await client.query('UPDATE cost_centers SET name = $1 WHERE id = $2', [name, id]);
        res.status(200).json({ message: 'Stredisko úspešne aktualizované.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri aktualizácii strediska.' });
    } finally {
        client.release();
    }
});


// SESSIONS (Active & Completed)
app.get('/api/active-sessions', async (req, res) => {
    const client = await pool.connect();
    try {
        const sessionsRes = await client.query(`
            SELECT 
                s.id,
                s.user_id,
                u.name as user_name,
                s.project_id,
                p.name as project_name,
                s.start_time,
                p.cost_center_id,
                cc.name as cost_center_name
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
            JOIN cost_centers cc ON p.cost_center_id = cc.id
            ORDER BY s.start_time DESC
        `);
        res.json(sessionsRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní aktívnych relácií.' });
    } finally {
        client.release();
    }
});

app.post('/api/active-sessions', async (req, res) => {
    const { userId, projectId } = req.body;
    const client = await pool.connect();
    try {
        const newSession = await client.query(
            'INSERT INTO active_sessions (user_id, project_id, start_time) VALUES ($1, $2, NOW()) RETURNING *',
            [userId, projectId]
        );
        res.status(201).json(newSession.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri spustení relácie.' });
    } finally {
        client.release();
    }
});

app.post('/api/stop-session', async (req, res) => {
    const { userId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const activeSessionRes = await client.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        if (activeSessionRes.rows.length === 0) {
            return res.status(404).json({ message: 'Žiadna aktívna relácia pre tohto používateľa.' });
        }
        const activeSession = activeSessionRes.rows[0];

        const userRes = await client.query('SELECT name FROM users WHERE id = $1', [activeSession.user_id]);
        const projectRes = await client.query('SELECT name FROM projects WHERE id = $1', [activeSession.project_id]);

        const durationMinutes = Math.round((new Date() - new Date(activeSession.start_time)) / 60000);

        await client.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [activeSession.start_time, activeSession.user_id, userRes.rows[0].name, activeSession.project_id, projectRes.rows[0].name, durationMinutes]
        );

        await client.query('DELETE FROM active_sessions WHERE id = $1', [activeSession.id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Relácia úspešne ukončená.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Chyba pri ukončovaní relácie.' });
    } finally {
        client.release();
    }
});

app.post('/api/sessions/completed/filtered', async (req, res) => {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(403).json({ message: 'Neoprávnený prístup' });

    const client = await pool.connect();
    try {
        let sessionsRes;
        if (user.role === 'admin') {
            sessionsRes = await client.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
        } else {
             const projectsRes = await client.query('SELECT id FROM projects WHERE cost_center_id = ANY($1::int[])', [user.costCenters]);
             const allowedProjectIds = projectsRes.rows.map(p => p.id);
             sessionsRes = await client.query('SELECT * FROM completed_sessions WHERE project_id = ANY($1::text[]) ORDER BY timestamp DESC', [allowedProjectIds]);
        }
        res.json(sessionsRes.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní ukončených relácií.' });
    } finally {
        client.release();
    }
});



// Štart servera
const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`Server beží na porte ${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
