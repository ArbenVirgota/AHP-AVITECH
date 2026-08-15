// app/api/ai/generate-subcriteria/route.ts
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const subcriteriaSchema = {
  type: 'object',
  properties: {
    subcriteria: {
      type: 'array',
      items: { type: 'string' },
      description: 'Daftar nama subkriteria yang relevan dan terukur'
    },
  },
  required: ['subcriteria'],
};

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, message: 'GEMINI_API_KEY belum diatur.' }, { status: 500 });
    }

    const { topic, description, criterionName } = await req.json();

    if (!criterionName) {
      return NextResponse.json({ success: false, message: 'Nama kriteria wajib diisi.' }, { status: 400 });
    }

    const prompt = `
Anda adalah Pakar Metodologi Analytic Hierarchy Process (AHP).
Untuk penelitian dengan topik: "${topic}"
Deskripsi Singkat: "${description || 'Tidak ada deskripsi tambahan.'}"

Kriteria Utama: "${criterionName}"

Tugas:
Berikan 3 hingga 5 nama subkriteria yang sangat relevan, terukur, logis, dan saling lepas (MECE) untuk kriteria utama di atas.
Kembalikan hanya format JSON murni sesuai skema.
`;

    const modelName = (GEMINI_MODEL || 'gemini-3.5-flash').trim();
    const apiKey = GEMINI_API_KEY.trim();
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelName + ':generateContent?key=' + apiKey;

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: subcriteriaSchema,
          temperature: 0.3,
        },
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      throw new Error(`Gagal memanggil layanan AI Gemini: ${errBody}`);
    }

    const json = await apiRes.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}