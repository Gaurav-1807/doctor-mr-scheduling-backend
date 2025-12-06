const nodemailer = require('nodemailer');

// Basic nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const getEmailTemplate = (content) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MRAlo</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f3f4f6;
        }
        .email-container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .email-header {
          background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
          padding: 30px 20px;
          text-align: center;
        }
        .brand-name {
          color: white;
          font-size: 36px;
          font-weight: bold;
          margin: 10px 0 5px 0;
          letter-spacing: 2px;
        }
        .brand-tagline {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          margin: 0;
        }
        .email-body {
          padding: 40px 30px;
          color: #374151;
          line-height: 1.6;
        }
        .email-body h2 {
          color: #1f2937;
          margin-top: 0;
          font-size: 24px;
        }
        .info-box {
          background-color: #f9fafb;
          border-left: 4px solid #3B82F6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-box p {
          margin: 8px 0;
        }
        .info-label {
          font-weight: 600;
          color: #4b5563;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
          color: white;
          padding: 14px 32px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: 600;
        }
        .email-footer {
          background-color: #f9fafb;
          padding: 25px 30px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1 class="brand-name">MRAlo</h1>
          <p class="brand-tagline">Doctor-MR Scheduling Platform</p>
        </div>
        <div class="email-body">
          ${content}
        </div>
        <div class="email-footer">
          <p><strong>MRAlo</strong> - Simplifying Doctor-MR Scheduling</p>
          <p>© ${new Date().getFullYear()} MRAlo. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`⚠️ Email not configured - skipping`);
      return false;
    }

    if (!to || !to.includes('@')) {
      console.log(`⚠️ Invalid email: ${to}`);
      return false;
    }

    transporter.sendMail({
      from: `"MRAlo" <${process.env.EMAIL_USER}>`,
      to: to.trim(),
      subject,
      html: getEmailTemplate(html)
    });

    console.log(`✅ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return false;
  }
};


const sendAppointmentConfirmation = async (mrEmail, doctorName, date, time) => {
  const subject = '✅ Appointment Confirmed - MRAlo';
  const html = `
    <h2>✅ Appointment Confirmed!</h2>
    <p>Your appointment has been successfully confirmed.</p>
    <div class="info-box">
      <p><span class="info-label">Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">Date:</span> ${date}</p>
      <p><span class="info-label">Time:</span> ${time}</p>
    </div>
    <p>Please arrive 5 minutes early.</p>
  `;
  return sendEmail(mrEmail, subject, html);
};

const sendFollowUpReminder = async (mrEmail, doctorName, date, time) => {
  const subject = '🔔 Follow-up Reminder - MRAlo';
  const html = `
    <h2>🔔 Follow-up Reminder</h2>
    <p>Reminder about your upcoming appointment.</p>
    <div class="info-box">
      <p><span class="info-label">Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">Date:</span> ${date}</p>
      <p><span class="info-label">Time:</span> ${time}</p>
    </div>
  `;
  return sendEmail(mrEmail, subject, html);
};

const sendDailyScheduleEmail = async (doctorEmail, doctorName, appointments) => {
  const subject = `📋 Your Daily Schedule - ${new Date().toLocaleDateString()}`;
  const appointmentList = appointments.map(apt => `
    <div style="padding: 10px; margin: 5px 0; background: #f9fafb; border-radius: 4px;">
      <p><strong>${apt.time}</strong> - ${apt.mrName} (${apt.company})</p>
    </div>
  `).join('');
  
  const html = `
    <h2>Good Morning, Dr. ${doctorName}!</h2>
    <p>Here's your schedule for today:</p>
    <p><strong>Total Appointments: ${appointments.length}</strong></p>
    ${appointmentList}
  `;
  return sendEmail(doctorEmail, subject, html);
};

const sendAppointmentCancellation = async (mrEmail, mrName, doctorName, date, time, reason) => {
  const subject = '❌ Appointment Cancelled - MRAlo';
  const html = `
    <h2>❌ Appointment Cancelled</h2>
    <p>Dear ${mrName}, your appointment has been cancelled.</p>
    <div class="info-box">
      <p><span class="info-label">Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">Date:</span> ${date}</p>
      <p><span class="info-label">Time:</span> ${time}</p>
      <p><span class="info-label">Reason:</span> ${reason}</p>
    </div>
  `;
  return sendEmail(mrEmail, subject, html);
};

const sendAppointmentCompletion = async (mrEmail, mrName, doctorName, date, time) => {
  const subject = '✅ Appointment Completed - MRAlo';
  const html = `
    <h2>✅ Appointment Completed</h2>
    <p>Dear ${mrName}, your appointment has been completed.</p>
    <div class="info-box">
      <p><span class="info-label">Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">Date:</span> ${date}</p>
      <p><span class="info-label">Time:</span> ${time}</p>
    </div>
    <p>Thank you for using MRAlo!</p>
  `;
  return sendEmail(mrEmail, subject, html);
};

// Fire-and-forget wrapper - doesn't wait for email to complete
const sendEmailAsync = (to, subject, html) => {
  // Don't await - just fire and forget
  sendEmail(to, subject, html).catch(err => {
    console.error(`Background email failed to ${to}:`, err.message);
  });
};

// Non-blocking versions of email functions
const sendAppointmentConfirmationAsync = (mrEmail, doctorName, date, time) => {
  sendAppointmentConfirmation(mrEmail, doctorName, date, time).catch(err => {
    console.error('Background confirmation email failed:', err.message);
  });
};

const sendAppointmentCancellationAsync = (mrEmail, mrName, doctorName, date, time, reason) => {
  sendAppointmentCancellation(mrEmail, mrName, doctorName, date, time, reason).catch(err => {
    console.error('Background cancellation email failed:', err.message);
  });
};

const sendAppointmentCompletionAsync = (mrEmail, mrName, doctorName, date, time) => {
  sendAppointmentCompletion(mrEmail, mrName, doctorName, date, time).catch(err => {
    console.error('Background completion email failed:', err.message);
  });
};

module.exports = {
  sendEmail,
  sendEmailAsync,
  sendAppointmentConfirmation,
  sendAppointmentConfirmationAsync,
  sendFollowUpReminder,
  sendDailyScheduleEmail,
  sendAppointmentCancellation,
  sendAppointmentCancellationAsync,
  sendAppointmentCompletion,
  sendAppointmentCompletionAsync
};
