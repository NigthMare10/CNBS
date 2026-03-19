import { describe, expect, it } from "vitest";
import { createSignedToken, verifySignedToken } from "./signed-token";

describe("signed token", () => {
  it("verifies a valid token payload", () => {
    const token = createSignedToken({ user: "tester", role: "admin", exp: 9999999999 }, "secret");

    expect(verifySignedToken<{ user: string; role: string; exp: number }>(token, "secret")).toEqual({
      user: "tester",
      role: "admin",
      exp: 9999999999
    });
  });

  it("rejects tampered tokens", () => {
    const token = createSignedToken({ user: "tester" }, "secret");
    const [payload] = token.split(".");

    expect(verifySignedToken(`${payload}.tampered`, "secret")).toBeNull();
  });
});
