"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/lib/subscribe-actions";
import { initialSubscribeState } from "@/lib/subscribe-types";

export function SubscribeForm({ source = "site" }: { source?: string }) {
  const [state, action, pending] = useActionState(subscribeAction, initialSubscribeState);
  const done = state.status === "success" || state.status === "already";

  return (
    <form action={action} className="subscribe-form">
      <input type="hidden" name="source" value={source} />
      {/* Honeypot — hidden from humans, catches bots. */}
      <input
        type="text"
        name="company"
        className="hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="subscribe-row">
        <input
          type="email"
          name="email"
          required
          placeholder="you@email.com"
          aria-label="Email address"
          autoComplete="email"
          disabled={done}
        />
        <button type="submit" disabled={pending || done}>
          {pending ? "…" : done ? "✓" : "Subscribe"}
        </button>
      </div>
      {state.status !== "idle" && (
        <p className={`subscribe-msg ${state.status}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
