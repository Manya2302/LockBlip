import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Story from '../models/Story.js';
import StoryView from '../models/StoryView.js';
import User from '../models/User.js';
import Connection from '../models/Connection.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, mediaType, backgroundColor, image } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const story = new Story({
      userId: req.user.id,
      username: user.username,
      content,
      mediaType: mediaType || 'text',
      backgroundColor: backgroundColor || '#1a1a1a',
      image: image || '',
      expiresAt,
    });

    await story.save();

    res.json({
      id: story._id,
      userId: story.userId,
      username: story.username,
      content: story.content,
      mediaType: story.mediaType,
      backgroundColor: story.backgroundColor,
      image: story.image,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      viewCount: 0,
      viewers: [],
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentTime = new Date();
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const connections = await Connection.find({
      $or: [
        { sender: currentUser.username, status: 'accepted' },
        { receiver: currentUser.username, status: 'accepted' }
      ]
    }).lean();

    const friendUsernames = connections.map(conn => 
      conn.sender === currentUser.username ? conn.receiver : conn.sender
    );

    const stories = await Story.find({
      expiresAt: { $gt: currentTime },
      $or: [
        { userId: req.user.id },
        { username: { $in: friendUsernames } }
      ]
    }).sort({ createdAt: -1 });

    const storyViews = await StoryView.find({
      storyId: { $in: stories.map(s => s._id) }
    });

    const allUsers = await User.find({
      $or: [
        { _id: req.user.id },
        { username: { $in: friendUsernames } }
      ]
    });
    const userMap = {};
    allUsers.forEach(user => {
      userMap[user._id.toString()] = {
        username: user.username,
        profileImage: user.profileImage || '',
      };
    });

    const storiesWithViews = await Promise.all(stories.map(async (story) => {
      const views = storyViews.filter(v => v.storyId.toString() === story._id.toString());
      const userInfo = userMap[story.userId.toString()] || {};

      return {
        id: story._id,
        userId: story.userId,
        username: story.username,
        profileImage: userInfo.profileImage,
        content: story.content,
        mediaType: story.mediaType,
        backgroundColor: story.backgroundColor,
        image: story.image,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewCount: views.length,
        viewers: views.map(v => ({
          username: v.viewerUsername,
          viewedAt: v.viewedAt,
        })),
        isOwnStory: story.userId.toString() === req.user.id.toString(),
      };
    }));

    const groupedStories = {};
    storiesWithViews.forEach(story => {
      const userId = story.userId.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = [];
      }
      groupedStories[userId].push(story);
    });

    res.json(groupedStories);
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:storyId/view', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.userId.toString() === req.user.id.toString()) {
      return res.json({ message: 'Cannot view own story' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingView = await StoryView.findOne({
      storyId,
      viewerId: req.user.id,
    });

    if (existingView) {
      return res.json({ message: 'Already viewed' });
    }

    const view = new StoryView({
      storyId,
      viewerId: req.user.id,
      viewerUsername: user.username,
    });

    await view.save();

    res.json({ message: 'Story viewed' });
  } catch (error) {
    console.error('Mark story viewed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:storyId/viewers', authenticateToken, async (req, res) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    if (story.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Not authorized to view story viewers' });
    }

    const views = await StoryView.find({ storyId }).sort({ viewedAt: -1 });

    const viewers = await Promise.all(views.map(async (view) => {
      const user = await User.findById(view.viewerId);
      return {
        id: view.viewerId,
        username: view.viewerUsername,
        profileImage: user?.profileImage || '',
        viewedAt: view.viewedAt,
      };
    }));

    res.json(viewers);
  } catch (error) {
    console.error('Get story viewers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
