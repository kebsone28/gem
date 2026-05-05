import express from 'express';
import { authProtect } from '../middlewares/auth.js';

const router = express.Router();

// Protected debug endpoint to inspect the server-evaluated user object
router.get('/whoami', authProtect, (req, res) => {
    // Don't expose sensitive token fields if present
    const safeUser = { ...req.user };
    delete safeUser.iat;
    delete safeUser.exp;
    delete safeUser.jti;
    return res.json({ ok: true, user: safeUser });
});

export default router;
