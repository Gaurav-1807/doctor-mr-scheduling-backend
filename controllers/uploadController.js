const path = require('path');
const fs = require('fs');
const Doctor = require('../models/Doctor');
const MR = require('../models/MR');

// @desc    Upload profile image
// @route   POST /api/upload/profile-image
// @access  Private
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const imageUrl = `/uploads/profiles/${req.file.filename}`;

    // Update user's profile image
    let user;
    if (req.user.role === 'doctor') {
      user = await Doctor.findByIdAndUpdate(
        req.user.id,
        { profileImage: imageUrl },
        { new: true }
      ).select('-password');
    } else {
      user = await MR.findByIdAndUpdate(
        req.user.id,
        { profileImage: imageUrl },
        { new: true }
      ).select('-password');
    }

    res.json({
      success: true,
      data: {
        imageUrl,
        user
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete profile image
// @route   DELETE /api/upload/profile-image
// @access  Private
exports.deleteProfileImage = async (req, res) => {
  try {
    let user;
    if (req.user.role === 'doctor') {
      user = await Doctor.findById(req.user.id);
    } else {
      user = await MR.findById(req.user.id);
    }

    if (user?.profileImage) {
      // Delete file from disk
      const uploadsBase = process.env.NODE_ENV === 'production' 
        ? path.join(__dirname, '..')
        : path.join(__dirname, '..', '..');
      const filePath = path.join(uploadsBase, user.profileImage);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Update user
      user.profileImage = null;
      await user.save();
    }

    res.json({ success: true, message: 'Profile image deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
