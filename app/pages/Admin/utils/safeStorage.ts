export const isBrowser = typeof window !== "undefined";

const make = (which: "localStorage" | "sessionStorage") => ({
  get(key: string): string | null {
    if (!isBrowser) return null;
    try {
      return (window as any)[which].getItem(key);
    } catch {
      return null;
    }
  },
  getJSON<T = any>(key: string, fallback: T | null = null): T | null {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, val: string) {
    if (!isBrowser) return;
    try {
      (window as any)[which].setItem(key, val);
    } catch {}
  },
  setJSON(key: string, val: any) {
    if (!isBrowser) return;
    try {
      (window as any)[which].setItem(key, JSON.stringify(val));
    } catch {}
  },
  remove(key: string) {
    if (!isBrowser) return;
    try {
      (window as any)[which].removeItem(key);
    } catch {}
  },
  clear() {
    if (!isBrowser) return;
    try {
      (window as any)[which].clear();
    } catch {}
  },
});

export const safeLocal = make("localStorage");
export const safeSession = make("sessionStorage");
export function hydrateSessionFromLocal(key: string) {
  if (typeof window !== "undefined") {
    // If sessionStorage is empty, copy the value from localStorage
    if (sessionStorage.getItem(key) === null) {
      const storedValue = localStorage.getItem(key);
      if (storedValue) {
        sessionStorage.setItem(key, storedValue);
      }
    }
  }
}

export function persistBothJSON(key: string, value: any) {
  safeLocal.setJSON(key, value);
  safeSession.setJSON(key, value);
}
