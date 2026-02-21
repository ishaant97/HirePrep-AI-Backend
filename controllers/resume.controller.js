const Resume = require("../models/resume.model");
const { parseResumeText: parseResumePDF } = require("../utils/parseResume");
const { geminiExtractedInfoOfResume, geminiATSResponseForResume, geminiCareerRoadmapForResume } = require("../utils/geminiServices");
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

        // ── Optimization 1: Parallelize PDF parsing + Cloudinary upload ──
        const [extractedText, uploadResult] = await Promise.all([
            parseResumePDF(req.file.buffer),
            uploadPdfBuffer(req.file.buffer, req.file.originalname),
        ]);

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
            analyticsStatus: "pending",
        });

        // ── Optimization 2: Save immediately & respond fast ──
        await resume.save();

        res.status(201).json({
            success: true,
            message: "Resume saved successfully. Analytics are being generated.",
            resumeId: resume._id,
            analyticsStatus: "pending",
        });

        // ── Optimization 3: Process analytics in the background ──
        // (response already sent — this runs asynchronously)
        processAnalyticsInBackground(resume, resumeData, extractedText).catch(
            (err) => console.error("Background analytics processing failed:", err.message)
        );
    } catch (error) {
        res.status(500).json({ message: "Failed to save resume, " + error.message });
    }
}

/**
 * Runs after the response is sent. Generates ATS evaluation + career roadmap
 * and patches the saved resume document.
 */
async function processAnalyticsInBackground(resume, resumeData, extractedText) {
    const resumeId = resume._id;

    try {
        await Resume.updateOne({ _id: resumeId }, { analyticsStatus: "processing" });

        const desiredRole = resumeData.desired_role || "";
        const experience_years = resumeData.experience_years || 0;
        const cgpa = resumeData.cgpa || 0;
        const backlogs = resumeData.backlogs || 0;
        const communication_rating = resumeData.communication_rating || 0;
        const hackathons_participated = resumeData.hackathon || 0;
        const skills = resumeData.skills || [];
        const projects = resumeData.project || [];
        const certifications = resumeData.certifications || [];
        const internships = resumeData.internships || [];

        const analytics = {};
        let atsResult = null;

        // Step 1: ATS Evaluation
        if (extractedText && desiredRole) {
            try {
                atsResult = await geminiATSResponseForResume(extractedText, desiredRole);
                if (atsResult && typeof atsResult === "object") {
                    analytics.ats_evaluation = atsResult;
                }
            } catch (atsError) {
                console.error("ATS evaluation failed:", atsError.message);
            }
        }

        // Step 2: Career Roadmap (depends on ATS result)
        if (atsResult && extractedText) {
            try {
                const roadMap = await geminiCareerRoadmapForResume(
                    extractedText, desiredRole, experience_years, cgpa,
                    backlogs, communication_rating, hackathons_participated,
                    skills, projects, certifications, internships, atsResult
                );
                if (roadMap && typeof roadMap === "object") {
                    analytics.career_roadmap = roadMap;
                }
            } catch (roadmapError) {
                console.error("Career roadmap generation failed:", roadmapError.message);
            }
        }

        // Step 3: Patch the resume with analytics
        const updateFields = { analyticsStatus: "completed" };
        if (Object.keys(analytics).length > 0) {
            updateFields.analytics = analytics;
        }

        await Resume.updateOne({ _id: resumeId }, { $set: updateFields });
        console.log(`Analytics completed for resume ${resumeId}`);
    } catch (error) {
        console.error(`Analytics processing error for resume ${resumeId}:`, error.message);
        await Resume.updateOne(
            { _id: resumeId },
            { analyticsStatus: "failed" }
        ).catch(() => { });
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
        const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id })
            .select("analytics analyticsStatus");

        if (!resume) {
            return res.status(404).json({ error: "Resume not found" });
        }

        res.json({
            analyticsStatus: resume.analyticsStatus || "pending",
            analytics: resume.analytics || {},
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch resume analytics, " + error.message });
    }
}

module.exports = { saveResume, parseResumeText, viewResume, getResumesByUserId, getResumeAnalytics };