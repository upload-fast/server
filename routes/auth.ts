import { createRouter, defineEventHandler, getQuery, setCookie, getCookie, deleteCookie, sendRedirect, createError } from 'h3';
import { User } from '../models/user.js';
import { Session } from '../models/session.js';
import mongoose from 'mongoose';
import { generateRandomString } from '../lib/custom-uuid.js';

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
    maxAge: 60 * 60 * 24 * SESSION_DURATION_DAYS, // 7 days in seconds
    domain: `.${FRONTEND_DOMAIN}`, // Note the dot prefix to include all subdomains
    path: '/',
});

// Helper to create a new session
async function createSession(userId: mongoose.Types.ObjectId): Promise<string> {
    const sessionId = generateRandomString({ length: 32 });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await Session.create({
        userId,
        sessionId,
        expiresAt,
    });

    return sessionId;
}

// Helper to validate a session
async function validateSession(sessionId: string): Promise<mongoose.Types.ObjectId | null> {
    const session = await Session.findOne({ sessionId });
    if (!session) return null;
    return session.userId;
}

// Helper to delete a session
async function deleteSession(sessionId: string): Promise<boolean> {
    try {
        await Session.deleteOne({ sessionId });
        return true;
    } catch (error) {
        return false;
    }
}

// Initiate GitHub OAuth flow
authRouter.get('/login', defineEventHandler(async (event) => {
    
    const query = getQuery(event);
    const callbackUrl = query.callbackUrl || `https://${FRONTEND_DOMAIN}/auth/callback`;

    const state = Buffer.from(JSON.stringify({ callbackUrl })).toString('base64');

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user:email&state=${state}`;
    return sendRedirect(event, authUrl);
}));

// GitHub OAuth callback
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

        if (!user) {
            user = new User({
                githubId: userData.id,
                email: primaryEmail,
                name: userData.name || userData.login,
                avatar: userData.avatar_url,
                accessToken: access_token,
                refreshToken: refresh_token,
            });
        } else {
            user.accessToken = access_token;
            if (refresh_token) user.refreshToken = refresh_token;
            user.name = userData.name || userData.login;
            user.avatar = userData.avatar_url;
        }

        await user.save();

        // Create a new session
        const sessionId = await createSession(user._id);

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
        return { authenticated: false };
    }

    const userId = await validateSession(sessionId);

    if (!userId) {
        deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());
        return { authenticated: false };
    }

    try {
        const user = await User.findById(userId).select('-accessToken -refreshToken');

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
            },
        };
    } catch (error) {
        console.error('Error fetching user:', error);
        return { authenticated: false };
    }
}));

// Logout
authRouter.post('/logout', defineEventHandler(async (event) => {
    const sessionId = getCookie(event, SESSION_COOKIE_NAME);

    if (sessionId) {
        await deleteSession(sessionId);
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

    const userId = await validateSession(sessionId);

    if (!userId) {
        deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());
        return { success: false, message: 'Invalid session' };
    }

    try {
        // Delete all sessions for this user
        await Session.deleteMany({ userId });

        // Delete the cookie
        deleteCookie(event, SESSION_COOKIE_NAME, getCookieOptions());

        return { success: true };
    } catch (error) {
        console.error('Error logging out from all devices:', error);
        return { success: false, message: 'Server error' };
    }
}));

export default authRouter;
