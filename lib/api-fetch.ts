/**
 * 通用 API 请求封装
 */

// 请求选项接口
export interface ApiFetchOptions {
  /** HTTP 方法 */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** 查询参数 */
  params?: Record<string, string | number | boolean | undefined>;
  /** 请求体 */
  body?: Record<string, any>;
  /** 自定义 headers */
  headers?: Record<string, string>;
  /** 基础 URL（可选） */
  baseUrl?: string;
  /** 认证 Token（可选） */
  token?: string;
}

// API 响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

/**
 * 通用 API 请求函数
 * @param endpoint API 端点
 * @param options 请求选项
 * @returns Promise<ApiResponse>
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: ApiFetchOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    params,
    body,
    headers = {},
    baseUrl = "",
    token,
  } = options;

  // 验证 endpoint 参数
  if (!endpoint || typeof endpoint !== "string") {
    return {
      success: false,
      error: `Invalid endpoint: ${endpoint}`,
    };
  }

  // 构建完整 URL
  let url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;

  // 构建查询字符串
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // 构建请求配置
  const fetchOptions: RequestInit = {
    method,
    headers: {
      accept: "application/json",
      ...headers,
    },
  };

  // 添加认证头
  if (token) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  // 添加请求体
  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Content-Type": "application/json",
    };
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    // 发起请求
    const response = await fetch(url, fetchOptions);

    // 解析响应
    const data = await response.json();

    // 检查响应状态
    if (!response.ok) {
      return {
        success: false,
        error:
          data.status_message ||
          data.message ||
          `请求失败: ${response.statusText}`,
        status: response.status,
        data,
      };
    }

    return {
      success: true,
      data,
      status: response.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "请求发生未知错误",
    };
  }
}

/**
 * 创建 API 客户端
 * @param baseUrl 基础 URL
 * @param defaultToken 默认 Token
 * @returns API 客户端对象
 */
export function createApiClient(baseUrl: string, defaultToken?: string) {
  return {
    /**
     * GET 请求
     */
    get: <T = any>(
      endpoint: string,
      params?: Record<string, string | number | boolean | undefined>,
      token?: string
    ): Promise<ApiResponse<T>> => {
      return apiFetch<T>(endpoint, {
        method: "GET",
        params,
        baseUrl,
        token: token || defaultToken,
      });
    },

    /**
     * POST 请求
     */
    post: <T = any>(
      endpoint: string,
      body?: Record<string, any>,
      token?: string
    ): Promise<ApiResponse<T>> => {
      return apiFetch<T>(endpoint, {
        method: "POST",
        body,
        baseUrl,
        token: token || defaultToken,
      });
    },

    /**
     * PUT 请求
     */
    put: <T = any>(
      endpoint: string,
      body?: Record<string, any>,
      token?: string
    ): Promise<ApiResponse<T>> => {
      return apiFetch<T>(endpoint, {
        method: "PUT",
        body,
        baseUrl,
        token: token || defaultToken,
      });
    },

    /**
     * DELETE 请求
     */
    delete: <T = any>(
      endpoint: string,
      token?: string
    ): Promise<ApiResponse<T>> => {
      return apiFetch<T>(endpoint, {
        method: "DELETE",
        baseUrl,
        token: token || defaultToken,
      });
    },

    /**
     * PATCH 请求
     */
    patch: <T = any>(
      endpoint: string,
      body?: Record<string, any>,
      token?: string
    ): Promise<ApiResponse<T>> => {
      return apiFetch<T>(endpoint, {
        method: "PATCH",
        body,
        baseUrl,
        token: token || defaultToken,
      });
    },

    /**
     * 通用请求
     */
    fetch: <T = any>(
      endpoint: string,
      options?: Omit<ApiFetchOptions, "baseUrl" | "token"> & {
        token?: string;
      }
    ): Promise<ApiResponse<T>> => {
      return apiFetch<T>(endpoint, {
        ...options,
        baseUrl,
        token: options?.token || defaultToken,
      });
    },
  };
}

const TMDB_API_TOKEN = process.env.TMDB_API_TOKEN;

if (!TMDB_API_TOKEN) {
  throw new Error("TMDB_API_TOKEN is required");
}

const TMDB_BASE_URL =
  process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org";

export const tmdb = createApiClient(TMDB_BASE_URL, TMDB_API_TOKEN);
