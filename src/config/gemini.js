const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

const apiKey = process.env.GEMINI_API_KEY;

if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      // Configure JSON response output for structured schemas
      generationConfig: { responseMimeType: 'application/json' }
    });
    console.log('Gemini AI Client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini AI client:', err.message);
  }
} else {
  console.warn('WARNING: GEMINI_API_KEY is not defined. AI functionality will use fallback answers.');
}

module.exports = {
  genAI,
  model
};
