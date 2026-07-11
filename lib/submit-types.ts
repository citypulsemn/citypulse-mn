/** Plain module (no "use server"): shared between the client form and the
 *  server action. A "use server" file may export only async server actions,
 *  so the state type and its initial value live here. */
export interface SubmitState {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
}

export const initialSubmitState: SubmitState = { status: "idle", message: "" };
