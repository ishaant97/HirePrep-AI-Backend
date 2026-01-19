const express = require('express');
const connectToMongoDB = require('./connections/mongodbConfig');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth.route');
const cors = require('cors');
require('dotenv').config();

connectToMongoDB();

const app = express();

app.use(cookieParser());
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', // Frontend URL from which requests will be accepted
    credentials: true                // Required if you are sending cookies/sessions
}));

app.use('/api/auth', authRoutes);

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running at http://localhost:${process.env.PORT || 3000}`);
});