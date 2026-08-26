/**
 * The "end must be later than start" rule, across both workshop schemas.
 *
 * Add Workshop and Edit Workshop enforce it through `workshopFormSchema`; Offer
 * Again through `workshopOfferSchema`. The offer schema was missing the rule
 * entirely, so the two are asserted together here — if one gains or loses it,
 * this file fails rather than the pages quietly disagreeing again.
 */

import { workshopFormSchema } from "~/schemas/workshopFormSchema";
import { workshopOfferSchema } from "~/schemas/workshopOfferAgainSchema";

const RANGE_ERROR = "End date must be later than start date";

const on = (day: number, hour: number) => new Date(2026, 10, day, hour);

/** A three-hour session — the kind the removed auto-2h rule used to flatten. */
const validRange = { startDate: on(5, 13), endDate: on(5, 16) };
const endBeforeStart = { startDate: on(5, 16), endDate: on(5, 13) };
const endEqualsStart = { startDate: on(5, 13), endDate: on(5, 13) };

/** Everything `workshopFormSchema` needs besides the occurrences under test. */
const workshopBase = {
  name: "Laser Cutting Basics",
  description: "Introduction to the laser cutter",
  price: 25,
  location: "Bay 3",
  capacity: 8,
  type: "workshop" as const,
};

const offerErrors = (occurrences: unknown[]) => {
  const result = workshopOfferSchema.safeParse({ occurrences });
  return result.success ? null : result.error.flatten().fieldErrors.occurrences;
};

const workshopErrors = (occurrences: unknown[]) => {
  const result = workshopFormSchema.safeParse({
    ...workshopBase,
    occurrences,
  });
  return result.success ? null : result.error.flatten().fieldErrors.occurrences;
};

describe("workshopOfferSchema occurrence date range", () => {
  it("accepts a session that ends after it starts", () => {
    expect(offerErrors([validRange])).toBeNull();
  });

  it("rejects a session whose end is before its start", () => {
    expect(offerErrors([endBeforeStart])).toContain(RANGE_ERROR);
  });

  it("rejects a session whose end is the same instant as its start", () => {
    expect(offerErrors([endEqualsStart])).toContain(RANGE_ERROR);
  });

  it("rejects the whole list when any one session is inverted", () => {
    expect(
      offerErrors([validRange, endBeforeStart, validRange])
    ).toContain(RANGE_ERROR);
  });

  it("still requires at least one date", () => {
    expect(offerErrors([])).toContain("At least one date is required");
  });

  it("still rejects a date that was never filled in", () => {
    const errors = offerErrors([
      { startDate: new Date(""), endDate: on(5, 16) },
    ]);
    expect(errors).not.toBeNull();
  });
});

describe("workshopFormSchema occurrence date range", () => {
  it("accepts a session that ends after it starts", () => {
    expect(workshopErrors([validRange])).toBeNull();
  });

  it("rejects a session whose end is before its start", () => {
    expect(workshopErrors([endBeforeStart])).toContain(RANGE_ERROR);
  });

  it("rejects a session whose end is the same instant as its start", () => {
    expect(workshopErrors([endEqualsStart])).toContain(RANGE_ERROR);
  });
});

describe("the two schemas agree", () => {
  it("reject an inverted range with the same message under the same field", () => {
    expect(offerErrors([endBeforeStart])).toEqual(
      workshopErrors([endBeforeStart])
    );
  });

  it("both accept the same valid range", () => {
    expect(offerErrors([validRange])).toBeNull();
    expect(workshopErrors([validRange])).toBeNull();
  });
});

/**
 * The rule is meant to hold for every kind of workshop, so every combination of
 * the three flags that change how the form behaves is asserted rather than
 * assumed — a future branch that skips the check for one variant fails here.
 */
describe("every workshop variant", () => {
  const variants = [] as Array<{
    label: string;
    type: "workshop" | "orientation";
    isMultiDayWorkshop: boolean;
    hasPriceVariations: boolean;
  }>;

  for (const type of ["workshop", "orientation"] as const) {
    for (const isMultiDayWorkshop of [false, true]) {
      for (const hasPriceVariations of [false, true]) {
        variants.push({
          label: `${type}, ${isMultiDayWorkshop ? "multi-day" : "single-day"}, ${
            hasPriceVariations ? "with" : "without"
          } price variations`,
          type,
          isMultiDayWorkshop,
          hasPriceVariations,
        });
      }
    }
  }

  const parse = (
    variant: (typeof variants)[number],
    occurrences: unknown[]
  ) => {
    const result = workshopFormSchema.safeParse({
      ...workshopBase,
      type: variant.type,
      isMultiDayWorkshop: variant.isMultiDayWorkshop,
      hasPriceVariations: variant.hasPriceVariations,
      // The schema requires at least one variation when the flag is on
      priceVariations: variant.hasPriceVariations
        ? [
            {
              name: "Standard",
              price: 25,
              description: "Standard seat",
              capacity: 5,
            },
          ]
        : [],
      occurrences,
    });
    return result.success
      ? null
      : result.error.flatten().fieldErrors.occurrences;
  };

  it.each(variants)("rejects an inverted range: $label", (variant) => {
    // A multi-day workshop gets two sessions, one of them inverted
    const occurrences = variant.isMultiDayWorkshop
      ? [validRange, endBeforeStart]
      : [endBeforeStart];
    expect(parse(variant, occurrences)).toContain(RANGE_ERROR);
  });

  it.each(variants)("accepts a valid range: $label", (variant) => {
    const occurrences = variant.isMultiDayWorkshop
      ? [validRange, { startDate: on(6, 13), endDate: on(6, 16) }]
      : [validRange];
    expect(parse(variant, occurrences)).toBeNull();
  });
});
