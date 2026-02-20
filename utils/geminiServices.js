const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper to fix common JSON issues from LLM output
function sanitizeLLMJson(jsonStr) {
    // Replace single-quoted keys/values with double quotes
    jsonStr = jsonStr.replace(/(?<=[{,\[\s])\s*'([^']+)'\s*:/g, '"$1":');
    jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ': "$1"');
    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(jsonStr);
}

const getGeminiResponse = async (req, res) => {
    try {
        // 1. Get the prompt from the request body
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        // 2. Select the model
        const model = genAI.getGenerativeModel({
            model: "gemma-3-4b-it"
        });

        // 3. Generate content
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // const response = await model.generateContent(prompt);
        // res.status(200).json(response);

        // 4. Send the response back to the client
        res.status(200).json({
            success: true,
            data: responseText
        });

    } catch (error) {
        console.error("Error generating AI response:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate response"
        });
    }
}

const geminiExtractedInfoOfResume = async (resumeText) => {
    const prompt = `You are an AI resume parser.

Your task is to extract structured information from raw resume text and return the result strictly in JSON format that matches the given MongoDB schema EXACTLY.

⚠️ IMPORTANT RULES:
1. Output ONLY valid JSON. Do NOT include explanations, comments, markdown, or extra text.
2. Follow the schema structure and field names exactly as provided.
3. If any field is missing or not mentioned, use:
   - null for single-value fields
   - [] for arrays
   - default values where logically applicable
4. Infer values intelligently when possible.
5. Normalize data (trim strings, remove unnecessary symbols).
6. Skills, projects, and certifications must be arrays of strings.
7. internships must be an array of objects with { company, role }.
8. If multiple values are found, choose the most relevant/recent ones.

### 🗣 Communication Skill Evaluation Rules

Infer communication_rating (1–5) based on:
- Resume clarity and structure
- Use of action verbs
- Presence of leadership roles
- Internship descriptions
- Hackathon participation
- Grammar and professionalism

Rating Guide:
1 → Very poor / unclear resume
2 → Basic, minimal descriptions
3 → Clear but generic
4 → Well-structured, confident wording
5 → Strong leadership, impact-driven language

If resume quality is average or above, do NOT leave it null.



CRITICAL OUTPUT RULES (MANDATORY):
- Return ONLY a raw JSON object.
- Do NOT wrap the response in markdown.
- Do NOT label the response as JSON.
- Do NOT include code fences or triple backticks.
- Do NOT include any surrounding text.
- Do NOT nest the output inside another object.
- The response must start with { and end with }.


---

### 📘 **Target JSON Schema Format**

{
  "name": String,
  "email": String,
  "phone": String,

  "linkedin": String,
  "github": String,

  "cgpa": Number,
  "twelfth_percent": Number,
  "tenth_percent": Number,
  "backlogs": Number,

  "experienceYears": Number,
  "desired_role": String,
  "communication_rating": Number,

  "skills": [String],
  "projects": [String],
  "certifications": [String],

  "hackathon": "Yes" | "No",

  "internships": [
    {
      "company": String,
      "role": String
    }
  ]
}

---

### 🧠 **Experience Level Rules**
- experience = 0–1 → "Entry-Level"
- experience = 2–4 → "Mid-Level"
- experience ≥ 5 → "Senior-Level"

---

### 🧪 **Example**

#### Example Resume Text:
"John Doe  
Email: john.doe@gmail.com  
Phone: 9876543210  
LinkedIn: linkedin.com/in/johndoe  
GitHub: github.com/johndoe  
CGPA: 8.5  
12th: 89%  
10th: 92%  
Skills: JavaScript, React, Node.js, MongoDB  
Projects: Smart Attendance System, E-commerce Website  
Certifications: AWS Cloud Practitioner  
Internship: Software Intern at TCS  
Role Interested: Full Stack Developer  
Hackathon Participation: Yes"

#### Example Output JSON:
{
  "name": "John Doe",
  "email": "john.doe@gmail.com",
  "phone": "9876543210",
  "linkedin": "https://linkedin.com/in/johndoe",
  "github": "https://github.com/johndoe",
  "cgpa": 8.5,
  "twelfth_percent": 89,
  "tenth_percent": 92,
  "backlogs": 0,
  "experienceYears": 1,
  "desired_role": "Full Stack Developer",
  "communication_rating": null,
  "skills": ["JavaScript", "React", "Node.js", "MongoDB"],
  "projects": ["Smart Attendance System", "E-commerce Website"],
  "certifications": ["AWS Cloud Practitioner"],
  "hackathon": "Yes",
  "internships": [
    {
      "company": "TCS",
      "role": "Software Intern"
    }
  ]
}

---

### 📄 **Now parse the following resume text and return ONLY the JSON output:**

${resumeText}`;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemma-3-27b-it"
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 1. Clean markdown code fences
        let cleaned = responseText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // 2. Extract JSON safely (in case extra text sneaks in)
        const match = cleaned.match(/\{[\s\S]*\}/);

        if (!match) {
            console.error("AI Response (no JSON found):", responseText);
            throw new Error("No JSON object found in AI response");
        }

        // 3. Parse JSON (with LLM output sanitization)
        const parsed = sanitizeLLMJson(match[0]);

        // 4. Validate required fields exist
        if (!parsed.name && !parsed.email && !parsed.skills) {
            console.error("Parsed JSON missing key fields:", parsed);
            throw new Error("Extracted data is incomplete");
        }

        return parsed;
    }
    catch (error) {
        console.error("Error extracting info from resume:", error);
        throw new Error(`Failed to extract resume info: ${error.message}`);
    }
}

