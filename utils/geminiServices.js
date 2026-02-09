const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
4. Infer values intelligently when possible (e.g., experience_level based on experience count).
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

  "experience": Number,
  "experience_level": "Entry-Level" | "Mid-Level" | "Senior-Level",
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
  "experience": 1,
  "experience_level": "Entry-Level",
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

        // 3. Parse JSON
        const parsed = JSON.parse(match[0]);

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

module.exports = { getGeminiResponse, geminiExtractedInfoOfResume };