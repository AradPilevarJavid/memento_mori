import { setVapidDetails } from "web-push";

let configured = false;

export function vapidConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function configureWebPush(): void {
  if (configured) {
    return;
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@memento.local";

  if (!publicKey || !privateKey) {
    throw new Error(
      "Missing VAPID keys. Run `npm run setup:vapid` or set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
  }

  setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}
