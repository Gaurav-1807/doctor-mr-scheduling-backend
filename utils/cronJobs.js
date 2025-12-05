const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const Doctor = require('../models/Doctor');
const MR = require('../models/MR');
const { sendFollowUpReminder, sendDailyScheduleEmail } = require('./emailService');

const sendFollowUpReminders = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find appointments with follow-up date tomorrow
    const appointments = await Appointment.find({
      followUpDate: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'completed'
    })
    .populate('doctorId', 'name')
    .populate('mrId', 'name email');

    for (const appointment of appointments) {
      // Send email
      await sendFollowUpReminder(
        appointment.mrId.email,
        appointment.doctorId.name,
        appointment.followUpDate.toLocaleDateString(),
        'As scheduled'
      );

      // Create notification
      await Notification.create({
        userId: appointment.mrId._id,
        userType: 'mr',
        title: 'Follow-up Reminder',
        message: `Follow-up with Dr. ${appointment.doctorId.name} is due tomorrow`,
        type: 'followup',
        relatedId: appointment._id
      });
    }

    console.log(`✅ Sent ${appointments.length} follow-up reminders`);
  } catch (error) {
    console.error('❌ Error sending follow-up reminders:', error);
  }
};

const sendDailySchedule = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all appointments for today
    const appointments = await Appointment.find({
      date: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'scheduled'
    })
    .populate('doctorId', 'name email')
    .populate('mrId', 'name company');

    // Group by doctor
    const doctorAppointments = {};
    
    for (const apt of appointments) {
      const doctorId = apt.doctorId._id.toString();
      
      if (!doctorAppointments[doctorId]) {
        doctorAppointments[doctorId] = {
          doctor: apt.doctorId,
          appointments: []
        };
      }

      doctorAppointments[doctorId].appointments.push({
        time: apt.startTime,
        mrName: apt.mrId.name,
        company: apt.mrId.company
      });
    }

    // Send emails to doctors
    for (const doctorId in doctorAppointments) {
      const { doctor, appointments } = doctorAppointments[doctorId];
      
      await sendDailyScheduleEmail(
        doctor.email,
        doctor.name,
        appointments
      );

      // Create notification
      await Notification.create({
        userId: doctor._id,
        userType: 'doctor',
        title: 'Today\'s Schedule',
        message: `You have ${appointments.length} appointment(s) today`,
        type: 'general'
      });
    }

    console.log(`✅ Sent daily schedule to ${Object.keys(doctorAppointments).length} doctors`);
  } catch (error) {
    console.error('❌ Error sending daily schedule:', error);
  }
};

module.exports = {
  sendFollowUpReminders,
  sendDailySchedule
};
