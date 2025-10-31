import express from 'express';
import requestIp from 'request-ip';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

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

const router = express.Router();

// Protected debug route: returns raw/normalized IP and user's authorized IPs
router.get('/ipinfo', authenticateToken, async (req, res) => {
  try {
    const rawClientIP = requestIp.getClientIp(req) || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection.remoteAddress || req.socket.remoteAddress || req.ip;
    const clientIP = normalizeIP(rawClientIP);

    const user = await User.findById(req.user.id);

    res.json({
      rawClientIP,
      clientIP,
      authorizedIPs: user.authorizedIPs || [],
    });
  } catch (err) {
    console.error('Debug IP info error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
