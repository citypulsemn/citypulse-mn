"use client";

import { useActionState } from "react";
import { submitEventAction } from "@/lib/submit-actions";
import { initialSubmitState } from "@/lib/submit-types";
import { CATEGORIES } from "@/lib/categories";

const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([key, meta]) => ({
  key,
  label: meta.label,
}));

export function SubmitForm() {
  const [state, action, pending] = useActionState(submitEventAction, initialSubmitState);
  const done = state.status === "success";
  const err = (f: string) => state.errors?.[f];

  if (done) {
    return (
      <div className="submit-done" role="status">
        <div className="submit-done-check">✓</div>
        <p>{state.message}</p>
        <a className="more-day-all" href="/">
          Back to events →
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="submit-form">
      {/* Honeypot */}
      <input type="text" name="company" className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      <label className="sf-field">
        <span>Event title *</span>
        <input name="title" required maxLength={140} placeholder="e.g. Powderhorn Art Fair" />
        {err("title") && <em className="sf-err">{err("title")}</em>}
      </label>

      <label className="sf-field">
        <span>Category *</span>
        <select name="category" required defaultValue="">
          <option value="" disabled>
            Choose one…
          </option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        {err("category") && <em className="sf-err">{err("category")}</em>}
      </label>

      <div className="sf-row">
        <label className="sf-field">
          <span>Date *</span>
          <input type="date" name="date" required />
          {err("date") && <em className="sf-err">{err("date")}</em>}
        </label>
        <label className="sf-field">
          <span>Start time *</span>
          <input type="time" name="time" required />
          {err("time") && <em className="sf-err">{err("time")}</em>}
        </label>
        <label className="sf-field">
          <span>End time</span>
          <input type="time" name="endTime" />
          {err("endTime") && <em className="sf-err">{err("endTime")}</em>}
        </label>
      </div>

      <div className="sf-row">
        <label className="sf-field">
          <span>Venue *</span>
          <input name="venue" required maxLength={120} placeholder="e.g. First Avenue" />
          {err("venue") && <em className="sf-err">{err("venue")}</em>}
        </label>
        <label className="sf-field">
          <span>City *</span>
          <input name="city" required maxLength={80} placeholder="e.g. Minneapolis" />
          {err("city") && <em className="sf-err">{err("city")}</em>}
        </label>
      </div>

      <label className="sf-field">
        <span>Address</span>
        <input name="address" maxLength={160} placeholder="Street address (helps us place it on the map)" />
        {err("address") && <em className="sf-err">{err("address")}</em>}
      </label>

      <div className="sf-row">
        <label className="sf-field">
          <span>Price</span>
          <input name="price" placeholder="e.g. Free or $20" />
        </label>
        <label className="sf-field">
          <span>Ticket / info link</span>
          <input name="ticketUrl" inputMode="url" placeholder="https://…" />
          {err("ticketUrl") && <em className="sf-err">{err("ticketUrl")}</em>}
        </label>
      </div>

      <label className="sf-field">
        <span>Description</span>
        <textarea name="description" rows={4} maxLength={1000} placeholder="What's happening? A sentence or two." />
        {err("description") && <em className="sf-err">{err("description")}</em>}
      </label>

      <label className="sf-field">
        <span>Your email (optional)</span>
        <input type="email" name="submitterEmail" placeholder="So we can follow up if needed" />
        {err("submitterEmail") && <em className="sf-err">{err("submitterEmail")}</em>}
      </label>

      {state.status === "error" && !state.errors && (
        <p className="sf-err" role="status">
          {state.message}
        </p>
      )}

      <button type="submit" className="sf-submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit event"}
      </button>
      <p className="sf-note">
        Submissions are reviewed before they go live — we publish the ones that fit.
      </p>
    </form>
  );
}
