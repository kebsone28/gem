import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { generateTokens, verifyRefreshToken } from '../../core/utils/jwt.js';

// @desc    Register a new organization and its first admin user
// @route   POST /api/auth/register-org
export const registerOrganization = async (req, res) => {
    try {
        const { orgName, email, password, name } = req.body;

        // 1. Check if user already exists
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Create Organization and User in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.create({
                data: { name: orgName }
            });

            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash: hashedPassword,
                    name,
                    role: 'admin',
                    organizationId: organization.id
                }
            });

            return { user, organization };
        });

        // 4. Generate tokens
        const { accessToken, refreshToken } = generateTokens(result.user);

        // 5. Set refresh token in cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({
            message: 'Organization registered successfully',
            user: {
                id: result.user.id,
                email: result.user.email,
                role: result.user.role,
                organization: result.organization.name
            },
            accessToken
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔍 Login attempt body:', req.body);

        if (!email) {
            console.log('❌ Email is missing in request body');
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            include: { organization: true }
        });

        if (!user) {
            console.log('❌ User not found for email:', email);
        } else {
            console.log('✅ User found in DB. Role:', user.role);
            const isMatch = await bcrypt.compare(password, user.passwordHash);
            console.log('🔑 Password match result:', isMatch);
        }

        if (user && (await bcrypt.compare(password, user.passwordHash))) {
            const { accessToken, refreshToken } = generateTokens(user);

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            // Update last login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            });

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    organization: user.organization.name
                },
                accessToken
            });
        } else {
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
export const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.status(401).json({ error: 'No refresh token' });

        const decoded = verifyRefreshToken(token);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            include: { organization: true }
        });

        if (!user) return res.status(401).json({ error: 'User not found' });

        const tokens = generateTokens(user);

        res.json({ accessToken: tokens.accessToken });
    } catch (error) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
export const logout = (req, res) => {
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
};
