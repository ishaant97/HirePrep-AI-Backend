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

function toNumber(value, defaultValue = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
}

function normalizeProjectsForML(value) {
    if (!Array.isArray(value)) return [];
    return value.map((project) => {
        if (project && typeof project === "object") {
            return project;
        }
        return {};
    });
}

function normalizeInternshipsForML(value) {
    if (!Array.isArray(value)) return [];
    return value.map((internship) => {
        if (!internship || typeof internship !== "object") {
            return {};
        }

        return {
            company: typeof internship.company === "string" ? internship.company.trim() : "",
            role: typeof internship.role === "string" ? internship.role.trim() : "",
        };
    });
}

function buildMLAnalysisPayload(resumeData) {
    return {
        education: {
            cgpa: String(resumeData.cgpa ?? ""),
        },
        skills: normalizeStringArray(resumeData.skills),
        projects: normalizeProjectsForML(resumeData.project),
        certifications: normalizeStringArray(resumeData.certifications),
        internships: normalizeInternshipsForML(resumeData.internships),
        experience: {
            years: toNumber(resumeData.experience_years, 0),
        },
        career_preferences: {
            desired_role: typeof resumeData.desired_role === "string"
                ? resumeData.desired_role.trim()
                : "",
        },
        placement_inputs: {
            communication_rating: toNumber(resumeData.communication_rating, 0),
            hackathon: (resumeData.hackathon === "Yes" || resumeData.hackathon === "No")
                ? resumeData.hackathon
                : "No",
            twelfth_percent: toNumber(resumeData.twelfth_percent, 0),
            tenth_percent: toNumber(resumeData.tenth_percent, 0),
            backlogs: toNumber(resumeData.backlogs, 0),
        },
    };
}

function mapMLAnalysisResponse(mlResponse) {
    if (!mlResponse || typeof mlResponse !== "object") {
        return null;
    }

    const placement = mlResponse.placement_analysis;
    const skill = mlResponse.skill_analysis;
    const roleSource = mlResponse.role_recommendations;

    const roleRecommendations = Array.isArray(roleSource)
        ? roleSource
        : Array.isArray(roleSource?.top_roles)
            ? roleSource.top_roles
            : [];

    return {
        placement_analysis: {
            final_probability: toNumber(placement?.final_probability, 0),
            interpretation: typeof placement?.interpretation === "string"
                ? placement.interpretation
                : "",
        },
        skill_analysis: {
            desired_role: typeof skill?.desired_role === "string" ? skill.desired_role : "",
            experience_level: typeof skill?.experience_level === "string" ? skill.experience_level : "",
            total_skills_in_resume: toNumber(skill?.total_skills_in_resume, 0),
            skill_match_percent: toNumber(skill?.skill_match_percent, 0),
            matched_skills: normalizeStringArray(skill?.matched_skills),
            missing_skills: normalizeStringArray(skill?.missing_skills),
            matched_count: toNumber(skill?.matched_count, 0),
            missing_count: toNumber(skill?.missing_count, 0),
        },
        role_recommendations: roleRecommendations.map((role, index) => ({
            rank: toNumber(role?.rank, index + 1),
            role: typeof role?.role === "string" ? role.role : "",
            experience_level: typeof role?.experience_level === "string" ? role.experience_level : "",
            skill_match_percent: toNumber(role?.skill_match_percent, 0),
            matched_skills: normalizeStringArray(role?.matched_skills),
            skills_to_learn: normalizeStringArray(role?.skills_to_learn),
        })),
    };
}

function postJson(url, payload, timeoutMs = 45000) {
    const targetUrl = new URL(url);
    const client = targetUrl.protocol === "https:" ? https : http;
    const requestBody = JSON.stringify(payload);

    const options = {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || undefined,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody),
        },
    };

    return new Promise((resolve, reject) => {
        const req = client.request(options, (response) => {
            let body = "";

            response.on("data", (chunk) => {
                body += chunk;
            });

            response.on("end", () => {
                const isSuccess = response.statusCode && response.statusCode >= 200 && response.statusCode < 300;
                if (!isSuccess) {
                    return reject(
                        new Error(`ML API request failed with status ${response.statusCode}: ${body}`)
                    );
                }

                try {
                    const parsed = body ? JSON.parse(body) : {};
                    resolve(parsed);
                } catch (parseError) {
                    reject(new Error(`Invalid JSON from ML API: ${parseError.message}`));
                }
            });
        });

        req.on("error", reject);

        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error(`ML API request timed out after ${timeoutMs}ms`));
        });

        req.write(requestBody);
        req.end();
    });
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
                atsResult = await geminiATSResponseForResume(extractedText, desiredRole, experience_years);
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

        // Step 3: Machine learning backend evaluation
        try {
            const mlApiUrl =
                process.env.ML_COMPLETE_ANALYSIS_URL;

            const mlPayload = buildMLAnalysisPayload(resumeData);
            const mlResponse = await postJson(mlApiUrl, mlPayload);
            const mappedML = mapMLAnalysisResponse(mlResponse);

            if (mappedML && typeof mappedML === "object") {
                analytics.machine_learning_evaluation = mappedML;
            }
        } catch (mlError) {
            console.error("ML evaluation failed:", mlError.message);
        }

        // Step 4: Add all skills to analytics
        analytics.machine_learning_evaluation.skills = skills;

        // Step 5: Patch the resume with analytics
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
        const resume = await Resume.findById(req.params.id);

        if (!resume) {
            return res.status(404).json({ error: "Resume not found" });
        }

        // Ownership check
        if (resume.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "You do not have access to this resume" });
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