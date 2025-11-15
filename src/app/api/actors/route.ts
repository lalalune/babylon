/**
 * API endpoint to fetch all actors and organizations data
 * Uses the new split file structure loader
 */

import { NextResponse } from 'next/server';
import { loadActorsData } from '@/lib/data/actors-loader';

export async function GET() {
  try {
    const actorsData = loadActorsData();
    return NextResponse.json(actorsData);
  } catch (error) {
    console.error('Error loading actors data:', error);
    return NextResponse.json(
      { error: 'Failed to load actors data' },
      { status: 500 }
    );
  }
}

