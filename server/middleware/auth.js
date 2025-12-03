import jwt from 'jsonwebtoken';
import requestIp from 'request-ip';
import crypto from 'crypto';
import User from '../models/User.js';
import IPAuthorization from '../models/IPAuthorization.js';
import { sendIPAuthorizationEmail } from '../lib/emailService.js';

function normalizeIP(ip) {
  if (!ip) return ip;
  if (ip.includes(',')) ip = ip.split(',')[0].trim();
  if (ip.includes(':') && ip.split(':').length > 2 && ip.includes('.')) {
    const last = ip.split(':').pop();
    if (last && last.includes('.')) ip = last;
  } else if (ip.includes(':') && !ip.includes('.')) {
    ip = ip.split('%')[0];
  } else if (ip.includes(':') && ip.includes('.')) {
    ip = ip.split(':')[0];
  }
  return ip.trim();
}

export async function authenticateToken(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    console.log('=== MIDDLEWARE: AUTHENTICATING USER ===');
    console.log('User from token:', decoded.username);
    console.log('User ID from token:', decoded.userId);
    console.log('User ID from DB:', user._id.toString());
    console.log('Username from DB:', user.username);
    console.log('This user has', user.authorizedIPs?.length || 0, 'authorized IPs');

    const rawClientIP = requestIp.getClientIp(req) || 
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
      req.connection.remoteAddress || 
      req.socket.remoteAddress || 
      req.ip;
    const clientIP = normalizeIP(rawClientIP);

    const isAuthorizedIP = user.authorizedIPs && user.authorizedIPs.some(auth => {
      const normalizedAuthIP = normalizeIP(auth.ip);
      const matches = normalizedAuthIP === clientIP;
      console.log(`Middleware IP check: ${normalizedAuthIP} === ${clientIP} ? ${matches}`);
      return matches;
    });

    if (!isAuthorizedIP) {
      console.log('=== MIDDLEWARE: IP AUTHORIZATION CHECK FAILED ===');
      console.log('User:', user.username);
      console.log('Raw IP:', rawClientIP);
      console.log('Normalized Current IP:', clientIP);
      console.log('User Agent:', req.headers['user-agent']);
      console.log('Authorized IPs:', JSON.stringify(user.authorizedIPs));
      console.log('Request Path:', req.path);
      console.log('Request Method:', req.method);

      try {
        await IPAuthorization.deleteMany({ username: user.username, ip: clientIP, authorized: false });

        const authToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const ipAuth = new IPAuthorization({
          username: user.username,
          ip: clientIP,
          token: authToken,
          userAgent: req.headers['user-agent'],
          expiresAt,
        });

        ipAuth.ip = normalizeIP(ipAuth.ip);
        await ipAuth.save();

        const authUrl = `${req.protocol}://${req.get('host')}/api/auth/authorize-ip?token=${authToken}`;

        try {
          await sendIPAuthorizationEmail(user.email, user.username, ipAuth.ip, authUrl);
          console.log('✓ IP authorization email sent to:', user.email);
        } catch (emailErr) {
          console.error('Failed to send IP authorization email:', emailErr);
        }
        
        console.log('✓ IP authorization request created for IP:', clientIP);
      } catch (err) {
        console.error('Error creating/sending IP authorization:', err);
      }

      console.log('❌ Access denied - IP not authorized');
      console.log('=== END MIDDLEWARE IP CHECK ===');

      return res.status(403).json({ 
        error: 'IP_NOT_AUTHORIZED',
        message: 'Your IP address has changed or is not authorized. An authorization email has been sent to your registered email address. Please verify the new IP address to continue.',
        requiresReauth: true,
        ip: clientIP
      });
    }

    console.log(`✓ Middleware: IP ${clientIP} is authorized for user ${user.username}`);

    req.user = {
      id: user._id,
      username: user.username,
      publicKey: user.publicKey,
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

export async function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      console.error('Socket auth: User not found');
      return next(new Error('Authentication error'));
    }

    socket.userId = decoded.userId;
    socket.username = decoded.username;

    const rawClientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
    const clientIP = normalizeIP(rawClientIP);

    const isAuthorizedIP = user.authorizedIPs && user.authorizedIPs.some(auth => {
      const normalizedAuthIP = normalizeIP(auth.ip);
      return normalizedAuthIP === clientIP;
    });

    if (!isAuthorizedIP) {
      console.log('=== SOCKET: IP AUTHORIZATION CHECK FAILED ===');
      console.log('User:', user.username);
      console.log('Raw IP:', rawClientIP);
      console.log('Normalized IP:', clientIP);
      console.log('Authorized IPs:', JSON.stringify(user.authorizedIPs));

      try {
        await IPAuthorization.deleteMany({ username: user.username, ip: clientIP, authorized: false });
        
        const authToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        
        const ipAuth = new IPAuthorization({
          username: user.username,
          ip: clientIP,
          token: authToken,
          userAgent: socket.handshake.headers['user-agent'],
          expiresAt,
        });
        
        ipAuth.ip = normalizeIP(ipAuth.ip);
        await ipAuth.save();
        
        const protocol = socket.handshake.headers['x-forwarded-proto'] || 'https';
        const host = socket.handshake.headers.host;
        const authUrl = `${protocol}://${host}/api/auth/authorize-ip?token=${authToken}`;
        
        try {
          await sendIPAuthorizationEmail(user.email, user.username, ipAuth.ip, authUrl);
          console.log('✓ Socket: IP authorization email sent to:', user.email);
        } catch (emailErr) {
          console.error('Socket: Failed to send IP authorization email:', emailErr);
        }
      } catch (e) {
        console.error('Socket IP auth creation error:', e);
      }
      
      console.log('❌ Socket connection denied - IP not authorized');
      console.log('=== END SOCKET IP CHECK ===');
      return next(new Error('IP_NOT_AUTHORIZED'));
    }

    console.log(`✓ Socket: IP ${clientIP} is authorized for user ${user.username}`);
    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication error'));
  }
}
