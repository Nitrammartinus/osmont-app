
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Middleware to get user cost centers for filtering
const getUserContext = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userRole = req.headers['x-user-role'];

    req.userContext = {
        id: userId,
        role: userRole,
        costCenterIds: []
    };

    if (userId && (userRole === 'manager' || userRole === 'employee')) {
        try {
            const result = await pool.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
            req.userContext.costCenterIds = result.rows.map(row => row.center_id);
        } catch (error) {
            console.error('Error fetching user cost centers:', error);
            return res.status(500).json({ message: 'Chyba pri načítavaní oprávnení používateľa.' });
        }
    }
    next();
};


// GET INITIAL DATA (Users, Projects, Sessions, etc.)
app.get('/api/initial-data', async (req, res) => {
    try {
        const usersQuery = 'SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name';
        const projectsQuery = `
            SELECT p.*, cc.name as cost_center_name 
            FROM projects p
            LEFT JOIN cost_centers cc ON p.cost_center_id = cc.id
            ORDER BY p.name`;
        const activeSessionsQuery = `
            SELECT 
                a.id, a.user_id, a.project_id, a.start_time,
                u.name as user_name,
                p.name as project_name,
                p.cost_center_id,
                cc.name as cost_center_name
            FROM active_sessions a
            JOIN users u ON a.user_id = u.id
            JOIN projects p ON a.project_id = p.id
            JOIN cost_centers cc ON p.cost_center_id = cc.id
            ORDER BY a.start_time DESC`;
        const completedSessionsQuery = 'SELECT * FROM completed_sessions ORDER BY timestamp DESC';
        const costCentersQuery = 'SELECT * FROM cost_centers ORDER BY name';
        const userCostCentersQuery = 'SELECT * FROM user_cost_centers';

        const [usersRes, projectsRes, activeSessionsRes, completedSessionsRes, costCentersRes, userCostCentersRes] = await Promise.all([
            pool.query(usersQuery),
            pool.query(projectsQuery),
            pool.query(activeSessionsQuery),
            pool.query(completedSessionsQuery),
            pool.query(costCentersQuery),
            pool.query(userCostCentersQuery)
        ]);

        // Append cost center IDs to each user
        const usersWithCostCenters = usersRes.rows.map(user => {
            const centers = userCostCentersRes.rows
                .filter(ucc => ucc.user_id === user.id)
                .map(ucc => ucc.center_id);
            return { ...user, costCenters: centers };
        });

        res.json({
            users: usersWithCostCenters,
            projects: projectsRes.rows,
            activeSessions: activeSessionsRes.rows,
            completedSessions: completedSessionsRes.rows,
            costCenters: costCentersRes.rows,
        });
    } catch (error) {
        console.error('Error fetching initial data:', error);
        res.status(500).json({ message: 'Chyba pri načítavaní počiatočných dát.' });
    }
});


// LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Nesprávne meno alebo heslo.' });
        }
        if (user.blocked) {
            return res.status(403).json({ message: 'Používateľ je zablokovaný.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Nesprávne meno alebo heslo.' });
        }
        
        // CRITICAL FIX: Fetch and add user's cost centers to the response object
        const costCenterRes = await pool.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [user.id]);
        user.costCenters = costCenterRes.rows.map(row => row.center_id);

        delete user.password; // Never send password back
        res.json(user);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Interná chyba servera pri prihlasovaní.' });
    }
});


// ========== USERS API ==========
// ... (omitted for brevity - full user API logic is included)

// ========== PROJECTS API ==========
// ... (omitted for brevity - full project API logic is included)

// ========== COST CENTERS API ==========
// ... (omitted for brevity - full cost center API logic is included)

// ========== SESSIONS API ==========

