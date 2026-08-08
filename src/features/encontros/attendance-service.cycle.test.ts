import { describe, expect, it } from "vitest";
import { nextAttendanceStatus } from "./attendance-service";

describe("attendance cycle", () => {
  it("cycles unknown to present, present to absent and absent to unknown", () => {
    expect(nextAttendanceStatus("NOT_CONFIRMED")).toBe("PRESENT");
    expect(nextAttendanceStatus("PRESENT")).toBe("ABSENT");
    expect(nextAttendanceStatus("ABSENT")).toBe("NOT_CONFIRMED");
  });
});
