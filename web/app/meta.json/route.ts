import { NextResponse } from 'next/server';

export async function GET() {
  const metadata = {
    name: 'Laralis Dental Manager',
    description: 'Sistema de gestión dental completo',
    version: '1.0.0',
    type: 'webapp',
    environment: process.env.NODE_ENV || 'development'
  };

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=86400' // Cache por 24 horas
    }
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}