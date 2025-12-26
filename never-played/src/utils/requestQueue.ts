/**
 * Priority-based request queue to prevent overwhelming Steam's API
 * Limits concurrent requests and prioritizes user-triggered actions
 */

type Priority = 'high' | 'low';

interface QueuedRequest<T> {
  id: string;
  priority: Priority;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export interface FailureInfo {
  requestId: string;
  error: any;
  attempts: number;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeCount = 0;
  private readonly maxConcurrent: number;
  private readonly delayMs: number;
  private requestCounter = 0;
  private lowPriorityPaused = false;
  private failures: FailureInfo[] = [];

  constructor(maxConcurrent: number = 3, delayMs: number = 600) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs; // Delay between low-priority requests to prevent rate limiting (increased from 400ms to 600ms)
  }

  /**
   * Add a request to the queue with specified priority
   * High priority requests (showcase images) jump to front of queue
   */
  async enqueue<T>(fn: () => Promise<T>, priority: Priority = 'low'): Promise<T> {
    return this.enqueueWithRetry(fn, priority, 0);
  }

  /**
   * Add a request to the queue with retry logic
   * Retries failed requests with exponential backoff
   */
  async enqueueWithRetry<T>(
    fn: () => Promise<T>, 
    priority: Priority = 'low',
    maxRetries: number = 2
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: `req_${this.requestCounter++}`,
        priority,
        fn,
        resolve,
        reject,
        retryCount: 0,
        maxRetries
      };

      // High priority goes to front, low priority to back
      if (priority === 'high') {
        // Insert at the front of the queue (but after other high priority items)
        const firstLowPriorityIndex = this.queue.findIndex(r => r.priority === 'low');
        if (firstLowPriorityIndex === -1) {
          this.queue.push(request);
        } else {
          this.queue.splice(firstLowPriorityIndex, 0, request);
        }
      } else {
        this.queue.push(request);
      }

      this.processQueue();
    });
  }

  private async processQueue() {
    // If we're at max concurrent requests, wait
    if (this.activeCount >= this.maxConcurrent) {
      return;
    }

    // If queue is empty, nothing to do
    if (this.queue.length === 0) {
      return;
    }

    // Skip low priority requests if paused
    if (this.lowPriorityPaused && this.queue[0].priority === 'low') {
      return;
    }

    // Get next request from queue
    const request = this.queue.shift()!;
    this.activeCount++;

    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.lastError = error instanceof Error ? error.message : String(error);
      
      // Retry logic with exponential backoff
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        const backoffDelay = Math.pow(2, request.retryCount) * 1000; // 2s, 4s, 8s...
        
        console.log(`⚠️ Retry ${request.retryCount}/${request.maxRetries} for ${request.id} after ${backoffDelay}ms`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Re-add to queue at appropriate position
        if (request.priority === 'high') {
          const firstLowPriorityIndex = this.queue.findIndex(r => r.priority === 'low');
          if (firstLowPriorityIndex === -1) {
            this.queue.push(request);
          } else {
            this.queue.splice(firstLowPriorityIndex, 0, request);
          }
        } else {
          this.queue.push(request);
        }
        
        this.activeCount--;
        this.processQueue();
        return;
      }
      
      // Max retries reached - log failure and reject
      this.failures.push({
        requestId: request.id,
        error,
        attempts: request.retryCount + 1,
        timestamp: Date.now()
      });
      
      console.error(`❌ Request ${request.id} failed after ${request.retryCount + 1} attempts:`, request.lastError);
      request.reject(error);
    } finally {
      this.activeCount--;
      
      // Add delay before processing next request (only for low-priority)
      // This prevents overwhelming Steam's rate limit
      if (request.priority === 'low' && this.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
      
      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Pause low priority queue (for showcase image loading)
   */
  pauseLowPriority() {
    this.lowPriorityPaused = true;
    console.log('⏸️ Low priority queue paused');
  }

  /**
   * Resume low priority queue
   */
  resumeLowPriority() {
    this.lowPriorityPaused = false;
    console.log('▶️ Low priority queue resumed');
    this.processQueue();
  }

  /**
   * Get current queue status for debugging
   */
  getStatus() {
    return {
      active: this.activeCount,
      queued: this.queue.length,
      highPriority: this.queue.filter(r => r.priority === 'high').length,
      lowPriority: this.queue.filter(r => r.priority === 'low').length,
      paused: this.lowPriorityPaused,
      failures: this.failures.length
    };
  }

  /**
   * Get failure history
   */
  getFailures(): FailureInfo[] {
    return [...this.failures];
  }

  /**
   * Clear failure history
   */
  clearFailures() {
    this.failures = [];
  }
}

// Export singleton instance - limit to 3 concurrent Steam API requests
export const steamRequestQueue = new RequestQueue(3, 600);
