import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get('appid');
  
  if (!appId) {
    return NextResponse.json(
      { error: 'App ID is required' },
      { status: 400 }
    );
  }
  
  try {
    // Fetch from SteamSpy (server-side, no CORS issues)
    const response = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appId}`);
    const data = await response.json();
    
    const positive = data.positive || 0;
    const negative = data.negative || 0;
    const total = positive + negative;
    
    if (total === 0) {
      return NextResponse.json({ rating: null });
    }
    
    const score = Math.round((positive / total) * 100);
    
    return NextResponse.json({ rating: score });
    
  } catch (error) {
    console.error('SteamSpy API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rating from SteamSpy' },
      { status: 500 }
    );
  }
}
