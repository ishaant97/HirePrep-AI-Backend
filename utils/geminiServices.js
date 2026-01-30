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
};

module.exports = { getGeminiResponse };