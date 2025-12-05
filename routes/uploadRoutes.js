const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

// Ensure upload directory exists
// Use backend/uploads in production, root/uploads in development
const uploadDir = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '..', 'uploads', 'profiles')
  : path.join(__dirname, '..', '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

// Routes
router.post('/profile-image', protect, upload.single('image'), uploadController.uploadProfileImage);
router.delete('/profile-image', protect, uploadController.deleteProfileImage);

module.exports = router;
