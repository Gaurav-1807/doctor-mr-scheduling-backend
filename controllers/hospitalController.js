const Hospital = require('../models/Hospital');

exports.addHospital = async (req, res) => {
  try {
    const { name, address, city, state, pincode, phone } = req.body;

    const hospital = await Hospital.create({
      doctorId: req.user.id,
      name,
      address,
      city,
      state,
      pincode,
      phone
    });

    res.status(201).json({ success: true, hospital });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ doctorId: req.user.id });
    res.json({ success: true, hospitals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    res.json({ success: true, hospital });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findOneAndDelete({
      _id: req.params.id,
      doctorId: req.user.id
    });

    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    res.json({ success: true, message: 'Hospital deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
