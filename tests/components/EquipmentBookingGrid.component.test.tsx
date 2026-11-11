/**
 * @jest-environment jest-fixed-jsdom
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import EquipmentBookingGrid, {
  type SlotsByDay,
} from "~/components/ui/Dashboard/EquipmentBookingGrid";

/**
 * Cells are business (UTC-6) wall times whatever zone the browser is in.
 * NOW is Sun Nov 15 01:00 in Yellowknife but still Sat Nov 14 on a Vancouver
 * or other western clock, so a host-clock regression changes what renders.
 */
const NOW = new Date("2026-11-15T07:00:00Z");

const freeSlot = { id: null, isBooked: false, isAvailable: true };

function slotsFor(days: string[]): SlotsByDay {
  const out: SlotsByDay = {};
  for (const day of days) {
    out[day] = {};
    for (let h = 0; h < 24; h++) {
      for (const m of ["00", "30"]) {
        out[day][`${String(h).padStart(2, "0")}:${m}`] = { ...freeSlot };
      }
    }
  }
  return out;
}

const DAYS = ["Sun 15", "Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20", "Sat 21"];

/** The grid cell for a column index (0 = first day) and a row label. */
function cell(dayIndex: number, rowLabel: string, rowOffset = 0): HTMLElement {
  const label = screen.getByText(rowLabel);
  let row = label.closest("tr")!;
  for (let i = 0; i < rowOffset; i++) row = row.nextElementSibling as HTMLTableRowElement;
  return row.querySelectorAll("td")[dayIndex + 1] as HTMLElement;
}

describe("EquipmentBookingGrid on the business clock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts the grid on the business today and highlights it", () => {
    render(
      <EquipmentBookingGrid slotsByDay={slotsFor(DAYS)} onSelectSlots={jest.fn()} />
    );
    const headers = Array.from(document.querySelectorAll("thead th")).slice(1);
    expect(headers.map((h) => h.textContent)).toEqual(DAYS.map((d) => d.replace(" ", "")));
    expect(headers[0].className).toContain("bg-indigo-100");
    expect(screen.getByRole("tab").textContent).toBe("Nov 15-21");
  });

  it("submits the real instant of the clicked 10:00 cell", () => {
    const onSelectSlots = jest.fn();
    render(<EquipmentBookingGrid slotsByDay={slotsFor(DAYS)} onSelectSlots={onSelectSlots} />);

    fireEvent.click(cell(1, "10:00 AM"));

    expect(onSelectSlots).toHaveBeenLastCalledWith([
      "2026-11-16T16:00:00.000Z|2026-11-16T16:30:00.000Z",
    ]);
    expect(cell(1, "10:00 AM").className).toContain("bg-green-500");
  });

  it("treats a cell as past by the business clock", () => {
    const onSelectSlots = jest.fn();
    render(<EquipmentBookingGrid slotsByDay={slotsFor(DAYS)} onSelectSlots={onSelectSlots} />);

    // 00:30 today has passed at 01:00; 01:30 has not.
    fireEvent.click(cell(0, "12:00 AM", 1));
    expect(onSelectSlots).not.toHaveBeenCalled();

    fireEvent.click(cell(0, "1:00 AM", 1));
    expect(onSelectSlots).toHaveBeenLastCalledWith([
      "2026-11-15T07:30:00.000Z|2026-11-15T08:00:00.000Z",
    ]);
  });

  it("applies level 3 hours as business hours", () => {
    const onSelectSlots = jest.fn();
    const hours = { start: 9, end: 17, closed: false };
    render(
      <EquipmentBookingGrid
        slotsByDay={slotsFor(DAYS)}
        onSelectSlots={onSelectSlots}
        userRoleLevel={3}
        level3Restrictions={{
          Sunday: hours,
          Monday: hours,
          Tuesday: hours,
          Wednesday: hours,
          Thursday: hours,
          Friday: hours,
          Saturday: hours,
        }}
      />
    );

    fireEvent.click(cell(1, "9:00 AM"));
    expect(onSelectSlots).toHaveBeenLastCalledWith([
      "2026-11-16T15:00:00.000Z|2026-11-16T15:30:00.000Z",
    ]);
  });

  it("blocks a planned closure stored as UTC instants at its business time", () => {
    const onSelectSlots = jest.fn();
    render(
      <EquipmentBookingGrid
        slotsByDay={slotsFor(DAYS)}
        onSelectSlots={onSelectSlots}
        userRoleLevel={3}
        plannedClosures={[
          // Mon 16, 12:00 to 14:00 business
          { id: 1, startDate: "2026-11-16T18:00:00.000Z", endDate: "2026-11-16T20:00:00.000Z" },
        ]}
      />
    );

    expect(cell(1, "12:00 PM").className).toContain("bg-orange-300");
    expect(cell(1, "1:00 PM", 1).className).toContain("bg-orange-300");
    expect(cell(1, "2:00 PM").className).not.toContain("bg-orange-300");
    expect(cell(1, "11:00 AM", 1).className).not.toContain("bg-orange-300");
  });
});
