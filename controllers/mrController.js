const MR = require('../models/MR');
const Appointment = require('../models/Appointment');

exports.getMRProfile = async (req, res) => {
  try {
    const mr = await MR.findById(req.user.id).select('-password');
    res.json({ success: true, mr });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMRProfile = async (req, res) => {
  try {
    const { name, mobile, company, territory } = req.body;

    const mr = await MR.findByIdAndUpdate(
      req.user.id,
      { name, mobile, company, territory },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, mr });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMRAppointments = async (req, res) => {
  try {
    const { status, upcoming } = req.query;
    
    let query = { mrId: req.user.id };
    
    if (status) {
      query.status = status;
    }
    
    if (upcoming === 'true') {
      query.date = { $gte: new Date() };
    }

    const appointments = await Appointment.find(query)
      .populate('doctorId', 'name speciality')
      .sort({ date: 1, startTime: 1 });

    res.json({ success: true, appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
