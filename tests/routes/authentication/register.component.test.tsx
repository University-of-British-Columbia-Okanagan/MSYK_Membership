/**
 * @jest-environment jest-fixed-jsdom
 */

// The route module imports session.server for its loader and action, which drags in
// Prisma, bcrypt, pdf-lib and Mailgun. Only the component is under test here, so stand
// those in. The real register() is covered by tests/utils/session.register-minor.test.ts.
jest.mock("~/utils/session.server", () => ({
  register: jest.fn(),
  getUser: jest.fn(),
}));

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import RegisterRoute from "~/routes/authentication/register";

/**
 * The age gate, the guardian field and the post-error restore all live in component state,
 * so none of it is reachable from the model tests. These cases drive the real form.
 *
 * Time is frozen because every assertion is a statement about an age on a date.
 */
describe("register form - age gate, guardian field and error restore", () => {
  const TODAY = new Date("2026-09-01T12:00:00");

  /** Matches the amber 14-17 notice. */
  const GUARDIAN_NOTICE = /Makers aged 14 to 17 can create an account online/i;
  /** Matches the blocking under-14 notice. */
  const TOO_YOUNG_NOTICE = /a bit too young to register/i;

  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(TODAY);
    // userEvent needs to advance the faked clock or its internal waits never resolve.
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  /**
   * Renders the route's component inside a router stub, so its useLoaderData call resolves.
   *
   * `actionData` is passed as a prop because that is exactly how React Router hands an
   * action result to a route component. It cannot be produced by submitting the form here:
   * the form posts natively via formRef.current.submit(), which jsdom does not implement.
   */
  const renderForm = async (
    { actionData }: { actionData?: unknown } = {}
  ) => {
    const Stub = createRoutesStub([
      {
        path: "/register",
        Component: () => (
          <RegisterRoute actionData={actionData as never} />
        ),
        loader: () => ({ user: null }),
      },
    ]);
    const result = render(<Stub initialEntries={["/register"]} />);
    // The stub resolves its loader asynchronously, so nothing is on screen on the first
    // tick. Everything below queries the form, so wait for it to mount.
    await waitFor(() =>
      expect(screen.getAllByRole("combobox")).toHaveLength(3)
    );
    return result;
  };

  /** The three Date of Birth selects, in document order. */
  const dobSelects = () => {
    const selects = screen.getAllByRole("combobox");
    return { month: selects[0], day: selects[1], year: selects[2] };
  };

  const setDob = async (month: string, day: string, year: string) => {
    const { month: m, day: d, year: y } = dobSelects();
    await user.selectOptions(m, month);
    await user.selectOptions(d, day);
    await user.selectOptions(y, year);
  };

  const guardianField = () =>
    screen.queryByLabelText(/Legal Guardian's Full Name/i);

  const submitButton = () =>
    screen.getByRole("button", { name: /Create Account|Creating Account/i });

  describe("under 14 is blocked", () => {
    it("shows the blocking notice and no guardian field", async () => {
      await renderForm();
      await setDob("01", "01", "2020");

      expect(await screen.findByText(TOO_YOUNG_NOTICE)).toBeTruthy();
      expect(guardianField()).toBeNull();
      expect(screen.queryByText(GUARDIAN_NOTICE)).toBeNull();
    });

    it("disables the submit button", async () => {
      await renderForm();
      await setDob("01", "01", "2020");

      await waitFor(() => expect((submitButton() as HTMLButtonElement).disabled).toBe(true));
    });

    it("blocks someone one day short of their 14th birthday", async () => {
      await renderForm();
      await setDob("09", "02", "2012");

      expect(await screen.findByText(TOO_YOUNG_NOTICE)).toBeTruthy();
      expect(guardianField()).toBeNull();
      await waitFor(() => expect((submitButton() as HTMLButtonElement).disabled).toBe(true));
    });
  });

  describe("14 to 17 asks for a guardian", () => {
    it("shows the notice and the guardian field on the 14th birthday exactly", async () => {
      await renderForm();
      await setDob("09", "01", "2012");

      expect(await screen.findByText(GUARDIAN_NOTICE)).toBeTruthy();
      expect(guardianField()).toBeTruthy();
      expect(screen.queryByText(TOO_YOUNG_NOTICE)).toBeNull();
    });

    it("leaves the submit button enabled", async () => {
      await renderForm();
      await setDob("09", "01", "2012");

      await screen.findByText(GUARDIAN_NOTICE);
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows the field at 15", async () => {
      await renderForm();
      await setDob("03", "04", "2011");

      expect(await screen.findByText(GUARDIAN_NOTICE)).toBeTruthy();
      expect(guardianField()).toBeTruthy();
    });

    it("still shows the field at 17, one day short of 18", async () => {
      await renderForm();
      await setDob("09", "02", "2008");

      expect(await screen.findByText(GUARDIAN_NOTICE)).toBeTruthy();
      expect(guardianField()).toBeTruthy();
    });

    it("marks the guardian field as required", async () => {
      await renderForm();
      await setDob("03", "04", "2011");

      const field = await screen.findByLabelText(
        /Legal Guardian's Full Name/i
      );
      const label = field.closest("div")?.parentElement;
      expect(label?.textContent).toContain("*");
    });
  });

  describe("18 and over sees neither", () => {
    it("shows no notice and no guardian field on the 18th birthday exactly", async () => {
      await renderForm();
      await setDob("09", "01", "2008");

      await waitFor(() => {
        expect(screen.queryByText(GUARDIAN_NOTICE)).toBeNull();
      });
      expect(screen.queryByText(TOO_YOUNG_NOTICE)).toBeNull();
      expect(guardianField()).toBeNull();
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows nothing for a much older adult", async () => {
      await renderForm();
      await setDob("03", "04", "1990");

      await waitFor(() => {
        expect(screen.queryByText(GUARDIAN_NOTICE)).toBeNull();
      });
      expect(guardianField()).toBeNull();
    });
  });

  describe("moving across the boundaries", () => {
    it("swaps the blocking notice for the guardian notice when a day is added", async () => {
      await renderForm();
      await setDob("09", "02", "2012");
      expect(await screen.findByText(TOO_YOUNG_NOTICE)).toBeTruthy();

      await user.selectOptions(dobSelects().day, "01");

      expect(await screen.findByText(GUARDIAN_NOTICE)).toBeTruthy();
      expect(screen.queryByText(TOO_YOUNG_NOTICE)).toBeNull();
      expect(guardianField()).toBeTruthy();
    });

    it("drops a typed guardian name when the birthday moves to an adult one", async () => {
      await renderForm();
      await setDob("03", "04", "2011");

      const field = await screen.findByLabelText(
        /Legal Guardian's Full Name/i
      );
      await user.type(field, "Alex Guardian");
      expect((field as HTMLInputElement).value).toBe("Alex Guardian");

      await user.selectOptions(dobSelects().year, "1990");
      await waitFor(() => expect(guardianField()).toBeNull());

      // Coming back into the band must not resurrect the old value.
      await user.selectOptions(dobSelects().year, "2011");
      const again = await screen.findByLabelText(
        /Legal Guardian's Full Name/i
      );
      expect((again as HTMLInputElement).value).toBe("");
    });

    it("shows nothing at all before a birthday is chosen", async () => {
      await renderForm();

      expect(screen.queryByText(GUARDIAN_NOTICE)).toBeNull();
      expect(screen.queryByText(TOO_YOUNG_NOTICE)).toBeNull();
      expect(guardianField()).toBeNull();
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows nothing while the birthday is still incomplete", async () => {
      await renderForm();
      const { month, day } = dobSelects();
      await user.selectOptions(month, "03");
      await user.selectOptions(day, "04");

      // No year yet, so there is no date to judge.
      expect(screen.queryByText(GUARDIAN_NOTICE)).toBeNull();
      expect(screen.queryByText(TOO_YOUNG_NOTICE)).toBeNull();
    });
  });

  describe("restoring the form after a server error", () => {
    /** What the form stashes just before it posts. */
    const saveToSession = (values: Record<string, unknown>) => {
      window.sessionStorage.setItem(
        "registerFormValues",
        JSON.stringify(values)
      );
    };

    const minorValues = {
      firstName: "Robin",
      lastName: "Maker",
      email: "robin@example.com",
      password: "password",
      confirmPassword: "password",
      phone: "867-555-0100",
      dateOfBirth: "2011-03-04",
      guardianName: "Alex Guardian",
      emergencyContactName: "Sam Contact",
      emergencyContactPhone: "867-555-0101",
      emergencyContactEmail: "sam@example.com",
      mediaConsent: true,
      dataPrivacy: true,
      communityGuidelines: true,
      operationsPolicy: true,
      waiverSignature: "data:image/png;base64,abc",
    };

    const renderAfterError = async (
      values: Record<string, unknown> = minorValues,
      errors: Record<string, string[]> = {
        email: ["This email is already registered."],
      }
    ) => {
      saveToSession(values);
      return renderForm({ actionData: { errors } });
    };

    it("puts the birthday back into all three dropdowns", async () => {
      // The regression: form.reset restored dateOfBirth but the three selects kept their
      // own empty state, so the birthday looked unset while it was still being submitted.
      await renderAfterError();

      await waitFor(() => {
        expect((dobSelects().year as HTMLSelectElement).value).toBe("2011");
      });
      expect((dobSelects().month as HTMLSelectElement).value).toBe("03");
      expect((dobSelects().day as HTMLSelectElement).value).toBe("04");
    });

    it("keeps the guardian field and its value", async () => {
      await renderAfterError();

      await waitFor(() => expect(guardianField()).toBeTruthy());
      expect((guardianField() as HTMLInputElement).value).toBe(
        "Alex Guardian"
      );
    });

    it("keeps the guardian notice on screen", async () => {
      await renderAfterError();

      expect(await screen.findByText(GUARDIAN_NOTICE)).toBeTruthy();
    });

    it("re-enables the consent checkboxes so they are submitted again", async () => {
      // The blocking bug. The boxes came back ticked but disabled, and a disabled control
      // is left out of FormData, so the next submit dropped the consents and the server
      // rejected it for agreements the page was visibly showing as agreed.
      await renderAfterError();

      const boxes = await waitFor(() => {
        const found = screen.getAllByRole("checkbox");
        expect(found.length).toBeGreaterThanOrEqual(3);
        return found;
      });

      boxes.forEach((box) => {
        expect((box as HTMLButtonElement).disabled).toBe(false);
      });
    });

    it("leaves a consent gate shut when that consent was not given", async () => {
      await renderAfterError({
        ...minorValues,
        communityGuidelines: false,
      });

      await waitFor(() => {
        const disabled = screen
          .getAllByRole("checkbox")
          .filter((b) => (b as HTMLButtonElement).disabled);
        expect(disabled.length).toBe(1);
      });
    });

    it("restores an adult form without inventing a guardian field", async () => {
      await renderAfterError({
        ...minorValues,
        dateOfBirth: "1990-03-04",
        guardianName: "",
      });

      await waitFor(() => {
        expect((dobSelects().year as HTMLSelectElement).value).toBe("1990");
      });
      expect(guardianField()).toBeNull();
      expect(screen.queryByText(GUARDIAN_NOTICE)).toBeNull();
    });

    it("surfaces the server error message", async () => {
      await renderAfterError();

      expect(
        await screen.findByText(/This email is already registered/i)
      ).toBeTruthy();
    });

    it("shows the guardian error against the guardian field", async () => {
      await renderAfterError(minorValues, {
        guardianName: ["Please enter your legal guardian's full name"],
      });

      expect(
        await screen.findByText(/Please enter your legal guardian's full name/i)
      ).toBeTruthy();
    });

    it("does not fall over when the stashed values are unparseable", async () => {
      window.sessionStorage.setItem("registerFormValues", "{not json");
      await renderForm({ actionData: { errors: { email: ["nope"] } } });

      // The form still renders rather than throwing out of the restore effect.
      expect(await screen.findByText(/nope/i)).toBeTruthy();
      expect(submitButton()).toBeTruthy();
    });

    it("does not fall over when there is nothing stashed at all", async () => {
      await renderForm({ actionData: { errors: { email: ["nope"] } } });

      expect(await screen.findByText(/nope/i)).toBeTruthy();
      expect((dobSelects().year as HTMLSelectElement).value).toBe("");
    });
  });
});
