const mongoose = require('mongoose');
require('dotenv').config();

function connectToMongoDB() {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('Failed to connect to MongoDB', err));
}

module.exports = connectToMongoDB;