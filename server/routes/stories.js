import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import Story from '../models/Story.js';
import StoryView from '../models/StoryView.js';
import User from '../models/User.js';
import Connection from '../models/Connection.js';
import { encryptField, decryptField } from '../lib/encryption.js';

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, mediaType, backgroundColor, image, visibilityType, allowedViewers, hiddenFromViewers, closeFriendsOnly } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const encryptedAllowedViewers = (allowedViewers || []).map(username => encryptField(username));
    const encryptedHiddenFromViewers = (hiddenFromViewers || []).map(username => encryptField(username));

    const story = new Story({
      userId: req.user.id,
      username: user.username,
      content,
      mediaType: mediaType || 'text',
      backgroundColor: backgroundColor || '#1a1a1a',
      image: image || '',
      expiresAt,
      visibilityType: visibilityType || 'everyone',
      allowedViewers: encryptedAllowedViewers,
      hiddenFromViewers: encryptedHiddenFromViewers,
      closeFriendsOnly: closeFriendsOnly || false,
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
      visibilityType: story.visibilityType,
      closeFriendsOnly: story.closeFriendsOnly,
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

    // Since username is encrypted in the User model, we need to fetch all users
    // and manually decrypt usernames to get friend user IDs
    const allUsers = await User.find({});
    const friendUserIds = allUsers
      .filter(u => friendUsernames.includes(u.username))
      .map(u => u._id);

    console.log('📸 Stories: Current user:', currentUser.username);
    console.log('📸 Stories: Friend usernames:', friendUsernames);
    console.log('📸 Stories: Friend user IDs:', friendUserIds);

    const stories = await Story.find({
      expiresAt: { $gt: currentTime },
      $or: [
        { userId: req.user.id },
        { userId: { $in: friendUserIds } }
      ]
    }).sort({ createdAt: -1 });

    console.log('📸 Stories: Found', stories.length, 'stories');

    const storyOwnerIds = [...new Set(stories.map(s => s.userId.toString()))];
    const storyOwners = await User.find({ _id: { $in: storyOwnerIds } });
    const ownerMap = {};
    storyOwners.forEach(owner => {
      const closeFriendsList = (owner.closeFriendsList || []).map(encrypted => {
        try { return decryptField(encrypted); } catch { return null; }
      }).filter(Boolean);
      ownerMap[owner._id.toString()] = {
        username: owner.username,
        profileImage: owner.profileImage || '',
        closeFriendsList,
      };
    });

    const filteredStories = stories.filter(story => {
      if (story.userId.toString() === req.user.id.toString()) {
        return true;
      }

      if (story.closeFriendsOnly) {
        const ownerData = ownerMap[story.userId.toString()];
        if (!ownerData) return false;
        if (!ownerData.closeFriendsList.includes(currentUser.username)) {
          return false;
        }
      }

      switch (story.visibilityType) {
        case 'everyone':
          return true;
        case 'hide_from':
          const hiddenFrom = (story.hiddenFromViewers || []).map(encrypted => {
            try { return decryptField(encrypted); } catch { return null; }
          }).filter(Boolean);
          return !hiddenFrom.includes(currentUser.username);
        case 'only_selected':
          const allowed = (story.allowedViewers || []).map(encrypted => {
            try { return decryptField(encrypted); } catch { return null; }
          }).filter(Boolean);
          return allowed.includes(currentUser.username);
        default:
          return true;
      }
    });

    const storyViews = await StoryView.find({
      storyId: { $in: filteredStories.map(s => s._id) }
    });

    const storiesWithViews = await Promise.all(filteredStories.map(async (story) => {
      const views = storyViews.filter(v => v.storyId.toString() === story._id.toString());
      const ownerInfo = ownerMap[story.userId.toString()] || {};

      return {
        id: story._id,
        userId: story.userId,
        username: story.username,
        profileImage: ownerInfo.profileImage,
        content: story.content,
        mediaType: story.mediaType,
        backgroundColor: story.backgroundColor,
        image: story.image,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        visibilityType: story.visibilityType,
        closeFriendsOnly: story.closeFriendsOnly,
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
      return res.json({ message: 'Cannot view own story', viewCount: 0 });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const view = new StoryView({
      storyId,
      viewerId: req.user.id,
      viewerUsername: user.username,
    });

    await view.save();

    const totalViews = await StoryView.countDocuments({ storyId });

    res.json({ message: 'Story viewed', viewCount: totalViews });
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

    const viewerIds = [...new Set(views.map(v => v.viewerId.toString()))];
    const viewerUsers = await User.find({ _id: { $in: viewerIds } });
    const viewerUserMap = {};
    viewerUsers.forEach(u => {
      viewerUserMap[u._id.toString()] = {
        profileImage: u.profileImage || '',
      };
    });

    const viewerMap = {};
    for (const view of views) {
      const viewerId = view.viewerId.toString();
      if (!viewerMap[viewerId]) {
        const userInfo = viewerUserMap[viewerId] || {};
        viewerMap[viewerId] = {
          id: view.viewerId,
          username: view.viewerUsername,
          profileImage: userInfo.profileImage,
          viewCount: 0,
          timestamps: [],
        };
      }
      viewerMap[viewerId].viewCount++;
      viewerMap[viewerId].timestamps.push(view.viewedAt);
    }

    const groupedViewers = Object.values(viewerMap).map(viewer => ({
      ...viewer,
      timestamps: viewer.timestamps.sort((a, b) => new Date(b) - new Date(a)),
    }));

    groupedViewers.sort((a, b) => {
      const latestA = a.timestamps[0];
      const latestB = b.timestamps[0];
      return new Date(latestB) - new Date(latestA);
    });

    const totalViewCount = views.length;

    res.json({ viewers: groupedViewers, totalViewCount });
  } catch (error) {
    console.error('Get story viewers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
