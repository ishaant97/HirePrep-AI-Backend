const express = require('express');
const { register, login, logout } = require('../controllers/auth.controller');
const protect = require('../middlewares/auth.middleware');

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

router.get("/me", protect, (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            name: req.user.name,
            collegeName: req.user.collegeName,
            email: req.user.email
        }
    });
});


module.exports = router;