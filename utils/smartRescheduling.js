const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');
const Leave = require('../models/Leave');
const { sendEmail } = require('./emailService');

/**
 * Smart Auto-Rescheduling System
 * Automatically finds and suggests alternative slots when appointments need rescheduling
 */

// Find available slots for rescheduling
const findAvailableSlots = async (doctorId, originalDate, daysToSearch = 7) => {
  const availableSlots = [];
  const startDate = new Date(originalDate);
  
  // Get all doctor's availabilities
  const doctorAvailabilities = await Availability.find({
    doctorId: doctorId,
    isActive: true
  });
  
  if (doctorAvailabilities.length === 0) {
    return availableSlots;
  }
  
  // Create a map of day number to availability
  const availabilityByDay = {};
  doctorAvailabilities.forEach(avail => {
    availabilityByDay[avail.dayOfWeek] = avail;
  });
  
  for (let i = 1; i <= daysToSearch; i++) {
    const checkDate = new Date(startDate);
    checkDate.setDate(checkDate.getDate() + i);
    checkDate.setHours(0, 0, 0, 0);
    
    const dayOfWeek = checkDate.getDay();
    
    // Check if doctor has availability on this day
    const availability = availabilityByDay[dayOfWeek];
    if (!availability) continue;
    
    // Skip if doctor is on leave
    const isOnLeave = await Leave.findOne({
      doctorId: doctorId,
      startDate: { $lte: checkDate },
      endDate: { $gte: checkDate },
      status: 'active'
    });
    
    if (isOnLeave) continue;
    
    // Get existing appointments for this date
    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const existingAppointments = await Appointment.find({
      $or: [{ doctorId: doctorId }, { doctor: doctorId }],
      date: {
        $gte: checkDate,
        $lt: nextDay
      },
      status: { $nin: ['cancelled', 'no-show', 'missed'] }
    }).select('startTime timeSlot');
    
    // Get booked time slots (handle both startTime and timeSlot fields)
    const bookedSlots = existingAppointments.map(a => a.startTime || a.timeSlot);
    
    // Generate time slots based on availability
    const slots = generateTimeSlots(availability.startTime, availability.endTime, availability.slotDuration);
    const freeSlots = slots.filter(slot => !bookedSlots.includes(slot));
    
    if (freeSlots.length > 0) {
      availableSlots.push({
        date: new Date(checkDate),
        slots: freeSlots
      });
    }
  }
  
  return availableSlots;
};

// Helper function to generate time slots
const generateTimeSlots = (startTime, endTime, duration) => {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
    slots.push(timeStr);
    
    currentMin += duration;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
  }
  
  return slots;
};


// Auto-reschedule appointment
const autoReschedule = async (appointmentId, reason = 'Doctor unavailable') => {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'name email')
      .populate('mr', 'name email');
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    
    const doctorId = appointment.doctor?._id || appointment.doctor;
    
    // Find available slots
    const availableSlots = await findAvailableSlots(
      doctorId,
      appointment.date,
      14 // Search 2 weeks ahead
    );
    
    if (availableSlots.length === 0) {
      // No slots available, notify MR
      await sendEmail({
        to: appointment.mr.email,
        subject: 'Appointment Rescheduling Required - No Auto Slots Available',
        html: `
          <h2>Appointment Needs Manual Rescheduling</h2>
          <p>Your appointment with Dr. ${appointment.doctor.name} on ${appointment.date.toDateString()} 
          at ${appointment.timeSlot} needs to be rescheduled.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Unfortunately, no automatic slots are available. Please contact the doctor's office to reschedule.</p>
        `
      });
      
      return { success: false, message: 'No available slots found', suggestedSlots: [] };
    }
    
    // Get the first available slot
    const newSlot = availableSlots[0];
    const newTimeSlot = newSlot.slots[0];
    
    // Update appointment
    const oldDate = appointment.date;
    const oldTimeSlot = appointment.timeSlot;
    
    appointment.date = newSlot.date;
    appointment.timeSlot = newTimeSlot;
    appointment.rescheduledFrom = {
      date: oldDate,
      timeSlot: oldTimeSlot,
      reason,
      rescheduledAt: new Date()
    };
    appointment.status = 'rescheduled';
    
    await appointment.save();
    
    // Notify MR about rescheduling
    await sendEmail({
      to: appointment.mr.email,
      subject: 'Appointment Automatically Rescheduled',
      html: `
        <h2>Your Appointment Has Been Rescheduled</h2>
        <p>Your appointment with Dr. ${appointment.doctor.name} has been automatically rescheduled.</p>
        <p><strong>Original:</strong> ${oldDate.toDateString()} at ${oldTimeSlot}</p>
        <p><strong>New:</strong> ${newSlot.date.toDateString()} at ${newTimeSlot}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>If this new time doesn't work for you, please reschedule through the app.</p>
      `
    });
    
    return {
      success: true,
      message: 'Appointment rescheduled successfully',
      newDate: newSlot.date,
      newTimeSlot,
      suggestedSlots: availableSlots
    };
  } catch (error) {
    console.error('Auto-reschedule error:', error);
    throw error;
  }
};

// Bulk reschedule for doctor leave
const bulkRescheduleForLeave = async (doctorId, leaveStartDate, leaveEndDate) => {
  try {
    // Find all appointments during leave period
    const affectedAppointments = await Appointment.find({
      $or: [{ doctor: doctorId }, { doctorId: doctorId }],
      date: { $gte: leaveStartDate, $lte: leaveEndDate },
      status: { $in: ['pending', 'confirmed'] }
    });
    
    const results = {
      total: affectedAppointments.length,
      rescheduled: 0,
      failed: 0,
      details: []
    };
    
    for (const appointment of affectedAppointments) {
      try {
        const result = await autoReschedule(appointment._id, 'Doctor on leave');
        if (result.success) {
          results.rescheduled++;
        } else {
          results.failed++;
        }
        results.details.push({
          appointmentId: appointment._id,
          ...result
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          appointmentId: appointment._id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Bulk reschedule error:', error);
    throw error;
  }
};

// Get rescheduling suggestions
const getReschedulingSuggestions = async (appointmentId) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new Error('Appointment not found');
  }
  
  const doctorId = appointment.doctor || appointment.doctorId;
  return findAvailableSlots(doctorId, appointment.date, 14);
};

module.exports = {
  findAvailableSlots,
  autoReschedule,
  bulkRescheduleForLeave,
  getReschedulingSuggestions
};
