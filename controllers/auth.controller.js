const User = require('../models/user.model');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');

async function register(req, res) {
    const { name, collegeName, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, collegeName, email, password: hashedPassword });
    const token = generateToken(user._id, user.email);
    res
        .cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })
        .status(201)
        .json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                name: user.name,
                collegeName: user.collegeName,
                email: user.email
            }
        });
}

async function login(req, res) {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = generateToken(user._id, user.email);
    res
        .cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })
        .json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                collegeName: user.collegeName,
                email: user.email,
            }
        });
}

function logout(req, res) {
    res
        .cookie("token", "", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            maxAge: 0 // Expire the cookie immediately
        })
        .json({ message: "Logout successful" });
}

module.exports = { register, login, logout };