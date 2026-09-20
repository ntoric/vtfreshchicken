import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "@/components/ExportDialog";
import { AuthProvider } from "@/lib/auth";
import type { ExportJob } from "@/types";

// Mock the API module
vi.mock("@/lib/api", () => ({
  api: {
    estimateExportSize: vi.fn(),
    createExport: vi.fn(),
    getExport: vi.fn(),
    downloadExport: vi.fn(),
  },
}));

import { api } from "@/lib/api";

// Mock useAuth to provide a tenant
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ tenant: "demo", user: { id: "u1", email: "a@b.c" } }),
}));

function makeJob(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: "job-1",
    tenant_id: "t1",
    user_id: "u1",
    type: "orders",
    format: "csv",
    filters: {},
    email: "",
    status: "pending",
    file_size: 0,
    rows_total: 0,
    rows_done: 0,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ExportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.estimateExportSize).mockResolvedValue({ type: "orders", estimated_rows: 100 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ExportDialog open={false} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows title and description when open", async () => {
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);
    expect(screen.getByText("Export Orders")).toBeInTheDocument();
    expect(screen.getByText(/Generate a CSV file/)).toBeInTheDocument();
  });

  it("estimates export size on open", async () => {
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{ status: "paid" }} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(api.estimateExportSize).toHaveBeenCalledWith("demo", expect.objectContaining({ type: "orders", status: "paid" }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Estimated rows:/)).toBeInTheDocument();
    });
  });

  it("shows CSV format selector (disabled)", () => {
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);
    const select = screen.getByDisplayValue("CSV (Comma-separated values)");
    expect(select).toBeDisabled();
  });

  it("shows email field as optional for small exports", async () => {
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/optional/)).toBeInTheDocument();
    });
  });

  it("requires email for large exports (>5000 rows)", async () => {
    vi.mocked(api.estimateExportSize).mockResolvedValue({ type: "orders", estimated_rows: 10000 });
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/required/)).toBeInTheDocument();
    });
    expect(screen.getByText(/This is a large export/i)).toBeInTheDocument();
  });

  it("validates email format on create", async () => {
    vi.mocked(api.estimateExportSize).mockResolvedValue({ type: "orders", estimated_rows: 10000 });
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/required/)).toBeInTheDocument());

    const emailInput = screen.getByPlaceholderText("you@example.com");
    await userEvent.type(emailInput, "invalid-email");
    const createBtn = screen.getByText("Create Export");
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(api.createExport).not.toHaveBeenCalled();
  });

  it("requires email for large exports on create", async () => {
    vi.mocked(api.estimateExportSize).mockResolvedValue({ type: "orders", estimated_rows: 10000 });
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/required/)).toBeInTheDocument());

    const createBtn = screen.getByText("Create Export");
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/enter an email/i)).toBeInTheDocument();
    });
    expect(api.createExport).not.toHaveBeenCalled();
  });

  it("creates export job with email for large export", async () => {
    vi.mocked(api.estimateExportSize).mockResolvedValue({ type: "orders", estimated_rows: 10000 });
    vi.mocked(api.createExport).mockResolvedValue(makeJob({ status: "pending", rows_total: 10000 }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/required/)).toBeInTheDocument());
    const emailInput = screen.getByPlaceholderText("you@example.com");
    await userEvent.type(emailInput, "user@example.com");
    await userEvent.click(screen.getByText("Create Export"));

    await waitFor(() => {
      expect(api.createExport).toHaveBeenCalledWith("demo", expect.objectContaining({
        type: "orders",
        format: "csv",
        email: "user@example.com",
      }));
    });
  });

  it("creates export job without email for small export", async () => {
    vi.mocked(api.createExport).mockResolvedValue(makeJob({ status: "pending", rows_total: 100 }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Create Export")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Create Export"));

    await waitFor(() => {
      expect(api.createExport).toHaveBeenCalledWith("demo", expect.objectContaining({
        email: undefined,
      }));
    });
  });

  it("shows pending state after job creation", async () => {
    vi.mocked(api.createExport).mockResolvedValue(makeJob({ status: "pending" }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await userEvent.click(screen.getByText("Create Export"));
    await waitFor(() => {
      expect(screen.getByText(/Queued/i)).toBeInTheDocument();
    });
  });

  it("shows running state with progress bar", async () => {
    vi.mocked(api.createExport).mockResolvedValue(makeJob({
      status: "running",
      rows_total: 100,
      rows_done: 50,
    }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await userEvent.click(screen.getByText("Create Export"));
    await waitFor(() => {
      expect(screen.getByText(/Processing/i)).toBeInTheDocument();
      expect(screen.getByText(/50 \/ 100/)).toBeInTheDocument();
    });
  });

  it("shows completed state with download button", async () => {
    vi.mocked(api.createExport).mockResolvedValue(makeJob({
      status: "completed",
      rows_total: 100,
      rows_done: 100,
      file_name: "export.csv",
      file_size: 2048,
    }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await userEvent.click(screen.getByText("Create Export"));
    await waitFor(() => {
      expect(screen.getByText("Export completed")).toBeInTheDocument();
      expect(screen.getByText("Download CSV")).toBeInTheDocument();
    });
  });

  it("calls downloadExport when download button clicked", async () => {
    vi.mocked(api.createExport).mockResolvedValue(makeJob({
      status: "completed",
      rows_total: 10,
      rows_done: 10,
      file_name: "export.csv",
    }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await userEvent.click(screen.getByText("Create Export"));
    await waitFor(() => expect(screen.getByText("Download CSV")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Download CSV"));

    await waitFor(() => {
      expect(api.downloadExport).toHaveBeenCalledWith("demo", "job-1", "export.csv");
    });
  });

  it("shows email confirmation when completed with email", async () => {
    vi.mocked(api.estimateExportSize).mockResolvedValue({ type: "orders", estimated_rows: 100 });
    vi.mocked(api.createExport).mockResolvedValue(makeJob({
      status: "completed",
      rows_total: 100,
      rows_done: 100,
      email: "user@example.com",
      file_name: "export.csv",
    }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Create Export")).toBeInTheDocument());
    await userEvent.click(screen.getByText("Create Export"));

    await waitFor(() => {
      expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
    });
  });

  it("shows failed state with error message", async () => {
    vi.mocked(api.createExport).mockResolvedValue(makeJob({
      status: "failed",
      error: "Database timeout",
    }));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await userEvent.click(screen.getByText("Create Export"));
    await waitFor(() => {
      expect(screen.getByText("Export failed")).toBeInTheDocument();
      expect(screen.getByText("Database timeout")).toBeInTheDocument();
    });
  });

  it("shows Create Export error when API fails", async () => {
    vi.mocked(api.createExport).mockRejectedValue(new Error("Network error"));
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={vi.fn()} />);

    await userEvent.click(screen.getByText("Create Export"));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<ExportDialog open={true} type="orders" title="Orders" filters={{}} onClose={onClose} />);
    // Click the X close button (top right)
    const closeBtn = screen.getByRole("button", { name: "" });
    // The X button — find by the svg's parent button
    const buttons = screen.getAllByRole("button");
    // First button is the X close button
    await userEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
