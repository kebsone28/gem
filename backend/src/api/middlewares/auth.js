import { verifyAccessToken } from '../../core/utils/jwt.js';

export const authProtect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            return res.status(401).json({ error: 'Not authorized, no token' });
        }

        const decoded = verifyAccessToken(token);

        // Inject user info into request
        req.user = decoded;

        next();
    } catch (error) {
        console.error('Auth check failed:', error.message);
        res.status(401).json({ error: 'Not authorized, token failed' });
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};
