"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignIn() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ID;

  const initialize = useCallback(() => {
    const google = window.google;
    if (!google || !buttonRef.current || !clientId || initialized.current) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        if (!credential) { setError("Google did not return an ID token. Please try again."); return; }
        setBusy(true);
        setError("");
        try {
          const response = await fetch("/api/auth/google/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: credential }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.detail || "Google sign-in could not be completed.");
          window.location.assign("/profile");
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
          setBusy(false);
        }
      },
    });
    buttonRef.current.replaceChildren();
    google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 320, logo_alignment: "left" });
    initialized.current = true;
  }, [clientId]);

  useEffect(() => { initialize(); }, [initialize]);

  if (!clientId) return <p className="login-error" role="alert">Google sign-in is not configured. Set NEXT_PUBLIC_AUTH_GOOGLE_ID in the frontend environment.</p>;

  return <div className="google-signin">
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={initialize} />
    <div ref={buttonRef} aria-busy={busy} />
    {busy && <p className="login-legal">Signing you in…</p>}
    {error && <p className="login-error" role="alert">{error}</p>}
  </div>;
}
