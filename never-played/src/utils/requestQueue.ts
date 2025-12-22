/**
 * Request Queue Manager
 * 
 * Manages concurrent API requests to prevent rate limiting.
 * Limits concurrent requests and queues additional ones.
 */

interface QueuedRequest {
  url: string;
  priority: 'high' | 'low';
  resolve: (value: Response) => void;
  reject: (error: Error) => void;
  retries: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private activeRequests = 0;
  private readonly maxConcurrent = 3; // Max 3 concurrent requests to Steam API
  private readonly maxRetries = 3;

  /**
   * Queue a fetch request with priority
   */
  async queueFetch(url: string, priority: 'high' | 'low' = 'low'): Promise<Response> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        url,
        priority,
        resolve,
        reject,
        retries: 0
      };

      // Add to queue based on priority
      if (priority === 'high') {
        // High priority requests go to the front
        this.queue.unshift(request);
      } else {
        // Low priority requests go to the back
        this.queue.push(request);
      }

      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue() {
    // If we're at max capacity or queue is empty, don't start new requests
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) return;

    this.activeRequests++;

    try {
      const response = await this.fetchWithRetry(request);
      request.resolve(response);
    } catch (error) {
      request.reject(error as Error);
    } finally {
      this.activeRequests--;
      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Fetch with exponential backoff retry logic
   */
  private async fetchWithRetry(request: QueuedRequest): Promise<Response> {
    try {
      const response = await fetch(request.url);

      // Check if we got an HTML error page (rate limiting)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Rate limited - HTML response');
      }

      return response;
    } catch (error) {
      // If we haven't exceeded max retries, try again with exponential backoff
      if (request.retries < this.maxRetries) {
        request.retries++;
        const delay = Math.pow(2, request.retries) * 1000; // 2s, 4s, 8s
        
        console.log(`[RequestQueue] Retry ${request.retries}/${this.maxRetries} for ${request.url} after ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(request);
      }

      // Max retries exceeded, throw error
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Export singleton instance
export const requestQueue = new RequestQueue();
