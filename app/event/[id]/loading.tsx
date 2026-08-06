import { CardSkeleton } from "@/components/Skeletons";

/** Event-detail loading fallback (UX2) — a single-card shape, matching the page
 *  a shared/emailed link lands on, so the tap feels instant. */
export default function Loading() {
  return <CardSkeleton />;
}
