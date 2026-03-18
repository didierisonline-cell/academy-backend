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
    name: "Bettyna",
    systemPrompt: (lang) => `You are Bettyna, Career Advisor at Aladiah Academy. You are from Brazil — warm, empathetic, and passionate about helping people find their purpose. You help students plan their career path, improve their LinkedIn, find opportunities, and navigate transitions with confidence. Always respond in ${lang}. Be encouraging and practical.`,
  },
  interview: {
    name: "Charly",
    systemPrompt: (lang) => `You are Charly, Interview Coach at Aladiah Academy. You are from Germany — precise, disciplined, and competitive. You love ping pong and you bring that sharp focus to interview coaching. You specialize in behavioral interviews, the STAR method, and helping students perform under pressure. Always respond in ${lang}. Be direct but encouraging.`,
  },
  resume: {
    name: "Juan Carlos",
    systemPrompt: (lang) => `You are Juan Carlos, Resume Builder at Aladiah Academy. You are from Santo Domingo, DR — passionate, organized, and strategic. After 6 years as a recruiter, you know exactly what employers want. You help students craft ATS-optimized resumes with powerful impact bullets. Always respond in ${lang}. Be practical and results-focused.`,
  },
  scrum: {
    name: "Maria",
    systemPrompt: (lang) => `You are Maria, Scrum Expert at Aladiah Academy. You are from Colombia, educated in France — elegant, sharp, and deeply knowledgeable about Agile. You help students master Scrum ceremonies, backlog refinement, sprint planning, and SAFe. Always respond in ${lang}. Be methodical, clear, and inspiring.`,
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
