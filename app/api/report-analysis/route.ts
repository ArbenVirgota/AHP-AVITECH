// app/api/report-analysis/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

function sanitizeText(val: any): any {
  if (typeof val === 'string') {
    return val
      .replace(/[*#$]/g, '')
      .replace(/%/g, ' persen')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeText);
  }
  if (val !== null && typeof val === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const key in val) {
      sanitizedObj[key] = sanitizeText(val[key]);
    }
    return sanitizedObj;
  }
  return val;
}

function generateFallbackData(body: any, userPlan: string) {
  const projectName = body?.project?.name || 'Proyek Analisis AHP';
  const totalExperts = body?.project?.totalExperts || 0;
  const alternatives = body?.alternatives || [];
  const topAlt = alternatives[0]?.name || 'Elemen Prioritas Utama';
  const topScore = alternatives[0]?.score ? Number(alternatives[0].score).toFixed(4) : '0.0000';

  // Evaluasi konsistensi riil dari tasks payload
  const expertEvaluations: any[] = [];
  let allConsistent = true;

  if (Array.isArray(body?.tasks)) {
    body.tasks.forEach((t: any) => {
      if (Array.isArray(t.expertReviews)) {
        t.expertReviews.forEach((rev: any) => {
          const isCons = Number(rev.cr || 0) <= 0.1;
          if (!isCons) allConsistent = false;
          expertEvaluations.push({
            expert_name: rev.expertName || 'Responden Pakar',
            status: isCons ? 'Konsisten' : 'Inkonsisten (Perlu Tinjauan)',
            notes: isCons 
              ? `Nilai CR ${Number(rev.cr).toFixed(3)} berada di bawah ambang batas toleransi 0.10 (Konsisten).`
              : `Nilai CR ${Number(rev.cr).toFixed(3)} melebihi ambang batas toleransi 0.10. Terdapat kontradiksi logis pada matriks penilaian perbandingan.`
          });
        });
      }
    });
  }

  const consistencyNarrative = allConsistent
    ? 'Evaluasi rasio konsistensi (Consistency Ratio) menunjukkan seluruh matriks perbandingan berpasangan berada di bawah batas ambang kritis 0.10. Hal ini memvalidasi bahwa penilaian para pakar memiliki tingkat konsistensi logis yang kuat dan bebas dari kontradiksi pertimbangan.'
    : 'Evaluasi rasio konsistensi menemukan adanya matriks penilaian responden yang memiliki nilai Consistency Ratio (CR) di atas ambang batas 0.10. Penilaian yang melebihi batas toleransi ini menunjukkan adanya inkonsistensi logis atau kontradiksi preferensi yang memerlukan peninjauan ulang atau kalibrasi matriks.';

  return {
    section_overview: `Laporan evaluasi komprehensif untuk proyek ${projectName} ini disusun berdasarkan sintesis penilaian multi-kriteria Analytic Hierarchy Process (AHP) yang melibatkan ${totalExperts} penilai pakar. Data perbandingan berpasangan diagregasi menggunakan metode geometric mean untuk menghasilkan konsensus objektif.`,
    section_consistency: {
      narrative: consistencyNarrative,
      expert_evaluations: expertEvaluations.length > 0 ? expertEvaluations : [
        {
          expert_name: 'Evaluasi Kolektif Pakar',
          status: allConsistent ? 'Konsisten' : 'Inkonsisten',
          notes: allConsistent 
            ? 'Penilaian seluruh responden konsisten dan memenuhi kaidah validitas ilmiah AHP.' 
            : 'Terdapat penilaian responden dengan CR > 0.10 yang perlu ditinjau kembali.'
        }
      ]
    },
    section_criteria: {
      narrative: 'Distribusi bobot kriteria memperlihatkan preferensi dominan terhadap parameter utama yang diuji.',
      strategic_insight: 'Kriteria dengan bobot tertinggi harus dijadikan fokus prioritas dalam perencanaan strategis dan mitigasi risiko.'
    },
    section_alternatives: {
      narrative: `Hasil sintesis akhir menetapkan ${topAlt} sebagai prioritas utama dengan perolehan bobot sebesar ${topScore}.`,
      sensitivity_notes: `Keunggulan ${topAlt} menunjukkan stabilitas yang baik terhadap variasi sensitivitas kriteria.`
    },
    section_final_recommendations: [
      `Menjadikan alternatif ${topAlt} sebagai prioritas utama eksekusi kebijakan.`,
      allConsistent 
        ? 'Mengesahkan hasil sintesis keputusan AHP ini sebagai landasan kebijakan yang akuntabel.'
        : 'Melakukan kalibrasi ulang atau diskusi terfokus (FGD) khusus untuk penilai yang memiliki nilai CR tinggi sebelum penetapan kebijakan akhir.'
    ]
  };
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
    const userPlan = String(body?.userPlan || 'free').toLowerCase();

    if (!GEMINI_API_KEY) {
      return NextResponse.json({
        success: true,
        isFallback: true,
        data: sanitizeText(generateFallbackData(body, userPlan))
      });
    }

    let planInstruction = '';
    if (userPlan === 'premium') {
      planInstruction = `
TINGKAT KEDALAMAN: ADVANCED / KONSULTAN SENIOR (PREMIUM)
- Uraikan pembahasan mendalam per bagian (2-3 paragraf per bagian).
- Bedah trade-off matematis antar kriteria dan analisis sensitivitas alternatif secara kritis.
- Berikan evaluasi terpisah untuk masing-masing pakar pada "expert_evaluations".
- Berikan minimal 4 sampai 5 rekomendasi strategis implementatif.
`;
    } else if (userPlan === 'plus') {
      planInstruction = `
TINGKAT KEDALAMAN: MENENGAH (PLUS)
- Uraikan pembahasan komprehensif (1-2 paragraf per bagian).
- Analisis alasan keunggulan alternatif teratas dan kriteria dominan penentunya.
- Berikan 3 rekomendasi strategis terarah.
`;
    } else {
      planInstruction = `
TINGKAT KEDALAMAN: DASAR / RINGKAS (FREE / PRO)
- Uraikan ringkasan padat dan to-the-point (1 paragraf per bagian).
- Berikan 2 rekomendasi umum.
`;
    }

    // 🟢 PENEGASAN HUKUM MATEMATIS KONSISTENSI AHP
    const prompt = `
Anda adalah Analis Pakar Pengambilan Keputusan Kuantitatif Analytic Hierarchy Process (AHP) dan Profesor Metodologi Penelitian.

HUKUM METODOLOGI KONSISTENSI AHP (SANGAT KRUSIAL - JANGAN SAMPAI TERBALIK):
1. Consistency Ratio (CR) adalah ukuran TINGKAT KETIDAKKONSISTENAN / KESALAHAN LOGIKA.
2. Batas toleransi validitas ilmiah: CR <= 0.10 (atau 10 persen).
3. JIKA CR <= 0.10 (Nilai Rendah):
   - Status: KONSISTEN dan VALID secara akademis.
   - Makna: Matriks perbandingan logis, transitif, dan dapat diterima sebagai konsensus ilmiah.
4. JIKA CR > 0.10 (Nilai Tinggi, misalnya 0.15, 0.28, 0.45):
   - Status: INKONSISTEN / TIDAK KONSISTEN / PERLU TINJAUAN ULANG.
   - Makna: Terdapat kontradiksi logis atau distorsi pertimbangan saat responden mengisi matriks. Responden tersebut TIDAK konsisten dan disarankan untuk meninjau kembali atau mengisi ulang kuesioner.
5. JANGAN PERNAH menyebut nilai CR yang tinggi (> 0.10) sebagai "sangat konsisten" atau "tingkat keandalan tinggi". Itu adalah KESALAHAN FATAL.

${planInstruction}

DATA PROYEK AHP:
${JSON.stringify(body, null, 2)}

ATURAN FORMAT:
1. DILARANG menggunakan karakter markdown seperti (#), (*), ($), atau (%). Ganti karakter "%" dengan kata "persen".
2. Gunakan bahasa Indonesia ilmiah, baku, presisi, dan objektif.
`;

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        section_overview: { type: 'STRING', description: 'Pengantar metodologis dan konteks proyek.' },
        section_consistency: {
          type: 'OBJECT',
          properties: {
            narrative: { type: 'STRING', description: 'Pembahasan kritis Consistency Ratio (CR). Jelaskan mana yang konsisten (CR <= 0.10) dan mana yang inkonsisten (CR > 0.10).' },
            expert_evaluations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  expert_name: { type: 'STRING' },
                  status: { type: 'STRING', description: 'Tulis "Konsisten" jika CR <= 0.10, atau "Inkonsisten / Perlu Tinjauan" jika CR > 0.10.' },
                  notes: { type: 'STRING', description: 'Evaluasi presisi berdasarkan nilai riil CR pakar tersebut.' }
                },
                required: ['expert_name', 'status', 'notes']
              }
            }
          },
          required: ['narrative', 'expert_evaluations']
        },
        section_criteria: {
          type: 'OBJECT',
          properties: {
            narrative: { type: 'STRING', description: 'Analisis bobot kriteria dan trade-off.' },
            strategic_insight: { type: 'STRING', description: 'Implikasi strategis kriteria.' }
          },
          required: ['narrative', 'strategic_insight']
        },
        section_alternatives: {
          type: 'OBJECT',
          properties: {
            narrative: { type: 'STRING', description: 'Analisis sintesis alternatif terbaik.' },
            sensitivity_notes: { type: 'STRING', description: 'Catatan sensitivitas alternatif.' }
          },
          required: ['narrative', 'sensitivity_notes']
        },
        section_final_recommendations: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Daftar rekomendasi strategis akhir.'
        }
      },
      required: [
        'section_overview',
        'section_consistency',
        'section_criteria',
        'section_alternatives',
        'section_final_recommendations'
      ]
    };

    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2, // Turunkan temperature ke 0.2 agar lebih deterministik dan ketat aturan
            responseMimeType: 'application/json',
            responseSchema: responseSchema
          }
        })
      }
    );

    if (!apiRes.ok) {
      console.error('Gemini API Error:', await apiRes.text());
      return NextResponse.json({
        success: true,
        isFallback: true,
        data: sanitizeText(generateFallbackData(body, userPlan))
      });
    }

    const resJson = await apiRes.json();
    const textContent = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedData = JSON.parse(textContent);

    return NextResponse.json({
      success: true,
      isFallback: false,
      data: sanitizeText(parsedData)
    });

  } catch (error: any) {
    console.error('API Route Error:', error);
    return NextResponse.json({
      success: true,
      isFallback: true,
      data: sanitizeText(generateFallbackData(body, 'free'))
    });
  }
}