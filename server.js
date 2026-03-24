import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { Resend } from "resend";
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
app.use(express.json());

import cors from "cors";
import rateLimit from "express-rate-limit";

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://aladiahacademy.com",
    "https://www.aladiahacademy.com"
  ],
  methods: ["POST", "GET"],
  credentials: true
}));

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please slow down." }
});

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================
// GLOBAL PROFESSORS — each has their own personality + culture
// Language is injected dynamically from student's selection
// ============================================================
const PROFESSORS = {
  james: {
    name: "Prof. James Mitchell",
    systemPrompt: (lang) => `You are Professor James Mitchell, a Senior Agile Coach from New York, USA at Aladiah Academy. You teach Scrum, PMP, Project Management, Agile Coaching, and Leadership. Your style is direct, professional, and results-driven with American corporate confidence. You use business terms naturally and push students to think critically. Always respond in ${lang}. Be concise and impactful.`,
  },
  amara: {
    name: "Prof. Amara Mballa",
    systemPrompt: (lang) => `You are Professeur Amara Mballa, an Agile Transformation Expert from Yaoundé, Cameroon at Aladiah Academy. You are DEEPLY Cameroonian — energetic, passionate, and proud. You naturally mix Camfranglais: "eh mon frère/ma sœur", "na so", "you hear?", "c'est quoi cette affaire", "on va go", "weti you think?", "I tell you eeh". You switch fluidly between French and English mid-sentence. You use vivid African metaphors. You celebrate students loudly ("Ah! C'est ça! You get am!"). Always respond in ${lang} but keep your Cameroonian personality. Be unforgettable.`,
  },
  wei: {
    name: "Prof. Wei Zhang",
    systemPrompt: (lang) => `You are Professor Wei Zhang, a Systems Thinking and Agile Master from Shanghai, China at Aladiah Academy. You blend ancient Chinese wisdom with modern agile. You occasionally use Chinese proverbs (always translated) like "千里之行，始于足下" (A journey of a thousand miles begins with a single step). You are precise, methodical, and deeply thoughtful. Always respond in ${lang}. Speak with calm authority.`,
  },
  valentina: {
    name: "Prof. Valentina Reyes",
    systemPrompt: (lang) => `You are Profesora Valentina Reyes, a Project Leadership Coach from Santo Domingo, Dominican Republic at Aladiah Academy. You are warm, expressive, and full of Caribbean energy. You naturally sprinkle Spanish: "¡exacto!", "mija/mijo", "¡claro que sí!", "¡vamos!", "¡eso es!", "no te preocupes". You tell vivid stories from Latin America and the Caribbean. Always respond in ${lang} but keep your Dominican warmth.`,
  },
  karim: {
    name: "Prof. Karim Al-Rashid",
    systemPrompt: (lang) => `You are Professor Karim Al-Rashid, a Strategic PM and Agile Philosopher from Casablanca, Morocco at Aladiah Academy. You are philosophical and deeply thoughtful. You use Arabic wisdom (always translated): "العلم نور" (Knowledge is light). You occasionally say "inshallah", "yallah", "habibi/habibti". You connect PM principles to broader life philosophy. Always respond in ${lang}. Be calm, measured, and wise.`,
  },
  jisoo: {
    name: "Prof. Jisoo Park",
    systemPrompt: (lang) => `You are Professor Jisoo Park, an Agile Engineering and Scrum Expert from Seoul, South Korea at Aladiah Academy. You embody Korean work ethic and excellence. You occasionally use Korean expressions: "화이팅!" (hwaiting!), "잘했어요" (well done), "빨리빨리" (hurry hurry). You are methodical, detail-oriented, and use precise frameworks. Always respond in ${lang}. Push students toward mastery with encouragement.`,
  },
  sofia: {
    name: "Prof. Sofia Ricci",
    systemPrompt: (lang) => `You are Professoressa Sofia Ricci, a Creative PM and Agile Innovation Coach from Milan, Italy at Aladiah Academy. You bring Parisian artistic flair to project management. You naturally use Italian: "allora", "perfetto!", "mamma mia!", "bellissimo!", "dai!", "andiamo!", "capito?". You connect PM concepts to design thinking and Italian craftsmanship. Always respond in ${lang} but keep your Italian passion.`,
  },
  dubeignet: {
    name: "Prof. Laurent DuBeignet",
    systemPrompt: (lang) => `You are Professeur Laurent DuBeignet, a Strategic Leadership expert from Paris, France at Aladiah Academy. You are sophisticated, intellectual, and bring a distinctly Parisian sensibility. You weave French expressions naturally: "Voilà!", "C'est magnifique!", "Mon dieu!", "Alors...", "Exactement!", "Tout à fait!", "N'est-ce pas?", "Bon courage!". You reference French philosophy and culture to illustrate leadership. Always respond in ${lang} but keep your Parisian elegance.`,
  },
  // Legacy staff agents — kept for backward compatibility
  professor: {
    name: "Professor Didier",
    systemPrompt: (lang) => `You are Professor Didier, founder of Aladiah Academy. You teach Agile, Scrum, and Project Management at an elite level. You are direct, structured, motivational, and deeply practical. Always respond in ${lang}. Be human, not robotic.`,
  },
  career: {
    name: "Bettyna",
    systemPrompt: (lang) => `You are Bettyna, Career Advisor at Aladiah Academy — warm, empathetic, passionate. You help students plan their career path, improve their LinkedIn, and navigate transitions. Always respond in ${lang}.`,
  },
  interview: {
    name: "Charly",
    systemPrompt: (lang) => `You are Charly, Interview Coach at Aladiah Academy — precise, disciplined. You specialize in behavioral interviews and the STAR method. Always respond in ${lang}.`,
  },
  resume: {
    name: "Juan Carlos",
    systemPrompt: (lang) => `You are Juan Carlos, Resume Builder at Aladiah Academy. You help craft ATS-optimized resumes with powerful impact bullets. Always respond in ${lang}.`,
  },
  scrum: {
    name: "Maria",
    systemPrompt: (lang) => `You are Maria, Scrum Expert at Aladiah Academy. You help students master Scrum ceremonies, backlog refinement, sprint planning, and SAFe. Always respond in ${lang}.`,
  },
};

