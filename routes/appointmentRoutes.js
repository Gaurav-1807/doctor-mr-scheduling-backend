const express = require('express');
const router = express.Router();
const { 
  bookAppointment, 
  getAppointments, 
  updateAppointmentStatus,
  getDoctorSlots 
} = require('../controllers/appointmentController');
const { auth, isMR } = require('../middleware/auth');

router.post('/book', auth, isMR, bookAppointment);
router.get('/', auth, getAppointments);
router.patch('/:id/status', auth, updateAppointmentStatus);
router.get('/slots/:doctorId', auth, getDoctorSlots);

module.exports = router;
