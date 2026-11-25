import { afterEach, expect, it, vi } from "vitest";
import { tabularAnalysisAccess } from "./tabular-rollout";

afterEach(() => vi.unstubAllEnvs());

it("requires the exact production flag and an explicit beta claim", () => {
  vi.stubEnv("GCLOUD_PROJECT", "incagen-eeef4");
  vi.stubEnv("FUNCTIONS_EMULATOR", "false");
  for (const value of ["", "false", "1", "TRUE"]) {
    vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", value);
    expect(tabularAnalysisAccess(true)).toBe("closed");
  }
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "true");
  for (const claim of [undefined, null, false, "true", 1, { incagenDeveloper: true }]) {
    expect(tabularAnalysisAccess(claim)).toBe("invite-required");
  }
  expect(tabularAnalysisAccess(true)).toBe("available");
});

it("applies real access policy if an emulator flag leaks into production", () => {
  vi.stubEnv("GCLOUD_PROJECT", "incagen-eeef4");
  vi.stubEnv("FUNCTIONS_EMULATOR", "true");
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "false");
  expect(tabularAnalysisAccess(true)).toBe("closed");
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "true");
  expect(tabularAnalysisAccess()).toBe("invite-required");
});

it("keeps the isolated demo usable with no real beta claim or provider", () => {
  vi.stubEnv("GCLOUD_PROJECT", "demo-incagen");
  vi.stubEnv("FUNCTIONS_EMULATOR", "true");
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "false");
  expect(tabularAnalysisAccess()).toBe("available");
});