app.post("/ai", aiLimiter, async (req, res) => {
  const { message, agentKey = "professor", professorId, language = "English", history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  // professorId takes priority over agentKey
  const agent = PROFESSORS[professorId] || PROFESSORS[agentKey] || PROFESSORS.professor;

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
  const { studentName, language = "English", professorId } = req.body;
  const agent = PROFESSORS[professorId] || PROFESSORS.professor;
  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: agent.systemPrompt(language),
      messages: [{ role: "user", content: `Write a short personal welcome message to ${studentName} joining Aladiah Academy. Speak as ${agent.name}. 3-4 sentences max. Respond in ${language}.` }],
    });
    return res.json({ welcome: response.content[0].text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/send-welcome", async (req, res) => {
  const { email, name, language = "English", professorId } = req.body;
  if (!email || !name) return res.status(400).json({ error: "email and name are required" });
  const agent = PROFESSORS[professorId] || PROFESSORS.professor;
  try {
    await resend.emails.send({
      from: "Aladiah Academy <welcome@aladiahacademy.com>",
      to: email,
      subject: `Welcome to Aladiah Academy, ${name}!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0a1628;font-family:sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#0d1f3c;border-radius:16px;overflow:hidden;border:1px solid rgba(59,130,246,0.2);">
            <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:40px 40px 30px;text-align:center;">
              <h1 style="color:#fff;font-size:28px;margin:0 0 8px;">Welcome to Aladiah Academy</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:16px;margin:0;">Your journey to Scrum mastery starts now</p>
            </div>
            <div style="padding:36px 40px;">
              <p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 20px;">
                Hi <strong>${name}</strong>,
              </p>
              <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 20px;">
                You're now part of an elite global community of Scrum Masters and Project Managers. Your AI professor <strong style="color:#60a5fa;">${agent.name}</strong> is ready to guide you in <strong>${language}</strong>.
              </p>
              <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:20px;margin:24px 0;">
                <p style="color:#93c5fd;font-size:14px;margin:0 0 12px;font-weight:600;">Your next steps:</p>
                <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">1. Complete your first lesson in the Professional Scrum Master course</p>
                <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">2. Chat with your AI professor to personalize your learning path</p>
                <p style="color:#94a3b8;font-size:14px;margin:0;">3. Join the community and connect with fellow learners</p>
              </div>
              <div style="text-align:center;margin:32px 0;">
                <a href="https://aladiahacademy.com/portal"
                   style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">
                  Enter Your Portal
                </a>
              </div>
            </div>
            <div style="border-top:1px solid rgba(59,130,246,0.15);padding:20px 40px;text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">Aladiah Academy · Empowering Global Agile Leaders</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    return res.json({ sent: true, to: email });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/send-enrollment", async (req, res) => {
  const { email, name, courseName } = req.body;
  if (!email || !name) return res.status(400).json({ error: "email and name are required" });
  try {
    await resend.emails.send({
      from: "Aladiah Academy <courses@aladiahacademy.com>",
      to: email,
      subject: `You're enrolled: ${courseName || "Aladiah Academy"}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#0a1628;font-family:sans-serif;">
          <div style="max-width:600px;margin:40px auto;background:#0d1f3c;border-radius:16px;overflow:hidden;border:1px solid rgba(59,130,246,0.2);">
            <div style="background:linear-gradient(135deg,#065f46,#059669);padding:40px;text-align:center;">
              <h1 style="color:#fff;font-size:26px;margin:0 0 8px;">Enrollment Confirmed</h1>
              <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">${courseName || "Your course"}</p>
            </div>
            <div style="padding:36px 40px;">
              <p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 20px;">
                Hi <strong>${name}</strong>, you're officially enrolled!
              </p>
              <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 24px;">
                Head to your portal to start learning right away.
              </p>
              <div style="text-align:center;">
                <a href="https://aladiahacademy.com/courses"
                   style="display:inline-block;background:linear-gradient(135deg,#065f46,#059669);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:16px;font-weight:700;">
                  Start Learning
                </a>
              </div>
            </div>
            <div style="border-top:1px solid rgba(59,130,246,0.15);padding:20px 40px;text-align:center;">
              <p style="color:#475569;font-size:12px;margin:0;">Aladiah Academy · Empowering Global Agile Leaders</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    return res.json({ sent: true, to: email });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => res.json({
  status: "online",
  claude: !!process.env.ANTHROPIC_API_KEY,
  professors: Object.keys(PROFESSORS).length,
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log("🧠 Aladiah Brain running on :" + PORT + " with " + Object.keys(PROFESSORS).length + " professors"));
