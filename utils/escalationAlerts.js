const Appointment = require('../models/Appointment');
const VisitTracking = require('../models/VisitTracking');
const { sendEmail } = require('./emailService');

/**
 * Escalation Alert System
 * Monitors for missed visits, no-shows, and other issues requiring attention
 */

// Check for no-shows and send alerts
const checkNoShows = async () => {
  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  
  // Find appointments that should have started but no check-in recorded
  const potentialNoShows = await Appointment.find({
    date: {
      $gte: new Date(now.setHours(0, 0, 0, 0)),
      $lt: new Date(now.setHours(23, 59, 59, 999))
    },
    status: 'confirmed'
  }).populate('doctor', 'name email')
    .populate('mr', 'name email phone');
  
  const alerts = [];
  
  for (const appointment of potentialNoShows) {
    // Parse time slot to check if appointment time has passed
    const [hours, minutes] = appointment.timeSlot.split(':').map(Number);
    const appointmentTime = new Date(appointment.date);
    appointmentTime.setHours(hours, minutes, 0, 0);
    
    // If appointment was 30+ minutes ago and still confirmed (no check-in)
    if (appointmentTime < thirtyMinutesAgo) {
      // Check if there's a visit tracking record
      const visitRecord = await VisitTracking.findOne({
        appointment: appointment._id,
        checkInTime: { $exists: true }
      });
      
      if (!visitRecord) {
        // Mark as potential no-show
        appointment.status = 'no-show';
        await appointment.save();
        
        // Send alert to doctor
        await sendEmail({
          to: appointment.doctor.email,
          subject: `⚠️ No-Show Alert: ${appointment.mr.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">⚠️ Missed Appointment Alert</h2>
              <p>The following MR did not show up for their scheduled appointment:</p>
              
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>MR Name:</strong> ${appointment.mr.name}</p>
                <p><strong>Scheduled Time:</strong> ${appointment.timeSlot}</p>
                <p><strong>Contact:</strong> ${appointment.mr.phone || appointment.mr.email}</p>
              </div>
              
              <p>The appointment has been marked as a no-show. The slot is now available for other bookings.</p>
            </div>
          `
        });
        
        alerts.push({
          type: 'no-show',
          appointmentId: appointment._id,
          mrName: appointment.mr.name,
          doctorName: appointment.doctor.name
        });
      }
    }
  }
  
  return alerts;
};

// Check for overdue visits (MR checked in but hasn't checked out)
const checkOverdueVisits = async () => {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  
  const overdueVisits = await VisitTracking.find({
    checkInTime: { $lt: twoHoursAgo },
    checkOutTime: { $exists: false },
    status: 'in-progress'
  }).populate('mr', 'name email')
    .populate('doctor', 'name');
  
  const alerts = [];
  
  for (const visit of overdueVisits) {
    // Send reminder to MR to check out
    await sendEmail({
      to: visit.mr.email,
      subject: '⏰ Reminder: Please Check Out from Your Visit',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">⏰ Visit Check-Out Reminder</h2>
          <p>Hi ${visit.mr.name},</p>
          <p>You checked in for your visit with Dr. ${visit.doctor.name} over 2 hours ago but haven't checked out yet.</p>
          <p>Please remember to check out when your visit is complete to maintain accurate records.</p>
        </div>
      `
    });
    
    alerts.push({
      type: 'overdue-visit',
      visitId: visit._id,
      mrName: visit.mr.name,
      checkInTime: visit.checkInTime
    });
  }
  
  return alerts;
};

// Check for repeated no-shows (pattern detection)
const checkRepeatedNoShows = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Aggregate no-shows by MR in last 30 days
  const noShowPatterns = await Appointment.aggregate([
    {
      $match: {
        status: 'no-show',
        date: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: '$mr',
        noShowCount: { $sum: 1 },
        doctors: { $addToSet: '$doctor' }
      }
    },
    {
      $match: {
        noShowCount: { $gte: 3 } // 3+ no-shows triggers alert
      }
    }
  ]);
  
  const alerts = [];
  
  for (const pattern of noShowPatterns) {
    const MR = require('../models/MR');
    const mr = await MR.findById(pattern._id);
    
    if (mr) {
      alerts.push({
        type: 'repeated-no-shows',
        mrId: mr._id,
        mrName: mr.name,
        noShowCount: pattern.noShowCount,
        affectedDoctors: pattern.doctors.length
      });
      
      // Could implement automatic restrictions here
      // mr.bookingRestricted = true;
      // await mr.save();
    }
  }
  
  return alerts;
};

// Run all escalation checks
const runEscalationChecks = async () => {
  const results = {
    noShows: await checkNoShows(),
    overdueVisits: await checkOverdueVisits(),
    repeatedNoShows: await checkRepeatedNoShows(),
    timestamp: new Date()
  };
  
  console.log(`Escalation check completed: ${results.noShows.length} no-shows, ${results.overdueVisits.length} overdue visits`);
  
  return results;
};

module.exports = {
  checkNoShows,
  checkOverdueVisits,
  checkRepeatedNoShows,
  runEscalationChecks
};
