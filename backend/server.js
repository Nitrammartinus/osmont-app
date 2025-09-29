const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { getDb, initDb } = require('./database');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const apiRouter = express.Router();

// Helper to get user cost centers
const getUserCostCenters = async (userId) => {
    const db = getDb();
    const result = await db.query(
        `SELECT cc.id, cc.name FROM cost_centers cc
         JOIN user_cost_centers ucc ON cc.id = ucc.center_id
         WHERE ucc.user_id = $1`,
        [userId]
    );
    return result.rows;
};

// Middleware to get user from request body (for filtering)
const getUserFromRequest = async (req) => {
    const { userId, userRole } = req.body;
    if (!userId || !userRole) return null;
    return { id: userId, role: userRole };
};


// LOGIN
apiRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = getDb();
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
        const user = result.rows[0];
        if (user.blocked) {
            return res.status(403).json({ message: 'Používateľ je zablokovaný.' });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Neplatné používateľské meno alebo heslo.' });
        }
        
        // CRITICAL FIX: Fetch and attach cost centers to the user object on login
        const costCenters = await getUserCostCenters(user.id);
        const { password: _, ...userWithoutPassword } = user;

        res.json({ ...userWithoutPassword, costCenters });
    } catch (err) {
        res.status(500).json({ message: 'Chyba servera pri prihlasovaní.', error: err.message });
    }
});


// USERS
apiRouter.get('/users', async (req, res) => {
    const db = getDb();
    try {
        const result = await db.query("SELECT id, name, username, role, blocked, can_select_project_manually FROM users ORDER BY name");
        const users = result.rows;
        // For each user, get their cost centers
        for (const user of users) {
            user.costCenters = await getUserCostCenters(user.id);
        }
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Chyba pri načítavaní používateľov.', error: err.message });
    }
});
// ... (the rest of the CRUD operations for users, projects, cost centers, sessions)

const startServer = async () => {
    await initDb();
    app.use('/api', apiRouter);
    app.listen(port, () => {
        console.log(`Server beží na porte ${port}`);
    });
};

startServer();
