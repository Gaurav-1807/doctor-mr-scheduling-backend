const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Doctor = require('../models/Doctor');
const MR = require('../models/MR');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, mobile, role, speciality, company } = req.body;

    // Check if user exists
    let existingUser;
    if (role === 'doctor') {
      existingUser = await Doctor.findOne({ email });
    } else {
      existingUser = await MR.findOne({ email });
    }

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    if (role === 'doctor') {
      user = await Doctor.create({
        name,
        email,
        password: hashedPassword,
        mobile,
        speciality,
        role: 'doctor'
      });
    } else {
      user = await MR.create({
        name,
        email,
        password: hashedPassword,
        mobile,
        company,
        role: 'mr'
      });
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    let user;
    if (role === 'doctor') {
      user = await Doctor.findOne({ email });
    } else {
      user = await MR.findOne({ email });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    let user;
    if (req.user.role === 'doctor') {
      user = await Doctor.findById(req.user.id).select('-password');
    } else {
      user = await MR.findById(req.user.id).select('-password');
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
