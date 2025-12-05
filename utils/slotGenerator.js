const Slot = require('../models/Slot');
const Availability = require('../models/Availability');

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const generateSlotsForDate = async (doctorId, date) => {
  // Normalize date to local midnight
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create date at local midnight
  const localDate = new Date(year, month, day, 0, 0, 0, 0);
  const dayOfWeek = localDate.getDay();
  
  console.log(`Generating slots for date: ${localDate.toDateString()}, dayOfWeek: ${dayOfWeek}`);
  
  // Check if doctor is on leave on this date
  const Leave = require('../models/Leave');
  
  const isOnLeave = await Leave.findOne({
    doctorId: doctorId,
    startDate: { $lte: localDate },
    endDate: { $gte: localDate },
    status: 'active'
  });
  
  if (isOnLeave) {
    console.log(`Doctor is on leave on ${localDate.toDateString()}`);
    return [];
  }
  
  // Get availability for this specific day of week
  const availabilities = await Availability.find({
    doctorId,
    dayOfWeek: dayOfWeek,
    isActive: true
  });

  console.log(`Found ${availabilities.length} availabilities for dayOfWeek ${dayOfWeek}`);

  if (availabilities.length === 0) {
    return [];
  }

  const slots = [];

  for (const availability of availabilities) {
    const startMinutes = timeToMinutes(availability.startTime);
    const endMinutes = timeToMinutes(availability.endTime);
    const duration = availability.slotDuration;

    console.log(`Processing availability: ${availability.startTime} - ${availability.endTime}, duration: ${duration}`);

    let currentMinutes = startMinutes;
    
    while (currentMinutes + duration <= endMinutes) {
      const startTime = minutesToTime(currentMinutes);
      const endTime = minutesToTime(currentMinutes + duration);
      
      // Check if slot already exists for this exact date and time
      const startOfDay = new Date(localDate);
      const endOfDay = new Date(localDate);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      const existingSlot = await Slot.findOne({
        doctorId,
        date: {
          $gte: startOfDay,
          $lt: endOfDay
        },
        startTime: startTime
      });

      if (!existingSlot) {
        slots.push({
          doctorId,
          date: localDate,
          startTime,
          endTime,
          isBooked: false
        });
        console.log(`Created slot: ${localDate.toDateString()} ${startTime}-${endTime}`);
      } else {
        console.log(`Slot already exists: ${localDate.toDateString()} ${startTime}`);
      }

      currentMinutes += duration;
    }
  }

  if (slots.length > 0) {
    await Slot.insertMany(slots);
    console.log(`Inserted ${slots.length} slots for ${localDate.toDateString()}`);
  }

  return slots;
};

const generateSlotsForRange = async (doctorId, startDate, endDate) => {
  console.log(`Generating slots from ${startDate} to ${endDate}`);
  
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  // Normalize to start of day
  currentDate.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  let totalSlots = 0;
  
  while (currentDate <= end) {
    const slots = await generateSlotsForDate(doctorId, new Date(currentDate));
    totalSlots += slots.length;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`Total slots generated: ${totalSlots}`);
  return totalSlots;
};

const getNextAvailableSlot = async (doctorId, fromDate = new Date()) => {
  const slot = await Slot.findOne({
    doctorId,
    date: { $gte: fromDate },
    isBooked: false
  })
  .sort({ date: 1, startTime: 1 });

  return slot;
};

module.exports = {
  generateSlotsForDate,
  generateSlotsForRange,
  getNextAvailableSlot
};
