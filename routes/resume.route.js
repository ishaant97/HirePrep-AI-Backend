const express = require('express');
const multer = require('multer');
const protect = require('../middlewares/auth.middleware');
const { saveResume, parseResumeText, viewResume, getResumesByUserId } = require('../controllers/resume.controller');

const router = express.Router();
const upload = multer();

router.post("/save", protect, upload.single('resume'), saveResume)
router.post("/parseResume", protect, upload.single('resume'), parseResumeText)
router.get("/view/:id", protect, viewResume)
router.get("/user/:userId", protect, getResumesByUserId);

module.exports = router;