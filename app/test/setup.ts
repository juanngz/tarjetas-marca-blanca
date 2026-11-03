// Every test runs with the example café, not the active one (cafes/index.ts): the tests don't depend on any
// café's config (../../marca/README.md). The manifest and icon tests read the active one on purpose.
import { vi } from "vitest";
import { exampleCafe } from "../src/cafes/example";

vi.mock("../src/platform/currentCafe.server", () => ({ currentCafe: () => exampleCafe }));
