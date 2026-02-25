const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
require('dotenv').config();

async function protect(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, token missing' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Not authorized, token invalid' });
    }
}

module.exports = protect;