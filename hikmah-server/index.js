import express from "express"; //craete server using express
import cors from "cors"; //allow cross-origin requests
import dotenv from "dotenv"; //load environment variables (secret API) from .env file
import { GoogleGenerativeAI } from "@google/generative-ai"; //import google generative AI library
import { createClient } from "@supabase/supabase-js"; //import supabase client for database access
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const primaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const generateWithFallback = async (prompt) => {
  try {
    const result = await primaryModel.generateContent(prompt);
    return { text: result.response.text() };
  } catch (error) {
    if (error.status === 429 || error.status === 503) {
      console.log("Gemini 2.5 unavailable, trying Gemini 2.0...");
      try {
        const result = await fallbackModel.generateContent(prompt);
        return { text: result.response.text() };
      } catch (error2) {
        if (error2.status === 429 || error2.status === 503) {
          console.log("Gemini 2.0 unavailable, switching to Groq...");
          const result = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
          });
          return { text: result.choices[0].message.content };
        }
        throw error2;
      }
    }
    throw error;
  }
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Generate embedding for a query using Gemini
const getEmbedding = async (text) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error("Embedding failed: " + JSON.stringify(data));
  return data.embedding.values;
};

// Search Supabase for relevant documents
const searchDocuments = async (question) => {
  try {
    const embedding = await getEmbedding(question);
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_count: 5,
    });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("RAG search failed:", err.message);
    return [];
  }
};

//Test route
app.get("/", (req, res) => {
  res.json({ message: "Islamic AI server is running!" });
});

//Ask route
app.post("/ask", async (req, res) => {
  const { question, session_id } = req.body;

  // RAG: find relevant documents
  const docs = await searchDocuments(question);
  const context = docs.length > 0
    ? docs.map(d => `[${d.type.toUpperCase()} - ${d.reference}]\nArabic: ${d.arabic}\nEnglish: ${d.english}`).join("\n\n")
    : "";

  const prompt = `
    Kamu adalah pembantu AI Islam yang pakar dalam topik wakaf, sedekah, zakat, fidyah, dan pengurusan harta Islam.
    Jawab soalan berikut dalam Bahasa Melayu dengan ringkas dan jelas.
    ${context ? `Gunakan sumber rujukan berikut untuk membantu jawapan kamu:\n\n${context}\n\n` : ""}
    Sertakan satu ayat Al-Quran yang berkaitan dan satu hadis yang berkaitan.
    Jika ayat atau hadis ada dalam sumber rujukan di atas, gunakan yang itu. Jika tidak ada, pilih yang paling sesuai.
    Format jawapan dalam JSON seperti berikut:
    {
      "summary": "ringkasan jawapan",
      "quran": { "surah": "nama surah", "chapter": 2, "verse": 261, "malay": "terjemahan ayat dalam Bahasa Melayu" },
      "hadith": { "collection": "bukhari", "number": 1, "source": "Sahih Al-Bukhari", "malay": "terjemahan hadis dalam Bahasa Melayu" }
    }
    Penting: chapter, verse dan number mesti nombor sahaja. collection mesti salah satu daripada: bukhari, muslim, tirmidhi, abudawud, nasai, ibnmajah, malik, nawawi, qudsi.
    Soalan: ${question}
  `;

  try {
    const result = await generateWithFallback(prompt);
    const text = result.text;
    const answer = JSON.parse(text.replace(/```json|```/g, "").trim()); //remove code block markers and parse JSON

    // Fetch Quran English + Arabic from API
    try {
      const [engRes, araRes] = await Promise.all([
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/eng-ummmuhammad/${answer.quran.chapter}/${answer.quran.verse}.json`),
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranindopak/${answer.quran.chapter}/${answer.quran.verse}.json`)
      ]);
      const engData = await engRes.json();
      const araData = await araRes.json();
      answer.quran.text = engData.text;
      answer.quran.arabic = araData.text;
    } catch (error) {
      console.error("Quran API fetch failed:", error);
    }

    // Fetch Hadith English + Arabic from API
    try {
      const [engRes, araRes] = await Promise.all([
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${answer.hadith.collection}/${answer.hadith.number}.json`),
        fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${answer.hadith.collection}/${answer.hadith.number}.json`)
      ]);
      const engData = await engRes.json();
      const araData = await araRes.json();
      answer.hadith.text = engData.hadiths[0].text;
      answer.hadith.arabic = araData.hadiths[0].text;
    } catch (err) {
      console.log("Hadith API fetch failed, using Gemini text");
    }

    // Save to Supabase
    let sid = session_id;

    if (!sid) {
      //Create new session using first few words of question as Title
      const title =
        question.length > 40 ? question.substring(0, 40) + "..." : question;
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert([{ title }])
        .select()
        .single();

      if (sessionError) throw sessionError;
      sid = session.id;
    }

    //Save message
    const { error: msgError } = await supabase.from("messages").insert({
      session_id: sid,
      question,
      summary: answer.summary,
      quran: answer.quran,
      hadith: answer.hadith,
    });
    if (msgError) console.error("Message save error:", msgError);

    res.json({ ...answer, session_id: sid });
  } catch (error) {
    console.error("Error generating AI response:", error);
    res.status(500).json({ error: "Gagal mendapatkan jawapan." });
  }
});

// Get all sessions
app.get("/sessions/", async (req, res) => {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error });
  res.json(data);
});

//Get messages for a session
app.get("/sessions/:id/messages", async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", req.params.id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error });
  res.json(data);
});

// Rename a session
app.patch("/sessions/:id", async (req, res) => {
  const { title } = req.body;
  const { error } = await supabase
    .from("sessions")
    .update({ title })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error });
  res.json({ success: true });
});

// Delete a session
app.delete("/sessions/:id", async (req, res) => {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
