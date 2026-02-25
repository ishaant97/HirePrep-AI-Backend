const { geminiATSResponseForResume } = require('../utils/geminiServices');

async function geminiATSResponseForResumeController(req, res) {
    try {
        const { desiredRole, resumeData, experience_years } = req.body;
        if (!desiredRole || !resumeData) {
            return res.status(400).json({ error: "Missing desiredRole or resumeData in request body" });
        }

        const response = await geminiATSResponseForResume(resumeData, desiredRole, experience_years || 0);
        res.status(200).json(response);
    } catch (error) {
        console.error("Error generating ATS response:", error);
        res.status(500).json({ error: "Failed to generate ATS response" });
    }
}

module.exports = {
    geminiATSResponseForResumeController
};