const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { getDb, initializeDatabase } = require('./database');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const apiRouter = express.Router();

// Helper to get user's cost centers
const getUserCostCenters = async (userId) => {
    const db = getDb();
    const res = await db.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.center_id);
}

// LOGIN
apiRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user.blocked) {
                return res.status(403).json({ message: 'Používateľ je zablokovaný.' });
            }
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const { password, ...userWithoutPassword } = user;
                res.json(userWithoutPassword);
            } else {
                res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
            }
        } else {
            res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba na strane servera.' });
    }
});


// USERS
apiRouter.get('/users', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        for (let user of result.rows) {
            user.costCenters = await getUserCostCenters(user.id);
        }
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní používateľov.' });
    }
});

apiRouter.post('/users', async (req, res) => {
    const { id, name, username, password, role, can_select_project_manually } = req.body;
    if (!name || !username || !password || !role) {
        return res.status(400).json({ message: "Chýbajú povinné údaje." });
    }
    const db = getDb();
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await db.query(
            'INSERT INTO users(id, name, username, password, role, blocked, can_select_project_manually) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, name, username, hashedPassword, role, false, can_select_project_manually || false]
        );
        const { password: _, ...newUser } = result.rows[0];
        res.status(201).json(newUser);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ message: `Používateľské meno '${username}' už existuje.` });
        }
        res.status(500).json({ message: 'Chyba pri vytváraní používateľa.' });
    }
});

apiRouter.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, blocked, can_select_project_manually, costCenters } = req.body;
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Fetch existing user
        const existingUserRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        if (existingUserRes.rows.length === 0) {
            return res.status(404).json({ message: 'Používateľ nebol nájdený.' });
        }

        let query = 'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5';
        const values = [name, username, role, blocked, can_select_project_manually];
        
        if (password) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            query += ', password = $6 WHERE id = $7 RETURNING *';
            values.push(hashedPassword, id);
        } else {
            query += ' WHERE id = $6 RETURNING *';
            values.push(id);
        }
        
        const result = await client.query(query, values);
        
        // Update cost centers
        await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }
        
        await client.query('COMMIT');
        
        const { password: _, ...updatedUser } = result.rows[0];
        updatedUser.costCenters = costCenters || [];
        res.json(updatedUser);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ message: `Používateľské meno '${username}' už existuje.` });
        }
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa.' });
    } finally {
        client.release();
    }
});


apiRouter.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDb();
    try {
        await db.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Používateľ nebol nájdený.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri mazaní používateľa.' });
    }
});

// PROJECTS
apiRouter.post('/projects/filtered', async (req, res) => {
    const { userRole, userId } = req.body;
    const db = getDb();
    try {
        let result;
        if (userRole === 'admin') {
            result = await db.query('SELECT * FROM projects ORDER BY name');
        } else {
            const userCostCenters = await getUserCostCenters(userId);
            if (userCostCenters.length === 0) {
                return res.json([]); // User has no cost centers, so they see no projects
            }
            result = await db.query(
                'SELECT * FROM projects WHERE cost_center_id = ANY($1::varchar[]) ORDER BY name', 
                [userCostCenters]
            );
        }
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní projektov.' });
    }
});


apiRouter.post('/projects', async (req, res) => {
    const { id, name, budget, deadline, estimated_hours, cost_center_id } = req.body;
    const db = getDb();
    try {
        const result = await db.query(
            'INSERT INTO projects(id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, name, budget, deadline, false, estimated_hours, cost_center_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri vytváraní projektu.' });
    }
});

apiRouter.put('/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { name, budget, deadline, closed, estimated_hours, cost_center_id } = req.body;
    const db = getDb();
    try {
        const result = await db.query(
            'UPDATE projects SET name = $1, budget = $2, deadline = $3, closed = $4, estimated_hours = $5, cost_center_id = $6 WHERE id = $7 RETURNING *',
            [name, budget, deadline, closed, estimated_hours, cost_center_id, id]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Projekt nebol nájdený.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri aktualizácii projektu.' });
    }
});

