const Appointment = require('../models/Appointment');
const Availability = require('../models/Availability');

/**
 * Priority-Based Scheduling System
 * Allocates slots based on MR priority levels and booking history
 */

const PRIORITY_WEIGHTS = {
  urgent: 100,
  high: 75,
  normal: 50,
  low: 25
};

// Calculate MR priority score
const calculateMRPriorityScore = async (mrId, doctorId) => {
  // Get MR's booking history with this doctor
  const history = await Appointment.find({
    mr: mrId,
    doctor: doctorId,
    status: 'completed'
  }).sort({ date: -1 }).limit(10);
  
  let score = 50; // Base score
  
  // Bonus for consistent visits
  if (history.length >= 5) score += 10;
  if (history.length >= 10) score += 10;
  
  // Check for no-shows (penalty)
  const noShows = await Appointment.countDocuments({
    mr: mrId,
    doctor: doctorId,
    status: 'no-show'
  });
  score -= noShows * 5;
  
  // Check for cancellations (small penalty)
  const cancellations = await Appointment.countDocuments({
    mr: mrId,
    doctor: doctorId,
    status: 'cancelled'
  });
  score -= cancellations * 2;
  
  // Ensure score is within bounds
  return Math.max(0, Math.min(100, score));
};

// Get priority-sorted available slots
const getPrioritizedSlots = async (doctorId, date, mrId, requestedPriority = 'normal') => {
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  // Get availability
  const availability = await Availability.findOne({
    doctor: doctorId,
    dayOfWeek,
    isActive: true
  });
  
  if (!availability) return [];
  
  // Get existing appointments
  const existingAppointments = await Appointment.find({
    doctor: doctorId,
    date: {
      $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
      $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
    },
    status: { $nin: ['cancelled', 'no-show'] }
  });
  
  const bookedSlots = existingAppointments.map(a => a.timeSlot);
  
  // Calculate MR's priority score
  const mrScore = await calculateMRPriorityScore(mrId, doctorId);
  const priorityWeight = PRIORITY_WEIGHTS[requestedPriority] || PRIORITY_WEIGHTS.normal;
  const combinedScore = (mrScore + priorityWeight) / 2;
  
  // Filter and sort available slots
  const availableSlots = availability.slots
    .filter(slot => slot.isAvailable && !bookedSlots.includes(slot.time))
    .map(slot => ({
      time: slot.time,
      recommended: combinedScore >= 60, // High priority MRs get recommendations
      priorityAccess: combinedScore >= 75 // Very high priority gets premium slots
    }));
  
  // Sort slots - premium slots first for high priority MRs
  if (combinedScore >= 75) {
    // High priority MRs get morning slots first (usually preferred)
    availableSlots.sort((a, b) => a.time.localeCompare(b.time));
  }
  
  return {
    slots: availableSlots,
    mrPriorityScore: mrScore,
    combinedScore,
    accessLevel: combinedScore >= 75 ? 'premium' : combinedScore >= 50 ? 'standard' : 'basic'
  };
};

// Reserve priority slot
const reservePrioritySlot = async (doctorId, date, timeSlot, mrId, priority) => {
  const priorityData = await getPrioritizedSlots(doctorId, date, mrId, priority);
  
  // Check if slot is available
  const slotAvailable = priorityData.slots.find(s => s.time === timeSlot);
  if (!slotAvailable) {
    throw new Error('Slot not available');
  }
  
  // Check if MR has access to this slot
  if (priority === 'urgent' && priorityData.accessLevel === 'basic') {
    throw new Error('Insufficient priority level for urgent booking');
  }
  
  return {
    canBook: true,
    priorityLevel: priorityData.accessLevel,
    mrScore: priorityData.mrPriorityScore
  };
};

module.exports = {
  calculateMRPriorityScore,
  getPrioritizedSlots,
  reservePrioritySlot,
  PRIORITY_WEIGHTS
};
