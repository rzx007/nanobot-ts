import { ofetch } from "ofetch";

/**
 * 全局 API 基础路径，可通过环境变量 VITE_API_BASE_URL 覆盖
 */
const getBaseURL = (): string => {
  const env = import.meta.env?.VITE_API_BASE_URL;
  if (typeof env === "string" && env) return env;
  return "";
};

/**
 * 默认请求头
 */
const defaultHeaders: HeadersInit = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/** 拦截器上下文（与 ofetch 内部 context 结构一致，options 使用宽松类型以兼容 ofetch 类型） */
export interface FetchContext {
  request: Request | string;
  options: Record<string, unknown>;
  response?: Response & { _data?: unknown };
  error?: unknown;
}

/** 拦截器函数类型（使用 unknown 以兼容 ofetch 的 FetchContext 泛型） */
type Interceptor = (ctx: unknown) => void | Promise<void>;

export interface RequestConfig {
  /** 全局基础路径 */
  baseURL?: string;
  /** 全局默认请求头 */
  headers?: HeadersInit;
  /** 请求前拦截器 */
  onRequest?: Interceptor;
  /** 请求错误拦截器（如网络错误） */
  onRequestError?: Interceptor;
  /** 响应成功拦截器 */
  onResponse?: Interceptor;
  /** 响应错误拦截器（如 4xx/5xx） */
  onResponseError?: Interceptor;
}

/**
 * 创建带全局配置的请求实例
 */
function createRequest(config: RequestConfig = {}) {
  const baseURL = config.baseURL ?? getBaseURL();
  const headers = { ...defaultHeaders, ...config.headers };

  return ofetch.create({
    baseURL,
    headers,
    async onRequest(ctx) {
      // 可在此注入 token、trace id 等
      if (config.onRequest) {
        await config.onRequest(ctx);
      }
    },
    async onRequestError(ctx) {
      if (config.onRequestError) {
        await config.onRequestError(ctx);
      }
    },
    async onResponse(ctx) {
      if (config.onResponse) {
        await config.onResponse(ctx);
      }
    },
    async onResponseError(ctx) {
      if (config.onResponseError) {
        await config.onResponseError(ctx);
      }
    },
  });
}

/**
 * 默认请求实例：支持全局基础路径、默认请求头与拦截器
 */
let requestInstance = createRequest();

/**
 * 配置全局请求实例（建议在应用入口调用一次）
 */
export function configureRequest(config: RequestConfig) {
  requestInstance = createRequest(config);
}


/** 请求实例类型（与 ofetch 调用签名一致） */
export type RequestInstance = typeof ofetch;

/**
 * 全局请求方法：自动使用已配置的 baseURL、headers 和拦截器
 */

export default requestInstance;
