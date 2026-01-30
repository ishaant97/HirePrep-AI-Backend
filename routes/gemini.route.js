const express = require('express');
const { getGeminiResponse } = require('../utils/geminiServices');
const protect = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/generate', protect, getGeminiResponse);

module.exports = router;