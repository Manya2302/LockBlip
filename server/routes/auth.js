import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import requestIp from 'request-ip';
import { OAuth2Client } from 'google-auth-library';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import User from '../models/User.js';
import OTP from '../models/OTP.js';
import IPAuthorization from '../models/IPAuthorization.js';
import { sendOTPEmail, sendIPAuthorizationEmail } from '../lib/emailService.js';
import { encryptField, decryptField } from '../lib/encryption.js';
import { body, validationResult } from 'express-validator';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();

// Normalize client IPs so comparisons are consistent across IPv6-mapped addresses
function normalizeIP(ip) {
  if (!ip) return ip;
  // If header contains multiple IPs (proxy chain), take the first
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  // Remove port if present (e.g. 1.2.3.4:12345)
  if (ip.includes(':') && ip.split(':').length > 2 && ip.includes('.')) {
    // IPv6 with embedded IPv4 like ::ffff:1.2.3.4
    const last = ip.split(':').pop();
    if (last && last.includes('.')) ip = last;
  } else if (ip.includes(':') && !ip.includes('.')) {
    // pure IPv6 - keep as-is but trim
    ip = ip.split('%')[0]; // drop zone id if present
  } else if (ip.includes(':') && ip.includes('.')) {
    // IPv4 with port
    ip = ip.split(':')[0];
  }

  return ip.trim();
}

