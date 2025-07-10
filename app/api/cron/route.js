// app/api/cron/route.js

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const siteUrl = process.env.SITE_URL || 'https://fundedfinal.vercel.app';

    const res = await fetch(`${siteUrl}/api/mock-auto-settle`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET || ''}`,
      },
    });

    const text = await res.text();

    // Try parsing safely:
    let data;
    try {
      data = JSON.parse(text);
    } catch (jsonError) {
      console.error('❌ Response is not valid JSON:', text);
      return NextResponse.json(
        { error: 'Response from /api/mock-auto-settle is not valid JSON', raw: text },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Cron executed', result: data });
  } catch (error) {
    console.error('❌ Cron execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
