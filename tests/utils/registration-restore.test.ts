import { documentViewsFromSavedValues } from "~/utils/registration-restore";

/**
 * The register form gates three controls behind "have you opened the document yet?" local
 * state. A server error posts the whole page, which resets that state to false, so the
 * restored consent checkboxes came back **checked but disabled**.
 *
 * A disabled control is not serialised into FormData, so the next submit silently dropped
 * `communityGuidelines` and `operationsPolicy`, and the server rejected it with "You must
 * agree to follow the MSYK Community Guidelines" while the boxes sat there visibly ticked
 * and greyed out. There was no way for the user to proceed short of re-opening both PDFs.
 *
 * A saved consent is proof the document was opened on the previous attempt, so the flags
 * are re-derived from the restored values.
 */
describe("documentViewsFromSavedValues", () => {
  it("re-opens all three gates when the previous attempt had consented and signed", () => {
    expect(
      documentViewsFromSavedValues({
        communityGuidelines: true,
        operationsPolicy: true,
        waiverSignature: "data:image/png;base64,abc",
      })
    ).toEqual({
      communityGuidelines: true,
      operationsPolicy: true,
      waiver: true,
    });
  });

  it("leaves a gate shut when that consent was not given", () => {
    expect(
      documentViewsFromSavedValues({
        communityGuidelines: false,
        operationsPolicy: true,
        waiverSignature: "data:image/png;base64,abc",
      })
    ).toEqual({
      communityGuidelines: false,
      operationsPolicy: true,
      waiver: true,
    });
  });

  it("keeps the waiver gate shut when nothing was signed", () => {
    expect(
      documentViewsFromSavedValues({
        communityGuidelines: true,
        operationsPolicy: true,
        waiverSignature: "",
      }).waiver
    ).toBe(false);
  });

  it("treats a whitespace-only signature as unsigned", () => {
    expect(
      documentViewsFromSavedValues({ waiverSignature: "   " }).waiver
    ).toBe(false);
  });

  it("shuts every gate for an empty restore", () => {
    expect(documentViewsFromSavedValues({})).toEqual({
      communityGuidelines: false,
      operationsPolicy: false,
      waiver: false,
    });
  });

  it("survives a null or undefined payload rather than throwing mid-restore", () => {
    // The saved blob is parsed from sessionStorage, so it can be anything.
    expect(documentViewsFromSavedValues(null)).toEqual({
      communityGuidelines: false,
      operationsPolicy: false,
      waiver: false,
    });
    expect(documentViewsFromSavedValues(undefined)).toEqual({
      communityGuidelines: false,
      operationsPolicy: false,
      waiver: false,
    });
  });

  it("ignores non-boolean junk in the saved payload", () => {
    expect(
      documentViewsFromSavedValues({
        communityGuidelines: "on" as unknown as boolean,
        operationsPolicy: 1 as unknown as boolean,
      })
    ).toEqual({
      communityGuidelines: false,
      operationsPolicy: false,
      waiver: false,
    });
  });

  it("ignores a non-string signature", () => {
    expect(
      documentViewsFromSavedValues({
        waiverSignature: 12345 as unknown as string,
      }).waiver
    ).toBe(false);
  });
});
