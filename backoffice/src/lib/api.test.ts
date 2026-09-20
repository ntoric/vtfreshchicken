import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  clearAuth,
  generateIdempotencyKey,
  downloadFile,
} from "@/lib/api";
import type { User } from "@/types";

describe("auth storage helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("getToken returns null when no token set", () => {
    expect(getToken()).toBeNull();
  });

  it("setToken / getToken round-trip", () => {
    setToken("abc123");
    expect(getToken()).toBe("abc123");
  });

  it("getStoredUser returns null when empty", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("setStoredUser / getStoredUser round-trip", () => {
    const user: User = {
      id: "u1",
      email: "test@example.com",
      full_name: "Test User",
      role: "customer",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
    } as User;
    setStoredUser(user);
    const got = getStoredUser();
    expect(got).not.toBeNull();
    expect(got?.email).toBe("test@example.com");
    expect(got?.id).toBe("u1");
  });

  it("clearAuth removes token and user", () => {
    setToken("tok");
    setStoredUser({ id: "u1" } as User);
    clearAuth();
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it("clearAuth removes tenant name", () => {
    localStorage.setItem("tc_tenant_name", "demo");
    clearAuth();
    expect(localStorage.getItem("tc_tenant_name")).toBeNull();
  });
});

describe("generateIdempotencyKey", () => {
  it("returns a non-empty string", () => {
    const key = generateIdempotencyKey();
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
  });

  it("uses crypto.randomUUID when available", () => {
    // crypto.randomUUID is mocked in setup.ts to return a fixed UUID
    const key = generateIdempotencyKey();
    expect(key).toBe("00000000-0000-4000-8000-000000000000");
  });
});

describe("downloadFile", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("downloads a file with Content-Disposition filename", async () => {
    const blob = new Blob(["csv,data\n1,2"], { type: "text/csv" });
    const mockResponse = new Response(blob, {
      status: 200,
      headers: { "Content-Disposition": 'attachment; filename="export.csv"' },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document, "createElement").mockReturnValue({
      click: clickSpy,
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => null as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);

    await downloadFile("/api/t/demo/exports/download/123", "fallback.csv");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/t/demo/exports/download/123",
      expect.objectContaining({ headers: {} }),
    );
    expect(clickSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it("sends Authorization header when token is set", async () => {
    setToken("my-token");
    const blob = new Blob(["x"], { type: "text/csv" });
    const mockResponse = new Response(blob, { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      click: clickSpy,
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => null as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);

    await downloadFile("/api/t/demo/exports/download/123");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/t/demo/exports/download/123",
      expect.objectContaining({
        headers: { Authorization: "Bearer my-token" },
      }),
    );
    fetchSpy.mockRestore();
  });

  it("throws on 401 unauthorized", async () => {
    const mockResponse = new Response("{}", { status: 401 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    await expect(downloadFile("/api/t/demo/exports/download/123")).rejects.toThrow("unauthorized");
    expect(getToken()).toBeNull(); // clearAuth should have been called
    fetchSpy.mockRestore();
  });

  it("throws on non-ok response with error body", async () => {
    const mockResponse = new Response(JSON.stringify({ error: "file not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    await expect(downloadFile("/api/t/demo/exports/download/123")).rejects.toThrow("file not found");
    fetchSpy.mockRestore();
  });
});
