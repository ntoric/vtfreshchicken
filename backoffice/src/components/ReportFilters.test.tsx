import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportFilters, type ReportFiltersValue } from "@/components/ReportFilters";

describe("ReportFilters", () => {
  let onChange: ReturnType<typeof vi.fn>;
  let value: ReportFiltersValue;

  beforeEach(() => {
    onChange = vi.fn();
    value = {};
  });

  it("renders date presets when dateRange is true (default)", () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    expect(screen.getByText("Quick range:")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("All time")).toBeInTheDocument();
  });

  it("hides date presets when dateRange is false", () => {
    render(<ReportFilters value={value} onChange={onChange} dateRange={false} />);
    expect(screen.queryByText("Quick range:")).not.toBeInTheDocument();
  });

  it("renders search input when search is true", () => {
    render(<ReportFilters value={value} onChange={onChange} search searchPlaceholder="Find products" />);
    expect(screen.getByPlaceholderText("Find products")).toBeInTheDocument();
  });

  it("does not render search input by default", () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    expect(screen.queryByPlaceholderText("Search…")).not.toBeInTheDocument();
  });

  it("renders select dropdowns with options", () => {
    render(
      <ReportFilters
        value={value}
        onChange={onChange}
        selects={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("calls onChange when selecting a status", async () => {
    render(
      <ReportFilters
        value={value}
        onChange={onChange}
        selects={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
            ],
          },
        ]}
      />,
    );
    const select = screen.getByDisplayValue("Status");
    await userEvent.selectOptions(select, "active");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("calls onChange when selecting empty option (clears status)", async () => {
    value = { status: "active" };
    render(
      <ReportFilters
        value={value}
        onChange={onChange}
        selects={[
          {
            key: "status",
            label: "Status",
            options: [{ value: "active", label: "Active" }],
          },
        ]}
      />,
    );
    const select = screen.getByDisplayValue("Active");
    await userEvent.selectOptions(select, "");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("calls onChange when setting a date range via inputs", async () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    const dateInputs = screen.getAllByDisplayValue("");
    // First date input is "from", second is "to"
    fireEvent.change(dateInputs[0], { target: { value: "2024-01-01" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: "2024-01-01" }));
  });

  it("debounces search input changes", async () => {
    vi.useFakeTimers();
    render(<ReportFilters value={value} onChange={onChange} search />);
    const input = screen.getByPlaceholderText("Search…");
    fireEvent.change(input, { target: { value: "hello" } });
    // onChange should not be called immediately
    expect(onChange).not.toHaveBeenCalled();
    // Advance past the debounce delay (350ms)
    vi.advanceTimersByTime(400);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "hello" }));
    vi.useRealTimers();
  });

  it("search input updates clear to undefined", async () => {
    vi.useFakeTimers();
    value = { search: "old" };
    render(<ReportFilters value={value} onChange={onChange} search />);
    const input = screen.getByDisplayValue("old");
    fireEvent.change(input, { target: { value: "" } });
    vi.advanceTimersByTime(400);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }));
    vi.useRealTimers();
  });

  it("shows Clear filters button when filters are active", () => {
    value = { from: "2024-01-01" };
    render(<ReportFilters value={value} onChange={onChange} />);
    expect(screen.getByText("Clear filters")).toBeInTheDocument();
  });

  it("hides Clear filters button when no filters are active", () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("Clear filters resets all values", async () => {
    value = { from: "2024-01-01", search: "abc", status: "active" };
    render(
      <ReportFilters
        value={value}
        onChange={onChange}
        search
        selects={[{ key: "status", label: "Status", options: [] }]}
      />,
    );
    const clearBtn = screen.getByText("Clear filters");
    await userEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("All time preset clears date range", async () => {
    value = { from: "2024-01-01", to: "2024-12-31" };
    render(<ReportFilters value={value} onChange={onChange} />);
    await userEvent.click(screen.getByText("All time"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: undefined, to: undefined }));
  });

  it("Today preset sets from and to to today", async () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    await userEvent.click(screen.getByText("Today"));
    // The component sets from to midnight local time and to to end-of-day local time,
    // then converts to ISO date. We replicate the same logic to avoid timezone issues.
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      from: from.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    }));
  });

  it("Last 7 days preset sets from to 7 days ago", async () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    await userEvent.click(screen.getByText("Last 7 days"));
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: from.toISOString().slice(0, 10),
        to: today.toISOString().slice(0, 10),
      }),
    );
  });

  it("This month preset sets from to start of month", async () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    await userEvent.click(screen.getByText("This month"));
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: start.toISOString().slice(0, 10) }),
    );
  });

  it("This year preset sets from to start of year", async () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    await userEvent.click(screen.getByText("This year"));
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: start.toISOString().slice(0, 10) }),
    );
  });

  it("highlights All time preset when no date range set", () => {
    render(<ReportFilters value={value} onChange={onChange} />);
    const allTimeBtn = screen.getByText("All time");
    expect(allTimeBtn.className).toContain("bg-brand");
  });

  it("does not highlight All time preset when date range is set", () => {
    value = { from: "2024-01-01" };
    render(<ReportFilters value={value} onChange={onChange} />);
    const allTimeBtn = screen.getByText("All time");
    expect(allTimeBtn.className).not.toContain("bg-brand");
  });
});