router.post('/check-username',
  body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username } = req.body;
      
      const allUsers = await User.find({});
      const usernameTaken = allUsers.some(user => user.username === username);

      res.json({ available: !usernameTaken });
    } catch (error) {
      console.error('Username check error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/send-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('fullName').trim().isLength({ min: 2 }),
    body('phone').trim().matches(/^[0-9+\-() ]+$/),
    body('dateOfBirth').isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      // Prevent rapid duplicate sends: if there's a recent unverified OTP for this email (<=60s), don't create/send another.
      const encryptedEmail = encryptField(email);
      const lastUnverified = await OTP.findOne({ email: encryptedEmail, verified: false }).sort({ createdAt: -1 });
      if (lastUnverified) {
        const ageMs = Date.now() - new Date(lastUnverified.createdAt).getTime();
        if (ageMs <= 60 * 1000) {
          // Recent OTP already sent; return success to the client without resending.
          return res.json({ message: 'OTP recently sent' });
        }
      }

      // Remove older unverified OTPs before creating a new one
      await OTP.deleteMany({ email: encryptedEmail, verified: false });

      const otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otpDoc = new OTP({
        email,
        otp,
        expiresAt,
      });

      await otpDoc.save();

      const emailSent = await sendOTPEmail(email, otp);
      
      if (!emailSent) {
        return res.status(500).json({ error: 'Failed to send OTP email' });
      }

      res.json({ message: 'OTP sent successfully' });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp } = req.body;

      // Find candidate OTPs by otp value (use .lean() to get raw data without getters)
      const candidates = await OTP.find({ otp, verified: false }).sort({ createdAt: -1 }).limit(5).lean();

      // Try to find a candidate whose decrypted email matches the provided email
      const now = new Date();
      const graceMs = 2 * 60 * 1000; // 2 minute grace
      const normalizedProvidedEmail = (email || '').toString().trim().toLowerCase();
      
      let matched = null;
      for (const c of candidates) {
        let storedEmail;
        try {
          // c.email is raw encrypted value because we used .lean()
          storedEmail = decryptField(c.email);
        } catch (e) {
          storedEmail = null;
        }
        const normalizedStoredEmail = storedEmail ? storedEmail.toString().trim().toLowerCase() : null;
        
        if (normalizedStoredEmail === normalizedProvidedEmail) {
          const expiresAt = c.expiresAt instanceof Date ? c.expiresAt : new Date(c.expiresAt);
          if ((expiresAt.getTime() + graceMs) > now.getTime()) {
            matched = c;
            break;
          } else {
            // expired candidate; delete it
            await OTP.deleteOne({ _id: c._id });
            return res.status(400).json({ error: 'OTP expired' });
          }
        }
      }

      if (!matched) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      // Update OTP as verified (matched is a plain object from .lean())
      await OTP.updateOne({ _id: matched._id }, { verified: true });

      res.json({ message: 'OTP verified successfully' });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/register',
  [
    body('username').trim().isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
    body('password').isLength({ min: 8 }),
    body('email').isEmail().normalizeEmail(),
    body('fullName').trim().isLength({ min: 2 }),
    body('phone').trim().matches(/^[0-9+\-() ]+$/),
    body('dateOfBirth').isISO8601(),
    body('publicKey').notEmpty(),
    body('privateKey').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, email, fullName, phone, dateOfBirth, publicKey, privateKey } = req.body;

      // Get and normalize client IP address
      const rawClientIP = requestIp.getClientIp(req) || 
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
        req.connection.remoteAddress || 
        req.socket.remoteAddress || 
        req.ip;
      const clientIP = normalizeIP(rawClientIP);
      const userAgent = req.headers['user-agent'];

      // Find verified OTPs and check if any match the provided email
      const verifiedOTPs = await OTP.find({ verified: true }).lean();
      const normalizedEmail = email.trim().toLowerCase();
      
      let otpDoc = null;
      for (const otp of verifiedOTPs) {
        let storedEmail;
        try {
          storedEmail = decryptField(otp.email);
        } catch (e) {
          storedEmail = null;
        }
        if (storedEmail && storedEmail.trim().toLowerCase() === normalizedEmail) {
          otpDoc = otp;
          break;
        }
      }

      if (!otpDoc) {
        return res.status(400).json({ error: 'Email not verified' });
      }

      const allUsers = await User.find({});
      const usernameTaken = allUsers.some(user => user.username === username);

      if (usernameTaken) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      const user = new User({
        username,
        password,
        email,
        fullName,
        phone,
        dateOfBirth,
        publicKey,
        privateKey,
        isVerified: true,
        authorizedIPs: [{
          ip: clientIP,
          authorizedAt: new Date(),
          userAgent: userAgent || 'Unknown'
        }]
      });

      await user.save();
      
      console.log('✓ User registered with initial IP:', clientIP);

      // Delete the verified OTP using its ID
      await OTP.deleteOne({ _id: otpDoc._id });

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set token as httpOnly cookie for automatic inclusion in requests
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          publicKey: user.publicKey,
          privateKey: user.privateKey,
          themePreference: user.themePreference || 'dark',
        },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/login',
  [
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;
      
  const rawClientIP = requestIp.getClientIp(req) || 
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
        req.connection.remoteAddress || 
        req.socket.remoteAddress || 
        req.ip;
  const clientIP = normalizeIP(rawClientIP);
      
      const userAgent = req.headers['user-agent'];

      const allUsers = await User.find({});
      const foundUser = allUsers.find(u => u.username === username);
      
      if (!foundUser) {
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials. Please check your username and password or reset your password.',
          redirectToForgotPassword: true
        });
      }
      
      console.log('=== USER LOOKUP START ===');
      console.log('Looking up user:', username);
      console.log('Found user ID:', foundUser._id);
      console.log('=== USER LOOKUP END ===');
      
      const user = await User.findById(foundUser._id);

      if (!user) {
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials. Please check your username and password or reset your password.',
          redirectToForgotPassword: true
        });
      }
      
      console.log('=== USER VERIFICATION ===');
      console.log('Verified user ID:', user._id);
      console.log('Verified username:', user.username);
      console.log('This user has', user.authorizedIPs?.length || 0, 'authorized IPs');
      console.log('=== END USER VERIFICATION ===');

      const passwordMatch = await user.comparePassword(password);
      if (!passwordMatch) {
        return res.status(401).json({ 
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials. Please check your username and password or reset your password.',
          redirectToForgotPassword: true
        });
      }

      console.log('=== LOGIN IP VERIFICATION START ===');
      console.log('Checking IP for user:', username);
      console.log('User ID:', user._id.toString());
      console.log('Raw IP:', rawClientIP);
      console.log('Normalized IP:', clientIP);
      console.log('User Agent:', userAgent);
      console.log('This user\'s authorized IPs:', JSON.stringify(user.authorizedIPs));
      console.log('Number of authorized IPs for this user:', user.authorizedIPs?.length || 0);

      if (!user.authorizedIPs) {
        console.log('WARNING: authorizedIPs is null/undefined for user', username);
        user.authorizedIPs = [];
      }

      const isFirstTimeLogin = user.authorizedIPs.length === 0;
      const isKnownIP = user.authorizedIPs.some(auth => {
        const normalizedAuthIP = normalizeIP(auth.ip);
        const matches = normalizedAuthIP === clientIP;
        console.log(`Comparing stored IP ${normalizedAuthIP} === current IP ${clientIP} ? ${matches}`);
        return matches;
      });

      console.log('First time login for user', username + ':', isFirstTimeLogin);
      console.log('Known IP for user', username + ':', isKnownIP);
      console.log('=== LOGIN IP VERIFICATION END ===');

      if (isFirstTimeLogin || !isKnownIP) {
        console.log('❌ IP NOT AUTHORIZED - Blocking login and sending email verification');
        
        await IPAuthorization.deleteMany({ username, ip: clientIP, authorized: false });

        const authToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const ipAuth = new IPAuthorization({
          username,
          ip: clientIP,
          token: authToken,
          userAgent,
          expiresAt,
        });

        ipAuth.ip = normalizeIP(ipAuth.ip);
        await ipAuth.save();

        const authUrl = `${req.protocol}://${req.get('host')}/api/auth/authorize-ip?token=${authToken}`;
        
        try {
          await sendIPAuthorizationEmail(user.email, username, clientIP, authUrl);
          console.log('✓ IP authorization email sent to:', user.email);
        } catch (emailError) {
          console.error('Failed to send IP authorization email:', emailError);
        }

        return res.status(403).json({
          error: 'IP_AUTHORIZATION_REQUIRED',
          message: isFirstTimeLogin 
            ? 'First-time login detected. An authorization email has been sent to your registered email address. Please check your email to authorize this IP address before logging in.'
            : 'Login attempt from a new IP address detected. An authorization email has been sent to your registered email address. Please verify this new IP address to continue.',
          isFirstTimeLogin,
          ip: clientIP,
          email: user.email
        });
      }

      console.log('✓ IP AUTHORIZED - Allowing login');

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set token as httpOnly cookie for automatic inclusion in requests
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        token,
        user: {
          id: user._id,
          username: user.username,
          publicKey: user.publicKey,
          privateKey: user.privateKey,
          themePreference: user.themePreference || 'dark',
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/authorize-ip', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send('<h1>Authorization token is required</h1>');
    }

    const ipAuth = await IPAuthorization.findOne({ token, authorized: false });

    if (!ipAuth) {
      return res.status(400).send('<h1>Invalid or expired authorization link</h1>');
    }

    if (new Date() > ipAuth.expiresAt) {
      await IPAuthorization.deleteOne({ _id: ipAuth._id });
      return res.status(400).send('<h1>Authorization link expired</h1>');
    }

    const allUsers = await User.find({});
    const foundUser = allUsers.find(u => u.username === ipAuth.username);

    if (!foundUser) {
      console.error('User not found for IP authorization:', ipAuth.username);
      return res.status(400).send('<h1>User not found</h1>');
    }

    const user = await User.findById(foundUser._id);
    
    if (!user) {
      console.error('User not found by ID:', foundUser._id);
      return res.status(400).send('<h1>User not found</h1>');
    }
    
    console.log('=== IP AUTHORIZATION START ===');
    console.log('User:', user.username);
    console.log('IP to authorize:', ipAuth.ip);
    console.log('Normalized IP:', normalizeIP(ipAuth.ip));
    console.log('Current authorizedIPs:', JSON.stringify(user.authorizedIPs));

    const normalizedNewIP = normalizeIP(ipAuth.ip);
    const ipExists = user.authorizedIPs && user.authorizedIPs.some(auth => normalizeIP(auth.ip) === normalizedNewIP);
    
    if (!ipExists) {
      if (!user.authorizedIPs) {
        user.authorizedIPs = [];
      }
      
      user.authorizedIPs.push({
        ip: normalizedNewIP,
        authorizedAt: new Date(),
        userAgent: ipAuth.userAgent || 'Unknown',
      });
      
      console.log('After push - authorizedIPs:', JSON.stringify(user.authorizedIPs));

      await user.save();
      
      const savedUser = await User.findById(user._id);
      console.log('Verification - Saved authorizedIPs:', JSON.stringify(savedUser.authorizedIPs));
      console.log('✓ IP address successfully saved to database:', normalizedNewIP);
    } else {
      console.log('IP already exists in authorizedIPs:', normalizedNewIP);
    }

    ipAuth.authorized = true;
    await ipAuth.save();
    
    console.log('=== IP AUTHORIZATION COMPLETE ===');

    res.send(`
      <html>
        <head>
          <title>Device Authorized - LockBlip</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #0b1020, #1b1f3a);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255,255,255,0.1);
              border-radius: 10px;
            }
            h1 { color: #2DE2A9; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Device Authorized</h1>
            <p>You can now close this window and return to LockBlip to log in.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('IP authorization error:', error);
    res.status(500).send('<h1>Server error</h1>');
  }
});

router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;

      const allUsers = await User.find({});
      const foundUser = allUsers.find(u => u.email === email);

      if (!foundUser) {
        return res.json({ message: 'If an account exists with this email, you will receive a password reset code.' });
      }
      
      const user = await User.findById(foundUser._id);

      const encryptedEmail = encryptField(email);
      await OTP.deleteMany({ email: encryptedEmail, verified: false });

      const otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otpDoc = new OTP({
        email,
        otp,
        expiresAt,
      });

      await otpDoc.save();
      await sendOTPEmail(email, otp);

      res.json({ message: 'If an account exists with this email, you will receive a password reset code.' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp, newPassword } = req.body;

      const candidates = await OTP.find({ otp, verified: false }).sort({ createdAt: -1 }).limit(5).lean();

      const now = new Date();
      const graceMs = 2 * 60 * 1000;
      const normalizedProvidedEmail = (email || '').toString().trim().toLowerCase();
      
      let matched = null;
      for (const c of candidates) {
        let storedEmail;
        try {
          storedEmail = decryptField(c.email);
        } catch (e) {
          storedEmail = null;
        }
        const normalizedStoredEmail = storedEmail ? storedEmail.toString().trim().toLowerCase() : null;
        
        if (normalizedStoredEmail === normalizedProvidedEmail) {
          const expiresAt = c.expiresAt instanceof Date ? c.expiresAt : new Date(c.expiresAt);
          if ((expiresAt.getTime() + graceMs) > now.getTime()) {
            matched = c;
            break;
          } else {
            await OTP.deleteOne({ _id: c._id });
            return res.status(400).json({ error: 'OTP expired' });
          }
        }
      }

      if (!matched) {
        return res.status(400).json({ error: 'Invalid or expired OTP' });
      }

      const allUsers = await User.find({});
      const foundUser = allUsers.find(u => u.email === email);

      if (!foundUser) {
        return res.status(400).json({ error: 'User not found' });
      }
      
      const user = await User.findById(foundUser._id);

      user.password = newPassword;
      await user.save();

      await OTP.deleteOne({ _id: matched._id });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

router.post('/clear-authorized-ips', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const allUsers = await User.find({});
    const foundUser = allUsers.find(u => u.username === username);

    if (!foundUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = await User.findById(foundUser._id);

    user.authorizedIPs = [];
    await user.save();

    res.json({ message: 'Authorized IPs cleared successfully. Please logout and login again to trigger IP authorization.' });
  } catch (error) {
    console.error('Clear IPs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' });
    }

    const rawClientIP = requestIp.getClientIp(req) || 
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
      req.connection.remoteAddress || 
      req.socket.remoteAddress || 
      req.ip;
    const clientIP = normalizeIP(rawClientIP);
    const userAgent = req.headers['user-agent'];

    const allUsers = await User.find({}).lean({ getters: true });
    let existingUser = allUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      const user = await User.findById(existingUser._id);

      const isIPAuthorized = user.authorizedIPs?.some(
        (ipObj) => ipObj.ip === clientIP
      );

      if (!isIPAuthorized) {
        const authCode = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await IPAuthorization.deleteMany({ 
          userId: user._id,
          ip: clientIP,
        });

        const ipAuth = new IPAuthorization({
          userId: user._id,
          ip: clientIP,
          userAgent: userAgent || 'Unknown',
          authorizationCode: authCode,
          expiresAt,
        });

        await ipAuth.save();

        const emailSent = await sendIPAuthorizationEmail(
          user.email,
          authCode,
          clientIP,
          userAgent
        );

        if (!emailSent) {
          return res.status(500).json({ 
            error: 'Failed to send authorization email',
            requiresIPAuth: true 
          });
        }

        return res.status(403).json({
          error: 'IP_NOT_AUTHORIZED',
          message: 'A new device or location was detected. Please check your email to authorize this login.',
          requiresIPAuth: true,
        });
      }

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        token,
        user: {
          id: user.publicKey,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          description: user.description,
          profileImage: user.profileImage || picture,
          privateKey: user.privateKey,
          publicKey: user.publicKey,
        },
      });
    }

    const username = email.split('@')[0] + '_' + Math.random().toString(36).substring(2, 8);
    
    const keyPair = nacl.box.keyPair();
    const publicKeyBase64 = naclUtil.encodeBase64(keyPair.publicKey);
    const privateKeyBase64 = naclUtil.encodeBase64(keyPair.secretKey);

    const randomPassword = crypto.randomBytes(32).toString('hex');

    const newUser = new User({
      username,
      password: randomPassword,
      email,
      fullName: name || 'Google User',
      phone: '+0000000000',
      dateOfBirth: '2000-01-01',
      publicKey: publicKeyBase64,
      privateKey: privateKeyBase64,
      isVerified: true,
      profileImage: picture || '',
      authorizedIPs: [{
        ip: clientIP,
        authorizedAt: new Date(),
        userAgent: userAgent || 'Unknown'
      }]
    });

    await newUser.save();

    console.log('✓ User registered via Google OAuth:', username);

    const token = jwt.sign(
      { userId: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      token,
      user: {
        id: newUser.publicKey,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        phone: newUser.phone,
        dateOfBirth: newUser.dateOfBirth,
        description: newUser.description,
        profileImage: newUser.profileImage,
        privateKey: newUser.privateKey,
        publicKey: newUser.publicKey,
        themePreference: newUser.themePreference || 'dark',
      },
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

export default router;
