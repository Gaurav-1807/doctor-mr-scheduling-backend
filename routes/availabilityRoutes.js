const express = require('express');
const router = express.Router();
const { 
  addAvailability, 
  getAvailability, 
  updateAvailability, 
  deleteAvailability,
  checkConflicts,
  markUnavailable,
  regenerateSlots
} = require('../controllers/availabilityController');
const { auth, isDoctor } = require('../middleware/auth');

router.post('/', auth, isDoctor, addAvailability);
router.get('/', auth, isDoctor, getAvailability);
router.put('/:id', auth, isDoctor, updateAvailability);
router.delete('/:id', auth, isDoctor, deleteAvailability);
router.post('/check-conflicts', auth, isDoctor, checkConflicts);
router.post('/mark-unavailable', auth, isDoctor, markUnavailable);
router.post('/regenerate-slots', auth, isDoctor, regenerateSlots);

module.exports = router;