app.get('/api/active-sessions', getUserContext, async (req, res) => {
    try {
        let query = `
            SELECT 
                a.id, a.user_id, a.project_id, a.start_time,
                u.name as user_name,
                p.name as project_name,
                p.cost_center_id,
                cc.name as cost_center_name
            FROM active_sessions a
            JOIN users u ON a.user_id = u.id
            JOIN projects p ON a.project_id = p.id
            JOIN cost_centers cc ON p.cost_center_id = cc.id`;
        
        const params = [];
        if (req.userContext.role === 'manager' || req.userContext.role === 'employee') {
            if (req.userContext.costCenterIds.length === 0) {
                return res.json([]); // Return empty if user has no cost centers
            }
            query += ` WHERE p.cost_center_id = ANY($1::int[])`;
            params.push(req.userContext.costCenterIds);
        }
        query += ' ORDER BY a.start_time DESC';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ message: 'Chyba pri načítavaní aktívnych relácií.' });
    }
});


app.post('/api/start-session', async (req, res) => {
    const { userId, projectId } = req.body;
    try {
        // Check for existing active session for this user
        const existing = await pool.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ message: 'Používateľ už má aktívnu reláciu.' });
        }
        
        const result = await pool.query(
            'INSERT INTO active_sessions (user_id, project_id, start_time) VALUES ($1, $2, NOW()) RETURNING *',
            [userId, projectId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ message: 'Chyba pri spúšťaní relácie.' });
    }
});

app.post('/api/stop-session', async (req, res) => {
    const { userId } = req.body;
    try {
        // Find the active session
        const activeSessionRes = await pool.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        const activeSession = activeSessionRes.rows[0];

        if (!activeSession) {
            return res.status(404).json({ message: 'Pre používateľa sa nenašla žiadna aktívna relácia.' });
        }
        
        // Get user and project details for the completed session log
        const [userRes, projectRes] = await Promise.all([
            pool.query('SELECT name FROM users WHERE id = $1', [activeSession.user_id]),
            pool.query('SELECT name FROM projects WHERE id = $1', [activeSession.project_id])
        ]);
        const userName = userRes.rows[0]?.name || 'Neznámy používateľ';
        const projectName = projectRes.rows[0]?.name || 'Neznámy projekt';

        const startTime = new Date(activeSession.start_time);
        const durationMinutes = Math.round((Date.now() - startTime.getTime()) / 60000);

        // Use a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Create completed session
            await client.query(
                'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
                [startTime, activeSession.user_id, userName, activeSession.project_id, projectName, durationMinutes]
            );

            // Delete active session
            await client.query('DELETE FROM active_sessions WHERE id = $1', [activeSession.id]);
            
            await client.query('COMMIT');
            res.status(200).json({ message: 'Relácia úspešne ukončená.' });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error stopping session:', error);
        res.status(500).json({ message: 'Chyba pri ukončovaní relácie.' });
    }
});


// Start server
const startServer = async () => {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`Server beží na porte ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// =======================================================
// FULL API IMPLEMENTATIONS (that were omitted for brevity)
// =======================================================

// GET USERS
app.get('/api/users', async (req, res) => {
    try {
        const usersRes = await pool.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const userCostCentersRes = await pool.query('SELECT * FROM user_cost_centers');
        
        const usersWithCostCenters = usersRes.rows.map(user => {
            const centers = userCostCentersRes.rows
                .filter(ucc => ucc.user_id === user.id)
                .map(ucc => ucc.center_id);
            return { ...user, costCenters: centers };
        });
        res.json(usersWithCostCenters);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: 'Chyba pri načítavaní používateľov.' });
    }
});

// ADD USER
app.post('/api/users', async (req, res) => {
    const { name, username, password, role, blocked, can_select_project_manually, costCenters = [] } = req.body;
    const id = `user${Date.now()}`;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const newUserRes = await client.query(
                'INSERT INTO users (id, name, username, password, role, blocked, can_select_project_manually) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [id, name, username, hashedPassword, role, blocked, can_select_project_manually]
            );
            const newUser = newUserRes.rows[0];

            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
            await client.query('COMMIT');
            
            delete newUser.password;
            newUser.costCenters = costCenters;
            res.status(201).json(newUser);
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: 'Chyba pri pridávaní používateľa.' });
    }
});

// UPDATE USER
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, username, password, role, blocked, can_select_project_manually, costCenters = [] } = req.body;
    
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            let query = 'UPDATE users SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5';
            const params = [name, username, role, blocked, can_select_project_manually];
            
            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                query += `, password = $${params.length + 1}`;
                params.push(hashedPassword);
            }
            
            query += ` WHERE id = $${params.length + 1} RETURNING *`;
            params.push(id);
            
            const updatedUserRes = await client.query(query, params);
            
            // Update cost centers
            await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
            
            await client.query('COMMIT');
            
            const updatedUser = updatedUserRes.rows[0];
            delete updatedUser.password;
            updatedUser.costCenters = costCenters;
            res.json(updatedUser);
            
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Error updating user ${id}:`, error);
        res.status(500).json({ message: 'Chyba pri aktualizácii používateľa.' });
    }
});


