import { afterEach, expect, it, vi } from "vitest";
import { tabularRolloutEnabled } from "./tabular-rollout";

afterEach(() => vi.unstubAllEnvs());

it("keeps live paid generation closed unless the server explicitly enables it", () => {
  vi.stubEnv("GCLOUD_PROJECT", "incagen-eeef4"); vi.stubEnv("FUNCTIONS_EMULATOR", "false");
  for (const value of ["", "false", "1", "TRUE"]) {
    vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", value);
    expect(tabularRolloutEnabled()).toBe(false);
  }
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "true");
  expect(tabularRolloutEnabled()).toBe(true);
});

it("does not treat a real project as an isolated demo when an emulator flag leaks", () => {
  vi.stubEnv("GCLOUD_PROJECT", "incagen-eeef4"); vi.stubEnv("FUNCTIONS_EMULATOR", "true");
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "false");
  expect(tabularRolloutEnabled()).toBe(false);
});

it("allows the isolated demo flow without exposing a cloud provider", () => {
  vi.stubEnv("GCLOUD_PROJECT", "demo-incagen"); vi.stubEnv("FUNCTIONS_EMULATOR", "true");
  vi.stubEnv("INCAGEN_TABULAR_ANALYSIS_ENABLED", "false");
  expect(tabularRolloutEnabled()).toBe(true);
});
