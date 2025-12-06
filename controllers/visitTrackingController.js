const VisitTracking = require('../models/VisitTracking');
const Appointment = require('../models/Appointment');

// @desc    Get all visits
// @route   GET /api/visits
// @access  Private
exports.getVisits = async (req, res) => {
  try {
    const { visitStatus, page = 1, limit = 20 } = req.query;
    
    let query = { mrId: req.user.id };
    if (visitStatus) query.visitStatus = visitStatus;
    
    const visits = await VisitTracking.find(query)
      .populate('doctorId', 'name speciality')
      .populate('appointmentId', 'date startTime endTime')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Map to frontend-friendly format
    const mappedVisits = visits.map(v => ({
      _id: v._id,
      doctor: v.doctorId,
      appointment: v.appointmentId,
      visitType: v.visitType,
      status: v.visitStatus,
      checkInTime: v.checkInTime,
      checkOutTime: v.checkOutTime,
      duration: v.duration,
      notes: v.talkingSummary,
      geoLocation: v.geoLocation,
      createdAt: v.createdAt
    }));
    
    const total = await VisitTracking.countDocuments(query);
    
    res.json({
      success: true,
      data: mappedVisits,
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
      { $match: { mrId: req.user._id } },
      {
        $group: {
          _id: '$visitStatus',
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
    const visits = await VisitTracking.find({ appointmentId: req.params.appointmentId })
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
      .populate('doctorId', 'name speciality')
      .populate('mrId', 'name company')
      .populate('appointmentId');
    
    if (!visit) {
      return res.status(404).json({ success: false, message: 'Visit not found' });
    }
    
    res.json({ success: true, data: visit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Create visit (Check-in)
// @route   POST /api/visits
// @access  Private (MR)
exports.createVisit = async (req, res) => {
  try {
    const { appointment, doctor, visitType, checkInLocation } = req.body;
    
    // Map visitType to valid enum values
    // Valid: 'sample_drop', 'promotion', 'stock_check', 'inquiry_followup', 'general'
    const validVisitTypes = ['sample_drop', 'promotion', 'stock_check', 'inquiry_followup', 'general'];
    const mappedVisitType = validVisitTypes.includes(visitType) ? visitType : 'general';
    
    const visit = await VisitTracking.create({
      appointmentId: appointment,
      doctorId: doctor,
      mrId: req.user.id,
      visitType: mappedVisitType,
      visitStatus: 'successful', // Will update on checkout if needed
      checkInTime: new Date(),
      geoLocation: checkInLocation ? {
        latitude: checkInLocation.latitude,
        longitude: checkInLocation.longitude
      } : undefined
    });
    
    // Update appointment status
    if (appointment) {
      await Appointment.findByIdAndUpdate(appointment, { status: 'completed' });
    }
    
    // Return mapped response
    const populatedVisit = await VisitTracking.findById(visit._id)
      .populate('doctorId', 'name speciality')
      .populate('appointmentId', 'date startTime endTime');
    
    res.status(201).json({ 
      success: true, 
      data: {
        _id: populatedVisit._id,
        doctor: populatedVisit.doctorId,
        appointment: populatedVisit.appointmentId,
        visitType: populatedVisit.visitType,
        status: 'in-progress',
        checkInTime: populatedVisit.checkInTime,
        geoLocation: populatedVisit.geoLocation
      }
    });
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
    visit.visitStatus = 'successful';
    visit.talkingSummary = notes;
    
    // Update checkout location
    if (checkOutLocation) {
      visit.geoLocation = {
        ...visit.geoLocation,
        latitude: checkOutLocation.latitude,
        longitude: checkOutLocation.longitude
      };
    }
    
    // Calculate duration in minutes
    if (visit.checkInTime) {
      visit.duration = Math.round((visit.checkOutTime - visit.checkInTime) / 60000);
    }
    
    await visit.save();
    
    // Update appointment status
    if (visit.appointmentId) {
      await Appointment.findByIdAndUpdate(visit.appointmentId, { status: 'completed' });
    }
    
    res.json({ 
      success: true, 
      data: {
        _id: visit._id,
        status: 'completed',
        checkOutTime: visit.checkOutTime,
        duration: visit.duration,
        notes: visit.talkingSummary
      }
    });
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
    
    visit.talkingSummary = visit.talkingSummary 
      ? `${visit.talkingSummary}\n${req.body.note}` 
      : req.body.note;
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
    const { feedback } = req.body;
    
    const visit = await VisitTracking.findByIdAndUpdate(
      req.params.id,
      { doctorFeedback: feedback },
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
