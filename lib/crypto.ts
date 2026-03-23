import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey() {
  const key = process.env.ENV_VAR_ENCRYPTION_KEY
  if (!key) throw new Error("ENV_VAR_ENCRYPTION_KEY is not set")
  return Buffer.from(key, "hex")
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(":")
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8")
}
