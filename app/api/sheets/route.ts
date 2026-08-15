import { NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwpYV3wr6PfdCOymXi5qtUXEXChFivecf1AMIn0M1TSrlbtsOiec3e901pSr2FvewDo/exec'; // Pastikan URL ini yang terbaru

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    // Tangkap semua variasi parameter ID
    const token = searchParams.get('token');
    const projectId = searchParams.get('projectid') || searchParams.get('project_id') || searchParams.get('id');

    let targetUrl = `${GOOGLE_SCRIPT_URL}?action=${action || ''}`;
    if (token) targetUrl += `&token=${encodeURIComponent(token)}`;
    if (projectId) targetUrl += `&projectid=${encodeURIComponent(projectId)}`;

    const response = await fetch(targetUrl, { 
      method: 'GET', 
      redirect: 'follow' 
    });
    
    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      return NextResponse.json({ 
        success: false, 
        message: 'GET Error: Google tidak membalas JSON. Balasan asli: ' + text.substring(0, 150) 
      }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      message: 'Next.js GET Error: ' + (error instanceof Error ? error.message : 'Unknown error') 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'follow' // Wajib untuk mengikuti redirect Google Apps Script
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      // Jika Google membalas selain JSON (misal HTML error)
      return NextResponse.json({ 
        success: false, 
        message: 'POST Error: Google tidak membalas JSON. Balasan asli: ' + text.substring(0, 150) 
      }, { status: 500 });
    }

    return NextResponse.json(data);
    
  } catch (error) {
    // Jika Next.js mengalami kendala sebelum mencapai Google
    return NextResponse.json({ 
      success: false, 
      message: 'Next.js POST Error: ' + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 });
  }
}