import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sale } from "@/lib/types";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { prepare: vi.fn() } }));
vi.mock("@/lib/inventoryClient", () => ({
  apiFetch: vi.fn(),
  getInventoryConfig: vi.fn(),
}));
// El PDF real tarda y no dice nada: lo que hay que aseverar es *que datos* se le
// entregan al documento, asi que el render se intercepta y se inspecciona.
vi.mock("@react-pdf/renderer", () => ({
  Document: "Document",
  Page: "Page",
  Text: "Text",
  View: "View",
  StyleSheet: { create: <T,>(styles: T) => styles },
  renderToBuffer: vi.fn(),
}));

import { auth } from "@/auth";
import db from "@/lib/db";
import { apiFetch } from "@/lib/inventoryClient";
import { renderToBuffer } from "@react-pdf/renderer";
import { GET } from "./route";

const mockAuth = vi.mocked(auth);
const mockApiFetch = vi.mocked(apiFetch);
const mockRenderToBuffer = vi.mocked(renderToBuffer);
const mockPrepare = vi.mocked(db.prepare);

const SALE_ID = "11111111-1111-4111-8111-111111111111";

const session = {
  user: { id: "staff-1", name: "Bob", role: "staff", organizationId: "org-1" },
};

const serviceSale = {
  id: SALE_ID,
  locationId: "loc-1",
  status: "completed",
  actorRef: "staff-1",
  createdAt: "2026-07-20T10:00:00.000Z",
  total: "350.00",
  items: [
    {
      productId: "prod-1",
      quantity: 2,
      unitPrice: "100.00",
      lineTotal: "200.00",
    },
    {
      productId: "prod-2",
      quantity: 1,
      unitPrice: "150.00",
      lineTotal: "150.00",
    },
  ],
};

function request() {
  return new Request(`http://localhost/api/invoices/${SALE_ID}`);
}

function context(saleId = SALE_ID) {
  return { params: Promise.resolve({ saleId }) };
}

function renderedSale(): Sale {
  const element = mockRenderToBuffer.mock.calls[0][0] as unknown as {
    props: { sale: Sale };
  };
  return element.props.sale;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(session as never);
  mockPrepare.mockReturnValue({
    all: vi.fn().mockReturnValue([{ id: "staff-1", name: "Bob" }]),
  } as never);
  mockRenderToBuffer.mockResolvedValue(Buffer.from("%PDF-1.4"));
  process.env.STORE_NAME = "Tienda";
  process.env.TAX_RATE = "0.1";
});

describe("GET /api/invoices/[saleId]", () => {
  it("answers 401 without a session and never asks the service for the sale", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });

  it("answers 404 for a sale of another organization", async () => {
    mockApiFetch.mockResolvedValue({
      error: "Sale not found",
      code: "not_found",
      status: 404,
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(404);
    expect(mockApiFetch).toHaveBeenCalledWith(`/sales/${SALE_ID}`);
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });

  it("builds the PDF from the service response, not from the request", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === `/sales/${SALE_ID}`) return serviceSale;
      if (path === "/products/prod-1") return { id: "prod-1", name: "Café" };
      if (path === "/products/prod-2") return { id: "prod-2", name: "Azúcar" };
      return { error: "unexpected path" };
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(renderedSale()).toEqual({
      id: SALE_ID,
      createdAt: "2026-07-20T10:00:00.000Z",
      staffId: "staff-1",
      staffName: "Bob",
      items: [
        {
          productId: "prod-1",
          productName: "Café",
          quantity: 2,
          unitPrice: 100,
          lineTotal: 200,
        },
        {
          productId: "prod-2",
          productName: "Azúcar",
          quantity: 1,
          unitPrice: 150,
          lineTotal: 150,
        },
      ],
      subtotal: 350,
      total: 350,
    });
  });

  it("ignores a sale posted in the request body", async () => {
    mockApiFetch.mockImplementation(async (path: string) =>
      path === `/sales/${SALE_ID}`
        ? serviceSale
        : { id: "prod-1", name: "Café" }
    );

    const body = new FormData();
    body.set(
      "sale",
      JSON.stringify({ ...serviceSale, total: "0.01", items: [] })
    );
    const forged = new Request(`http://localhost/api/invoices/${SALE_ID}`, {
      method: "POST",
      body,
    });

    const response = await GET(forged, context());

    expect(response.status).toBe(200);
    expect(renderedSale().total).toBe(350);
    expect(renderedSale().items).toHaveLength(2);
  });

  it("answers 502 when the inventory service fails", async () => {
    mockApiFetch.mockResolvedValue({
      error: "HTTP 500",
      code: "service_error",
      status: 500,
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(502);
    expect(mockRenderToBuffer).not.toHaveBeenCalled();
  });
});
