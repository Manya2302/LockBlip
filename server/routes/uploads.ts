import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    // Validate by extension and MIME type. The previous check tested the
    // mimetype against an extension-only regex which caused valid audio
    // uploads (e.g. mimetype 'audio/mpeg') to be rejected. Use separate
    // patterns for extensions and MIME types and accept when either is a
    // valid known type.
    const allowedExt = /\.(jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|ogg|pdf|doc|docx|csv|xlsx|xls)$/i;
    const allowedMime = /^(image\/|video\/|audio\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)/i;

    const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMime.test(file.mimetype || '');

    if (extname || mimetype) {
      return cb(null, true);
    }

    cb(new Error('Invalid file type'));
  }
});

router.post('/file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.body.fileType || 'file';

    res.json({
      success: true,
      fileUrl,
      fileType,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.post('/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    res.json({
      success: true,
      location: {
        latitude,
        longitude,
        address: address || `${latitude}, ${longitude}`,
      },
    });
  } catch (error) {
    console.error('Location share error:', error);
    res.status(500).json({ error: 'Failed to process location' });
  }
});

router.post('/contact', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    res.json({
      success: true,
      contact: {
        name,
        phone,
        email: email || '',
      },
    });
  } catch (error) {
    console.error('Contact share error:', error);
    res.status(500).json({ error: 'Failed to process contact' });
  }
});

router.post('/poll', authenticateToken, async (req, res) => {
  try {
    const { question, options } = req.body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options are required' });
    }

    const poll = {
      question,
      options: options.map((opt: string) => ({
        text: opt,
        votes: 0,
        voters: [],
      })),
      totalVotes: 0,
    };

    res.json({
      success: true,
      poll,
    });
  } catch (error) {
    console.error('Poll creation error:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

router.post('/poll/vote', authenticateToken, async (req, res) => {
  try {
    const { pollId, optionIndex } = req.body;
    const username = (req as any).user?.username;

    if (!username) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      message: 'Vote recorded',
    });
  } catch (error) {
    console.error('Poll vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

export default router;
