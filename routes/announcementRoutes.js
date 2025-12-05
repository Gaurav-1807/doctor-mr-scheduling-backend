const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get announcements (for MRs)
router.get('/', announcementController.getAnnouncements);
router.get('/:id', announcementController.getAnnouncement);

// Doctor-only routes
router.post('/', authorize('doctor', 'admin'), announcementController.createAnnouncement);
router.put('/:id', authorize('doctor', 'admin'), announcementController.updateAnnouncement);
router.delete('/:id', authorize('doctor', 'admin'), announcementController.deleteAnnouncement);

// Mark as read (for MRs)
router.put('/:id/read', announcementController.markAsRead);

// Get read status
router.get('/:id/read-status', authorize('doctor', 'admin'), announcementController.getReadStatus);

module.exports = router;
