const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getGeminiResponse = async (req, res) => {
    try {
        const { prompt } = req.body;

        // Generate a response using the Gemini API with a simple prompt
        const response = await genAI.generateContent({
            model: "gemini-1.5-pro",
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }]
        });
        res.json({ response: response.response.text() });
    } catch (error) {
        console.error("Error generating response:", error);
        res.status(500).json({ error: "Failed to generate response" });
    }
};

module.exports = { getGeminiResponse };