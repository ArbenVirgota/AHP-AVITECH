// app/api/ai/generate-criteria/route.ts
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const criteriaSchema = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nama kriteria utama' },
          subcriteria: {
            type: 'array',
            items: { type: 'string', description: 'Daftar nama subkriteria' },
          },
        },
        required: ['name', 'subcriteria'],
      },
    },
  },
  required: ['criteria'],
};

export async function POST(req: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, message: 'GEMINI_API_KEY belum diatur.' }, { status: 500 });
    }

    const { topic, description, wantsSubcriteria } = await req.json();

    const prompt = `
Anda adalah Pakar Metodologi Analytic Hierarchy Process (AHP).
Buat struktur hierarki yang logis, saintifik, dan MECE (Mutually Exclusive, Collectively Exhaustive) untuk proyek penelitian berikut:

Topik/Judul Penelitian: "${topic}"
Deskripsi Singkat: "${description || 'Tidak ada deskripsi tambahan.'}"

Batasan:
- Berikan 3 hingga 5 kriteria utama (Criteria).
${wantsSubcriteria ? '- Berikan 2 hingga 4 subkriteria relevan di setiap kriteria utama.' : '- KOSONGKAN array subkriteria (harus berupa array kosong []).'}
- Kembalikan format JSON murni.
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
          responseSchema: criteriaSchema,
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