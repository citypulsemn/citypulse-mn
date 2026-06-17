import { NextResponse } from "next/server";
import { getEvents } from "@/lib/events";

export const revalidate = 300;

export async function GET() {
  const events = await getEvents();
  return NextResponse.json({ count: events.length, events });
}
