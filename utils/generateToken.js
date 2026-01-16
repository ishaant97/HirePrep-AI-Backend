const jwt = require('jsonwebtoken');
require('dotenv').config();


function generateToken(userid, userEmail) {
    const payload = {
        id: userid,
        email: userEmail,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    return token;
}

module.exports = generateToken;