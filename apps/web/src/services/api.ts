import type {
  City,
  EducationLevel,
  FundDonateResponse,
  FundsResponse,
  MasterclassRequestPayload,
  MentorshipRequestPayload,
} from "../types/api";

const LOCAL_API_BASE_URL = "http://localhost:8000/api/v1";

function resolveDefaultApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return LOCAL_API_BASE_URL;
  }

  const { hostname, origin } = window.location;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.");

  if (isLocalhost) {
    return LOCAL_API_BASE_URL;
  }

  return `${origin.replace(/\/$/, "")}/api/v1`;
}

const DEFAULT_API_BASE_URL = resolveDefaultApiBaseUrl();

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = `Ошибка запроса (${response.status})`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorBody?.detail || errorMessage;
    } catch {
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getCities: (): Promise<City[]> => request("/common/cities"),
  getEducationLevels: (): Promise<EducationLevel[]> => request("/common/education"),
  listFunds: (params?: { city?: string | null; recipient?: string | null; page?: number; pageSize?: number }): Promise<FundsResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.city) {
      searchParams.set("city", params.city);
    }
    if (params?.recipient) {
      searchParams.set("recipient", params.recipient);
    }
    if (params?.page) {
      searchParams.set("page", String(params.page));
    }
    if (params?.pageSize) {
      searchParams.set("page_size", String(params.pageSize));
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : "";
    return request(`/funds${suffix}`);
  },
  getFundDonateUrl: (slug: string): Promise<FundDonateResponse> => request(`/funds/${slug}/donate-url`),
  createMasterclassRequest: (payload: MasterclassRequestPayload) =>
    request("/masterclass/request", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createMentorshipRequest: (payload: MentorshipRequestPayload) =>
    request("/mentorship/request", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { API_BASE_URL, DEFAULT_API_BASE_URL };
