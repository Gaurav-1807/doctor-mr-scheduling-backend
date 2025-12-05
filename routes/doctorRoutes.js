const express = require('express');
const router = express.Router();
const { 
  getAllDoctors, 
  getDoctorById, 
  updateDoctor, 
  toggleAvailability 
} = require('../controllers/doctorController');
const { auth, isDoctor } = require('../middleware/auth');

router.get('/', getAllDoctors);
router.get('/:id', getDoctorById);
router.put('/profile', auth, isDoctor, updateDoctor);
router.patch('/toggle-availability', auth, isDoctor, toggleAvailability);

module.exports = router;
