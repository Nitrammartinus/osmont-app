const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool, initializeDatabase } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Middleware to get user cost centers
const getUserCostCenters = async (userId) => {
    const result = await pool.query('SELECT center_id FROM user_cost_centers WHERE user_id = $1', [userId]);
    return result.rows.map(row => row.center_id);
};

// API Endpoints

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (user && !user.blocked && bcrypt.compareSync(password, user.password)) {
            const costCenters = await getUserCostCenters(user.id);
            const { password, ...userWithoutPassword } = user;
            res.json({ ...userWithoutPassword, costCenters });
        } else {
            res.status(401).json({ message: 'Neplatné meno alebo heslo, alebo je používateľ zablokovaný.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Chyba servera pri prihlasovaní.' });
    }
});

// GET all data (for initial load)
app.get('/api/initial-data', async (req, res) => {
    try {
        const usersRes = await pool.query('SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name');
        const projectsRes = await pool.query('SELECT p.*, cc.name as cost_center_name FROM projects p JOIN cost_centers cc ON p.cost_center_id = cc.id ORDER BY name');
        const completedRes = await pool.query('SELECT * FROM completed_sessions ORDER BY timestamp DESC');
        const activeRes = await pool.query(`
            SELECT a.id, a.user_id, a.project_id, a.start_time, u.name as user_name, p.name as project_name, p.cost_center_id, cc.name as cost_center_name
            FROM active_sessions a
            JOIN users u ON a.user_id = u.id
            JOIN projects p ON a.project_id = p.id
            JOIN cost_centers cc ON p.cost_center_id = cc.id
            ORDER BY a.start_time DESC
        `);
        const costCentersRes = await pool.query('SELECT * FROM cost_centers ORDER BY name');

        // Attach cost centers to users
        const usersWithCostCenters = await Promise.all(usersRes.rows.map(async user => {
            const costCenters = await getUserCostCenters(user.id);
            return { ...user, costCenters };
        }));

        res.json({
            users: usersWithCostCenters,
            projects: projectsRes.rows,
            completedSessions: completedRes.rows,
            activeSessions: activeRes.rows,
            costCenters: costCentersRes.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Nepodarilo sa načítať dáta.' });
    }
});


// Users CRUD
app.post('/api/users', async (req, res) => { /* ... Add user logic ... */ });
app.put('/api/users/:id', async (req, res) => { /* ... Update user logic ... */ });
app.delete('/api/users/:id', async (req, res) => { /* ... Delete user logic ... */ });


// Projects CRUD
app.get('/api/projects', async (req, res) => {
    const { userId, userRole } = req.query;
    try {
        let projects;
        if (userRole === 'admin') {
            projects = await pool.query('SELECT p.*, cc.name as cost_center_name FROM projects p JOIN cost_centers cc ON p.cost_center_id = cc.id ORDER BY p.name');
        } else {
            const userCostCenters = await getUserCostCenters(userId);
            if (userCostCenters.length === 0) {
                return res.json([]);
            }
            projects = await pool.query('SELECT p.*, cc.name as cost_center_name FROM projects p JOIN cost_centers cc ON p.cost_center_id = cc.id WHERE p.cost_center_id = ANY($1::int[]) ORDER BY p.name', [userCostCenters]);
        }
        res.json(projects.rows);
    } catch (error) {
        res.status(500).json({ message: 'Chyba pri načítaní projektov.' });
    }
});
app.post('/api/projects', async (req, res) => { /* ... Add project logic ... */ });
app.put('/api/projects/:id', async (req, res) => { /* ... Update project logic ... */ });
app.delete('/api/projects/:id', async (req, res) => { /* ... Delete project logic ... */ });
app.put('/api/projects/:id/toggle-status', async (req, res) => { /* ... Toggle status logic ... */ });


// Cost Centers CRUD
app.post('/api/cost-centers', async (req, res) => { /* ... Add cost center logic ... */ });
app.put('/api/cost-centers/:id', async (req, res) => { /* ... Update cost center logic ... */ });
app.delete('/api/cost-centers/:id', async (req, res) => { /* ... Delete cost center logic ... */ });

// Active Sessions
app.post('/api/active-sessions', async (req, res) => { /* ... Start session logic ... */ });
app.delete('/api/active-sessions/:userId', async (req, res) => {
    const { userId } = req.params;
     try {
        const activeSessionRes = await pool.query('SELECT * FROM active_sessions WHERE user_id = $1', [userId]);
        if (activeSessionRes.rows.length === 0) {
            return res.status(404).json({ message: 'Žiadna aktívna relácia pre tohto používateľa.' });
        }
        const activeSession = activeSessionRes.rows[0];

        const userRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        const projectRes = await pool.query('SELECT name FROM projects WHERE id = $1', [activeSession.project_id]);
        const userName = userRes.rows[0].name;
        const projectName = projectRes.rows[0].name;

        const durationMinutes = Math.round((new Date() - new Date(activeSession.start_time)) / 60000);

        await pool.query('BEGIN');
        await pool.query('DELETE FROM active_sessions WHERE user_id = $1', [userId]);
        const newCompleted = await pool.query(
            'INSERT INTO completed_sessions (timestamp, employee_id, employee_name, project_id, project_name, duration_minutes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [activeSession.start_time, userId, userName, activeSession.project_id, projectName, durationMinutes]
        );
        await pool.query('COMMIT');
        
        res.status(200).json({ message: 'Relácia úspešne ukončená.', completedSession: newCompleted.rows[0] });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ message: 'Chyba pri ukončení relácie.' });
    }
});


// Fill in other CRUD operations
// ... (omitted for brevity, but they exist in the full file)

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
