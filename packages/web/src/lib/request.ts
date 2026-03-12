import { ofetch } from "ofetch";

const TOKEN_STORAGE_KEY = "token";

/**
 * 从当前 URL 的 apiKey 参数读取并持久化到 localStorage，并清除 URL 中的该参数
 * 例如：http://localhost:18790/?apiKey=nb_xxx → 存储 token 并跳转为 http://localhost:18790/
 */
export function storeTokenFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const apiKey = params.get("apiKey");
  if (!apiKey) return;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, apiKey);
  } finally {
    params.delete("apiKey");
    const newSearch = params.toString();
    const newUrl =
      window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }
}

/**
 * 默认请求头
 */
const defaultHeaders: HeadersInit = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

const baseURL = "/nanobot";
const headers = { ...defaultHeaders };

export const request = ofetch.create({
  baseURL,
  headers,
  async onRequest(ctx) {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && (ctx).options?.headers) {
      ((ctx).options.headers as Headers).set("Authorization", `Bearer ${token}`);
    }
  },
  async onRequestError() { },
  async onResponse() { },
  async onResponseError() { },
});