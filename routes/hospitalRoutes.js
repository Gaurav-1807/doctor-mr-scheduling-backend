const express = require('express');
const router = express.Router();
const { 
  addHospital, 
  getHospitals, 
  updateHospital, 
  deleteHospital 
} = require('../controllers/hospitalController');
const { auth, isDoctor } = require('../middleware/auth');

router.post('/', auth, isDoctor, addHospital);
router.get('/', auth, isDoctor, getHospitals);
router.put('/:id', auth, isDoctor, updateHospital);
router.delete('/:id', auth, isDoctor, deleteHospital);

module.exports = router;
