import { storage } from "#imports";

export type Identity = {
  /** Sent with slot reports; used only for rate limiting. */
  installId: string;
  /** Secret that controls this browser's Telegram link. Never sent with reports. */
  linkKey: string;
};

const identityItem = storage.defineItem<Identity>("local:identity");

function randomToken(bytes: number): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function getIdentity(): Promise<Identity> {
  const existing = await identityItem.getValue();
  if (existing) return existing;
  const identity = { installId: randomToken(18), linkKey: randomToken(32) };
  await identityItem.setValue(identity);
  return identity;
}