// DELETE USER
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting user ${id}:`, error);
        res.status(500).json({ message: 'Chyba pri mazaní používateľa.' });
    }
});

// GET PROJECTS
app.get('/api/projects', getUserContext, async (req, res) => {
    try {
        let query = `
            SELECT p.*, cc.name as cost_center_name 
            FROM projects p
            LEFT JOIN cost_centers cc ON p.cost_center_id = cc.id`;
        
        const params = [];
        if (req.userContext.role === 'manager' || req.userContext.role === 'employee') {
            if (req.userContext.costCenterIds.length === 0) {
                return res.json([]);
            }
            query += ` WHERE p.cost_center_id = ANY($1::int[])`;
            params.push(req.userContext.costCenterIds);
        }
        
        query += ' ORDER BY p.name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Chyba pri načítavaní projektov.' });
    }
});


// ADD PROJECT
app.post('/api/projects', async (req, res) => {
    const { name, budget, deadline, estimated_hours, cost_center_id } = req.body;
    const id = `proj${Date.now()}`;
    try {
        const result = await pool.query(
            'INSERT INTO projects (id, name, budget, deadline, closed, estimated_hours, cost_center_id) VALUES ($1, $2, $3, $4, false, $5, $6) RETURNING *',
            [id, name, budget, deadline, estimated_hours, cost_center_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ message: 'Chyba pri pridávaní projektu.' });
    }
});

// UPDATE PROJECT
app.put('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    const { name, budget, deadline, closed, estimated_hours, cost_center_id } = req.body;
    try {
        const result = await pool.query(
            'UPDATE projects SET name = $1, budget = $2, deadline = $3, closed = $4, estimated_hours = $5, cost_center_id = $6 WHERE id = $7 RETURNING *',
            [name, budget, deadline, closed, estimated_hours, cost_center_id, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Error updating project ${id}:`, error);
        res.status(500).json({ message: 'Chyba pri aktualizácii projektu.' });
    }
});

// DELETE PROJECT
app.delete('/api/projects/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting project ${id}:`, error);
        res.status(500).json({ message: 'Chyba pri mazaní projektu.' });
    }
});

// GET COST CENTERS
app.get('/api/cost-centers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cost_centers ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error getting cost centers:', error);
        res.status(500).json({ message: 'Chyba pri načítavaní stredísk.' });
    }
});

// ADD COST CENTER
app.post('/api/cost-centers', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO cost_centers (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding cost center:', error);
        res.status(500).json({ message: 'Chyba pri pridávaní strediska.' });
    }
});

// UPDATE COST CENTER
app.put('/api/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const result = await pool.query('UPDATE cost_centers SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Error updating cost center ${id}:`, error);
        res.status(500).json({ message: 'Chyba pri aktualizácii strediska.' });
    }
});

// DELETE COST CENTER
app.delete('/api/cost-centers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM cost_centers WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting cost center ${id}:`, error);
        res.status(500).json({ message: 'Chyba pri mazaní strediska.' });
    }
});
