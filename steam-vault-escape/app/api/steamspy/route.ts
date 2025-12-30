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
    const response = await fetch(
      `https://steamspy.com/api.php?request=appdetails&appid=${appId}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );
    
    if (!response.ok) {
      throw new Error(`SteamSpy API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract rating (positive/negative ratio as percentage)
    const positive = data.positive || 0;
    const negative = data.negative || 0;
    const total = positive + negative;
    const rating = total === 0 ? null : Math.round((positive / total) * 100);
    
    // Extract median playtime (hours to beat estimate)
    const medianMinutes = data.median_forever || null;
    const hoursTobeat = medianMinutes ? Math.round(medianMinutes / 60) : null;
    
    // Extract top 10 tags by vote count
    const tags: string[] = [];
    if (data.tags && typeof data.tags === 'object') {
      const tagEntries = Object.entries(data.tags)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10);
      tags.push(...tagEntries.map(([tag]) => tag));
    }
    
    return NextResponse.json({ 
      rating,
      hoursTobeat,
      tags,
      medianMinutes,
      averageMinutes: data.average_forever || null,
    });
    
  } catch (error) {
    console.error('[SteamSpy API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from SteamSpy' },
      { status: 500 }
    );
  }
}
