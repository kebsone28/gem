import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import { generateTokens, verifyRefreshToken } from '../../core/utils/jwt.js';
import { tracerAction } from '../../services/audit.service.js';

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

            // Trouver le rôle ADMIN_PROQUELEC
            const adminRole = await tx.role.findUnique({ where: { name: 'ADMIN_PROQUELEC' } });

            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    passwordHash: hashedPassword,
                    name,
                    roleLegacy: 'ADMIN_PROQUELEC',
                    roleId: adminRole?.id,
                    organizationId: organization.id
                },
                include: { 
                    organization: true,
                    role: {
                        include: {
                            permissions: {
                                include: { permission: true }
                            }
                        }
                    }
                }
            });

            return { user, organization };
        });

        // Audit Log
        await tracerAction({
            userId: result.user.id,
            organizationId: result.user.organizationId,
            action: 'INSCRIPTION_UTILISATEUR',
            resource: 'Authentification',
            resourceId: result.user.id,
            details: { email: result.user.email, role: result.user.role },
            req
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
            include: { 
                organization: true,
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                }
            }
        });

        if (!user) {
            console.log('❌ User not found for email:', email);
        } else {
            // ✅ VÉRIFICATION SÉCURITÉ: Vérifier que passwordHash existe
            if (!user.passwordHash) {
                console.log('❌ User found but passwordHash is missing - user may be corrupted');
                return res.status(400).json({ error: 'Invalid user account - contact administrator' });
            }

            // Gestion des permissions (Audit REINFORCEMENT: Override total)
            const rolePermissions = user.role?.permissions?.map(p => p.permission.key) || [];
            const userOverrides = Array.isArray(user.permissions) ? user.permissions : [];
            
            if (userOverrides.length > 0) {
                // Si permissions custom, on ignore les permissions du rôle (Override Total)
                user.mergedPermissions = userOverrides;
            } else {
                // Sinon, on prend les permissions standards du rôle
                user.mergedPermissions = rolePermissions;
            }
            
            console.log('✅ User found in DB. Role:', user.role?.name || user.roleLegacy);
            console.log('✅ passwordHash exists:', !!user.passwordHash);
        }

        if (user && user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
            // Audit Log - Tentative réussie
            await tracerAction({
                userId: user.id,
                organizationId: user.organizationId,
                action: 'CONNEXION_REUSSIE',
                resource: 'Authentification',
                resourceId: user.id,
                req
            });

            if (user.requires2FA) {
                // If 2FA code not provided, return the prompt
                if (!req.body.twoFactorCode) {
                    return res.json({
                        user: {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            role: user.role?.name || user.roleLegacy,
                            requires2FA: true,
                            securityQuestion: user.securityQuestion
                        }
                    });
                }

                // Verify 2FA code against securityAnswerHash
                const isValidAnswer = await bcrypt.compare(req.body.twoFactorCode.toLowerCase(), user.securityAnswerHash);
                if (!isValidAnswer) {
                    console.log('❌ Invalid 2FA code');
                    return res.status(401).json({ error: 'Invalid 2FA code' });
                }

                console.log('✅ 2FA code verified');
            }

            console.log('✅ Passing 2FA check...');
            
            // On s'assure que generateTokens reçoit les données minimales et propres
            const tokenPayload = {
                id: user.id,
                email: user.email,
                organizationId: user.organizationId,
                role: user.role?.name || user.roleLegacy || 'user',
                permissions: user.mergedPermissions || []
            };

            console.log('🗝️ Token Payload Logic:', { role: tokenPayload.role, email: tokenPayload.email });

            const { accessToken, refreshToken } = generateTokens(tokenPayload);
            console.log('✅ Tokens generated');

            // Set refresh token in cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            console.log('✅ Final User Data for Frontend:', { 
                id: user.id, 
                email: user.email, 
                role: user.role?.name || user.roleLegacy 
            });

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role?.name || user.roleLegacy,
                    name: user.name,
                    permissions: user.mergedPermissions,
                    organization: user.organization ? user.organization.name : 'N/A',
                    organizationConfig: user.organization?.config || {}
                },
                accessToken
            });
            console.log('✅ Response sent successfully');
        }
        else {
            // Audit Log - Échec de connexion (si l'utilisateur existe)
            if (user) {
                await tracerAction({
                    userId: user.id,
                    organizationId: user.organizationId,
                    action: 'CONNEXION_ECHEC',
                    resource: 'Authentification',
                    resourceId: user.id,
                    details: { motif: 'Mot de passe incorrect' },
                    req
                });
            }
            res.status(401).json({ error: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('❌ [CRITICAL LOGIN CRASH]');
        console.error('   Message:', error.message);
        console.error('   Code:', error.code);
        console.error('   Stack:', error.stack);
        
        // Handle database connection errors specifically
        if (error.code === 'P1001' || error.message?.includes("Can't reach database server")) {
            console.error('🔴 Database connection failed at login');
            return res.status(503).json({
                error: 'Base de données inaccessible',
                message: 'Le serveur ne parvient pas à contacter la base de données. Vérifiez que Docker Desktop est lancé.',
                code: 'DB_CONNECTION_ERROR'
            });
        }

        // Generic error
        res.status(500).json({
            error: 'Server error during login',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV ? error.stack : undefined
        });
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
            include: { 
                organization: true,
                role: {
                    include: {
                        permissions: {
                            include: { permission: true }
                        }
                    }
                }
            }
        });

        if (!user) return res.status(401).json({ error: 'User not found' });

        // Permissions avec politique d'Override Total pour le refresh
        const rolePermissions = user.role?.permissions.map(p => p.permission.key) || [];
        const userOverrides = Array.isArray(user.permissions) ? user.permissions : [];
        const mergedPermissions = userOverrides.length > 0 ? userOverrides : rolePermissions;

        const tokenPayload = {
            id: user.id,
            email: user.email,
            organizationId: user.organizationId,
            role: user.role?.name || user.roleLegacy || 'user',
            permissions: mergedPermissions || []
        };

        const tokens = generateTokens(tokenPayload);

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
// @desc    Change user password
// @route   POST /api/auth/change-password
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: hashedPassword }
        });

        await tracerAction({
            userId,
            organizationId: user.organizationId,
            action: 'CHANGEMENT_MOT_DE_PASSE',
            resource: 'Utilisateur',
            resourceId: userId,
            req
        });

        res.json({ message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
    }
};