const geminiATSResponseForResume = async (resumeData, desiredRole) => {
    const prompt = `
    You are an enterprise-grade Applicant Tracking System (ATS) resume evaluation engine.

Your task is to evaluate the resume quality and role alignment strictly based on ATS standards used by modern recruiters.

You must behave like a deterministic scoring system, NOT a career coach.

The candidate has specified a desired job role.
You must evaluate how well the resume aligns with that role.

========================================
INPUTS PROVIDED:
========================================
1) Desired Role
2) Resume Text

You MUST use both inputs when scoring.

========================================
SCORING CRITERIA (Total = 100 Points)
========================================

1) Section Completeness (10 points)
- Detect presence of:
  - Professional Summary / Objective
  - Education
  - Skills
  - Experience
  - Projects
  - Certifications
- Deduct points for missing major sections.

2) Contact & Professional Links (5 points)
- Email present
- Phone present
- LinkedIn present
- Deduct if missing or poorly formatted.

3) Chronological Structure (10 points)
- Experience and education should follow reverse chronological order.
- Deduct for inconsistent date formats.
- Deduct if dates are unclear or missing.

4) Experience Quality (15 points)
- Clear role descriptions.
- Bullet-point clarity.
- Impact-focused descriptions.
- Penalize vague responsibilities.

5) Quantified Achievements (10 points)
- Reward usage of numbers, %, metrics, measurable impact.
- Penalize if no measurable achievements are present.

6) Action Verbs Strength (10 points)
- Reward strong action verbs (Developed, Implemented, Led, Designed, Optimized, Built, Created, Engineered).
- Penalize repeated weak verbs.
- Penalize passive language.

7) Skills Depth & Technical Strength (10 points)
- Skills clearly listed.
- Technical skills grouped properly.
- Penalize overly generic skills.

8) Readability & Formatting (10 points)
- Clear structure.
- Logical spacing.
- Consistent bullet usage.
- Professional tone.

9) Education Quality (5 points)
- CGPA/Percentage clarity.
- Academic consistency.
- Penalize missing details.

10) Role Alignment Score (15 points)
- Evaluate how well skills, projects, and experience match the Desired Role.
- Reward relevant technical stack.
- Penalize irrelevant content.
- Penalize missing core competencies expected for that role.
- Consider industry-standard skills for that role.

========================================
CRITICAL RULES
========================================

- Total score MUST be between 0 and 100.
- Do NOT hallucinate missing sections.
- Use ONLY the provided resume text.
- Be strict but fair.
- Do NOT inflate scores.
- Do NOT explain scoring methodology.
- Return STRICT JSON ONLY.
- No markdown.
- No extra commentary.

========================================
OUTPUT FORMAT (STRICT JSON)
========================================

{
  "ats_score": number,
  "breakdown": {
    "section_completeness": number,
    "contact_score": number,
    "chronology_score": number,
    "experience_quality": number,
    "quantification_score": number,
    "action_verbs_score": number,
    "skills_score": number,
    "readability_score": number,
    "education_score": number,
    "role_alignment_score": number
  },
  "role_analysis": {
    "desired_role": "string",
    "role_match_level": "Poor | Moderate | Strong"
  },
  "strengths": ["string"],
  "weaknesses": ["string"],
  "improvement_suggestions": ["string"]
}

========================================
INPUT DATA
========================================

Desired Role:
${desiredRole}

Resume Text:
${resumeData}
`;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemma-3-27b-it"
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 1. Clean markdown code fences
        let cleaned = responseText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // 2. Extract JSON safely (in case extra text sneaks in)
        const match = cleaned.match(/\{[\s\S]*\}/);

        if (!match) {
            console.error("AI Response (no JSON found):", responseText);
            throw new Error("No JSON object found in AI response");
        }

        return sanitizeLLMJson(match[0]);
    } catch (error) {
        console.error("Error generating ATS evaluation:", error);
        throw new Error(`Failed to generate ATS evaluation: ${error.message}`);
    }
}

