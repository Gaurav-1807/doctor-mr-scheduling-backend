const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
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
        .logo-container {
          display: inline-block;
          margin-bottom: 15px;
        }
        .logo {
          width: 60px;
          height: 60px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .logo svg {
          width: 50px;
          height: 50px;
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
          box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
        }
        .email-footer {
          background-color: #f9fafb;
          padding: 25px 30px;
          text-align: center;
          color: #6b7280;
          font-size: 13px;
          border-top: 1px solid #e5e7eb;
        }
        .social-links {
          margin: 15px 0;
        }
        .social-links a {
          display: inline-block;
          margin: 0 8px;
          color: #3B82F6;
          text-decoration: none;
        }
        @media only screen and (max-width: 600px) {
          .email-body {
            padding: 25px 20px;
          }
          .brand-name {
            font-size: 26px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <div class="logo-container">
            <div class="logo">
              <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="emailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#e0e7ff;stop-opacity:1" />
                  </linearGradient>
                </defs>
                <circle cx="25" cy="25" r="23" fill="url(#emailGrad)" />
                <rect x="22" y="12" width="6" height="16" fill="#2563EB" rx="1" />
                <rect x="16" y="18" width="18" height="6" fill="#2563EB" rx="1" />
                <circle cx="18" cy="32" r="1.5" fill="#2563EB" />
                <circle cx="25" cy="32" r="1.5" fill="#2563EB" />
                <circle cx="32" cy="32" r="1.5" fill="#2563EB" />
                <circle cx="18" cy="37" r="1.5" fill="#2563EB" />
                <circle cx="25" cy="37" r="1.5" fill="#2563EB" />
                <circle cx="32" cy="37" r="1.5" fill="#2563EB" />
              </svg>
            </div>
          </div>
          <h1 class="brand-name">MRAlo</h1>
          <p class="brand-tagline">Doctor-MR Scheduling Platform</p>
        </div>
        <div class="email-body">
          ${content}
        </div>
        <div class="email-footer">
          <p><strong>MRAlo</strong> - Simplifying Doctor-MR Scheduling</p>
          <p>This is an automated message. Please do not reply to this email.</p>
          <div class="social-links">
            <a href="#">Website</a> | 
            <a href="#">Support</a> | 
            <a href="#">Privacy Policy</a>
          </div>
          <p style="margin-top: 15px; color: #9ca3af; font-size: 12px;">
            © ${new Date().getFullYear()} MRAlo. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendEmail = async (to, subject, html) => {
  try {
    // Validate recipient email
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      console.log(`⚠️ Skipping email - invalid recipient: ${to}`);
      return false;
    }

    // Trim and validate email format
    const recipientEmail = to.trim();
    if (!recipientEmail || recipientEmail.length < 5) {
      console.log(`⚠️ Skipping email - empty or invalid recipient`);
      return false;
    }

    const mailOptions = {
      from: `"MRAlo" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject,
      html: getEmailTemplate(html)
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Email sending failed to ${to}:`, error.message);
    return false;
  }
};

const sendAppointmentConfirmation = async (mrEmail, doctorName, date, time) => {
  if (!mrEmail || !mrEmail.includes('@')) {
    console.log(`⚠️ Skipping appointment confirmation - no valid email for MR`);
    return false;
  }
  
  const subject = '✅ Appointment Confirmed - MRAlo';
  const html = `
    <h2 style="color: #10b981; margin-bottom: 20px;">
      <span style="font-size: 28px;">✅</span> Appointment Confirmed!
    </h2>
    <p style="font-size: 16px; margin-bottom: 25px;">
      Great news! Your appointment has been successfully confirmed.
    </p>
    <div class="info-box">
      <p><span class="info-label">👨‍⚕️ Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">📅 Date:</span> ${date}</p>
      <p><span class="info-label">🕐 Time:</span> ${time}</p>
      <p><span class="info-label">📍 Status:</span> <span style="color: #10b981; font-weight: 600;">Confirmed</span></p>
    </div>
    <p style="margin-top: 25px;">
      <strong>What to bring:</strong>
    </p>
    <ul style="color: #6b7280; line-height: 1.8;">
      <li>Product samples and brochures</li>
      <li>Presentation materials</li>
      <li>Business card</li>
    </ul>
    <p style="margin-top: 25px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <strong>⚠️ Important:</strong> Please arrive 5 minutes early. If you need to reschedule, please contact us at least 24 hours in advance.
    </p>
    <p style="margin-top: 30px; color: #6b7280;">
      Thank you for choosing MRAlo for your healthcare scheduling needs!
    </p>
  `;
  await sendEmail(mrEmail, subject, html);
};

const sendFollowUpReminder = async (mrEmail, doctorName, date, time) => {
  if (!mrEmail || !mrEmail.includes('@')) {
    console.log(`⚠️ Skipping follow-up reminder - no valid email for MR`);
    return false;
  }
  
  const subject = '🔔 Follow-up Reminder - MRAlo';
  const html = `
    <h2 style="color: #f59e0b; margin-bottom: 20px;">
      <span style="font-size: 28px;">🔔</span> Follow-up Reminder
    </h2>
    <p style="font-size: 16px; margin-bottom: 25px;">
      This is a friendly reminder about your upcoming follow-up appointment.
    </p>
    <div class="info-box">
      <p><span class="info-label">👨‍⚕️ Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">📅 Date:</span> ${date}</p>
      <p><span class="info-label">🕐 Time:</span> ${time}</p>
    </div>
    <p style="margin-top: 25px; padding: 15px; background-color: #dbeafe; border-left: 4px solid #3B82F6; border-radius: 4px;">
      <strong>💡 Tip:</strong> Review your previous discussion notes and prepare any questions or updates you'd like to share.
    </p>
    <a href="${process.env.CLIENT_URL}/mr/appointments" class="button">View Appointment Details</a>
    <p style="margin-top: 25px; color: #6b7280;">
      Looking forward to your visit!
    </p>
  `;
  await sendEmail(mrEmail, subject, html);
};

const sendDailyScheduleEmail = async (doctorEmail, doctorName, appointments) => {
  if (!doctorEmail || !doctorEmail.includes('@')) {
    console.log(`⚠️ Skipping daily schedule - no valid email for doctor`);
    return false;
  }
  
  const subject = `📋 Your Daily Schedule - ${new Date().toLocaleDateString()}`;
  
  const appointmentList = appointments.map((apt, index) => `
    <div style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'}; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3B82F6;">
      <p style="margin: 5px 0;">
        <span style="font-weight: 600; color: #3B82F6;">🕐 ${apt.time}</span>
      </p>
      <p style="margin: 5px 0;">
        <span style="font-weight: 600;">👤 ${apt.mrName}</span>
      </p>
      <p style="margin: 5px 0; color: #6b7280;">
        🏢 ${apt.company}
      </p>
    </div>
  `).join('');
  
  const html = `
    <h2 style="color: #1f2937; margin-bottom: 20px;">
      Good Morning, Dr. ${doctorName}! ☀️
    </h2>
    <p style="font-size: 16px; margin-bottom: 25px;">
      Here's your schedule for today, <strong>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
    </p>
    <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-weight: 600; color: #1e40af;">
        📊 Total Appointments: ${appointments.length}
      </p>
    </div>
    <div style="margin: 25px 0;">
      ${appointmentList}
    </div>
    <p style="margin-top: 30px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <strong>💚 Have a productive day!</strong> All appointments are confirmed and ready.
    </p>
    <a href="${process.env.CLIENT_URL}/doctor/appointments" class="button">View Full Schedule</a>
  `;
  await sendEmail(doctorEmail, subject, html);
};

const sendAppointmentCancellation = async (mrEmail, mrName, doctorName, date, time, reason) => {
  if (!mrEmail || !mrEmail.includes('@')) {
    console.log(`⚠️ Skipping cancellation email - no valid email for MR: ${mrName}`);
    return false;
  }
  
  const subject = '❌ Appointment Cancelled - MRAlo';
  const html = `
    <h2 style="color: #ef4444; margin-bottom: 20px;">
      <span style="font-size: 28px;">❌</span> Appointment Cancelled
    </h2>
    <p style="font-size: 16px; margin-bottom: 25px;">
      Dear ${mrName},
    </p>
    <p style="font-size: 16px; margin-bottom: 25px;">
      We regret to inform you that your appointment has been cancelled by the doctor.
    </p>
    <div class="info-box">
      <p><span class="info-label">👨‍⚕️ Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">📅 Date:</span> ${date}</p>
      <p><span class="info-label">🕐 Time:</span> ${time}</p>
      <p><span class="info-label">📍 Status:</span> <span style="color: #ef4444; font-weight: 600;">Cancelled</span></p>
    </div>
    <div style="margin: 25px 0; padding: 20px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
      <p style="margin: 0 0 10px 0;"><strong>Reason for Cancellation:</strong></p>
      <p style="margin: 0; color: #991b1b;">${reason}</p>
    </div>
    <p style="margin-top: 25px;">
      <strong>What's Next?</strong>
    </p>
    <ul style="color: #6b7280; line-height: 1.8;">
      <li>You can book a new appointment at your convenience</li>
      <li>The cancelled slot is now available for rebooking</li>
      <li>Contact us if you have any questions</li>
    </ul>
    <a href="${process.env.CLIENT_URL}/mr/doctors" class="button" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">Book New Appointment</a>
    <p style="margin-top: 30px; color: #6b7280;">
      We apologize for any inconvenience caused. Thank you for your understanding.
    </p>
  `;
  await sendEmail(mrEmail, subject, html);
};

const sendAppointmentCompletion = async (mrEmail, mrName, doctorName, date, time) => {
  if (!mrEmail || !mrEmail.includes('@')) {
    console.log(`⚠️ Skipping completion email - no valid email for MR: ${mrName}`);
    return false;
  }
  
  const subject = '✅ Appointment Completed - MRAlo';
  const html = `
    <h2 style="color: #10b981; margin-bottom: 20px;">
      <span style="font-size: 28px;">✅</span> Appointment Completed
    </h2>
    <p style="font-size: 16px; margin-bottom: 25px;">
      Dear ${mrName},
    </p>
    <p style="font-size: 16px; margin-bottom: 25px;">
      Thank you for your visit! Your appointment has been successfully completed.
    </p>
    <div class="info-box">
      <p><span class="info-label">👨‍⚕️ Doctor:</span> Dr. ${doctorName}</p>
      <p><span class="info-label">📅 Date:</span> ${date}</p>
      <p><span class="info-label">🕐 Time:</span> ${time}</p>
      <p><span class="info-label">📍 Status:</span> <span style="color: #10b981; font-weight: 600;">Completed</span></p>
    </div>
    <div style="margin: 25px 0; padding: 20px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <p style="margin: 0;"><strong>💚 Thank you for choosing MRAlo!</strong></p>
      <p style="margin: 10px 0 0 0; color: #166534;">We hope your meeting was productive and successful.</p>
    </div>
    <p style="margin-top: 25px;">
      <strong>Next Steps:</strong>
    </p>
    <ul style="color: #6b7280; line-height: 1.8;">
      <li>Review your discussion notes and action items</li>
      <li>Schedule a follow-up if needed</li>
      <li>Share feedback about your experience</li>
    </ul>
    <a href="${process.env.CLIENT_URL}/mr/appointments" class="button">View Appointment History</a>
    <p style="margin-top: 30px; color: #6b7280;">
      We look forward to serving you again!
    </p>
  `;
  await sendEmail(mrEmail, subject, html);
};

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendFollowUpReminder,
  sendDailyScheduleEmail,
  sendAppointmentCancellation,
  sendAppointmentCompletion
};