// @desc    Update security question and recovery code
// @route   POST /api/auth/security-settings
export const updateSecuritySettings = async (req, res) => {
    try {
        const { securityQuestion, securityAnswer, recoveryCode } = req.body;
        const userId = req.user.id;

        const data = {};
        if (securityQuestion) data.securityQuestion = securityQuestion;
        if (securityAnswer) {
            const salt = await bcrypt.genSalt(10);
            data.securityAnswerHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), salt);
        }
        if (recoveryCode) {
            const salt = await bcrypt.genSalt(10);
            data.recoveryCodeHash = await bcrypt.hash(recoveryCode.trim(), salt);
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data
        });

        await tracerAction({
            userId,
            organizationId: user.organizationId,
            action: 'MISE_A_JOUR_SECURITE',
            resource: 'Utilisateur',
            resourceId: userId,
            req
        });

        res.json({ message: 'Paramètres de sécurité mis à jour' });
    } catch (error) {
        console.error('Security update error:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de la sécurité' });
    }
};

// @desc    Reset password (Forgot Password flow)
// @route   POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { email, securityAnswer, recoveryCode, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        let verified = false;

        if (recoveryCode && user.recoveryCodeHash) {
            verified = await bcrypt.compare(recoveryCode.trim(), user.recoveryCodeHash);
            if (verified) {
                // Invalider le code après usage
                await prisma.user.update({
                    where: { id: user.id },
                    data: { recoveryCodeHash: null }
                });
            }
        } else if (securityAnswer && user.securityAnswerHash) {
            verified = await bcrypt.compare(securityAnswer.trim().toLowerCase(), user.securityAnswerHash);
        }

        if (!verified) {
            return res.status(400).json({ error: 'Code de récupération ou réponse de sécurité incorrecte' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword }
        });

        await tracerAction({
            userId: user.id,
            organizationId: user.organizationId,
            action: 'REINITIALISATION_MOT_DE_PASSE',
            resource: 'Utilisateur',
            resourceId: user.id,
            req
        });

        res.json({ message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
};

// @desc    Verify 2FA (Security Question)
// @route   POST /api/auth/verify-2fa
export const verify2FA = async (req, res) => {
    try {
        const { id, email, answer } = req.body;
        console.log(`🔍 [2FA] Tentative de vérification pour ID/Email: ${id || email}`);

        if (!(id || email) || !answer) {
            return res.status(400).json({ error: 'Identifiant et réponse requis' });
        }

        const user = await prisma.user.findUnique({
            where: id ? { id } : { email: email.toLowerCase() },
            include: { organization: true }
        });

        if (!user) {
            console.log(`❌ [2FA] Utilisateur non trouvé pour ID: ${id}`);
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        if (!user.securityAnswerHash) {
            console.log(`❌ [2FA] Pas de réponse de sécurité configurée pour ${user.email}`);
            return res.status(400).json({ error: 'Sécurité non configurée pour ce compte' });
        }

        const isMatch = await bcrypt.compare(answer.trim().toLowerCase(), user.securityAnswerHash);

        if (!isMatch) {
            console.log(`❌ [2FA] Réponse incorrecte pour ${user.email}`);
            await tracerAction({
                userId: user.id,
                organizationId: user.organizationId,
                action: 'CONNEXION_ECHEC_2FA',
                resource: 'Authentification',
                resourceId: user.id,
                details: { motif: 'Réponse 2FA incorrecte' },
                req
            });
            return res.status(401).json({ error: 'Réponse de sécurité incorrecte' });
        }

        console.log(`✅ [2FA] Réponse correcte pour ${user.email}`);

        // Audit Log - Succès 2FA
        await tracerAction({
            userId: user.id,
            organizationId: user.organizationId,
            action: 'CONNEXION_REUSSIE',
            resource: 'Authentification',
            resourceId: user.id,
            details: { type: '2FA_QUESTION' },
            req
        });

        const tokens = generateTokens(user);
        console.log('✅ [2FA] Tokens générés');

        // Set refresh token in cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        console.log('✅ [2FA] Cookie refresh configuré');

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                organization: user.organization ? user.organization.name : 'N/A',
                organizationConfig: user.organization?.config || {}
            },
            accessToken: tokens.accessToken
        });
        console.log('✅ [2FA] Réponse envoyée avec succès');
    } catch (error) {
        console.error('❌ [2FA ERROR]:', error);
        res.status(500).json({
            error: 'Erreur lors de la vérification 2FA',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Start impersonating another user
// @route   POST /api/auth/impersonate
export const impersonateUser = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const adminUser = req.user;

        // 🛡️ [REINFORCEMENT] Bloquer Nested Impersonation
        if (adminUser.isSimulation) {
            return res.status(403).json({ error: "Impossible de lancer une simulation depuis une session déjà simulée." });
        }

        // 1. Verrou de sécurité : Seul un ADMIN_PROQUELEC peut simuler
        if (adminUser.role !== "ADMIN_PROQUELEC" && adminUser.email !== "admingem") {
            return res.status(403).json({ error: "Accès interdit : privilèges insuffisants." });
        }

        // 2. Trouver l'utilisateur cible et vérifier le multi-tenant
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: { 
                organization: true,
                role: {
                    include: {
                        permissions: { include: { permission: true } }
                    }
                }
            }
        });

        if (!targetUser) return res.status(404).json({ error: "Utilisateur cible non trouvé" });

        // 🛡️ [REINFORCEMENT] Politique sur rôles sensibles : Interdiction de simuler Admin/DG
        const targetRole = targetUser.role?.name || targetUser.roleLegacy;
        if ((targetRole === "ADMIN_PROQUELEC" || targetRole === "DG_PROQUELEC") && adminUser.email !== "admingem") {
            return res.status(403).json({ error: "Sécurité : Impossible de simuler un compte de Direction ou d'Administration." });
        }

        // Sécurité Multi-tenant : on ne simule pas hors de son organisation
        if (targetUser.organizationId !== adminUser.organizationId && adminUser.email !== "admingem") {
            return res.status(403).json({ error: "Interdit de simuler un utilisateur d'une autre organisation." });
        }

        // 3. Gestion des permissions (Audit REINFORCEMENT: Override total)
        const userOverrides = Array.isArray(targetUser.permissions) ? targetUser.permissions : [];
        let finalPermissions = [];
        
        if (userOverrides.length > 0) {
            // Si permissions custom, on ignore les permissions du rôle (Override Total)
            finalPermissions = userOverrides;
        } else {
            // Sinon, on prend les permissions standards du rôle
            finalPermissions = targetUser.role?.permissions.map(p => p.permission.key) || [];
        }

        // 4. Audit Log - Traçabilité
        await tracerAction({
            userId: adminUser.id,
            organizationId: adminUser.organizationId,
            action: "DEBUT_IMPERSONATION",
            resource: "Utilisateur",
            resourceId: targetUserId,
            details: { simulatedUser: targetUser.email, reason: req.body.reason || "Support" },
            req
        });

        // 5. Générer un JWT de simulation (Expiration courte 30m intégrée dans jwt.js)
        const tokenPayload = {
            id: targetUser.id,
            email: targetUser.email,
            organizationId: targetUser.organizationId,
            role: targetRole,
            permissions: finalPermissions
        };

        const { accessToken } = generateTokens(tokenPayload, adminUser);

        res.json({
            message: `Simulation active : ${targetUser.name}`,
            user: {
                id: targetUser.id,
                email: targetUser.email,
                role: targetRole,
                name: targetUser.name,
                permissions: finalPermissions,
                organization: targetUser.organization?.name,
                impersonatedBy: adminUser.id
            },
            accessToken
        });

    } catch (error) {
        console.error("Impersonation error:", error);
        res.status(500).json({ error: "Erreur lors de la tentative d'impersonation" });
    }
};

