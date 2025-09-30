
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper na získanie stredísk pre používateľa
const getUserCostCenters = async (userId) => {
    const res = await pool.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
    return res.rows.map(r => r.center_id);
};

// Middleware na overenie role a stredísk
const authorize = (roles = []) => {
    return async (req, res, next) => {
        const userId = req.headers['x-user-id'];
        const userRole = req.headers['x-user-role'];

        if (!userId || !userRole) {
            return res.status(401).json({ message: 'Unauthorized: User context not provided' });
        }

        if (roles.length && !roles.includes(userRole)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        }

        req.user = {
            id: userId,
            role: userRole,
            costCenterIds: userRole === 'admin' ? [] : await getUserCostCenters(userId)
        };
        next();
    };
};

// API Endpoints
// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (user && !user.blocked && bcrypt.compareSync(password, user.password)) {
            const costCenters = await getUserCostCenters(user.id);
            const { password, ...userWithoutPassword } = user;
            res.json({ ...userWithoutPassword, costCenters });
        } else {
            res.status(401).json({ message: 'Nesprávne meno, heslo alebo je účet zablokovaný.' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Chyba servera pri prihlasovaní.' });
    }
});

// Users
app.get('/api/users', authorize(['admin', 'manager']), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const users = await Promise.all(result.rows.map(async (user) => {
            const costCenters = await getUserCostCenters(user.id);
            return { ...user, costCenters };
        }));
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/users/:id', authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, username, password, role, blocked, can_select_project_manually, costCenters } = req.body;
        
        const client = await pool.connect();
        await client.query('BEGIN');

        let hashedPassword = undefined;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const userUpdateQuery = `
            UPDATE users 
            SET name = $1, username = $2, role = $3, blocked = $4, can_select_project_manually = $5 
            ${hashedPassword ? ', password = $6' : ''}
            WHERE id = ${hashedPassword ? '$7' : '$6'}
            RETURNING *;
        `;
        const userUpdateParams = hashedPassword
            ? [name, username, role, blocked, can_select_project_manually, hashedPassword, id]
            : [name, username, role, blocked, can_select_project_manually, id];
            
        await client.query(userUpdateQuery, userUpdateParams);

        await client.query('DELETE FROM user_cost_centers WHERE user_id = $1', [id]);
        if (costCenters && costCenters.length > 0) {
            for (const centerId of costCenters) {
                await client.query('INSERT INTO user_cost_centers (user_id, center_id) VALUES ($1, $2)', [id, centerId]);
            }
        }
        
        await client.query('COMMIT');
        client.release();
        res.status(200).json({ message: 'Používateľ úspešne aktualizovaný.' });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Projects
app.get('/api/projects', authorize(['admin', 'manager', 'employee']), async (req, res) => {
    try {
        let query = `
            SELECT p.*, cc.name as cost_center_name 
            FROM projects p
            JOIN cost_centers cc ON p.cost_center_id = cc.id
        `;
        const params = [];

        if (req.user.role !== 'admin') {
            query += ' WHERE p.cost_center_id = ANY($1)';
            params.push(req.user.costCenterIds);
        }
        query += ' ORDER BY p.name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/projects/:id/toggle-status', authorize(['admin', 'manager']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE projects SET closed = NOT closed WHERE id = $1 RETURNING *', [id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Cost Centers
app.get('/api/cost-centers', authorize(['admin', 'manager']), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM cost_centers ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/cost-centers', authorize(['admin']), async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query('INSERT INTO cost_centers (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/cost-centers/:id', authorize(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const result = await pool.query('UPDATE cost_centers SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Sessions
app.get('/api/active-sessions', authorize(['admin', 'manager', 'employee']), async (req, res) => {
    try {
         let query = `
            SELECT s.id, s.user_id, s.project_id, s.start_time,
                   u.name as user_name, p.name as project_name, p.cost_center_id, cc.name as cost_center_name
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
            JOIN cost_centers cc ON p.cost_center_id = cc.id
        `;
        const params = [];

        if (req.user.role !== 'admin') {
            query += ' WHERE p.cost_center_id = ANY($1)';
            params.push(req.user.costCenterIds);
        }
        query += ' ORDER BY s.start_time';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/active-sessions', authorize(['admin', 'manager', 'employee']), async (req, res) => {
    try {
        const { projectId } = req.body;
        const userId = req.user.id;
        const result = await pool.query('INSERT INTO active_sessions (user_id, project_id, start_time) VALUES ($1, $2, NOW()) RETURNING *', [userId, projectId]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete('/api/active-sessions/user/:userId', authorize(['admin', 'manager', 'employee']), async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId } = req.params;
        if (req.user.role !== 'admin' && req.user.id !== userId) {
            return res.status(403).json({ message: 'Forbidden: You can only stop your own session.' });
        }

        await client.query('BEGIN');

        const sessionRes = await client.query(`
            SELECT s.id, s.start_time, s.project_id, u.id as user_id, u.name as user_name, p.name as project_name
            FROM active_sessions s
            JOIN users u ON s.user_id = u.id
            JOIN projects p ON s.project_id = p.id
            WHERE s.user_id = $1
        `, [userId]);
        
        const sessionToStop = sessionRes.rows[0];

        if (!sessionToStop) {
            return res.status(404).json({ message: 'Aktívna relácia pre tohto používateľa nebola nájdená.' });
        }

        const durationMinutes = Math.round((Date.now() - new Date(sessionToStop.start_time).getTime()) / 60000);
        
        await client.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6)',
            [sessionToStop.start_time, sessionToStop.user_id, sessionToStop.user_name, sessionToStop.project_id, sessionToStop.project_name, durationMinutes]
        );

        await client.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Relácia úspešne ukončená.' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/sessions/completed', authorize(['admin', 'manager']), async (req, res) => {
    try {
        let query = `
            SELECT cs.* FROM completed_sessions cs
            JOIN projects p ON cs.project_id = p.id
        `;
        const params = [];
        if (req.user.role === 'manager') {
            query += ' WHERE p.cost_center_id = ANY($1)';
            params.push(req.user.costCenterIds);
        }
        query += ' ORDER BY cs.timestamp DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Inicializácia a spustenie servera
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
