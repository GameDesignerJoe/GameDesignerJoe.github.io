// Shared utility for verifying friends' game libraries in the background
// Used by both main page and debug page to avoid code duplication

interface Friend {
  steamid: string;
  personaname: string;
  profileurl: string;
  games?: Array<{ appid: number; name: string; playtime_forever: number }>;
  totalPlaytime?: number;
  verificationAttempts?: number;
}

interface CachedFriendsData {
  friends: Friend[];
  totalFriends: number;
  friendsWithGames: number;
  friendsWithPrivateLibraries: number;
  lastUpdated: number;
}

interface VerificationCallbacks {
  onProgress?: (current: number, total: number, friendName: string, currentPass?: number, totalPasses?: number) => void;
  onComplete?: (passNumber: number, hasMorePasses: boolean) => void;
  onFriendVerified?: (friend: Friend) => void;
}

const CACHE_KEY = 'steam_friends_data';

/**
 * Verify friends' game libraries one-by-one to avoid rate limiting
 * @param friendsToVerify - Array of friends to verify
 * @param callbacks - Optional callbacks for progress updates
 * @param pauseCheck - Function that returns true if verification should pause
 * @returns Promise that resolves when verification is complete or paused
 */
export async function verifyFriendsBackground(
  friendsToVerify: Friend[],
  callbacks: VerificationCallbacks = {},
  pauseCheck?: () => boolean
): Promise<void> {
  const { onProgress, onComplete, onFriendVerified } = callbacks;
  
  console.log('🚀 [Verification] Starting verification of', friendsToVerify.length, 'friends');
  
  for (let i = 0; i < friendsToVerify.length; i++) {
    // Check if paused
    if (pauseCheck && pauseCheck()) {
      console.log('⏸️ [Verification] Paused at', i, '/', friendsToVerify.length);
      break;
    }
    
    const friend = friendsToVerify[i];
    const friendName = friend.personaname || `Friend ${friend.steamid.slice(-4)}`;
    
    // Call progress callback
    if (onProgress) {
      onProgress(i + 1, friendsToVerify.length, friendName);
    }
    
    try {
      console.log(`🔍 [Verification] Verifying ${i + 1}/${friendsToVerify.length}: ${friendName}`);
      
      // Call single friend API
      const response = await fetch('/api/steam-friend-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamId: friend.steamid })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.friend) {
          // Update cache immediately
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const cachedData: CachedFriendsData = JSON.parse(cached);
            
            // Find and update this specific friend
            const updatedFriends = cachedData.friends.map((f: Friend) => {
              if (f.steamid === result.friend.steamid) {
                const previousAttempts = f.verificationAttempts || 0;
                const newAttempts = previousAttempts + 1;
                
                // Merge strategy: Only update fields that have values
                // If API didn't get a new personaname, keep the existing one
                const updatedFriend = {
                  ...f,
                  ...result.friend,
                  personaname: result.friend.personaname || f.personaname, // Keep existing if new is undefined
                  games: result.friend.games || f.games,
                  verificationAttempts: newAttempts
                };
                
                const nameChanged = result.friend.personaname && result.friend.personaname !== f.personaname;
                console.log(`✅ [Verification] Updated ${updatedFriend.personaname}: ${updatedFriend.games?.length || 0} games (attempt ${newAttempts})${nameChanged ? ' [NAME UPDATED]' : ''}`);
                
                // Call friend verified callback
                if (onFriendVerified) {
                  onFriendVerified(updatedFriend);
                }
                
                return updatedFriend;
              }
              return f;
            });
            
            // Recalculate counts
            const updatedData: CachedFriendsData = {
              ...cachedData,
              friends: updatedFriends,
              friendsWithGames: updatedFriends.filter((f: Friend) => f.games && f.games.length > 0).length,
              friendsWithPrivateLibraries: updatedFriends.filter((f: Friend) => !f.games || f.games.length === 0).length,
              lastUpdated: Date.now()
            };
            
            // Save to cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
          }
        }
      }
      
      // Rate limiting delay (500ms between requests)
      if (i < friendsToVerify.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`❌ [Verification] Error verifying ${friendName}:`, error);
    }
  }
  
  console.log('🏁 [Verification] Complete!');
  
  if (onComplete) {
    onComplete(1, false); // passNumber: 1, hasMorePasses: false (single pass mode)
  }
}

