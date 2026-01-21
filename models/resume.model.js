const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: String,
        email: String,
        phone: String,
        skills: [String],
        education: [String],
        experience: [String],
    },
    { timestamps: true }
);

const Resume = mongoose.model("Resume", resumeSchema);

module.exports = Resume;