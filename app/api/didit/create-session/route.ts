import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, expertId } = body;

    const apiKey = process.env.DIDIT_API_KEY;
    const workflowId = process.env.DIDIT_WORKFLOW_ID;
    const appId = process.env.DIDIT_APP_ID || 'e977a0bc-e3fd-49d9-9a06-d675a3d7884c';

    if (!apiKey || !workflowId) {
      return NextResponse.json(
        { success: false, message: 'DIDIT_API_KEY atau DIDIT_WORKFLOW_ID belum disetel pada .env.local.' }, 
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cleanVendorData = String(expertId || email || `EXP-${Date.now()}`).trim();

    const payload = {
      workflow_id: workflowId.trim(),
      application_id: appId,
      vendor_data: cleanVendorData,
      callback_url: `${baseUrl}/expert/verified-success`,
      redirect_url: `${baseUrl}/expert/verified-success`,
      metadata: {
        expert_id: cleanVendorData,
        email: String(email || '').trim()
      }
    };

    // 🟢 DAFTAR VARIASI ENDPOINT DIDIT (Dari yang paling umum ke spesifik)
    const endpoints = [
      'https://verification.didit.me/v1/session',         // Singular
      'https://verification.didit.me/v1/session/',        // Singular + trailing slash
      'https://verification.didit.me/v1/sessions',        // Plural
      'https://verification.didit.me/v1/sessions/',       // Plural + trailing slash
      `https://verification.didit.me/v1/applications/${appId}/session`,
      `https://verification.didit.me/v1/applications/${appId}/sessions`,
      'https://api.didit.me/v1/session'                   // Alternatif Subdomain API
    ];

    let responseData: any = {};
    let finalStatus = 404;
    let successResponse: Response | null = null;
    let successfulUrl = '';

    console.log(`🚀 Memulai pencarian Endpoint Didit yang valid...`);

    for (const url of endpoints) {
      console.log(`🌐 Mencoba: POST ${url}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify(payload),
      });

      // Jangan parse JSON jika 404 kosong, untuk menghindari error parsing
      const textResponse = await res.text();
      try {
        responseData = textResponse ? JSON.parse(textResponse) : {};
      } catch (e) {
        responseData = { detail: textResponse };
      }
      
      finalStatus = res.status;

      // Jika berhasil (200, 201) atau jika errornya BUKAN 404 (berarti endpoint ketemu tapi payload salah)
      if (res.ok || finalStatus !== 404) {
        successResponse = res;
        successfulUrl = url;
        break; // Hentikan pencarian
      }
    }

    if (!successResponse || !successResponse.ok) {
      console.error(`❌ Respon Error Didit (${finalStatus}) di URL ${successfulUrl || 'semua variasi'}:`, responseData);
      
      const errDetail = responseData.message || responseData.error || responseData.detail || JSON.stringify(responseData);
      return NextResponse.json(
        { 
          success: false, 
          message: `Didit.me Menolak Permintaan (${finalStatus}): ${errDetail}` 
        }, 
        { status: finalStatus }
      );
    }

    console.log(`✅ BERHASIL MENGGUNAKAN ENDPOINT: ${successfulUrl}`);

    const verificationUrl = responseData.url || responseData.verification_url || responseData.session_url;

    return NextResponse.json({
      success: true,
      message: 'Sesi verifikasi Didit.me berhasil dibuat.',
      session_id: responseData.session_id || responseData.id,
      verification_url: verificationUrl
    });

  } catch (error: any) {
    console.error('❌ Server Error /api/didit/create-session:', error);
    return NextResponse.json(
      { success: false, message: `Internal Error: ${error.message || error}` },
      { status: 500 }
    );
  }
}