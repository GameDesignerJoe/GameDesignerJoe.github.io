import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appid = searchParams.get('appid');
  
  if (!appid) {
    return NextResponse.json(
      { error: 'App ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Steam Store API returns: { "appid": { success: true/false, data: {...} } }
    const gameData = data[appid];
    
    if (!gameData || !gameData.success || !gameData.data) {
      return NextResponse.json(
        { 
          error: 'Game not found or unavailable',
          message: 'This game may be region-locked, removed, or not yet released.'
        },
        { status: 404 }
      );
    }
    
    const game = gameData.data;
    
    // Extract relevant fields
    const storeInfo = {
      name: game.name || null,
      short_description: game.short_description || null,
      header_image: game.header_image || null,
      release_date: {
        date: game.release_date?.date || null,
        coming_soon: game.release_date?.coming_soon || false
      },
      genres: game.genres?.map((g: any) => g.description) || [],
      metacritic: game.metacritic?.score || null,
      recommendations: game.recommendations?.total || null,
      developers: game.developers || [],
      publishers: game.publishers || [],
      // Steam user review data
      positive_reviews: game.positive || null,
      negative_reviews: game.negative || null,
      review_score: game.review_score || null,
      review_score_desc: game.review_score_desc || null
    };
    
    return NextResponse.json(storeInfo);
    
  } catch (error) {
    console.error('Steam Store API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch game details from Steam Store',
        message: 'An error occurred while connecting to Steam.'
      },
      { status: 500 }
    );
  }
}
