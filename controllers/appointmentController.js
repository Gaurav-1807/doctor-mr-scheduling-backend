const Appointment = require('../models/Appointment');
const Slot = require('../models/Slot');
const Notification = require('../models/Notification');
const { getNextAvailableSlot } = require('../utils/slotGenerator');
const { sendAppointmentConfirmation } = require('../utils/emailService');
const Doctor = require('../models/Doctor');
const MR = require('../models/MR');

exports.bookAppointment = async (req, res) => {
  try {
    const { doctorId, requestedDate, slotId } = req.body;

    // Get doctor's booking cycle
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Cycle days = how many days in advance MR can book
    // e.g., cycleDays = 1 means MR can book slots starting from tomorrow
    const cycleDays = doctor.bookingCycleDays || 1;
    
    // Calculate the earliest date MR can book (today + cycleDays)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const earliestBookingDate = new Date(today);
    earliestBookingDate.setDate(earliestBookingDate.getDate() + cycleDays);

    let slot;
    
    if (slotId) {
      // Book specific slot selected by MR
      slot = await Slot.findById(slotId);
      
      if (!slot) {
        return res.status(404).json({ message: 'Slot not found' });
      }
      
      if (slot.isBooked) {
        return res.status(400).json({ message: 'Slot already booked' });
      }
      
      if (slot.doctorId.toString() !== doctorId) {
        return res.status(400).json({ message: 'Invalid slot for this doctor' });
      }

      // Check if slot date is valid (must be >= earliestBookingDate)
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      
      if (slotDate < earliestBookingDate) {
        return res.status(400).json({ 
          message: `You can only book slots from ${earliestBookingDate.toLocaleDateString()} onwards (${cycleDays}-day advance booking required)` 
        });
      }
      
      // Check if MR already has an appointment on the SAME DATE with this doctor
      const existingAppointment = await Appointment.findOne({
        doctorId,
        mrId: req.user.id,
        date: {
          $gte: new Date(slot.date.setHours(0, 0, 0, 0)),
          $lt: new Date(new Date(slot.date).setHours(23, 59, 59, 999))
        },
        status: { $in: ['confirmed'] }
      });

      if (existingAppointment) {
        return res.status(400).json({ 
          message: `You already have an appointment with this doctor on ${new Date(slot.date).toLocaleDateString()}`
        });
      }
    } else {
      // Auto-book: Get next available slot (earliest first)
      const fromDate = requestedDate ? new Date(requestedDate) : new Date();
      slot = await getNextAvailableSlot(doctorId, fromDate);

      if (!slot) {
        return res.status(404).json({ 
          message: 'No available slots found' 
        });
      }
    }

    // Book the slot
    slot.isBooked = true;
    slot.bookedBy = req.user.id;
    await slot.save();

    // Create appointment with confirmed status
    const appointment = await Appointment.create({
      doctorId,
      mrId: req.user.id,
      slotId: slot._id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'confirmed',
      visitReason: req.body.visitReason || ''
    });

    // Get MR details (doctor already fetched above)
    const mr = await MR.findById(req.user.id);

    // Send notifications
    await Notification.create({
      userId: doctorId,
      userType: 'doctor',
      title: 'New Appointment',
      message: `${mr.name} from ${mr.company} booked an appointment`,
      type: 'appointment',
      relatedId: appointment._id
    });

    await Notification.create({
      userId: req.user.id,
      userType: 'mr',
      title: 'Appointment Confirmed',
      message: `Your appointment with Dr. ${doctor.name} is confirmed`,
      type: 'appointment',
      relatedId: appointment._id
    });

    // Send email
    await sendAppointmentConfirmation(
      mr.email,
      doctor.name,
      slot.date.toLocaleDateString(),
      slot.startTime
    );

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('doctorId', 'name speciality')
      .populate('mrId', 'name company');

    res.status(201).json({ 
      success: true, 
      appointment: populatedAppointment 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const { date, status, search, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
    } else {
      query.mrId = req.user.id;
    }
    
    // Single date filter
    if (date) {
      // Parse date string and create start/end of day in UTC
      const searchDate = new Date(date + 'T00:00:00.000Z');
      const nextDay = new Date(date + 'T23:59:59.999Z');
      
      query.date = {
        $gte: searchDate,
        $lte: nextDay
      };
    }
    
    // Date range filter
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Get populated appointments for search
    let appointments = await Appointment.find(query)
      .populate('doctorId', 'name speciality')
      .populate('mrId', 'name company')
      .sort({ date: -1, startTime: -1 });

    // Search filter (after population)
    if (search && search.trim() !== '') {
      const searchLower = search.toLowerCase();
      appointments = appointments.filter(apt => {
        const doctorName = apt.doctorId?.name?.toLowerCase() || '';
        const mrName = apt.mrId?.name?.toLowerCase() || '';
        const company = apt.mrId?.company?.toLowerCase() || '';
        const speciality = apt.doctorId?.speciality?.toLowerCase() || '';
        const visitReason = apt.visitReason?.toLowerCase() || '';
        
        return doctorName.includes(searchLower) ||
               mrName.includes(searchLower) ||
               company.includes(searchLower) ||
               speciality.includes(searchLower) ||
               visitReason.includes(searchLower);
      });
    }

    // Pagination
    const total = appointments.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedAppointments = appointments.slice(startIndex, endIndex);

    res.json({ 
      success: true, 
      appointments: paginatedAppointments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status, notes, followUpDate, cancellationReason } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate('doctorId', 'name')
      .populate('mrId', 'name email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Only doctor can cancel appointments
    if (status === 'cancelled' && req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Only doctors can cancel appointments' });
    }

    // If cancelling, require a reason and free up the slot
    if (status === 'cancelled' && appointment.status !== 'cancelled') {
      if (!cancellationReason || cancellationReason.trim() === '') {
        return res.status(400).json({ message: 'Cancellation reason is required' });
      }
      
      const slot = await Slot.findById(appointment.slotId);
      if (slot) {
        slot.isBooked = false;
        slot.bookedBy = null;
        await slot.save();
      }
      
      appointment.cancellationReason = cancellationReason;

      // Send cancellation email to MR
      const { sendAppointmentCancellation } = require('../utils/emailService');
      await sendAppointmentCancellation(
        appointment.mrId.email,
        appointment.mrId.name,
        appointment.doctorId.name,
        appointment.date.toLocaleDateString(),
        appointment.startTime,
        cancellationReason
      );

      // Send notification to MR
      await Notification.create({
        userId: appointment.mrId._id,
        userType: 'mr',
        title: 'Appointment Cancelled',
        message: `Your appointment with Dr. ${appointment.doctorId.name} has been cancelled`,
        type: 'cancellation',
        relatedId: appointment._id
      });
    }

    // If completing appointment, send completion email
    if (status === 'completed' && appointment.status !== 'completed') {
      const { sendAppointmentCompletion } = require('../utils/emailService');
      await sendAppointmentCompletion(
        appointment.mrId.email,
        appointment.mrId.name,
        appointment.doctorId.name,
        appointment.date.toLocaleDateString(),
        appointment.startTime
      );

      // Send notification to MR
      await Notification.create({
        userId: appointment.mrId._id,
        userType: 'mr',
        title: 'Appointment Completed',
        message: `Your appointment with Dr. ${appointment.doctorId.name} has been completed`,
        type: 'appointment',
        relatedId: appointment._id
      });
    }

    appointment.status = status;
    if (notes) appointment.notes = notes;
    if (followUpDate) appointment.followUpDate = new Date(followUpDate);

    await appointment.save();

    res.json({ success: true, appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDoctorSlots = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date, includeBooked } = req.query;

    // Get doctor's booking cycle
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Cycle days = how many days in advance MR can book
    const cycleDays = doctor.bookingCycleDays || 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate earliest booking date (today + cycleDays)
    // e.g., cycleDays = 1 means can book from tomorrow
    const earliestBookingDate = new Date(today);
    earliestBookingDate.setDate(earliestBookingDate.getDate() + cycleDays);

    let query = { doctorId };

    // Only show available slots unless specifically requesting all
    if (includeBooked !== 'true') {
      query.isBooked = false;
    }

    if (date) {
      // Parse the date and create local midnight boundaries
      const [year, month, day] = date.split('-').map(Number);
      const searchDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
      
      console.log(`Searching slots for date: ${date}, from ${searchDate.toISOString()} to ${nextDay.toISOString()}`);
      
      query.date = {
        $gte: searchDate,
        $lt: nextDay
      };
    } else {
      // Show slots from earliest booking date onwards (no upper limit)
      query.date = { 
        $gte: earliestBookingDate
      };
    }

    let slots = await Slot.find(query)
      .populate('bookedBy', 'name company')
      .sort({ date: 1, startTime: 1 })
      .limit(100);
    
    console.log(`Found ${slots.length} slots for query:`, JSON.stringify(query));

    // Filter out past time slots for today
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    slots = slots.filter(slot => {
      const slotDate = new Date(slot.date);
      slotDate.setHours(0, 0, 0, 0);
      
      // If slot is not today, include it
      if (slotDate.getTime() !== today.getTime()) {
        return true;
      }
      
      // For today, only include slots that haven't passed (with 5 min buffer)
      const [slotHours, slotMins] = slot.startTime.split(':').map(Number);
      const slotMinutes = slotHours * 60 + slotMins;
      const currentMinutes = now.getHours() * 60 + now.getMinutes() + 5; // 5 min buffer
      
      return slotMinutes > currentMinutes;
    });

    res.json({ 
      success: true, 
      slots,
      bookingCycleDays: cycleDays,
      earliestBookingDate: earliestBookingDate.toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
