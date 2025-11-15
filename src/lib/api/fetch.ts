export interface ApiFetchOptions extends RequestInit {
  /**
   * When true (default), the current Privy access token is attached if available.
   */
  auth?: boolean;
  /**
   * When true (default), automatically retry with a fresh token if the request fails with 401.
   */
  autoRetryOn401?: boolean;
}

/**
 * Get a fresh Privy access token
 */
async function getPrivyAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // Use the Privy hook's getAccessToken if available (preferred - gets fresh token)
  if (window.__privyGetAccessToken) {
    const token = await window.__privyGetAccessToken();
    // Update the cached token
    window.__privyAccessToken = token;
    return token;
  }
  
  // Fallback to cached token
  return window.__privyAccessToken ?? null;
}

/**
 * Lightweight wrapper around fetch that decorates requests with the latest
 * Privy access token stored on window. Centralising this logic avoids
 * sprinkling direct window lookups across the codebase and keeps future
 * Privy integration changes localised.
 * 
 * Automatically retries requests with a fresh token if a 401 error is received.
 */
export async function apiFetch(input: RequestInfo, init: ApiFetchOptions = {}) {
  const { auth = true, autoRetryOn401 = true, headers, ...rest } = init;
  const finalHeaders = new Headers(headers ?? {});

  if (auth) {
    // Always try to get a fresh token first, fallback to cached token
    const token = await getPrivyAccessToken();

    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  let response = await fetch(input, {
    ...rest,
    headers: finalHeaders,
  });

  // If we get a 401 and auto-retry is enabled, try to refresh the token and retry
  if (response.status === 401 && auth && autoRetryOn401) {
    const freshToken = await getPrivyAccessToken();
    
    if (freshToken) {
      const retryHeaders = new Headers(headers ?? {});
      retryHeaders.set('Authorization', `Bearer ${freshToken}`);
      
      response = await fetch(input, {
        ...rest,
        headers: retryHeaders,
      });
    }
  }

  return response;
}
