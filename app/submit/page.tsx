import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { SubmitForm } from "@/components/SubmitForm";

export const metadata: Metadata = {
  title: "Submit an Event — Twin Cities | City Pulse MN",
  description:
    "Hosting something in the Minneapolis–St. Paul metro? Submit your event to City Pulse MN. We review submissions and publish the ones that fit.",
  alternates: { canonical: "/submit" },
  openGraph: {
    title: "Submit an Event | City Pulse MN",
    description: "Add your Twin Cities event to City Pulse MN.",
    url: "/submit",
    type: "website",
    siteName: "City Pulse MN",
  },
};

export default function SubmitPage() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Logo />
          <a className="page-back" href="/">
            ← All events
          </a>
        </div>
      </header>

      <main className="wrap page">
        <div className="dayhdr">
          <div className="dayhdr-eyebrow">Twin Cities · community</div>
          <h1 className="dayhdr-title">Submit an event</h1>
          <p className="coll-tagline">
            Hosting something worth sharing across the metro? Tell us about it. We review every
            submission and publish the ones that fit — free.
          </p>
        </div>

        <SubmitForm />

        <SiteFooter source="submit" />
      </main>
    </>
  );
}
