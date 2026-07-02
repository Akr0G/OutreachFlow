import crypto from "node:crypto";

const algorithm = "aes-256-gcm";

export function encryptSecret(value: string) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Unsupported encrypted secret format.");
  }
  const decipher = crypto.createDecipheriv(
    algorithm,
    encryptionKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  const lastFour = value.slice(-4);
  return `Connected ending in ${lastFour}`;
}

function encryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY_BASE64;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY_BASE64 must be configured before storing secrets.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.");
  }
  return key;
}
