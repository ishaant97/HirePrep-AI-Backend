const Resume = require("../models/resume.model");
const { parseResumeText: parseResumePDF } = require("../utils/parseResume");
const { geminiExtractedInfoOfResume } = require("../utils/geminiServices");

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

async function parseResumeText(req, res) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: "No resume file uploaded" });
        }

        const text = await parseResumePDF(req.file.buffer);
        res.json(await geminiExtractedInfoOfResume(text));
    } catch (err) {
        console.error("Resume parse error:", err);
        res.status(500).json({ error: "Failed to parse resume" });
    }
}

module.exports = { saveResume, parseResumeText };