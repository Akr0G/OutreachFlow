import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/supabase/pagination";

describe("Supabase pagination", () => {
  it("continues until the final partial page", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3, 4], error: null })
      .mockResolvedValueOnce({ data: [5], error: null });

    await expect(fetchAllPages<number>(fetchPage, 2)).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 3);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 4, 5);
  });

  it("surfaces page errors", async () => {
    const error = new Error("query failed");
    await expect(fetchAllPages(() => Promise.resolve({ data: null, error }))).rejects.toBe(error);
  });
});
