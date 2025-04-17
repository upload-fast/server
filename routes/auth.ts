import { createRouter, defineEventHandler, getQuery, setCookie, getCookie, deleteCookie, sendRedirect, createError, setResponseStatus, readBody } from 'h3';
import { User } from '../models/user.js';
import { Session } from '../models/session.js';
import mongoose from 'mongoose';
import { generateRandomString } from '../lib/custom-uuid.js';
import { AuthService } from '../services/auth-service.js';
import vine, { errors } from "@vinejs/vine";

const authRouter = createRouter();

// Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FRONTEND_DOMAIN = process.env.FRONTEND_DOMAIN;
const BACKEND_URL = process.env.BACKEND_URL;

// Set redirect URI after validation
const REDIRECT_URI = `${BACKEND_URL}/api/auth/callback`;
const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_DURATION_DAYS = 35;

// Cookie options for cross-subdomain
const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * SESSION_DURATION_DAYS, // 35 days in seconds
    domain: `.${FRONTEND_DOMAIN}`, // Note the dot prefix to include all subdomains
    path: '/',
});

// Validation schemas
const registerSchema = vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8).maxLength(100),
    name: vine.string().minLength(2).maxLength(100),
});

const loginSchema = vine.object({
    email: vine.string().email(),
    password: vine.string(),
});

const resetPasswordSchema = vine.object({
    token: vine.string(),
    password: vine.string().minLength(8).maxLength(100),
});

const requestResetSchema = vine.object({
    email: vine.string().email(),
});

// Email & Password Registration
authRouter.post('/register', defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        await vine.validate({ schema: registerSchema, data: body });

        const { user, sessionId } = await AuthService.registerUser({
            email: body.email,
            password: body.password,
            name: body.name,
        });

        // Set session cookie
        setCookie(event, SESSION_COOKIE_NAME, sessionId, getCookieOptions());


        setResponseStatus(event, 201);
        return {
            success: true,
            user,
            message: 'Registration successful. Please verify your email.',
        };
    } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation error',
                data: error.messages,
            });
        }
        throw error;
    }
}));

// Email & Password Login
authRouter.post('/login', defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        await vine.validate({ schema: loginSchema, data: body });

        const { user, sessionId } = await AuthService.loginWithEmailPassword(
            body.email,
            body.password
        );

        // Set session cookie
        setCookie(event, SESSION_COOKIE_NAME, sessionId, getCookieOptions());

        return {
            success: true,
            user,
        };
    } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation error',
                data: error.messages,
            });
        }
        throw error;
    }
}));

// Request Password Reset
authRouter.post('/password-reset/request', defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        await vine.validate({ schema: requestResetSchema, data: body });

        const resetToken = await AuthService.requestPasswordReset(body.email);


        if (process.env.NODE_ENV === 'development') {
            return {
                success: true,
                message: 'If your email is registered, you will receive a password reset link.',
                devToken: resetToken, // Only in development
            };
        }

        return {
            success: true,
            message: 'If your email is registered, you will receive a password reset link.',
        };
    } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation error',
                data: error.messages,
            });
        }

        // Always return the same message regardless of whether the email exists
        // to prevent email enumeration attacks
        return {
            success: true,
            message: 'If your email is registered, you will receive a password reset link.',
        };
    }
}));

// Reset Password
authRouter.post('/password-reset/reset', defineEventHandler(async (event) => {
    try {
        const body = await readBody(event);
        await vine.validate({ schema: resetPasswordSchema, data: body });

        await AuthService.resetPassword(body.token, body.password);

        return {
            success: true,
            message: 'Password reset successful. You can now log in with your new password.',
        };
    } catch (error) {
        if (error instanceof errors.E_VALIDATION_ERROR) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Validation error',
                data: error.messages,
            });
        }
        throw error;
    }
}));

// Verify Email
authRouter.get('/email/verify/:token', defineEventHandler(async (event) => {
    try {
        const token = event.context.params?.token;
        
        if (!token) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid verification token',
            });
        }

        await AuthService.verifyEmail(token);

        // Redirect to frontend with success message
        return sendRedirect(event, `https://${FRONTEND_DOMAIN}/auth/email-verified`);
    } catch (error) {
        // Redirect to frontend with error
        return sendRedirect(event, `https://${FRONTEND_DOMAIN}/auth/verification-error`);
    }
}));

