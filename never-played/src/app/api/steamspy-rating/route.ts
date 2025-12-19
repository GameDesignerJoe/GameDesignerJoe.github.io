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
    
    // Debug: Log the raw response to see what fields are available
    console.log(`SteamSpy response for ${appId}:`, JSON.stringify(data, null, 2));
    
    // Extract rating
    const positive = data.positive || 0;
    const negative = data.negative || 0;
    const total = positive + negative;
    const rating = total === 0 ? null : Math.round((positive / total) * 100);
    
    // Extract top 5 tags by vote count
    const tags: string[] = [];
    if (data.tags && typeof data.tags === 'object') {
      const tagEntries = Object.entries(data.tags)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5);
      tags.push(...tagEntries.map(([tag]) => tag));
    }
    
    // Extract price (convert cents to dollars)
    let price: number | null = null;
    if (data.initialprice !== undefined && data.initialprice !== null) {
      price = data.initialprice / 100;
    }
    
    // Extract release date
    let releaseDate: string | null = null;
    if (data.release_date) {
      // Handle various formats
      if (typeof data.release_date === 'number') {
        // Unix timestamp
        const date = new Date(data.release_date * 1000);
        releaseDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } else if (typeof data.release_date === 'string') {
        // Already a string
        releaseDate = data.release_date;
      }
    }
    
    return NextResponse.json({ 
      rating,
      tags,
      price,
      releaseDate
    });
    
  } catch (error) {
    console.error('SteamSpy API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from SteamSpy' },
      { status: 500 }
    );
  }
}
