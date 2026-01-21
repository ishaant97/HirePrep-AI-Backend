const express = require('express');
const Resume = require('../models/resume.model');
const protect = require('../middlewares/auth.middleware');
const { saveResume } = require('../controllers/resume.controller');

const router = express.Router();

// Save resume
router.post("/save", protect, saveResume)

module.exports = router;