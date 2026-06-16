import dotenv from "dotenv";
dotenv.config();

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
);
const data = await res.json();

const embedModels = data.models?.filter(m =>
  m.supportedGenerationMethods?.includes("embedContent")
);

if (!embedModels?.length) {
  console.log("No embedding models found.");
  console.log("All models:");
  data.models?.forEach(m => console.log(" -", m.name));
} else {
  console.log("Embedding models available:");
  embedModels.forEach(m => console.log(" -", m.name));
}