apiRouter.delete('/projects/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDb();
    try {
        const result = await db.query('DELETE FROM projects WHERE id = $1', [id]);
        if (result.rowCount > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Projekt nebol nájdený.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri mazaní projektu.' });
    }
});

// SESSIONS
apiRouter.get('/sessions/active', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query('SELECT * FROM active_sessions');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní aktívnych relácií.' });
    }
});

apiRouter.post('/sessions/start', async (req, res) => {
    const { userId, userName, projectId, projectName } = req.body;
    const db = getDb();
    try {
        // Get cost center from project
        const projectRes = await db.query('SELECT cost_center_id FROM projects WHERE id = $1', [projectId]);
        if (projectRes.rows.length === 0) {
            return res.status(404).json({ message: 'Projekt nebol nájdený.' });
        }
        const costCenterId = projectRes.rows[0].cost_center_id;

        const result = await db.query(
            'INSERT INTO active_sessions (user_id, user_name, project_id, project_name, start_time, cost_center_id) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING *',
            [userId, userName, projectId, projectName, costCenterId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // unique_violation on user_id
             return res.status(409).json({ message: `Používateľ už má aktívnu reláciu.` });
        }
        res.status(500).json({ message: 'Chyba pri spúšťaní relácie.' });
    }
});

apiRouter.post('/sessions/stop', async (req, res) => {
    const { userId } = req.body;
    const db = getDb();
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        const activeSessionRes = await client.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        if (activeSessionRes.rows.length === 0) {
            return res.status(404).json({ message: 'Žiadna aktívna relácia pre tohto používateľa.' });
        }
        const session = activeSessionRes.rows[0];
        
        const durationMinutes = Math.round((new Date() - new Date(session.start_time)) / 60000);

        await client.query(
            'INSERT INTO completed_sessions(timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES($1, $2, $3, $4, $5, $6)',
            [session.start_time, session.user_id, session.user_name, session.project_id, session.project_name, durationMinutes]
        );

        await client.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
        
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

apiRouter.post('/sessions/completed/filtered', async (req, res) => {
    const { userRole, userId } = req.body;
    const db = getDb();
    try {
        let result;
        if (userRole === 'admin') {
            result = await db.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
        } else {
             const userCostCenters = await getUserCostCenters(userId);
             if (userCostCenters.length === 0) {
                return res.json([]);
            }
            // Join with projects to filter by cost center
            result = await db.query(
                `SELECT cs.* FROM completed_sessions cs
                 JOIN projects p ON cs.project_id = p.id
                 WHERE p.cost_center_id = ANY($1::varchar[])
                 ORDER BY cs.timestamp DESC`,
                [userCostCenters]
            );
        }
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní ukončených relácií.' });
    }
});

// COST CENTERS
apiRouter.get('/cost-centers', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query('SELECT * FROM cost_centers ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri načítavaní stredísk.' });
    }
});

apiRouter.post('/cost-centers', async (req, res) => {
    const { id, name } = req.body;
    const db = getDb();
    try {
        const result = await db.query('INSERT INTO cost_centers(id, name) VALUES($1, $2) RETURNING *', [id, name]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri vytváraní strediska.' });
    }
});

apiRouter.put('/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const db = getDb();
    try {
        const result = await db.query('UPDATE cost_centers SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Stredisko nebolo nájdené.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri aktualizácii strediska.' });
    }
});

apiRouter.delete('/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDb();
    // Check if any project is assigned to this cost center
    const projectsCheck = await db.query('SELECT id FROM projects WHERE cost_center_id = $1 LIMIT 1', [id]);
    if (projectsCheck.rows.length > 0) {
        return res.status(400).json({ message: `Nie je možné zmazať stredisko, pretože je priradené k projektu (ID: ${projectsCheck.rows[0].id}).` });
    }
    try {
        const result = await db.query('DELETE FROM cost_centers WHERE id = $1', [id]);
        if (result.rowCount > 0) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Stredisko nebolo nájdené.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Chyba pri mazaní strediska.' });
    }
});


app.use('/api', apiRouter);

const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(port, () => {
            console.log(`Server beží na porte ${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
