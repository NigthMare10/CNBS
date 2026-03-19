import { createHmac, timingSafeEqual } from "node:crypto";

function encodeSegment(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeSegment(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function signature(payloadSegment: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

export function createSignedToken(payload: object, secret: string): string {
  const payloadSegment = encodeSegment(JSON.stringify(payload));
  return `${payloadSegment}.${signature(payloadSegment, secret)}`;
}

export function verifySignedToken<T extends object>(token: string, secret: string): T | null {
  const [payloadSegment, providedSignature, ...rest] = token.split(".");
  if (!payloadSegment || !providedSignature || rest.length > 0) {
    return null;
  }

  const expectedSignature = signature(payloadSegment, secret);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const decoded = decodeSegment(payloadSegment);
  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded) as T;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
