const express = require('express');
const router = express.Router();
const { 
  getMRProfile, 
  updateMRProfile, 
  getMRAppointments 
} = require('../controllers/mrController');
const { auth, isMR } = require('../middleware/auth');

router.get('/profile', auth, isMR, getMRProfile);
router.put('/profile', auth, isMR, updateMRProfile);
router.get('/appointments', auth, isMR, getMRAppointments);

module.exports = router;
