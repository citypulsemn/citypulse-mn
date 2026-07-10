/** Plain module (no "use server"): shared between the client form and the
 *  server action. A "use server" file may export only async server actions,
 *  so the state type and its initial value live here. */
export interface SubscribeState {
  status: "idle" | "success" | "already" | "error";
  message: string;
}

export const initialSubscribeState: SubscribeState = { status: "idle", message: "" };
