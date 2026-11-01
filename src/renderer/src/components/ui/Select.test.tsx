// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

afterEach(() => {
  cleanup();
});

describe("Select", () => {
  it("opens a styled listbox and selects an option", async () => {
    const onChange = vi.fn();
    render(
      <>
        <label htmlFor="goal">Goal</label>
        <Select
          id="goal"
          value="partial"
          onChange={onChange}
          options={[
            { value: "partial", label: "Partial coverage", description: "Fill gaps" },
            { value: "full", label: "Full copy", description: "Every source file" },
          ]}
        />
      </>,
    );

    const trigger = screen.getByLabelText("Goal");
    expect(trigger).toHaveTextContent("Partial coverage");
    await userEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeVisible();
    await userEvent.click(screen.getByRole("option", { name: /Full copy/ }));
    expect(onChange).toHaveBeenCalledWith("full");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and escape", async () => {
    const onChange = vi.fn();
    render(
      <Select
        id="goal"
        value="partial"
        onChange={onChange}
        options={[
          { value: "partial", label: "Partial coverage" },
          { value: "full", label: "Full copy" },
        ]}
      />,
    );

    const trigger = screen.getByRole("button");
    trigger.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("full");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not bubble escape to an outer dialog handler", async () => {
    const outer = vi.fn();
    document.addEventListener("keydown", outer);
    try {
      render(
        <Select
          id="goal"
          value="partial"
          onChange={vi.fn()}
          options={[
            { value: "partial", label: "Partial coverage" },
            { value: "full", label: "Full copy" },
          ]}
        />,
      );
      await userEvent.click(screen.getByRole("button"));
      await userEvent.keyboard("{Escape}");
      expect(outer).not.toHaveBeenCalled();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    } finally {
      document.removeEventListener("keydown", outer);
    }
  });
});
