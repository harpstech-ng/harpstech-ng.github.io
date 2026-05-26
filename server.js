import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import admin from "firebase-admin";
import { encrypt, decrypt } from "./encryption.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Initialize Firebase Admin - no key needed on Render
admin.initializeApp({
  projectId: "harps-tech-95856"
});
const db = admin.firestore();

const SYSTEM_PROMPT = `You are VoicePay AI. Extract intents from speech. Return ONLY JSON:
{"intent":"transfer|pay_bill|buy_airtime|split_bill|unknown","amount":number,"recipient":string,"split_count":number,"language_detected":"en|yo|ha|ig|pcm","tone":"calm|rushed|stressed","confidence":0-1}`;

// 1. Parse voice intent + fraud check
app.post("/parse", async (req, res) => {
  try {
    const { transcript } = req.body;
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nUser: ${transcript}`);
    let json = JSON.parse(result.response.text().replace(/```json|```/g, ""));
    
    // Fraud check: flag stressed/rushed tone on transfers
    if (["stressed", "rushed"].includes(json.tone) && json.intent === "transfer") {
      json.requires_extra_verification = true;
    }
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Save user data encrypted
app.post("/save-user", async (req, res) => {
  try {
    const { userId, phone, voiceEmbedding } = req.body;
    await db.collection('users').doc(userId).set({
      phone_encrypted: encrypt(phone, process.env.AES_SECRET_KEY),
      voice_embedding_encrypted: encrypt(voiceEmbedding, process.env.AES_SECRET_KEY),
      created_at: Date.now()
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Generate voice receipt text
app.post("/generate-receipt", async (req, res) => {
  try {
    const { amount, recipient, language } = req.body;
    const prompt = `Generate a short voice receipt in ${language} for: Sent ₦${amount} to ${recipient}. Under 15 words, sound friendly.`;
    const result = await model.generateContent(prompt);
    res.json({ voice_text: result.response.text().trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get("/", (req, res) => res.json({ status: "Harps VoicePay backend live" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
