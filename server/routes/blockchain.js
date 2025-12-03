import express from 'express';
import { getUserBlockchain, validateChain } from '../lib/blockchain.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/ledger', authenticateToken, async (req, res) => {
  try {
    const blocks = await getUserBlockchain(req.user.username);
    res.json(blocks);
  } catch (error) {
    console.error('Get ledger error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/validate', authenticateToken, async (req, res) => {
  try {
    const validation = await validateChain();
    res.json(validation);
  } catch (error) {
    console.error('Validate chain error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
