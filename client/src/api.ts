const accessTokenKey = "mofaic-access-token";

export function getAccessToken() {
  const token = localStorage.getItem(accessTokenKey) ?? sessionStorage.getItem(accessTokenKey);
  if (token) localStorage.setItem(accessTokenKey, token);
  sessionStorage.removeItem(accessTokenKey);
  return token;
}

let accessToken = getAccessToken();

export function setAccessToken(value: string | null) {
  accessToken = value;
  sessionStorage.removeItem(accessTokenKey);
  if (value) localStorage.setItem(accessTokenKey, value);
  else localStorage.removeItem(accessTokenKey);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api${path}`, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) setAccessToken(null);
    throw new Error(
      typeof payload.error === "string" ? payload.error : "The request could not be completed.",
    );
  }
  return payload as T;
}

export async function downloadFile(path: string, fileName: string) {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api${path}`, { headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      typeof payload.error === "string" ? payload.error : "The document could not be downloaded.",
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
