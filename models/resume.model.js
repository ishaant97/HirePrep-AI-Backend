const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        originalFileName: {
            type: String,
            required: true,
            trim: true
        },
        resumePdfUrl: {
            type: String,
            required: true,
            trim: true
        },
        resumeExtractedText: {
            type: String,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        // Social Links
        linkedin: {
            type: String,
            trim: true
        },
        github: {
            type: String,
            trim: true
        },
        // Education & Grades
        cgpa: {
            type: Number,
            min: 0,
            max: 10
        },
        twelfth_percent: {
            type: Number,
            min: 0,
            max: 100
        },
        tenth_percent: {
            type: Number,
            min: 0,
            max: 100
        },
        backlogs: {
            type: Number,
            default: 0,
            min: 0
        },
        // Professional details
        desired_role: {
            type: String,
            trim: true
        },
        experience_years: {
            type: Number,
            default: 0
        },
        experience_level: {
            type: String,
            enum: ['Entry-Level', 'Mid-Level', 'Senior-Level'],
            default: 'Entry-Level'
        },
        desired_role: {
            type: String,
            trim: true
        },
        communication_rating: {
            type: Number,
            min: 1,
            max: 5
        },
        // Arrays & Lists
        skills: [{
            type: String, // Storing skill names
            trim: true
        }],
        project: [{
            type: String, // Storing project names
            trim: true
        }],
        certifications: [{
            type: String, // Storing certification titles
            trim: true
        }],
        hackathon: {
            type: String, // Yes/No
            enum: ['Yes', 'No'],
            default: 'No',
            trim: true
        },
        internships: [{
            company: { type: String },
            role: { type: String }
        }],

        // Analytics

    },
    { timestamps: true }
);

const Resume = mongoose.model("Resume", resumeSchema);

module.exports = Resume;