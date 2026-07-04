import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import type { Sale, SaleItem } from "@/lib/types";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", color: "#111827" },
  storeName: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  invoiceLabel: { fontSize: 12, color: "#6b7280", marginBottom: 24 },
  metaSection: { marginBottom: 16 },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaKey: { fontSize: 10, color: "#6b7280", width: 80 },
  metaVal: { fontSize: 10, flex: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 16 },
  tableHead: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    marginBottom: 4,
  },
  thCell: { fontSize: 9, fontWeight: "bold", color: "#6b7280" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tdCell: { fontSize: 10 },
  colName: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 2, textAlign: "right" },
  colLine: { flex: 2, textAlign: "right" },
  totalsSection: { marginTop: 20, alignItems: "flex-end" },
  totalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginBottom: 4,
  },
  totalLabel: { fontSize: 10, color: "#6b7280" },
  totalValue: { fontSize: 10 },
  grandRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 8,
    marginTop: 4,
  },
  grandLabel: { fontSize: 13, fontWeight: "bold" },
  grandValue: { fontSize: 13, fontWeight: "bold" },
});

interface InvoiceProps {
  sale: Sale;
  storeName: string;
  taxRate: number;
}

function InvoiceDocument({ sale, storeName, taxRate }: InvoiceProps) {
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const tax = sale.subtotal * taxRate;
  const grandTotal = sale.subtotal + tax;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.storeName}>{storeName}</Text>
        <Text style={styles.invoiceLabel}>Invoice #{sale.id}</Text>

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Date</Text>
            <Text style={styles.metaVal}>
              {dateStr} at {timeStr}
            </Text>
          </View>
          {sale.staffName ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Staff</Text>
              <Text style={styles.metaVal}>{sale.staffName}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Table header */}
        <View style={styles.tableHead}>
          <Text style={[styles.thCell, styles.colName]}>Product</Text>
          <Text style={[styles.thCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.thCell, styles.colUnit]}>Unit Price</Text>
          <Text style={[styles.thCell, styles.colLine]}>Total</Text>
        </View>

        {/* Line items */}
        {sale.items.map((item, idx) => (
          <View key={idx} style={styles.tableRow}>
            <Text style={[styles.tdCell, styles.colName]}>{item.productName}</Text>
            <Text style={[styles.tdCell, styles.colQty]}>{item.quantity}</Text>
            <Text style={[styles.tdCell, styles.colUnit]}>
              ${item.unitPrice.toFixed(2)}
            </Text>
            <Text style={[styles.tdCell, styles.colLine]}>
              ${item.lineTotal.toFixed(2)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${sale.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Tax ({(taxRate * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.totalValue}>${tax.toFixed(2)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>${grandTotal.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

function parseSale(raw: string, saleId: string): Sale | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.id !== saleId) return null;
  if (!Array.isArray(d.items)) return null;

  const items: SaleItem[] = [];
  for (const item of d.items) {
    if (typeof item !== "object" || item === null) return null;
    const i = item as Record<string, unknown>;
    if (
      typeof i.productId !== "string" ||
      typeof i.productName !== "string" ||
      typeof i.quantity !== "number" ||
      typeof i.unitPrice !== "number" ||
      typeof i.lineTotal !== "number"
    ) {
      return null;
    }
    items.push({
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    });
  }

  if (
    typeof d.id !== "string" ||
    typeof d.createdAt !== "string" ||
    typeof d.staffId !== "string" ||
    typeof d.subtotal !== "number" ||
    typeof d.total !== "number"
  ) {
    return null;
  }

  return {
    id: d.id,
    createdAt: d.createdAt,
    staffId: d.staffId,
    staffName: typeof d.staffName === "string" ? d.staffName : undefined,
    items,
    subtotal: d.subtotal,
    total: d.total,
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ saleId: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { saleId } = await context.params;

  const formData = await request.formData();
  const raw = formData.get("sale");
  if (typeof raw !== "string") {
    return new NextResponse("Missing sale data", { status: 400 });
  }

  const sale = parseSale(raw, saleId);
  if (!sale) {
    return new NextResponse("Invalid sale data", { status: 400 });
  }

  const storeName = process.env.STORE_NAME ?? "Store";
  const taxRate = parseFloat(process.env.TAX_RATE ?? "0");

  const buffer = await renderToBuffer(
    <InvoiceDocument sale={sale} storeName={storeName} taxRate={taxRate} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${saleId}.pdf"`,
    },
  });
}
