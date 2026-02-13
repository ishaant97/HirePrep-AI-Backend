const express = require('express');
const { getGeminiResponse } = require('../utils/geminiServices');
const { geminiATSResponseForResumeController } = require('../controllers/gemini.controller');
const protect = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/generate', protect, getGeminiResponse);
router.post('/geminiATSResponseForResume', protect, geminiATSResponseForResumeController);

module.exports = router;