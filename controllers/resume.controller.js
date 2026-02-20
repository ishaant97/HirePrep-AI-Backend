const Resume = require("../models/resume.model");
const { parseResumeText: parseResumePDF } = require("../utils/parseResume");
const { geminiExtractedInfoOfResume, geminiATSResponseForResume } = require("../utils/geminiServices");
const { uploadPdfBuffer } = require("../utils/cloudinary");
const http = require("http");
const https = require("https");
const { URL } = require("url");

function tryParseJson(value) {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
}

async function saveResume(req, res) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: "No resume file uploaded" });
        }

        const extractedText = await parseResumePDF(req.file.buffer);

        const uploadResult = await uploadPdfBuffer(
            req.file.buffer,
            req.file.originalname
        );

        const resumeData = req.body.resumeData
            ? tryParseJson(req.body.resumeData)
            : {
                ...req.body,
                skills: tryParseJson(req.body.skills),
                project: tryParseJson(req.body.project),
                certifications: tryParseJson(req.body.certifications),
                internships: tryParseJson(req.body.internships),
            };

        const resume = new Resume({
            userId: req.user._id,
            ...resumeData,
            originalFileName: req.file.originalname,
            resumePdfUrl: uploadResult.secure_url,
            resumeExtractedText: extractedText,
        });

        await resume.save();

        // Automatically run ATS evaluation in the background
        const desiredRole = resumeData.desired_role || "";
        if (extractedText && desiredRole) {
            try {
                const atsResult = await geminiATSResponseForResume(extractedText, desiredRole);
                resume.analytics = { ats_evaluation: atsResult };
                await resume.save();
            } catch (atsError) {
                console.error("ATS evaluation failed (resume still saved):", atsError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: "Resume saved successfully",
        });
    } catch (error) {
        // console.error(error);
        res.status(500).json({ message: "Failed to save resume, " + error.message });
    }
}

async function parseResumeText(req, res) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: "No resume file uploaded" });
        }

        const text = await parseResumePDF(req.file.buffer);
        res.json(await geminiExtractedInfoOfResume(text));
    } catch (error) {
        // console.error("Resume parse error:", error);
        res.status(500).json({ error: "Failed to parse resume, " + error.message });
    }
}

async function viewResume(req, res) {
    try {
        const resume = await Resume.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!resume) {
            return res.status(404).json({ error: "Resume not found" });
        }

        const targetUrl = new URL(resume.resumePdfUrl);
        const client = targetUrl.protocol === "https:" ? https : http;

        client.get(targetUrl, (cloudRes) => {
            if (cloudRes.statusCode && cloudRes.statusCode >= 400) {
                cloudRes.resume();
                return res.status(502).json({ error: "Failed to fetch resume file" });
            }

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `inline; filename="${resume.originalFileName || "resume.pdf"}"`
            );

            cloudRes.pipe(res);
        }).on("error", (error) => {
            res.status(502).json({ error: "Failed to fetch resume file, " + error.message });
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to view resume, " + error.message });
    }
}

async function getResumesByUserId(req, res) {
    try {
        const resumes = await Resume.find({ userId: req.params.userId })
            .select("originalFileName resumePdfUrl");
        res.json(resumes);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch resumes, " + error.message });
    }
}

async function getResumeAnalytics(req, res) {
    try {
        const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });

        if (!resume) {
            return res.status(404).json({ error: "Resume not found" });
        }

        res.json(resume.analytics || {});
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch resume analytics, " + error.message });
    }
}

module.exports = { saveResume, parseResumeText, viewResume, getResumesByUserId, getResumeAnalytics };