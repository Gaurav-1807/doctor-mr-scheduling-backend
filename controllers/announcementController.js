const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const MR = require('../models/MR');

// @desc    Get all announcements
// @route   GET /api/announcements
// @access  Private
exports.getAnnouncements = async (req, res) => {
  try {
    let query = { isActive: true };
    
    // For MRs, filter by target
    if (req.user.role === 'mr') {
      query.$or = [
        { targetMRs: { $size: 0 } },
        { targetMRs: req.user.id }
      ];
    } else if (req.user.role === 'doctor') {
      query.doctor = req.user.id;
    }
    
    const announcements = await Announcement.find(query)
      .populate('doctor', 'name specialty')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single announcement
// @route   GET /api/announcements/:id
// @access  Private
exports.getAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('doctor', 'name specialty');
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private (Doctor)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, priority, targetMRs, expiresAt } = req.body;
    
    const announcement = await Announcement.create({
      doctor: req.user.id,
      title,
      content,
      priority: priority || 'normal',
      targetMRs: targetMRs || [],
      expiresAt
    });
    
    // Send notifications to target MRs or all MRs
    let mrIds = targetMRs;
    if (!mrIds || mrIds.length === 0) {
      const allMRs = await MR.find({ isActive: true }).select('_id');
      mrIds = allMRs.map(mr => mr._id);
    }
    
    const notifications = mrIds.map(mrId => ({
      recipient: mrId,
      recipientModel: 'MR',
      title: `New Announcement: ${title}`,
      message: content.substring(0, 100),
      type: 'announcement',
      relatedId: announcement._id
    }));
    
    await Notification.insertMany(notifications);
    
    res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private (Doctor)
exports.updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, doctor: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private (Doctor)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findOneAndDelete({
      _id: req.params.id,
      doctor: req.user.id
    });
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark announcement as read
// @route   PUT /api/announcements/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    const alreadyRead = announcement.readBy?.some(
      r => r.mr?.toString() === req.user.id
    );
    
    if (!alreadyRead) {
      announcement.readBy = announcement.readBy || [];
      announcement.readBy.push({
        mr: req.user.id,
        readAt: new Date()
      });
      await announcement.save();
    }
    
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get read status
// @route   GET /api/announcements/:id/read-status
// @access  Private (Doctor)
exports.getReadStatus = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('readBy.mr', 'name company');
    
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    
    res.json({
      success: true,
      data: {
        totalReads: announcement.readBy?.length || 0,
        readBy: announcement.readBy || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