/**
 * Multi-pass verification system to resolve false "Private Profile" positives
 * Runs up to 3 passes with increasing delays between passes
 * @param friends - All friends to check
 * @param callbacks - Optional callbacks for progress updates
 * @param maxPasses - Maximum number of verification passes (default: 3)
 * @returns Promise that resolves when all passes are complete
 */
export async function verifyFriendsMultiPass(
  friends: Friend[],
  callbacks: VerificationCallbacks = {},
  maxPasses: number = 3
): Promise<void> {
  const { onProgress, onComplete, onFriendVerified } = callbacks;
  
  console.log('🎯 [Multi-Pass] Starting multi-pass verification (max', maxPasses, 'passes)');
  
  for (let pass = 1; pass <= maxPasses; pass++) {
    // Get unverified friends for this pass
    const unverifiedFriends = getUnverifiedFriends(friends);
    
    if (unverifiedFriends.length === 0) {
      console.log('✅ [Multi-Pass] No more friends to verify, stopping at pass', pass - 1);
      if (onComplete) {
        onComplete(pass - 1, false);
      }
      return;
    }
    
    console.log(`🔄 [Multi-Pass] Pass ${pass}/${maxPasses}: Verifying ${unverifiedFriends.length} friends`);
    
    // Verify friends in this pass
    await verifyFriendsBackground(unverifiedFriends, {
      onProgress: (current, total, friendName) => {
        if (onProgress) {
          onProgress(current, total, friendName, pass, maxPasses);
        }
      },
      onFriendVerified: (friend) => {
        if (onFriendVerified) {
          onFriendVerified(friend);
        }
      },
      onComplete: (passNumber, hasMorePasses) => {
        // Don't call onComplete here, wait until all passes are done
      }
    });
    
    // After each pass, reload friends from cache for next pass
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const cachedData: CachedFriendsData = JSON.parse(cached);
      friends = cachedData.friends;
    }
    
    // Check if we should continue
    const stillUnverified = getUnverifiedFriends(friends);
    const hasMorePasses = pass < maxPasses && stillUnverified.length > 0;
    
    if (hasMorePasses) {
      // Calculate delay: 30s for pass 2, 60s for pass 3
      const delayMs = pass === 1 ? 30000 : 60000;
      const delaySec = delayMs / 1000;
      
      console.log(`⏰ [Multi-Pass] Pass ${pass} complete. Waiting ${delaySec}s before pass ${pass + 1}...`);
      
      // Call onComplete with info about next pass
      if (onComplete) {
        onComplete(pass, true);
      }
      
      // Wait before next pass
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      console.log('🏁 [Multi-Pass] All passes complete!');
      if (onComplete) {
        onComplete(pass, false);
      }
      return;
    }
  }
}

/**
 * Get list of unverified friends (less than 2 verification attempts)
 */
export function getUnverifiedFriends(friends: Friend[]): Friend[] {
  return friends.filter(f => {
    // Always include if name is a fallback "Private Profile XXXX" - might not be accurate
    // Check this FIRST before attempts, so we always re-verify these
    if (f.personaname && f.personaname.startsWith('Private Profile ')) {
      const attempts = f.verificationAttempts || 0;
      return attempts < 2; // Only exclude if tried twice already
    }
    
    const attempts = f.verificationAttempts || 0;
    if (attempts >= 2) return false; // Already tried twice
    
    // Include if no games (truly unverified)
    if (!f.games) return true;
    
    // Include if verification attempts is explicitly 0 (marked for re-verification)
    if (f.verificationAttempts === 0) return true;
    
    return false;
  });
}

/**
 * Check if verification has already been auto-started this session
 */
export function hasAutoStarted(): boolean {
  return sessionStorage.getItem('verification_auto_started') === 'true';
}

/**
 * Mark verification as auto-started for this session
 */
export function markAutoStarted(): void {
  sessionStorage.setItem('verification_auto_started', 'true');
}

/**
 * Reset all friends' verification attempts to 0 (forces re-verification)
 */
export function resetAllVerificationAttempts(): void {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return;
  
  try {
    const cachedData: CachedFriendsData = JSON.parse(cached);
    
    // Reset all verification attempts to 0
    const resetFriends = cachedData.friends.map(f => ({
      ...f,
      verificationAttempts: 0
    }));
    
    const updatedData: CachedFriendsData = {
      ...cachedData,
      friends: resetFriends,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(updatedData));
    console.log('✅ [Verification] Reset all verification attempts to 0');
  } catch (e) {
    console.error('❌ [Verification] Failed to reset verification attempts:', e);
  }
}
