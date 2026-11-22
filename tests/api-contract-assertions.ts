import { expect } from "vitest";

interface ApiResponse {
  status: number;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export function expectApiError(
  response: ApiResponse,
  status: number,
  code: string,
  message: string,
): void {
  const requestId = response.headers["x-request-id"];

  expect(response.status).toBe(status);
  expect(requestId).toEqual(expect.any(String));
  expect(response.body).toEqual({
    error: {
      code,
      message,
      details: expect.anything(),
      requestId,
    },
  });
}
