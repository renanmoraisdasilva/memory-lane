// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CoverageMap } from "./components";

afterEach(() => {
  cleanup();
});

describe("CoverageMap", () => {
  it("groups monthly bars by year and labels each year once", () => {
    const { container } = render(
      <CoverageMap
        cells={[
          { year: 2011, month: 7, count: 10 },
          { year: 2011, month: 8, count: 5 },
          { year: 2012, month: null, count: 20 },
        ]}
      />,
    );

    expect(screen.getByText("2011")).toBeInTheDocument();
    expect(screen.getByText("2012")).toBeInTheDocument();
    expect(container.querySelector('[title="2011-07: 10 files"]')).toBeInTheDocument();
    expect(container.querySelector('[title="2011-08: 5 files"]')).toBeInTheDocument();
    expect(
      container.querySelector('[title="2012: 20 files with year-only dates"]'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('[title^="2011-"]').length).toBe(12);
  });

  it("shows the empty state without dated coverage", () => {
    render(<CoverageMap cells={[]} />);
    expect(screen.getByText("No dated verified files yet.")).toBeInTheDocument();
  });
});
