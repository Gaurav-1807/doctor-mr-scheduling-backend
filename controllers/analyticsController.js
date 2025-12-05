const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const MR = require('../models/MR');
const VisitTracking = require('../models/VisitTracking');
const Task = require('../models/Task');

// @desc    Get admin dashboard stats
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Get counts
    const [totalDoctors, totalMRs, totalAppointments, todayAppointments] = await Promise.all([
      Doctor.countDocuments({ isActive: true }),
      MR.countDocuments({ isActive: true }),
      Appointment.countDocuments(),
      Appointment.countDocuments({
        date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
      })
    ]);

    // Monthly stats
    const [thisMonthAppointments, lastMonthAppointments] = await Promise.all([
      Appointment.countDocuments({ date: { $gte: thisMonth } }),
      Appointment.countDocuments({ date: { $gte: lastMonth, $lt: thisMonth } })
    ]);

    // Appointment status breakdown
    const statusBreakdown = await Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Calculate growth
    const appointmentGrowth = lastMonthAppointments > 0
      ? ((thisMonthAppointments - lastMonthAppointments) / lastMonthAppointments * 100).toFixed(1)
      : 100;

    res.json({
      success: true,
      data: {
        totalDoctors,
        totalMRs,
        totalAppointments,
        todayAppointments,
        thisMonthAppointments,
        appointmentGrowth: parseFloat(appointmentGrowth),
        statusBreakdown: statusBreakdown.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get doctor analytics
// @route   GET /api/analytics/doctor/:doctorId
// @access  Private
exports.getDoctorAnalytics = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = { doctor: require('mongoose').Types.ObjectId(doctorId) };
    if (Object.keys(dateFilter).length) matchStage.date = dateFilter;

    // Appointment stats
    const appointmentStats = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Daily appointment trend
    const dailyTrend = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Top MRs by visits
    const topMRs = await Appointment.aggregate([
      { $match: { ...matchStage, status: 'completed' } },
      {
        $group: {
          _id: '$mr',
          visitCount: { $sum: 1 }
        }
      },
      { $sort: { visitCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'mrs',
          localField: '_id',
          foreignField: '_id',
          as: 'mrDetails'
        }
      },
      { $unwind: '$mrDetails' },
      {
        $project: {
          name: '$mrDetails.name',
          company: '$mrDetails.company',
          visitCount: 1
        }
      }
    ]);

    // Peak hours analysis
    const peakHours = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$timeSlot',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        appointmentStats: appointmentStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        dailyTrend,
        topMRs,
        peakHours
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get MR performance analytics
// @route   GET /api/analytics/mr/:mrId
// @access  Private
exports.getMRAnalytics = async (req, res) => {
  try {
    const { mrId } = req.params;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = { mr: require('mongoose').Types.ObjectId(mrId) };
    if (Object.keys(dateFilter).length) matchStage.date = dateFilter;

    // Appointment stats
    const appointmentStats = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Visit tracking stats
    const visitStats = await VisitTracking.aggregate([
      { $match: { mr: require('mongoose').Types.ObjectId(mrId) } },
      {
        $group: {
          _id: '$visitType',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    // Task completion rate
    const taskStats = await Task.aggregate([
      { $match: { assignedTo: require('mongoose').Types.ObjectId(mrId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Doctors visited
    const doctorsVisited = await Appointment.aggregate([
      { $match: { ...matchStage, status: 'completed' } },
      {
        $group: {
          _id: '$doctor',
          visitCount: { $sum: 1 }
        }
      },
      { $sort: { visitCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'doctors',
          localField: '_id',
          foreignField: '_id',
          as: 'doctorDetails'
        }
      },
      { $unwind: '$doctorDetails' },
      {
        $project: {
          name: '$doctorDetails.name',
          specialty: '$doctorDetails.specialty',
          visitCount: 1
        }
      }
    ]);

    // Calculate performance score
    const totalAppointments = appointmentStats.reduce((sum, s) => sum + s.count, 0);
    const completedAppointments = appointmentStats.find(s => s._id === 'completed')?.count || 0;
    const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        appointmentStats: appointmentStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        visitStats,
        taskStats: taskStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        doctorsVisited,
        completionRate: parseFloat(completionRate)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get appointment heatmap data
// @route   GET /api/analytics/heatmap
// @access  Private
exports.getAppointmentHeatmap = async (req, res) => {
  try {
    const { doctorId, startDate, endDate } = req.query;

    const matchStage = {};
    if (doctorId) matchStage.doctor = require('mongoose').Types.ObjectId(doctorId);
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const heatmapData = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$date' },
            hour: { $substr: ['$timeSlot', 0, 2] }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 } }
    ]);

    res.json({
      success: true,
      data: heatmapData.map(item => ({
        day: item._id.dayOfWeek,
        hour: parseInt(item._id.hour),
        count: item.count
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get system-wide reports
// @route   GET /api/analytics/reports
// @access  Private (Admin)
exports.getReports = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    let reportData = {};

    switch (type) {
      case 'appointments':
        reportData = await Appointment.aggregate([
          { $match: Object.keys(dateFilter).length ? { date: dateFilter } : {} },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
              noShow: { $sum: { $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0] } }
            }
          },
          { $sort: { _id: 1 } }
        ]);
        break;

      case 'doctors':
        reportData = await Doctor.aggregate([
          { $match: { isActive: true } },
          {
            $lookup: {
              from: 'appointments',
              localField: '_id',
              foreignField: 'doctor',
              as: 'appointments'
            }
          },
          {
            $project: {
              name: 1,
              specialty: 1,
              totalAppointments: { $size: '$appointments' },
              completedAppointments: {
                $size: {
                  $filter: {
                    input: '$appointments',
                    cond: { $eq: ['$$this.status', 'completed'] }
                  }
                }
              }
            }
          },
          { $sort: { totalAppointments: -1 } }
        ]);
        break;

      case 'mrs':
        reportData = await MR.aggregate([
          { $match: { isActive: true } },
          {
            $lookup: {
              from: 'appointments',
              localField: '_id',
              foreignField: 'mr',
              as: 'appointments'
            }
          },
          {
            $project: {
              name: 1,
              company: 1,
              totalAppointments: { $size: '$appointments' },
              completedAppointments: {
                $size: {
                  $filter: {
                    input: '$appointments',
                    cond: { $eq: ['$$this.status', 'completed'] }
                  }
                }
              }
            }
          },
          { $sort: { totalAppointments: -1 } }
        ]);
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
