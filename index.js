const express = require('express');
const connectToMongoDB = require('./connections/mongodbConfig');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.route');
const geminiRoutes = require('./routes/gemini.route');
const resumeRoutes = require('./routes/resume.route');
const cors = require('cors');
require('dotenv').config();

connectToMongoDB();

const app = express();

app.set('trust proxy', 1);

app.use(cookieParser());
app.use(express.json());
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/resume', resumeRoutes);
app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running at http://localhost:${process.env.PORT || 3000}`);
});