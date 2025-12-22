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
    
    // Filter categories to only include relevant ones
    const INCLUDED_CATEGORIES = [
      'Single-player',
      'Multi-player',
      'Co-op',
      'Online Co-op',
      'Steam Achievements',
      'VR Supported',
      'VR Only'
    ];
    
    const categories = game.categories
      ?.map((c: any) => c.description)
      .filter((desc: string) => INCLUDED_CATEGORIES.includes(desc)) || [];
    
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
      categories: categories,
      metacritic: game.metacritic?.score || null,
      recommendations: game.recommendations?.total || null,
      developers: game.developers || [],
      publishers: game.publishers || [],
      // Steam user review data
      positive_reviews: game.positive || null,
      negative_reviews: game.negative || null,
      review_score: game.review_score || null,
      review_score_desc: game.review_score_desc || null,
      // Video/trailer data - handle different possible structures
      movies: game.movies?.map((movie: any) => {
        // Steam API can return videos in different formats
        const webm_480 = movie.webm?.['480'] || movie.webm?.max || movie.webm;
        const mp4_480 = movie.mp4?.['480'] || movie.mp4?.max || movie.mp4;
        const mp4_max = movie.mp4?.max || movie.mp4;
        
        return {
          id: movie.id,
          name: movie.name,
          thumbnail: movie.thumbnail,
          webm_480,
          mp4_480,
          mp4_max
        };
      }) || []
    };
    
    return NextResponse.json(storeInfo);
    
  } catch (error) {
    console.error(`[Steam Store API] Error fetching appid ${appid}:`, error);
    console.error(`[Steam Store API] Error details:`, {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { 
        error: 'Failed to fetch game details from Steam Store',
        message: 'An error occurred while connecting to Steam.',
        appid: appid
      },
      { status: 500 }
    );
  }
}
