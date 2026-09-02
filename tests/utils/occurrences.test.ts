import {
  isEndBeforeStart,
  setOccurrenceDateField,
  sortOccurrencesByStart,
} from "~/utils/occurrences";

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute);

/** A four-hour session, the duration the auto-2h rule used to destroy. */
const session = (day: number, extra: Record<string, unknown> = {}) => ({
  startDate: at(day, 10),
  endDate: at(day, 14),
  ...extra,
});

/** What `addOccurrence` puts in the list for a row the admin has not filled in. */
const unfilledRow = () => ({
  startDate: new Date(""),
  endDate: new Date(""),
});

describe("setOccurrenceDateField", () => {
  it("leaves the end alone when the start changes", () => {
    const occurrences = [session(9)];

    const result = setOccurrenceDateField(
      occurrences,
      0,
      "startDate",
      at(12, 10)
    );

    expect(result[0].startDate).toEqual(at(12, 10));
    // The bug: this used to come back as 12:00, collapsing a 4h session to 2h
    expect(result[0].endDate).toEqual(at(9, 14));
  });

  it("leaves the start alone when the end changes", () => {
    const result = setOccurrenceDateField(
      [session(9)],
      0,
      "endDate",
      at(9, 16)
    );

    expect(result[0].startDate).toEqual(at(9, 10));
    expect(result[0].endDate).toEqual(at(9, 16));
  });

  it("changes only the occurrence at the given index", () => {
    const occurrences = [session(7), session(8), session(9)];

    const result = setOccurrenceDateField(
      occurrences,
      1,
      "startDate",
      at(8, 9)
    );

    expect(result[0]).toBe(occurrences[0]);
    expect(result[2]).toBe(occurrences[2]);
    expect(result[1].startDate).toEqual(at(8, 9));
    expect(result[1].endDate).toEqual(at(8, 14));
  });

  it("does not mutate the array or the occurrence it replaces", () => {
    const occurrences = [session(9)];
    const original = occurrences[0];

    const result = setOccurrenceDateField(
      occurrences,
      0,
      "startDate",
      at(12, 10)
    );

    expect(result).not.toBe(occurrences);
    expect(result[0]).not.toBe(original);
    expect(original.startDate).toEqual(at(9, 10));
    expect(original.endDate).toEqual(at(9, 14));
  });

  it("carries the occurrence's other fields through untouched", () => {
    const result = setOccurrenceDateField(
      [session(9, { id: 42, status: "active", userCount: 3, offerId: 2 })],
      0,
      "startDate",
      at(12, 10)
    );

    expect(result[0]).toMatchObject({
      id: 42,
      status: "active",
      userCount: 3,
      offerId: 2,
    });
  });

  it("is a no-op for an index that is not in the list", () => {
    const occurrences = [session(9)];

    const result = setOccurrenceDateField(
      occurrences,
      5,
      "startDate",
      at(12, 10)
    );

    expect(result).toEqual(occurrences);
  });

  it("accepts an invalid date, so clearing a field is not swallowed", () => {
    const result = setOccurrenceDateField(
      [session(9)],
      0,
      "startDate",
      new Date("")
    );

    expect(isNaN(result[0].startDate.getTime())).toBe(true);
    expect(result[0].endDate).toEqual(at(9, 14));
  });
});

describe("sortOccurrencesByStart", () => {
  it("puts occurrences in chronological order", () => {
    const result = sortOccurrencesByStart([
      session(16),
      session(9),
      session(12),
    ]);

    expect(result.map((o) => o.startDate.getDate())).toEqual([9, 12, 16]);
  });

  it("sinks rows that have not been filled in to the bottom", () => {
    const result = sortOccurrencesByStart([
      unfilledRow(),
      session(12),
      session(9),
    ]);

    expect(result.slice(0, 2).map((o) => o.startDate.getDate())).toEqual([
      9, 12,
    ]);
    expect(isNaN(result[2].startDate.getTime())).toBe(true);
  });

  it("fully sorts a list even when an unfilled row sits in the middle", () => {
    // A plain `a - b` comparator returns NaN here, which V8 reads as "equal".
    // The unfilled row then acts as a wall and the 29th never moves past it.
    const result = sortOccurrencesByStart([
      session(1),
      session(8),
      session(15),
      session(22),
      unfilledRow(),
      session(29),
    ]);

    expect(
      result.slice(0, 5).map((o) => o.startDate.getDate())
    ).toEqual([1, 8, 15, 22, 29]);
    expect(isNaN(result[5].startDate.getTime())).toBe(true);
  });

  it("keeps several unfilled rows without throwing", () => {
    const result = sortOccurrencesByStart([
      unfilledRow(),
      session(9),
      unfilledRow(),
    ]);

    expect(result).toHaveLength(3);
    expect(result[0].startDate).toEqual(at(9, 10));
  });

  it("does not mutate the array it was given", () => {
    const occurrences = [session(16), session(9)];

    const result = sortOccurrencesByStart(occurrences);

    expect(result).not.toBe(occurrences);
    expect(occurrences.map((o) => o.startDate.getDate())).toEqual([16, 9]);
  });
});

describe("isEndBeforeStart", () => {
  it("is false for a session that ends after it starts", () => {
    expect(isEndBeforeStart(session(9))).toBe(false);
  });

  it("is true when the end is earlier than the start", () => {
    // What a day-move now leaves behind: the start jumps to the 12th, the end
    // stays on the 9th. The row says so instead of failing on save.
    expect(
      isEndBeforeStart({ startDate: at(12, 10), endDate: at(9, 14) })
    ).toBe(true);
  });

  it("is true when the end is the same instant as the start", () => {
    expect(
      isEndBeforeStart({ startDate: at(9, 10), endDate: at(9, 10) })
    ).toBe(true);
  });

  it("is false while either side is still unfilled", () => {
    expect(
      isEndBeforeStart({ startDate: new Date(""), endDate: at(9, 14) })
    ).toBe(false);
    expect(
      isEndBeforeStart({ startDate: at(9, 10), endDate: new Date("") })
    ).toBe(false);
  });
});
