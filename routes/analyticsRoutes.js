const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Dashboard stats (Admin)
router.get('/dashboard', authorize('admin'), analyticsController.getDashboardStats);

// Doctor analytics
router.get('/doctor/:doctorId', analyticsController.getDoctorAnalytics);

// MR analytics
router.get('/mr/:mrId', analyticsController.getMRAnalytics);

// Heatmap data
router.get('/heatmap', analyticsController.getAppointmentHeatmap);

// Reports (Admin)
router.get('/reports', authorize('admin'), analyticsController.getReports);

module.exports = router;
