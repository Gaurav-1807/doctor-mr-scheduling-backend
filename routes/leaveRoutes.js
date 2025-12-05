const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Leave routes
router.get('/', leaveController.getLeaves);
router.get('/upcoming', leaveController.getUpcomingLeaves);
router.get('/calendar', leaveController.getLeaveCalendar);
router.get('/:id', leaveController.getLeave);

// Doctor routes for managing their leaves
router.post('/check-appointments', authorize('doctor', 'admin'), leaveController.checkLeaveAppointments);
router.post('/', authorize('doctor', 'admin'), leaveController.createLeave);
router.put('/:id', authorize('doctor', 'admin'), leaveController.updateLeave);
router.delete('/:id', authorize('doctor', 'admin'), leaveController.deleteLeave);

// Check availability
router.get('/check/:doctorId/:date', leaveController.checkAvailability);

// Recurring holidays
router.post('/recurring', authorize('doctor', 'admin'), leaveController.setRecurringHoliday);
router.get('/recurring/:doctorId', leaveController.getRecurringHolidays);

module.exports = router;
