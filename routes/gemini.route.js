const express = require('express');
const { getGeminiResponse } = require('../utils/geminiServices');

const router = express.Router();

router.post('/generate', getGeminiResponse);

module.exports = router;