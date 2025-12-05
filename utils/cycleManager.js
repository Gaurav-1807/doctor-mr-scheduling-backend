const cron = require('node-cron');
const Doctor = require('../models/Doctor');
const { generateSlotsForDate } = require('./slotGenerator');

// Open next cycle slots at 12 PM the day before
const openNextCycleSlots = async () => {
  try {
    console.log('🔄 Running cycle slot opener...');
    
    const doctors = await Doctor.find({ isActive: true });
    
    for (const doctor of doctors) {
      const cycleDays = doctor.bookingCycleDays || 1;
      
      // Calculate the date that should be opened tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const targetDate = new Date(tomorrow);
      targetDate.setDate(targetDate.getDate() + cycleDays - 1);
      
      // Generate slots for that date
      await generateSlotsForDate(doctor._id, targetDate);
      
      console.log(`✅ Generated slots for Dr. ${doctor.name} for ${targetDate.toDateString()}`);
    }
    
    console.log('✅ Cycle slot opener completed');
  } catch (error) {
    console.error('❌ Error opening next cycle slots:', error);
  }
};

// Schedule to run daily at 12 PM
const scheduleCycleSlotOpener = () => {
  // Run at 12:00 PM every day
  cron.schedule('0 12 * * *', openNextCycleSlots);
  console.log('📅 Cycle slot opener scheduled for 12:00 PM daily');
};

module.exports = {
  openNextCycleSlots,
  scheduleCycleSlotOpener
};
