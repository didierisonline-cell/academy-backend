import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

import cors from "cors";
app.use(cors());

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AGENTS = {
  professor: {
    name: "Professor Didier",
    systemPrompt: (lang) => `You are Professor Didier, founder of Aladiah Academy. You teach Agile, Scrum, and Project Management at an elite level. You are direct, structured, motivational, and deeply practical. Always respond in ${lang}. Be human, not robotic.`,
  },
  career: {
    name: "Career Advisor",
    systemPrompt: (lang) => `You are a Career Advisor at Aladiah Academy. You help students land high-paying remote Agile/PM roles in U.S. companies. Always respond in ${lang}. Be specific and actionable.`,
  },
  interview: {
    name: "Interview Coach",
    systemPrompt: (lang) => `You are an Interview Coach at Aladiah Academy. You run mock interviews and train students to ace PM/Scrum interviews. Always respond in ${lang}.`,
  },
  resume: {
    name: "Resume Builder",
    systemPrompt: (lang) => `You are a Resume Specialist at Aladiah Academy. You write ATS-optimized resumes for Scrum Masters and Project Managers. Always respond in ${lang}.`,
  },
  scrum: {
    name: "Scrum Expert",
    systemPrompt: (lang) => `You are a Scrum Expert at Aladiah Academy. You teach Scrum framework, ceremonies, sprint planning, and backlog grooming. Always respond in ${lang}.`,
  },
};

app.post("/ai", async (req, res) => {
  const { message, agentKey = "professor", language = "English", history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });
  const agent = AGENTS[agentKey] || AGENTS.professor;
  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: agent.systemPrompt(language),
      messages: [...history, { role: "user", content: message }],
    });
    return res.json({ response: response.content[0].text, agent: agent.name, language });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/welcome", async (req, res) => {
  const { studentName, language = "English" } = req.body;
  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: AGENTS.professor.systemPrompt(language),
      messages: [{ role: "user", content: `Write a short personal welcome message to ${studentName} joining Aladiah Academy. Speak as Professor Didier. 3-4 sentences max. Respond in ${language}.` }],
    });
    return res.json({ welcome: response.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => res.json({
  status: "online",
  claude: !!process.env.ANTHROPIC_API_KEY,
  kimi: !!process.env.KIMI_API_KEY,
  elevenlabs: !!process.env.ELEVEN_API_KEY,
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🧠 Aladiah Brain running on :${PORT}`));
