const Leave = require('../models/Leave');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');

// @desc    Get all leaves
// @route   GET /api/leaves
// @access  Private
exports.getLeaves = async (req, res) => {
  try {
    const { status, doctorId } = req.query;
    let query = {};
    
    // Doctors see only their leaves
    if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
    }
    
    // MRs can filter by specific doctor or see all
    if (req.user.role === 'mr' && doctorId) {
      query.doctorId = doctorId;
    }
    
    if (status) {
      query.status = status;
    }
    
    const leaves = await Leave.find(query)
      .populate('doctorId', 'name speciality email')
      .sort({ startDate: -1 });
    
    res.json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get upcoming leaves
// @route   GET /api/leaves/upcoming
// @access  Private
exports.getUpcomingLeaves = async (req, res) => {
  try {
    let query = { startDate: { $gte: new Date() }, status: 'active' };
    
    if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
    }
    
    const leaves = await Leave.find(query)
      .populate('doctorId', 'name')
      .sort({ startDate: 1 });
    
    res.json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get leave calendar
// @route   GET /api/leaves/calendar
// @access  Private
exports.getLeaveCalendar = async (req, res) => {
  try {
    const { month, year, doctorId } = req.query;
    
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    
    let query = {
      status: 'active',
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { startDate: { $lte: startOfMonth }, endDate: { $gte: endOfMonth } }
      ]
    };
    
    if (doctorId) {
      query.doctorId = doctorId;
    } else if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
    }
    
    const leaves = await Leave.find(query).populate('doctorId', 'name');
    
    res.json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single leave
// @route   GET /api/leaves/:id
// @access  Private
exports.getLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('doctorId', 'name');
    
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check for appointments during leave period
// @route   POST /api/leaves/check-appointments
// @access  Private (Doctor)
exports.checkLeaveAppointments = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const affectedAppointments = await Appointment.find({
      doctorId: req.user.id,
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed', 'scheduled', 'rescheduled'] }
    }).populate('mrId', 'name email');
    
    res.json({
      success: true,
      hasAppointments: affectedAppointments.length > 0,
      appointments: affectedAppointments.map(apt => ({
        _id: apt._id,
        date: apt.date,
        startTime: apt.startTime,
        mrName: apt.mrId?.name,
        mrEmail: apt.mrId?.email
      })),
      count: affectedAppointments.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create leave
// @route   POST /api/leaves
// @access  Private (Doctor)
exports.createLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, handleAppointments } = req.body;
    // handleAppointments can be: 'cancel' or 'reschedule'
    
    // Map frontend leaveType to model enum values
    const leaveTypeMap = {
      'vacation': 'vacation',
      'sick': 'sick_leave',
      'personal': 'other',
      'conference': 'conference',
      'holiday': 'other',
      'emergency': 'emergency'
    };
    
    const mappedLeaveType = leaveTypeMap[leaveType] || 'other';
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const leave = await Leave.create({
      doctorId: req.user.id,
      leaveType: mappedLeaveType,
      startDate: start,
      endDate: end,
      reason,
      status: 'active'
    });
    
    // Find affected appointments
    const affectedAppointments = await Appointment.find({
      doctorId: req.user.id,
      date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed', 'scheduled', 'rescheduled'] }
    }).populate('mrId', 'name email');
    
    const { sendEmailAsync } = require('../utils/emailService');
    const { findAvailableSlots } = require('../utils/smartRescheduling');
    const Slot = require('../models/Slot');
    
    // Handle each affected appointment
    for (const apt of affectedAppointments) {
      if (handleAppointments === 'reschedule') {
        // Try to auto-reschedule
        try {
          const availableSlots = await findAvailableSlots(req.user.id, end, 14);
          
          // Find slot where MR is also available
          let suitableSlot = null;
          for (const slot of availableSlots) {
            const mrConflict = await Appointment.findOne({
              mrId: apt.mrId._id,
              date: slot.date,
              startTime: slot.slots[0],
              status: { $in: ['pending', 'confirmed', 'scheduled', 'rescheduled'] },
              _id: { $ne: apt._id }
            });
            
            if (!mrConflict) {
              suitableSlot = slot;
              break;
            }
          }
          
          if (suitableSlot) {
            const oldDate = apt.date;
            const oldTime = apt.startTime;
            
            apt.date = suitableSlot.date;
            apt.startTime = suitableSlot.slots[0];
            const [hours, mins] = suitableSlot.slots[0].split(':').map(Number);
            const duration = 15; // Default duration
            const endMins = mins + duration;
            apt.endTime = `${Math.floor((hours * 60 + endMins) / 60).toString().padStart(2, '0')}:${((hours * 60 + endMins) % 60).toString().padStart(2, '0')}`;
            apt.status = 'rescheduled';
            await apt.save();
            
            // Notify MR
            await Notification.create({
              userId: apt.mrId._id,
              userType: 'mr',
              title: 'Appointment Rescheduled',
              message: `Your appointment has been rescheduled due to doctor's leave`,
              type: 'general',
              relatedId: apt._id
            });
            
            // Send email notification (non-blocking)
            console.log("apt--->",apt)
            if (apt.mrId?.email) {
              sendEmailAsync(
                apt.mrId.email,
                'Appointment Rescheduled - Doctor on Leave',
                `
                  <h2>Your Appointment Has Been Rescheduled</h2>
                  <p>Due to doctor's leave, your appointment has been automatically rescheduled.</p>
                  <p><strong>Original:</strong> ${oldDate.toDateString()} at ${oldTime}</p>
                  <p><strong>New:</strong> ${suitableSlot.date.toDateString()} at ${suitableSlot.slots[0]}</p>
                  <p><strong>Reason:</strong> ${reason || 'Doctor on leave'}</p>
                  <p>If this doesn't work for you, please reschedule through the app.</p>
                `
              );
            }
          } else {
            // No suitable slot, cancel
            apt.status = 'cancelled';
            apt.cancellationReason = `Doctor on leave: ${reason || leaveType} - No alternative slots available`;
            await apt.save();
            
            await Notification.create({
              userId: apt.mrId._id,
              userType: 'mr',
              title: 'Appointment Cancelled',
              message: `Your appointment was cancelled - doctor on leave`,
              type: 'cancellation',
              relatedId: apt._id
            });
            
            // Send email notification (non-blocking)
            if (apt.mrId?.email) {
              sendEmailAsync(
                apt.mrId.email,
                'Appointment Cancelled - Doctor on Leave',
                `
                  <h2>Appointment Cancelled</h2>
                  <p>We're sorry, but your appointment on ${apt.date.toDateString()} at ${apt.startTime} has been cancelled.</p>
                  <p><strong>Reason:</strong> Doctor on leave - ${reason || leaveType}</p>
                  <p>No alternative slots were available. Please book a new appointment through the app.</p>
                `
              );
            }
          }
        } catch (err) {
          console.error('Reschedule error:', err);
          apt.status = 'cancelled';
          apt.cancellationReason = `Doctor on leave: ${reason || leaveType}`;
          await apt.save();
        }
      } else {
        // Cancel appointment
        apt.status = 'cancelled';
        apt.cancellationReason = `Doctor on leave: ${reason || leaveType}`;
        await apt.save();
        
        // Free up slot
        await Slot.updateMany(
          { doctorId: req.user.id, date: apt.date, startTime: apt.startTime },
          { isBooked: false, bookedBy: null }
        );
        
        // Notify MR
        await Notification.create({
          userId: apt.mrId._id,
          userType: 'mr',
          title: 'Appointment Cancelled',
          message: `Your appointment was cancelled due to doctor's leave`,
          type: 'cancellation',
          relatedId: apt._id
        });
        
        // Send email notification (non-blocking)
        if (apt.mrId?.email) {
          sendEmailAsync(
            apt.mrId.email,
            'Appointment Cancelled - Doctor on Leave',
            `
              <h2>Appointment Cancelled</h2>
              <p>We're sorry, but your appointment on ${apt.date.toDateString()} at ${apt.startTime} has been cancelled.</p>
              <p><strong>Reason:</strong> Doctor on leave - ${reason || leaveType}</p>
              <p>Please book a new appointment through the app.</p>
            `
          );
        }
      }
    }
    
    // Delete slots during leave period
    const slotsToDelete = await Slot.find({
      doctorId: req.user.id,
      date: { $gte: start, $lte: end }
    });
    
    if (slotsToDelete.length > 0) {
      await Slot.deleteMany({
        doctorId: req.user.id,
        date: { $gte: start, $lte: end }
      });
      console.log(`Deleted ${slotsToDelete.length} slots during leave period`);
    }
    
    // Update leave with affected appointments
    leave.affectedAppointments = affectedAppointments.map(a => a._id);
    await leave.save();
    
    res.status(201).json({ 
      success: true, 
      data: leave,
      affectedAppointments: affectedAppointments.length,
      action: handleAppointments || 'cancelled'
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update leave
// @route   PUT /api/leaves/:id
// @access  Private (Doctor)
exports.updateLeave = async (req, res) => {
  try {
    const leave = await Leave.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    
    res.json({ success: true, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete leave
// @route   DELETE /api/leaves/:id
// @access  Private (Doctor)
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findOne({ 
      _id: req.params.id, 
      doctorId: req.user.id 
    });
    
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    
    // Delete the leave
    await Leave.findByIdAndDelete(req.params.id);
    
    // Regenerate slots for the leave period (if dates are in the future)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (endDate >= today) {
      const { generateSlotsForRange } = require('../utils/slotGenerator');
      
      // Start from today or leave start date, whichever is later
      const regenerateStart = startDate > today ? startDate : today;
      
      // Generate slots for the leave period
      const slotsGenerated = await generateSlotsForRange(req.user.id, regenerateStart, endDate);
      
      console.log(`Leave deleted. Regenerated ${slotsGenerated} slots for period ${regenerateStart.toDateString()} to ${endDate.toDateString()}`);
      
      res.json({ 
        success: true, 
        message: 'Leave deleted and slots regenerated',
        slotsGenerated
      });
    } else {
      res.json({ success: true, message: 'Leave deleted' });
    }
  } catch (error) {
    console.error('Delete leave error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check availability for a date
// @route   GET /api/leaves/check/:doctorId/:date
// @access  Private
exports.checkAvailability = async (req, res) => {
  try {
    const { doctorId, date } = req.params;
    const checkDate = new Date(date);
    
    const leave = await Leave.findOne({
      doctorId: doctorId,
      startDate: { $lte: checkDate },
      endDate: { $gte: checkDate },
      status: 'active'
    });
    
    res.json({
      success: true,
      data: {
        isAvailable: !leave,
        leave: leave || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Set recurring holiday
// @route   POST /api/leaves/recurring
// @access  Private (Doctor)
exports.setRecurringHoliday = async (req, res) => {
  try {
    const { dayOfWeek, reason } = req.body;
    
    const leave = await Leave.create({
      doctorId: req.user.id,
      leaveType: 'other',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      isRecurring: true,
      recurringPattern: {
        frequency: 'weekly',
        daysOfWeek: [dayOfWeek]
      },
      reason,
      status: 'active'
    });
    
    res.status(201).json({ success: true, data: leave });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get recurring holidays
// @route   GET /api/leaves/recurring/:doctorId
// @access  Private
exports.getRecurringHolidays = async (req, res) => {
  try {
    const leaves = await Leave.find({
      doctorId: req.params.doctorId,
      isRecurring: true,
      status: 'active'
    });
    
    res.json({ success: true, data: leaves });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
