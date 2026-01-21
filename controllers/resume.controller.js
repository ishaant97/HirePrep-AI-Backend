const Resume = require("../models/resume.model");

async function saveResume(req, res) {
    try {
        const resume = new Resume({
            userId: req.user._id,
            ...req.body,
        });

        await resume.save();

        res.status(201).json({
            success: true,
            message: "Resume saved successfully",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to save resume" });
    }
}

module.exports = { saveResume };