// Initiate GitHub OAuth 
authRouter.get('/github', defineEventHandler(async (event) => {
    const query = getQuery(event);
    const callbackUrl = query.callbackUrl || `https://${FRONTEND_DOMAIN}/auth/callback`;

    const state = Buffer.from(JSON.stringify({ callbackUrl })).toString('base64');

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user:email&state=${state}`;
    return sendRedirect(event, authUrl);
}));

// GitHub OAuth callback (existing code)
authRouter.get('/callback', defineEventHandler(async (event) => {
    const query = getQuery(event);
    const code = query.code as string;
    const state = query.state as string;

    if (!code) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Authorization code is missing',
        });
    }

    try {
        // Parse the state parameter to get the frontend callback URL
        let callbackUrl = `https://${FRONTEND_DOMAIN}/auth/callback`;
        try {
            const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
            if (stateData.callbackUrl) {
                callbackUrl = stateData.callbackUrl;
            }
        } catch (e) {
            console.error('Failed to parse state parameter:', e);
        }

        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: REDIRECT_URI,
            })
        });

        const tokenData = await tokenResponse.json();
        const { access_token, refresh_token } = tokenData as { access_token: string, refresh_token: string };

        // Get user data from GitHub
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const userData = await userResponse.json() as { id: string, name: string, login: string, avatar_url: string };

        // Get user email from GitHub
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const emailsData = await emailsResponse.json() as { email: string, primary: boolean }[];

        const primaryEmail = emailsData.find((email: { email: string, primary: boolean }) => email.primary)?.email;

        if (!primaryEmail) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Unable to get primary email from GitHub',
            });
        }

        // Find or create user
        let user = await User.findOne({ githubId: userData.id });

        // Check if email exists but not linked to this GitHub account
        if (!user) {
            const existingUserWithEmail = await User.findOne({ email: primaryEmail });
            
            if (existingUserWithEmail) {
                // Link GitHub account to existing email account
                existingUserWithEmail.githubId = userData.id;
                existingUserWithEmail.avatar = existingUserWithEmail.avatar || userData.avatar_url;
                existingUserWithEmail.accessToken = access_token;
                if (refresh_token) existingUserWithEmail.refreshToken = refresh_token;
                await existingUserWithEmail.save();
                user = existingUserWithEmail;
            }
        }

        if (!user) {
            // Create new user with GitHub credentials
            user = new User({
                githubId: userData.id,
                email: primaryEmail,
                name: userData.name || userData.login,
                avatar: userData.avatar_url,
                accessToken: access_token,
                refreshToken: refresh_token,
                isEmailVerified: true, 
            });
        } else {
            // Update existing user
            user.accessToken = access_token;
            if (refresh_token) user.refreshToken = refresh_token;
            user.name = userData.name || userData.login;
            user.avatar = userData.avatar_url;
        }

        await user.save();

        // Create a new session
        const sessionId = await AuthService.createSession(user._id);

        // Set session cookie
        setCookie(event, SESSION_COOKIE_NAME, sessionId, getCookieOptions());

        // Redirect to the frontend
        return sendRedirect(event, callbackUrl);
    } catch (error) {
        console.error('GitHub authentication error:', error);
        // Redirect to frontend with error
        const redirectUrl = new URL(`https://${FRONTEND_DOMAIN}/auth/error`);
        redirectUrl.searchParams.append('message', 'Authentication failed');
        return sendRedirect(event, redirectUrl.toString());
    }
}));

// Get current user
authRouter.get('/me', defineEventHandler(async (event) => {
    const sessionId = getCookie(event, SESSION_COOKIE_NAME);

    if (!sessionId) {
        setResponseStatus(event, 401)
        return { authenticated: false };
    }

    const userId = await AuthService.validateSession(sessionId);

    if (!userId) {
        deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());
        return { authenticated: false };
    }

    try {
        const user = await User.findById(userId, { accessToken: 0, refreshToken: 0 });

        if (!user) {
            deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());
            return { authenticated: false };
        }

        return {
            authenticated: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
                isEmailVerified: user.isEmailVerified,
            },
        };
    } catch (error) {
        setResponseStatus(event, 500)
        console.error('Error fetching user:', error);
        return { authenticated: false };
    }
}));

// Logout 
authRouter.post('/logout', defineEventHandler(async (event) => {
    const sessionId = getCookie(event, SESSION_COOKIE_NAME);

    if (sessionId) {
        await AuthService.deleteSession(sessionId);
    }

    deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());

    return { success: true };
}));

// Logout from all devices 
authRouter.post('/logout-all', defineEventHandler(async (event) => {
    const sessionId = getCookie(event, SESSION_COOKIE_NAME);

    if (!sessionId) {
        return { success: false, message: 'Not authenticated' };
    }

    const userId = await AuthService.validateSession(sessionId);

    if (!userId) {
        deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());
        return { success: false, message: 'Invalid session' };
    }

    try {
        // Delete all sessions for this user
        await AuthService.deleteAllSessions(userId);

        // Delete the cookie
        deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());

        return { success: true };
    } catch (error) {
        console.error('Error logging out from all devices:', error);
        return { success: false, message: 'Server error' };
    }
}));

export default authRouter;