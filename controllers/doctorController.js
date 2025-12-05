const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');

exports.getAllDoctors = async (req, res) => {
  try {
    const { speciality, city, search } = req.query;
    
    let query = { isActive: true };
    
    if (speciality) {
      query.speciality = speciality;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { speciality: { $regex: search, $options: 'i' } }
      ];
    }

    const doctors = await Doctor.find(query).select('-password');
    
    // If city filter, get doctors with hospitals in that city
    if (city) {
      const hospitalDoctorIds = await Hospital.find({ 
        city: { $regex: city, $options: 'i' } 
      }).distinct('doctorId');
      
      const filteredDoctors = doctors.filter(doc => 
        hospitalDoctorIds.some(id => id.equals(doc._id))
      );
      
      return res.json({ success: true, doctors: filteredDoctors });
    }

    res.json({ success: true, doctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('-password');
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const hospitals = await Hospital.find({ doctorId: doctor._id });

    res.json({ success: true, doctor, hospitals });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDoctor = async (req, res) => {
  try {
    const { name, mobile, speciality, qualification, experience, bookingCycleDays } = req.body;

    const updateData = { name, mobile, speciality, qualification, experience };
    
    if (bookingCycleDays !== undefined) {
      updateData.bookingCycleDays = bookingCycleDays;
    }

    const doctor = await Doctor.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleAvailability = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id);
    doctor.isActive = !doctor.isActive;
    await doctor.save();

    res.json({ 
      success: true, 
      isActive: doctor.isActive,
      message: `Availability ${doctor.isActive ? 'enabled' : 'disabled'}` 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
