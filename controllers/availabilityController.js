const Availability = require('../models/Availability');
const { generateSlotsForRange } = require('../utils/slotGenerator');

exports.addAvailability = async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, slotDuration } = req.body;

    // Validate time format
    if (!startTime || !endTime) {
      return res.status(400).json({ message: 'Start time and end time are required' });
    }

    // Validate that end time is after start time
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Check for overlapping availability on the same day
    const existingAvailability = await Availability.findOne({
      doctorId: req.user.id,
      dayOfWeek: dayOfWeek,
      isActive: true,
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    if (existingAvailability) {
      return res.status(400).json({ 
        message: `You already have availability set for this day (${existingAvailability.startTime} - ${existingAvailability.endTime}). Please delete it first or choose a different time.` 
      });
    }

    const availability = await Availability.create({
      doctorId: req.user.id,
      dayOfWeek,
      startTime,
      endTime,
      slotDuration: slotDuration || 15,
      isActive: true
    });

    // Generate slots for next 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDateRange = new Date();
    endDateRange.setDate(today.getDate() + 30);
    
    await generateSlotsForRange(req.user.id, today, endDateRange);

    res.status(201).json({ success: true, availability });
  } catch (error) {
    console.error('Add availability error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAvailability = async (req, res) => {
  try {
    const availabilities = await Availability.find({ 
      doctorId: req.user.id 
    }).sort({ dayOfWeek: 1, startTime: 1 });

    res.json({ success: true, availabilities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Regenerate all slots for a doctor (clears existing unbooked slots and creates new ones)
exports.regenerateSlots = async (req, res) => {
  try {
    const Slot = require('../models/Slot');
    
    // Delete all unbooked future slots for this doctor
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const deleteResult = await Slot.deleteMany({
      doctorId: req.user.id,
      date: { $gte: today },
      isBooked: false
    });
    
    console.log(`Deleted ${deleteResult.deletedCount} unbooked slots`);
    
    // Regenerate slots for next 30 days
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    const totalSlots = await generateSlotsForRange(req.user.id, today, endDate);
    
    res.json({ 
      success: true, 
      message: `Regenerated slots. Deleted ${deleteResult.deletedCount} old slots, created new slots for next 30 days.`,
      deletedSlots: deleteResult.deletedCount,
      generatedSlots: totalSlots
    });
  } catch (error) {
    console.error('Regenerate slots error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const availability = await Availability.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    // Regenerate slots for future dates
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);
    
    await generateSlotsForRange(req.user.id, today, endDate);

    res.json({ success: true, availability });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAvailability = async (req, res) => {
  try {
    const { action, reschedule } = req.query; // action: 'check', 'cancel', 'reschedule'
    const Appointment = require('../models/Appointment');
    const Slot = require('../models/Slot');
    const Notification = require('../models/Notification');
    const { sendEmailAsync } = require('../utils/emailService');
    const { findAvailableSlots } = require('../utils/smartRescheduling');

    const availability = await Availability.findOne({
      _id: req.params.id,
      doctorId: req.user.id
    });

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }

    // Find affected appointments (future appointments on this day of week)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // First get all future appointments for this doctor
    const allFutureAppointments = await Appointment.find({
      doctorId: req.user.id,
      date: { $gte: today },
      status: { $in: ['pending', 'confirmed', 'scheduled', 'rescheduled'] }
    }).populate('mrId', 'name email');

    // Filter by day of week AND time range
    const filteredAppointments = allFutureAppointments.filter(apt => {
      const aptDayOfWeek = new Date(apt.date).getDay();
      const aptStartTime = apt.startTime;
      
      // Check if appointment is on the same day of week
      const sameDayOfWeek = aptDayOfWeek === availability.dayOfWeek;
      
      // Check if appointment time falls within availability time range
      const timeInRange = aptStartTime >= availability.startTime && aptStartTime < availability.endTime;
      
      return sameDayOfWeek && timeInRange;
    });

    // If just checking, return affected appointments
    if (action === 'check') {
      return res.json({
        success: true,
        hasAffectedAppointments: filteredAppointments.length > 0,
        affectedAppointments: filteredAppointments.map(apt => ({
          _id: apt._id,
          date: apt.date,
          timeSlot: apt.startTime,
          mrName: apt.mrId?.name,
          mrEmail: apt.mrId?.email
        })),
        count: filteredAppointments.length
      });
    }

    // Handle affected appointments
    if (filteredAppointments.length > 0) {
      for (const apt of filteredAppointments) {
        if (reschedule === 'true') {
          // Try to auto-reschedule
          try {
            // Find available slots for this doctor
            const availableSlots = await findAvailableSlots(req.user.id, apt.date, 14);
            
            // Find a slot where MR is also available
            let suitableSlot = null;
            for (const slot of availableSlots) {
              // Check if MR has any conflicting appointments at this time
              const mrConflict = await Appointment.findOne({
                mrId: apt.mrId._id,
                date: slot.date,
                startTime: slot.slots[0],
                status: { $in: ['pending', 'confirmed', 'scheduled', 'rescheduled'] },
                _id: { $ne: apt._id } // Exclude current appointment
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
              // Calculate new end time based on slot duration
              const [hours, mins] = suitableSlot.slots[0].split(':').map(Number);
              const endMins = mins + (availability.slotDuration || 15);
              apt.endTime = `${Math.floor((hours * 60 + endMins) / 60).toString().padStart(2, '0')}:${((hours * 60 + endMins) % 60).toString().padStart(2, '0')}`;
              apt.status = 'rescheduled';
              await apt.save();

              // Notify MR about rescheduling
              await Notification.create({
                userId: apt.mrId._id,
                userType: 'mr',
                title: 'Appointment Rescheduled',
                message: `Your appointment has been rescheduled to ${suitableSlot.date.toDateString()} at ${suitableSlot.slots[0]}`,
                type: 'general',
                relatedId: apt._id
              });

              // Send email if MR has email (non-blocking)
              if (apt.mrId?.email) {
                sendEmailAsync(
                  apt.mrId.email,
                  'Appointment Rescheduled - MRAlo',
                  `
                    <h2>Your Appointment Has Been Rescheduled</h2>
                    <p>Due to changes in doctor's availability, your appointment has been automatically rescheduled.</p>
                    <p><strong>Original:</strong> ${oldDate.toDateString()} at ${oldTime}</p>
                    <p><strong>New:</strong> ${suitableSlot.date.toDateString()} at ${suitableSlot.slots[0]}</p>
                    <p>If this doesn't work for you, please reschedule through the app.</p>
                  `
                );
              }
            } else {
              // No suitable slots available (either doctor has no slots or MR is busy), cancel
              apt.status = 'cancelled';
              apt.cancellationReason = 'Doctor availability changed - no alternative slots available when you are free';
              await apt.save();

              await Notification.create({
                userId: apt.mrId._id,
                userType: 'mr',
                title: 'Appointment Cancelled',
                message: 'Your appointment was cancelled - no alternative slots available when you are free',
                type: 'cancellation',
                relatedId: apt._id
              });

              if (apt.mrId?.email) {
                sendEmailAsync(
                  apt.mrId.email,
                  'Appointment Cancelled - MRAlo',
                  `
                    <h2>Appointment Cancelled</h2>
                    <p>We're sorry, but your appointment on ${apt.date.toDateString()} at ${apt.startTime} has been cancelled.</p>
                    <p><strong>Reason:</strong> Doctor's availability has changed and no alternative slots are available when you are free</p>
                    <p>Please book a new appointment through the app.</p>
                  `
                );
              }
            }
          } catch (err) {
            console.error('Reschedule error:', err);
            apt.status = 'cancelled';
            apt.cancellationReason = 'Doctor availability changed - rescheduling failed';
            await apt.save();
            
            // Notify about cancellation
            await Notification.create({
              userId: apt.mrId._id,
              userType: 'mr',
              title: 'Appointment Cancelled',
              message: 'Your appointment was cancelled due to availability changes',
              type: 'cancellation',
              relatedId: apt._id
            });
          }
        } else {
          // Cancel appointment
          apt.status = 'cancelled';
          apt.cancellationReason = 'Doctor availability removed';
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
            message: 'Your appointment was cancelled due to doctor availability changes',
            type: 'cancellation',
            relatedId: apt._id
          });

          if (apt.mrId?.email) {
            sendEmailAsync(
              apt.mrId.email,
              'Appointment Cancelled - MRAlo',
              `
                <h2>Appointment Cancelled</h2>
                <p>We're sorry, but your appointment on ${apt.date.toDateString()} at ${apt.startTime} has been cancelled.</p>
                <p><strong>Reason:</strong> Doctor's availability has changed</p>
                <p>Please book a new appointment through the app.</p>
              `
            );
          }
        }
      }
    }

    // Delete the availability
    await Availability.findByIdAndDelete(req.params.id);

    // Delete future slots for this availability
    // Get all future slots for this doctor
    const futureSlots = await Slot.find({
      doctorId: req.user.id,
      date: { $gte: today }
    });

    // Filter slots that match the deleted availability's day of week and time range
    const slotsToDelete = futureSlots.filter(slot => {
      const slotDayOfWeek = new Date(slot.date).getDay();
      const slotStartTime = slot.startTime;
      
      return slotDayOfWeek === availability.dayOfWeek &&
             slotStartTime >= availability.startTime &&
             slotStartTime < availability.endTime;
    });

    // Delete the filtered slots
    const slotIdsToDelete = slotsToDelete.map(slot => slot._id);
    if (slotIdsToDelete.length > 0) {
      await Slot.deleteMany({ _id: { $in: slotIdsToDelete } });
      console.log(`Deleted ${slotIdsToDelete.length} slots for deleted availability`);
    }

    // Note: Appointments have already been handled above (cancelled or rescheduled)
    // The slotId reference in appointments will remain but the slot itself is deleted

    res.json({ 
      success: true, 
      message: 'Availability deleted',
      affectedAppointments: filteredAppointments.length,
      action: reschedule === 'true' ? 'rescheduled' : 'cancelled'
    });
  } catch (error) {
    console.error('Delete availability error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.checkConflicts = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;
    const Appointment = require('../models/Appointment');
    
    const searchDate = new Date(date);
    const nextDay = new Date(searchDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find appointments on that date and time range
    const conflicts = await Appointment.find({
      doctorId: req.user.id,
      date: {
        $gte: searchDate,
        $lt: nextDay
      },
      status: 'confirmed',
      $or: [
        {
          $and: [
            { startTime: { $gte: startTime } },
            { startTime: { $lt: endTime } }
          ]
        },
        {
          $and: [
            { endTime: { $gt: startTime } },
            { endTime: { $lte: endTime } }
          ]
        },
        {
          $and: [
            { startTime: { $lte: startTime } },
            { endTime: { $gte: endTime } }
          ]
        }
      ]
    })
    .populate('mrId', 'name email company')
    .sort({ startTime: 1 });

    res.json({ success: true, conflicts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markUnavailable = async (req, res) => {
  try {
    const { date, startTime, endTime, cancelConflicts } = req.body;
    const Appointment = require('../models/Appointment');
    const Slot = require('../models/Slot');
    const Notification = require('../models/Notification');
    const { sendAppointmentCancellationAsync } = require('../utils/emailService');
    const Doctor = require('../models/Doctor');
    
    const searchDate = new Date(date);
    const nextDay = new Date(searchDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Find conflicting appointments
    const conflicts = await Appointment.find({
      doctorId: req.user.id,
      date: {
        $gte: searchDate,
        $lt: nextDay
      },
      status: 'confirmed',
      $or: [
        {
          $and: [
            { startTime: { $gte: startTime } },
            { startTime: { $lt: endTime } }
          ]
        },
        {
          $and: [
            { endTime: { $gt: startTime } },
            { endTime: { $lte: endTime } }
          ]
        },
        {
          $and: [
            { startTime: { $lte: startTime } },
            { endTime: { $gte: endTime } }
          ]
        }
      ]
    })
    .populate('mrId', 'name email')
    .populate('doctorId', 'name');

    if (conflicts.length > 0 && !cancelConflicts) {
      return res.status(400).json({ 
        message: 'Conflicting appointments found',
        conflicts 
      });
    }

    // Cancel all conflicting appointments
    if (cancelConflicts && conflicts.length > 0) {
      for (const appointment of conflicts) {
        // Update appointment status
        appointment.status = 'cancelled';
        appointment.cancellationReason = `Doctor marked ${date} ${startTime}-${endTime} as unavailable`;
        await appointment.save();

        // Free up the slot
        const slot = await Slot.findById(appointment.slotId);
        if (slot) {
          slot.isBooked = false;
          slot.bookedBy = null;
          await slot.save();
        }

        // Send email notification (non-blocking)
        sendAppointmentCancellationAsync(
          appointment.mrId.email,
          appointment.mrId.name,
          appointment.doctorId.name,
          appointment.date.toLocaleDateString(),
          appointment.startTime,
          appointment.cancellationReason
        );

        // Create in-app notification
        await Notification.create({
          userId: appointment.mrId._id,
          userType: 'mr',
          title: 'Appointment Cancelled',
          message: `Your appointment with Dr. ${appointment.doctorId.name} has been cancelled - Doctor unavailable`,
          type: 'cancellation',
          relatedId: appointment._id
        });
      }
    }

    // Mark slots as unavailable (delete them)
    await Slot.deleteMany({
      doctorId: req.user.id,
      date: {
        $gte: searchDate,
        $lt: nextDay
      },
      startTime: { $gte: startTime },
      endTime: { $lte: endTime }
    });

    res.json({ 
      success: true, 
      message: `Marked as unavailable${cancelConflicts ? ` and cancelled ${conflicts.length} appointment(s)` : ''}` 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
