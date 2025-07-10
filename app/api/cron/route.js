// app/api/cron/route.js

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(`${process.env.SITE_URL}/api/mock-auto-settle`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await res.json();
    return NextResponse.json({ message: 'Cron executed', result: data });
  } catch (error) {
    console.error('Cron execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
