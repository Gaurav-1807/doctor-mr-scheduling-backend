const Appointment = require('../models/Appointment');
const Task = require('../models/Task');
const { sendEmail } = require('./emailService');

/**
 * Smart Reminder Engine
 * Sends intelligent reminders based on appointment type, history, and preferences
 */

// Send appointment reminder
const sendAppointmentReminder = async (appointmentId, reminderType = '24h') => {
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'name email clinicAddress')
      .populate('mr', 'name email phone');
    
    if (!appointment) return { success: false, message: 'Appointment not found' };
    
    const reminderTemplates = {
      '24h': {
        subject: `Reminder: Appointment Tomorrow with Dr. ${appointment.doctor.name}`,
        timeText: 'tomorrow'
      },
      '2h': {
        subject: `Reminder: Appointment in 2 Hours with Dr. ${appointment.doctor.name}`,
        timeText: 'in 2 hours'
      },
      '30m': {
        subject: `Final Reminder: Appointment in 30 Minutes`,
        timeText: 'in 30 minutes'
      }
    };
    
    const template = reminderTemplates[reminderType] || reminderTemplates['24h'];
    
    await sendEmail({
      to: appointment.mr.email,
      subject: template.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">⏰ Appointment Reminder</h2>
          <p>Hi ${appointment.mr.name},</p>
          <p>This is a reminder that your appointment is scheduled ${template.timeText}.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Doctor:</strong> Dr. ${appointment.doctor.name}</p>
            <p><strong>Date:</strong> ${appointment.date.toDateString()}</p>
            <p><strong>Time:</strong> ${appointment.timeSlot}</p>
            <p><strong>Location:</strong> ${appointment.doctor.clinicAddress || 'See app for details'}</p>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">
            Please arrive 5-10 minutes early. If you need to reschedule, please do so through the app.
          </p>
        </div>
      `
    });
    
    // Update appointment reminder status
    appointment.remindersSent = appointment.remindersSent || [];
    appointment.remindersSent.push({
      type: reminderType,
      sentAt: new Date()
    });
    await appointment.save();
    
    return { success: true, message: `${reminderType} reminder sent` };
  } catch (error) {
    console.error('Reminder error:', error);
    return { success: false, message: error.message };
  }
};

// Send task deadline reminder
const sendTaskReminder = async (taskId) => {
  try {
    const task = await Task.findById(taskId)
      .populate('assignedTo', 'name email');
    
    if (!task) return { success: false, message: 'Task not found' };
    
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const hoursUntilDue = Math.round((dueDate - now) / (1000 * 60 * 60));
    
    let urgencyText = '';
    if (hoursUntilDue <= 2) urgencyText = '🚨 URGENT: ';
    else if (hoursUntilDue <= 24) urgencyText = '⚠️ ';
    
    await sendEmail({
      to: task.assignedTo.email,
      subject: `${urgencyText}Task Reminder: ${task.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">📋 Task Deadline Approaching</h2>
          <p>Hi ${task.assignedTo.name},</p>
          <p>Your task is due ${hoursUntilDue <= 0 ? 'now' : `in ${hoursUntilDue} hours`}.</p>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p><strong>Task:</strong> ${task.title}</p>
            <p><strong>Priority:</strong> ${task.priority}</p>
            <p><strong>Due:</strong> ${dueDate.toLocaleString()}</p>
            ${task.description ? `<p><strong>Description:</strong> ${task.description}</p>` : ''}
          </div>
          
          <p>Please complete this task as soon as possible.</p>
        </div>
      `
    });
    
    return { success: true, message: 'Task reminder sent' };
  } catch (error) {
    console.error('Task reminder error:', error);
    return { success: false, message: error.message };
  }
};

// Process all pending reminders
const processReminders = async () => {
  const now = new Date();
  const results = { appointments: [], tasks: [] };
  
  // 24-hour appointment reminders
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const appointmentsIn24h = await Appointment.find({
    date: {
      $gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
      $lt: new Date(tomorrow.setHours(23, 59, 59, 999))
    },
    status: { $in: ['pending', 'confirmed'] },
    'remindersSent.type': { $ne: '24h' }
  });
  
  for (const apt of appointmentsIn24h) {
    const result = await sendAppointmentReminder(apt._id, '24h');
    results.appointments.push({ id: apt._id, ...result });
  }
  
  // Task reminders (due within 24 hours)
  const tasksDueSoon = await Task.find({
    dueDate: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
    status: { $nin: ['completed', 'cancelled'] },
    reminderSent: { $ne: true }
  });
  
  for (const task of tasksDueSoon) {
    const result = await sendTaskReminder(task._id);
    if (result.success) {
      task.reminderSent = true;
      await task.save();
    }
    results.tasks.push({ id: task._id, ...result });
  }
  
  return results;
};

module.exports = {
  sendAppointmentReminder,
  sendTaskReminder,
  processReminders
};