const geminiCareerRoadmapForResume = async (extractedText, desiredRole, experience_years, cgpa, backlogs, communication_rating, hackathons_participated, skills, projects, certifications, internships, atsResult) => {
    const prompt = `
    You are an expert Career Strategist, ATS Optimization Specialist, and Campus Placement Mentor.

Your task is to generate a highly personalized, actionable career roadmap for a student based strictly on their resume data and ATS evaluation.

Goals:
- Increase ATS score
- Strengthen alignment with the student's desired role
- Improve resume competitiveness
- Improve placement readiness

Important Instructions:
- Align all recommendations strictly with the student's Desired Role.
- Do NOT include vague advice.
- Every suggestion must be specific and actionable.
- Be realistic based on experience level.
- Return ONLY structured JSON.
- Do not include explanations outside JSON.

--------------------------------------------------
STUDENT DATA:

Desired Role: ${desiredRole}
Experience Years: ${experience_years}
CGPA: ${cgpa}
Backlogs: ${backlogs}
Communication Rating (1-5): ${communication_rating}
Hackathon Participation: ${hackathons_participated}

Skills:
${skills}

Projects:
${projects}

Internships:
${internships}

Certifications:
${certifications}

--------------------------------------------------
ATS ANALYSIS:

Current ATS Evaluation: ${atsResult}

This ATS evaluation contains a detailed breakdown of the resume's strengths and weaknesses, as well as an analysis of how well the resume aligns with the desired role. Use this information to generate your recommendations in the career roadmap.

--------------------------------------------------

Now generate a structured career roadmap in the following JSON format:

{
  "career_stage_assessment": "",
  "roadmap": {
    "short_term_0_3_months": {
      "technical_skills_to_focus": [],
      "projects_to_build_or_improve": [],
      "resume_optimization_steps": [],
      "interview_preparation_strategy": [],
      "profile_building_strategy": []
    },
    "mid_term_3_6_months": {
      "advanced_skills_to_develop": [],
      "high_impact_projects": [],
      "certifications_or_specializations": [],
      "internship_or_experience_strategy": []
    },
    "long_term_6_12_months": {
      "specialization_direction": [],
      "portfolio_strengthening": [],
      "placement_strategy": []
    }
  },
  "priority_actions_ranked": [],
}

Rules:
- Recommendations must directly address weaknesses and skill gaps.
- Roadmap must be progressive and logically structured.
- Avoid repeating strengths unless relevant for leverage.
- Keep content concise but impactful.
    `;

    try {
        const model = genAI.getGenerativeModel({
            model: "gemma-3-12b-it"
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // 1. Clean markdown code fences
        let cleaned = responseText
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // 2. Extract JSON safely (in case extra text sneaks in)
        const match = cleaned.match(/\{[\s\S]*\}/);

        if (!match) {
            console.error("AI Response (no JSON found):", responseText);
            throw new Error("No JSON object found in AI response");
        }

        return sanitizeLLMJson(match[0]);
    } catch (error) {
        console.error("Error generating career roadmap:", error);
        throw new Error(`Failed to generate career roadmap: ${error.message}`);
    }
}

module.exports = { getGeminiResponse, geminiExtractedInfoOfResume, geminiATSResponseForResume, geminiCareerRoadmapForResume };