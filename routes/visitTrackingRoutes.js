const express = require('express');
const router = express.Router();
const visitTrackingController = require('../controllers/visitTrackingController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Visit tracking routes
router.get('/', visitTrackingController.getVisits);
router.get('/stats', visitTrackingController.getVisitStats);
router.get('/timeline/:appointmentId', visitTrackingController.getVisitTimeline);
router.get('/:id', visitTrackingController.getVisit);

// MR-only routes for creating/updating visits
router.post('/', authorize('mr', 'admin'), visitTrackingController.createVisit);
router.put('/:id', authorize('mr', 'admin'), visitTrackingController.updateVisit);
router.put('/:id/check-in', authorize('mr', 'admin'), visitTrackingController.checkIn);
router.put('/:id/check-out', authorize('mr', 'admin'), visitTrackingController.checkOut);

// Add notes/attachments
router.post('/:id/notes', visitTrackingController.addNote);
router.post('/:id/voice-note', visitTrackingController.addVoiceNote);
router.post('/:id/signature', visitTrackingController.captureSignature);

// Doctor routes
router.put('/:id/feedback', authorize('doctor', 'admin'), visitTrackingController.addDoctorFeedback);

module.exports = router;
