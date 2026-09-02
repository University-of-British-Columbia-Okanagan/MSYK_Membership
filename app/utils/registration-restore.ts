/**
 * Restoring the register form after a server-side error.
 *
 * A plain `.ts`, not `.server.ts`: the register route imports it in the browser. Keep it
 * free of server-only imports.
 */

/** The subset of saved form values that decides which document gates reopen. */
type SavedRegistrationValues = {
  communityGuidelines?: boolean;
  operationsPolicy?: boolean;
  waiverSignature?: string | null;
};

export type DocumentViews = {
  communityGuidelines: boolean;
  operationsPolicy: boolean;
  waiver: boolean;
};

/**
 * Re-derives the "has this document been opened?" flags from the values restored after a
 * failed submit.
 *
 * The consent checkboxes and the signature pad stay disabled until the user opens the
 * matching PDF, and that flag is component state which a full page POST wipes. Without
 * this the boxes came back ticked but disabled, and a disabled control is left out of
 * FormData entirely, so the next submit dropped the consents and the server rejected it
 * for agreements the form was visibly showing as agreed.
 *
 * A saved consent only exists because the document was opened last time, so it is safe to
 * treat it as proof and reopen the gate.
 */
export function documentViewsFromSavedValues(
  saved: SavedRegistrationValues | null | undefined
): DocumentViews {
  const signature = saved?.waiverSignature;

  return {
    communityGuidelines: saved?.communityGuidelines === true,
    operationsPolicy: saved?.operationsPolicy === true,
    waiver: typeof signature === "string" && signature.trim() !== "",
  };
}
