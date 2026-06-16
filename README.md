# Hikmah AI 🕌

An Islamic AI chatbot that answers questions about **wakaf, sedekah, zakat, fidyah, and Islamic wealth management** in Bahasa Melayu — with verified Quran verses and Hadiths as references.

![Hikmah AI](hikmah-app/public/Hikmah_AI_logo_2.png)

---

## Features

- 🤖 **AI-powered answers** in Bahasa Melayu using Google Gemini 2.5 Flash
- 📖 **Verified Quran verses** with Arabic text + Malay translation
- 📜 **Verified Hadiths** with Arabic text + Malay translation
- 🔍 **RAG pipeline** — retrieves relevant Quran & Hadith from a vector database before answering
- 💬 **Multi-turn conversation** — ask follow-up questions in the same session
- 🗂️ **Chat history** — sessions saved to database, rename or delete anytime
- 🔄 **AI fallback chain** — Gemini 2.5 Flash → Gemini 2.0 Flash → Groq Llama 3.3

---

## Tech Stack

### Frontend
- React + Vite
- Tailwind CSS
- Plus Jakarta Sans font

### Backend
- Node.js + Express
- Google Gemini AI (`gemini-2.5-flash`)
- Groq (`llama-3.3-70b-versatile`) as fallback

### Database
- Supabase (PostgreSQL)
- pgvector for RAG vector search

### APIs
- [fawazahmed0 Quran API](https://github.com/fawazahmed0/quran-api) — Arabic + English text
- [fawazahmed0 Hadith API](https://github.com/fawazahmed0/hadith-api) — Arabic + English text
- Gemini Embedding API (`gemini-embedding-001`) — for RAG pipeline

---

## How RAG Works

```
User asks question
        ↓
Convert question to embedding (numbers representing meaning)
        ↓
Search Supabase vector database for similar Quran verses & Hadiths
        ↓
Pass retrieved verses as context to Gemini
        ↓
Gemini answers based on verified sources (not just memory)
```

This ensures answers are grounded in real Quran and Hadith text, not AI hallucination.

---

## Project Structure

```
Hikmah AI/
├── hikmah-app/          # React frontend
│   ├── src/
│   │   └── App.jsx
│   ├── public/
│   └── index.html
├── hikmah-server/       # Node.js backend
│   ├── index.js         # Express server + RAG logic
│   ├── seed.js          # Script to populate vector database
│   └── .env             # API keys (not committed)
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- Supabase account
- Google Gemini API key
- Groq API key

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/hikmah-ai.git
cd hikmah-ai
```

### 2. Setup backend

```bash
cd hikmah-server
npm install
```

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 3. Setup Supabase

Run this in your Supabase SQL Editor:

```sql
create extension if not exists vector;

create table sessions (
  id uuid default gen_random_uuid() primary key,
  title text,
  created_at timestamp default now()
);

create table messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  question text,
  summary text,
  quran jsonb,
  hadith jsonb,
  created_at timestamp default now()
);

create table documents (
  id bigserial primary key,
  type text,
  reference text,
  arabic text,
  malay text,
  english text,
  embedding vector(3072)
);

create or replace function match_documents (
  query_embedding vector(3072),
  match_count int default 5
)
returns table (
  id bigint, type text, reference text,
  arabic text, malay text, english text, similarity float
)
language sql stable as $$
  select id, type, reference, arabic, malay, english,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### 4. Seed the vector database

```bash
node seed.js
```

This fetches Quran verses and Hadiths, generates embeddings, and stores them in Supabase. Run once only.

### 5. Start the backend

```bash
node index.js
```

### 6. Setup and start frontend

```bash
cd ../hikmah-app
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Screenshots

![Homepage](hikmah-app/public/screenshots/homepage%20Hikmah%20AI.png)

![Chat 1](hikmah-app/public/screenshots/hikmah%20AI%201.png)

![Chat 2](hikmah-app/public/screenshots/hikmah%20AI%202.png)

![Chat 3](hikmah-app/public/screenshots/himah%20AI%203.png)

![Chat 4](hikmah-app/public/screenshots/hikmah%20AI%204.png)

---

## Disclaimer

Hikmah AI is for general reference only. It is not a fatwa or official religious ruling. Please consult a qualified Islamic scholar for specific guidance.

---

## Author

Built by [Ezwan](https://www.linkedin.com/in/ezwan-hazim-19002127a/) as a side project during internship.
