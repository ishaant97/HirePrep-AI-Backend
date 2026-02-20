const express = require('express');
const multer = require('multer');
const protect = require('../middlewares/auth.middleware');
const { saveResume, parseResumeText, viewResume, getResumesByUserId, getResumeAnalytics } = require('../controllers/resume.controller');

const router = express.Router();
const upload = multer();

router.post("/save", protect, upload.single('resume'), saveResume)
router.post("/parseResume", protect, upload.single('resume'), parseResumeText)
router.get("/view/:id", protect, viewResume)
router.get("/user/:userId", protect, getResumesByUserId);
router.get("/analytics/:id", protect, getResumeAnalytics);

module.exports = router;