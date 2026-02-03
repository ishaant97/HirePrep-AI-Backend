const express = require('express');
const multer = require('multer');
const protect = require('../middlewares/auth.middleware');
const { saveResume, parseResumeText } = require('../controllers/resume.controller');

const router = express.Router();
const upload = multer();

router.post("/save", protect, saveResume)
router.post("/parseResume", protect, upload.single('resume'), parseResumeText)

module.exports = router;