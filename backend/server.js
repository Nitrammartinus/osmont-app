const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { getDb, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const main = async () => {
    try {
        await initializeDatabase();
        console.log('Database initialized successfully.');

        // Simple health check endpoint
        app.get('/api/health', (req, res) => {
            res.status(200).json({ status: 'ok' });
        });

        // --- AUTH ---
        app.post('/api/login', async (req, res) => {
            const { username, password } = req.body;
            const db = getDb();
            try {
                const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
                const user = result.rows[0];

                if (!user) {
                    return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
                }
                if (user.blocked) {
                    return res.status(403).json({ message: 'Tento používateľ je zablokovaný.' });
                }

                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) {
                    return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
                }
                
                // Fetch cost centers for the user
                const centersResult = await db.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [user.id]);
                user.costCenters = centersResult.rows.map(row => row.center_id);

                delete user.password;
                res.json(user);
            } catch (err) {
                console.error('Login error:', err);
                res.status(500).json({ message: 'Interná chyba servera' });
            }
        });

        // --- USERS ---
        app.get('/api/users', async (req, res) => {
            const db = getDb();
            try {
                const usersResult = await db.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
                const users = usersResult.rows;

                // Fetch cost centers for each user
                for (const user of users) {
                    const centersResult = await db.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [user.id]);
                    user.costCenters = centersResult.rows.map(row => row.center_id);
                }
                
                res.json(users);
            } catch (err) {
                res.status(500).json({ message: 'Failed to fetch users' });
            }
        });

        app.post('/api/users', async (req, res) => {
            const { id, name, username, password, role, can_select_project_manually, costCenters } = req.body;
            const db = getDb();
            const client = await db.connect();
            try {
                await client.query('BEGIN');
                const saltRounds = 10;
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                
                await client.query(
                    'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [id, name, username, hashedPassword, role, false, can_select_project_manually]
                );
                
                if (costCenters && costCenters.length > 0) {
                    for (const centerId of costCenters) {
                        await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
                    }
                }

                await client.query('COMMIT');
                res.status(201).json({ id, name, username, role });
            } catch (err) {
                await client.query('ROLLBACK');
                res.status(500).json({ message: 'Failed to create user' });
            } finally {
                client.release();
            }
        });
        
        app.put('/api/users/:id', async (req, res) => {
            const { id } = req.params;
            const { name, username, password, role, blocked, can_select_project_manually, costCenters } = req.body;
            const db = getDb();
            const client = await db.connect();
            try {
                 await client.query('BEGIN');

                let query = 'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5';
                const values = [name, username, role, blocked, can_select_project_manually];

                if (password) {
                    const saltRounds = 10;
                    const hashedPassword = await bcrypt.hash(password, saltRounds);
                    query += ', password = $6 WHERE id = $7';
                    values.push(hashedPassword, id);
                } else {
                    query += ' WHERE id = $6';
                    values.push(id);
                }
                
                await client.query(query, values);
                
                // Update cost centers
                await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
                if (costCenters && costCenters.length > 0) {
                    for (const centerId of costCenters) {
                         await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
                    }
                }

                await client.query('COMMIT');
                res.status(200).json({ message: 'User updated successfully' });
            } catch (err) {
                 await client.query('ROLLBACK');
                 console.error(err);
                res.status(500).json({ message: 'Failed to update user' });
            } finally {
                client.release();
            }
        });

        app.delete('/api/users/:id', async (req, res) => {
            const { id } = req.params;
            const db = getDb();
            try {
                await db.query('DELETE FROM users WHERE id = $1', [id]);
                await db.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
                res.status(204).send();
            } catch (err) {
                res.status(500).json({ message: 'Failed to delete user' });
            }
        });

        // --- PROJECTS ---
        app.post('/api/projects/filtered', async (req, res) => {
            const { userRole, userId } = req.body;
            const db = getDb();
            try {
                let result;
                if (userRole === 'admin') {
                    result = await db.query('SELECT * FROM projects ORDER BY name');
                } else {
                    const centersResult = await db.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
                    const userCenters = centersResult.rows.map(r => r.center_id);
                    if (userCenters.length === 0) {
                        return res.json([]);
                    }
                    result = await db.query('SELECT * FROM projects WHERE cost_center_id = ANY($1::varchar[]) ORDER BY name', [userCenters]);
                }
                res.json(result.rows);
            } catch (err) {
                 res.status(500).json({ message: 'Failed to fetch projects' });
            }
        });
        
        app.post('/api/projects', async (req, res) => {
            const { id, name, budget, deadline, estimated_hours, cost_center_id } = req.body;
            const db = getDb();
            try {
                await db.query(
                    'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [id, name, budget, deadline, false, estimated_hours, cost_center_id]
                );
                res.status(201).json({ id, name });
            } catch (err) {
                res.status(500).json({ message: 'Failed to create project' });
            }
        });

        app.put('/api/projects/:id', async (req, res) => {
            const { id } = req.params;
            const { name, budget, deadline, closed, estimated_hours, cost_center_id } = req.body;
            const db = getDb();
            try {
                await db.query(
                    'UPDATE projects SET name = $1, budget = $2, deadline = $3, closed = $4, estimated_hours = $5, cost_center_id = $6 WHERE id = $7',
                    [name, budget, deadline, closed, estimated_hours, cost_center_id, id]
                );
                res.status(200).json({ message: 'Project updated' });
            } catch (err) {
                res.status(500).json({ message: 'Failed to update project' });
            }
        });

        app.delete('/api/projects/:id', async (req, res) => {
            const { id } = req.params;
            const db = getDb();
            try {
                await db.query('DELETE FROM projects WHERE id = $1', [id]);
                res.status(204).send();
            } catch (err) {
                res.status(500).json({ message: 'Failed to delete project' });
            }
        });

        // --- SESSIONS ---
        app.get('/api/sessions/active', async (req, res) => {
            const db = getDb();
            try {
                const result = await db.query('SELECT * FROM active_sessions');
                res.json(result.rows);
            } catch(err) {
                res.status(500).json({ message: 'Failed to get active sessions' });
            }
        });
        
        app.post('/api/sessions/start', async (req, res) => {
            const { userId, userName, projectId, projectName } = req.body;
            const db = getDb();
            try {
                const projectRes = await db.query('SELECT cost_center_id FROM projects WHERE id = $1', [projectId]);
                const cost_center_id = projectRes.rows[0].cost_center_id;
                await db.query(
                    'INSERT INTO active_sessions (user_id, user_name, project_id, project_name, start_time, cost_center_id) VALUES ($1, $2, $3, $4, NOW(), $5)',
                    [userId, userName, projectId, projectName, cost_center_id]
                );
                res.status(201).json({ message: 'Session started' });
            } catch (err) {
                res.status(500).json({ message: 'Failed to start session' });
            }
        });

        app.post('/api/sessions/stop', async (req, res) => {
            const { userId } = req.body;
            const db = getDb();
            const client = await db.connect();
            try {
                await client.query('BEGIN');
                const activeSessionRes = await client.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
                const session = activeSessionRes.rows[0];

                if (!session) {
                    return res.status(404).json({ message: 'No active session found' });
                }
                
                const duration_minutes = Math.round((Date.now() - new Date(session.start_time).getTime()) / 60000);
                
                await client.query(
                    'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
                    [session.start_time, session.user_id, session.user_name, session.project_id, session.project_name, duration_minutes]
                );
                
                await client.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);

                await client.query('COMMIT');
                res.status(200).json({ message: 'Session stopped' });
            } catch(err) {
                await client.query('ROLLBACK');
                res.status(500).json({ message: 'Failed to stop session' });
            } finally {
                client.release();
            }
        });
        
        app.post('/api/sessions/completed/filtered', async (req, res) => {
            const { userRole, userId } = req.body;
            const db = getDb();
            try {
                let result;
                if (userRole === 'admin') {
                    result = await db.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
                } else {
                     const centersResult = await db.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
                    const userCenters = centersResult.rows.map(r => r.center_id);
                     if (userCenters.length === 0) {
                        return res.json([]);
                    }
                    const projectsResult = await db.query('SELECT id FROM projects WHERE cost_center_id = ANY($1::varchar[])', [userCenters]);
                    const allowedProjectIds = projectsResult.rows.map(r => r.id);
                    if (allowedProjectIds.length === 0) {
                         return res.json([]);
                    }
                    result = await db.query('SELECT * FROM completed_sessions WHERE project_id = ANY($1::varchar[]) ORDER BY timestamp DESC', [allowedProjectIds]);
                }
                res.json(result.rows);
            } catch(err) {
                res.status(500).json({ message: 'Failed to fetch completed sessions' });
            }
        });

        // --- COST CENTERS ---
        app.get('/api/cost-centers', async (req, res) => {
            const db = getDb();
            try {
                const result = await db.query('SELECT * FROM cost_centers ORDER BY name');
                res.json(result.rows);
            } catch (err) {
                 res.status(500).json({ message: 'Failed to fetch cost centers' });
            }
        });
        
        app.post('/api/cost-centers', async (req, res) => {
            const { id, name } = req.body;
            const db = getDb();
            try {
                await db.query('INSERT INTO cost_centers (id, name) VALUES ($1, $2)', [id, name]);
                res.status(201).json({ id, name });
            } catch (err) {
                res.status(500).json({ message: 'Failed to create cost center' });
            }
        });
        
        app.put('/api/cost-centers/:id', async (req, res) => {
            const { id } = req.params;
            const { name } = req.body;
            const db = getDb();
            try {
                await db.query('UPDATE cost_centers SET name = $1 WHERE id = $2', [name, id]);
                res.status(200).json({ message: 'Cost center updated' });
            } catch (err) {
                 res.status(500).json({ message: 'Failed to update cost center' });
            }
        });
        
        app.delete('/api/cost-centers/:id', async (req, res) => {
            const { id } = req.params;
            const db = getDb();
            try {
                await db.query('DELETE FROM cost_centers WHERE id = $1', [id]);
                res.status(204).send();
            } catch (err) {
                res.status(500).json({ message: 'Failed to delete cost center' });
            }
        });

        app.listen(PORT, () => {
            console.log(`Server beží na porte ${PORT}`);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

main();