// @desc    Stop impersonating and return to admin
// @route   POST /api/auth/stop-impersonation
export const stopImpersonation = async (req, res) => {
    try {
        const currentUser = req.user;

        // 🔑 Vérifier que nous sommes bien en mode simulation
        if (!currentUser.isSimulation || !currentUser.impersonatorId) {
            return res.status(400).json({ error: "Aucune simulation active à arrêter." });
        }

        // 🔎 Retrouver l'admin original
        const adminUser = await prisma.user.findUnique({
            where: { id: currentUser.impersonatorId },
            include: { 
                organization: true,
                role: {
                    include: {
                        permissions: { include: { permission: true } }
                    }
                }
            }
        });

        if (!adminUser) return res.status(404).json({ error: "Administrateur original non retrouvé." });

        // 📝 Audit Log : FIN d'impersonation
        await tracerAction({
            userId: adminUser.id,
            organizationId: adminUser.organizationId,
            action: "FIN_IMPERSONATION",
            resource: "Utilisateur",
            resourceId: currentUser.id,
            details: { stoppedSimulationFor: currentUser.email },
            req
        });

        // 🛠️ Préparation des droits admin pour le nouveau token
        const rolePermissions = adminUser.role?.permissions.map(p => p.permission.key) || [];
        const userOverrides = Array.isArray(adminUser.permissions) ? adminUser.permissions : [];
        const adminPermissions = userOverrides.length > 0 ? userOverrides : rolePermissions;

        const tokenPayload = {
            id: adminUser.id,
            email: adminUser.email,
            organizationId: adminUser.organizationId,
            role: adminUser.role?.name || adminUser.roleLegacy,
            permissions: adminPermissions
        };

        // 🆕 Régénérer un token Admin neuf (Pas d'impersonatorId ici)
        const { accessToken } = generateTokens(tokenPayload);

        res.json({
            message: "Retour à l'identité administrateur réussi",
            user: {
                id: adminUser.id,
                email: adminUser.email,
                role: adminUser.role?.name || adminUser.roleLegacy,
                name: adminUser.name,
                permissions: adminPermissions,
                organization: adminUser.organization?.name
            },
            accessToken
        });

    } catch (error) {
        console.error("Stop impersonation error:", error);
        res.status(500).json({ error: "Erreur lors de l'arrêt de la simulation" });
    }
};

// @desc    Verify user password (for sensitive actions)
// @route   POST /api/auth/verify-password
export const verifyPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.id;

        if (!password) {
            return res.status(400).json({ error: 'Mot de passe requis' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        
        if (isMatch) {
            res.json({ success: true, message: 'Mot de passe vérifié' });
        } else {
            res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
        }
    } catch (error) {
        console.error('Verify password error:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
};
