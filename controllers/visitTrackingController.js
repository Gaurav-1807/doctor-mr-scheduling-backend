const VisitTracking = require('../models/VisitTracking');
const Appointment = require('../models/Appointment');

// @desc    Get all visits
// @route   GET /api/visits
// @access  Private
exports.getVisits = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = { mr: req.user.id };
    if (status) query.status = status;
    
    const visits = await VisitTracking.find(query)
      .populate('doctor', 'name specialty')
      .populate('appointment', 'date timeSlot')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await VisitTracking.countDocuments(query);
    
    res.json({
      success: true,
      data: visits,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get visit stats
// @route   GET /api/visits/stats
// @access  Private
exports.getVisitStats = async (req, res) => {
  try {
    const stats = await VisitTracking.aggregate([
      { $match: { mr: req.user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get visit timeline for appointment
// @route   GET /api/visits/timeline/:appointmentId
// @access  Private
exports.getVisitTimeline = async (req, res) => {
  try {
    const visits = await VisitTracking.find({ appointment: req.params.appointmentId })
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: visits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single visit
// @route   GET /api/visits/:id
// @access  Private
exports.getVisit = async (req, res) => {
  try {
    const visit = await VisitTracking.findById(req.params.id)
      .populate('doctor', 'name specialty')
      .populate('mr', 'name company')
      .populate('appointment');
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create visit
// @route   POST /api/visits
// @access  Private (MR)
exports.createVisit = async (req, res) => {
  try {
    const { appointment, doctor, visitType, checkInLocation } = req.body;
    
    const visit = await VisitTracking.create({
      appointment,
      doctor,
      mr: req.user.id,
      visitType: visitType || 'scheduled',
      status: 'in-progress',
      checkInTime: new Date(),
      checkInLocation
    });
    
    // Update appointment status
    if (appointment) {
      await Appointment.findByIdAndUpdate(appointment, { status: 'in-progress' });
    }
    
    res.status(201).json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update visit
// @route   PUT /api/visits/:id
// @access  Private (MR)
exports.updateVisit = async (req, res) => {
  try {
    const visit = await VisitTracking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check in
// @route   PUT /api/visits/:id/check-in
// @access  Private (MR)
exports.checkIn = async (req, res) => {
  try {
    const { checkInLocation } = req.body;
    
    const visit = await VisitTracking.findByIdAndUpdate(
      req.params.id,
      {
        checkInTime: new Date(),
        checkInLocation,
        status: 'in-progress'
      },
      { new: true }
    );
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check out
// @route   PUT /api/visits/:id/check-out
// @access  Private (MR)
exports.checkOut = async (req, res) => {
  try {
    const { checkOutLocation, notes } = req.body;
    
    const visit = await VisitTracking.findById(req.params.id);
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    visit.checkOutTime = new Date();
    visit.checkOutLocation = checkOutLocation;
    visit.status = 'completed';
    visit.notes = notes;
    
    // Calculate duration in minutes
    if (visit.checkInTime) {
      visit.duration = Math.round((visit.checkOutTime - visit.checkInTime) / 60000);
    }
    
    await visit.save();
    
    // Update appointment status
    if (visit.appointment) {
      await Appointment.findByIdAndUpdate(visit.appointment, { status: 'completed' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add note
// @route   POST /api/visits/:id/notes
// @access  Private
exports.addNote = async (req, res) => {
  try {
    const visit = await VisitTracking.findById(req.params.id);
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    visit.notes = visit.notes ? `${visit.notes}\n${req.body.note}` : req.body.note;
    await visit.save();
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add voice note
// @route   POST /api/visits/:id/voice-note
// @access  Private
exports.addVoiceNote = async (req, res) => {
  try {
    const { url, duration } = req.body;
    
    const visit = await VisitTracking.findById(req.params.id);
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    visit.voiceNotes = visit.voiceNotes || [];
    visit.voiceNotes.push({ url, duration, uploadedAt: new Date() });
    await visit.save();
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Capture signature
// @route   POST /api/visits/:id/signature
// @access  Private
exports.captureSignature = async (req, res) => {
  try {
    const { signature } = req.body;
    
    const visit = await VisitTracking.findByIdAndUpdate(
      req.params.id,
      { doctorSignature: signature },
      { new: true }
    );
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add doctor feedback
// @route   PUT /api/visits/:id/feedback
// @access  Private (Doctor)
exports.addDoctorFeedback = async (req, res) => {
  try {
    const { feedback, rating } = req.body;
    
    const visit = await VisitTracking.findByIdAndUpdate(
      req.params.id,
      { 
        doctorFeedback: feedback,
        doctorRating: rating
      },
      { new: true }
    );
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
