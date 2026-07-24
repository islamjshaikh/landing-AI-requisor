import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let errorObj: any;
    
    try {
      errorObj = JSON.parse(text);
    } catch {
      errorObj = { message: text || res.statusText };
    }
    
    const error: any = new Error(errorObj.message || `${res.status}: ${text}`);
    error.code = errorObj.code;
    error.status = res.status;
    error.email = errorObj.email;
    
    throw error;
  }
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<any> {
  const method = options?.method || 'GET';
  const headers: Record<string, string> = {
    ...(options?.headers || {}),
  };
  
  if (options?.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options?.body,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return await res.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.warn('Network error in apiRequest, likely due to authentication issues:', error);
      throw new Error('Unable to connect to server. Please check your connection or try logging in.');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('Network error in queryClient, likely due to authentication issues:', error);
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Return null instead of throwing on 401
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      // TanStack Query v5 uses gcTime instead of cacheTime
      gcTime: 1000 * 60 * 5, // 5 minutes 
    },
    mutations: {
      retry: false,
    },
  },
});
