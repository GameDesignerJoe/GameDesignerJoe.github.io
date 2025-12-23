/**
 * Fetch with automatic retry logic and exponential backoff
 * Useful for handling intermittent network issues or rate limiting
 */

interface FetchWithRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<FetchWithRetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for delays between retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry logic
 * @param url - The URL to fetch
 * @param init - Fetch init options
 * @param options - Retry configuration options
 * @returns Response from successful fetch
 * @throws Error if all retries are exhausted
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // Log retry attempts (skip logging on first attempt)
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt}/${config.maxRetries} for ${url}`);
      }
      
      const response = await fetch(url, init);
      
      // If response is ok, return it immediately
      if (response.ok) {
        if (attempt > 0) {
          console.log(`✅ Request succeeded on retry attempt ${attempt}`);
        }
        return response;
      }
      
      // For certain status codes, don't retry (client errors that won't change)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // Don't retry client errors (except 429 Too Many Requests)
        console.log(`❌ Non-retryable error: ${response.status} ${response.statusText}`);
        return response;
      }
      
      // For server errors (5xx) or 429, we should retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      // If this is the last attempt, return the failed response
      if (attempt === config.maxRetries) {
        console.log(`❌ All retry attempts exhausted for ${url}`);
        return response;
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`⚠️ Fetch attempt ${attempt + 1} failed:`, lastError.message);
      
      // If this is the last attempt, throw the error
      if (attempt === config.maxRetries) {
        console.error(`❌ All retry attempts exhausted for ${url}`);
        throw lastError;
      }
    }
    
    // Calculate delay with exponential backoff
    const delayMs = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );
    
    console.log(`⏳ Waiting ${delayMs}ms before retry...`);
    await sleep(delayMs);
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Request failed after all retries');
}
