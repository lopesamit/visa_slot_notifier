import { storage } from "#imports";

export type Identity = {
  /** Secret that controls this browser's Telegram link and proves a share comes from a connected chat. */
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
  const identity = { linkKey: randomToken(32) };
  await identityItem.setValue(identity);
  return identity;
}
