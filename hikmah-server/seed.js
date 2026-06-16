import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Quran verses to seed: [chapter, verse]
const quranRefs = [
  [2, 261], [2, 262], [2, 263], [2, 264], [2, 267], [2, 271], [2, 272],
  [2, 177], [2, 215], [2, 219], [2, 276], [2, 277], [2, 278],
  [3, 92], [3, 134],
  [4, 77], [4, 114],
  [9, 60], [9, 71], [9, 103], [9, 104],
  [22, 77], [22, 78],
  [47, 38],
  [57, 7], [57, 10], [57, 11], [57, 18],
  [63, 10], [63, 11],
  [64, 16], [64, 17],
  [76, 8], [76, 9],
  [92, 5], [92, 6], [92, 7], [92, 18], [92, 19], [92, 20], [92, 21],
  [107, 1], [107, 2], [107, 3],
];

// Hadiths to seed: [collection, number]
const hadithRefs = [
  ["bukhari", 1400], ["bukhari", 1401], ["bukhari", 1402], ["bukhari", 1403],
  ["bukhari", 1410], ["bukhari", 1411], ["bukhari", 1353], ["bukhari", 2590],
  ["muslim", 1000], ["muslim", 1001], ["muslim", 1002], ["muslim", 1003],
  ["muslim", 2198], ["muslim", 2199],
  ["tirmidhi", 659], ["tirmidhi", 660], ["tirmidhi", 662],
  ["abudawud", 1662], ["abudawud", 1663], ["abudawud", 1664],
  ["ibnmajah", 1828], ["ibnmajah", 1829], ["ibnmajah", 1830],
  ["nawawi", 1], ["nawawi", 2], ["nawawi", 13], ["nawawi", 25],
];

// Sleep helper to avoid rate limiting
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Generate embedding with retry on 503
const getEmbedding = async (text, retries = 5) => {
  for (let i = 0; i < retries; i++) {
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
    if (res.ok) return data.embedding.values;
    if (res.status === 503) {
      const wait = (i + 1) * 3000;
      console.log(`    503 — retrying in ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }
    throw new Error(JSON.stringify(data));
  }
  throw new Error("Max retries exceeded");
};

// Fetch Quran verse
const fetchQuranVerse = async (chapter, verse) => {
  try {
    const [engRes, araRes] = await Promise.all([
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/eng-ummmuhammad/${chapter}/${verse}.json`),
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranindopak/${chapter}/${verse}.json`),
    ]);
    const [eng, ara] = await Promise.all([engRes.json(), araRes.json()]);
    return {
      english: eng.text || "",
      arabic: ara.text || "",
      malay: "",
    };
  } catch (e) {
    console.log(`    fetch error: ${e.message}`);
    return null;
  }
};

// Fetch Hadith
const fetchHadith = async (collection, number) => {
  try {
    const [engRes, araRes] = await Promise.all([
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${collection}/${number}.json`),
      fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${collection}/${number}.json`),
    ]);
    const [eng, ara] = await Promise.all([engRes.json(), araRes.json()]);
    return {
      english: eng.hadiths?.[0]?.text || "",
      arabic: ara.hadiths?.[0]?.text || "",
    };
  } catch {
    return null;
  }
};

const run = async () => {
  console.log("Starting seed...\n");

  // Seed Quran verses
  console.log(`Seeding ${quranRefs.length} Quran verses...`);
  for (const [chapter, verse] of quranRefs) {
    const data = await fetchQuranVerse(chapter, verse);
    if (!data || !data.english) {
      console.log(`  Skipped Quran ${chapter}:${verse} — no data`);
      continue;
    }

    // Skip if already seeded
    const { data: existing } = await supabase.from("documents").select("id").eq("reference", `Quran ${chapter}:${verse}`).single();
    if (existing) { console.log(`  ~ Quran ${chapter}:${verse} already exists`); continue; }

    const textToEmbed = `Quran chapter ${chapter} verse ${verse}: ${data.english}`;
    const embedding = await getEmbedding(textToEmbed);

    const { error } = await supabase.from("documents").insert({
      type: "quran",
      reference: `Quran ${chapter}:${verse}`,
      arabic: data.arabic,
      malay: data.malay,
      english: data.english,
      embedding,
    });

    if (error) {
      console.log(`  Error inserting Quran ${chapter}:${verse}:`, error.message);
    } else {
      console.log(`  ✓ Quran ${chapter}:${verse}`);
    }

    await sleep(500); // avoid rate limiting
  }

  // Seed Hadiths
  console.log(`\nSeeding ${hadithRefs.length} hadiths...`);
  for (const [collection, number] of hadithRefs) {
    const data = await fetchHadith(collection, number);
    if (!data || !data.english) {
      console.log(`  Skipped ${collection} #${number} — no data`);
      continue;
    }

    // Skip if already seeded
    const { data: existing } = await supabase.from("documents").select("id").eq("reference", `${collection} #${number}`).single();
    if (existing) { console.log(`  ~ ${collection} #${number} already exists`); continue; }

    const textToEmbed = `Hadith from ${collection} number ${number}: ${data.english}`;
    const embedding = await getEmbedding(textToEmbed);

    const { error } = await supabase.from("documents").insert({
      type: "hadith",
      reference: `${collection} #${number}`,
      arabic: data.arabic,
      malay: "",
      english: data.english,
      embedding,
    });

    if (error) {
      console.log(`  Error inserting ${collection} #${number}:`, error.message);
    } else {
      console.log(`  ✓ ${collection} #${number}`);
    }

    await sleep(500);
  }

  console.log("\nSeed complete!");
};

run();
