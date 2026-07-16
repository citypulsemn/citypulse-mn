"use client";

import { useActionState } from "react";
import { requestSavedLinkAction } from "@/lib/saved-restore-actions";
import { initialSubscribeState } from "@/lib/subscribe-types";

/**
 * "Keep this list" (roadmap 5.4) — shown on /saved when there's a list worth
 * keeping. Same interaction pattern as the footer subscribe form.
 */
export function KeepListForm() {
  const [state, action, pending] = useActionState(requestSavedLinkAction, initialSubscribeState);

  return (
    <div className="keep-list">
      <div className="keep-list-title">Keep this list</div>
      <p className="keep-list-sub">
        Your saves live in this browser. Email yourself a link and open it anywhere —
        phone, laptop, a fresh browser — to bring the list with you.
      </p>
      {state.status === "success" ? (
        <p className="keep-list-done" role="status">{state.message}</p>
      ) : (
        <form action={action} className="keep-list-form">
          {/* Honeypot — humans never see it, bots fill it. */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hp-field" />
          <input
            type="email"
            name="email"
            required
            placeholder="you@email.com"
            aria-label="Email address"
            className="keep-list-input"
          />
          <button type="submit" disabled={pending} className="keep-list-btn">
            {pending ? "Sending…" : "Email me the link"}
          </button>
        </form>
      )}
      {state.status === "error" && <p className="keep-list-err" role="alert">{state.message}</p>}
      <p className="keep-list-fine">One link, good for 7 days. This doesn&apos;t subscribe you to anything.</p>
    </div>
  );
}
