import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import ReactPDF from "@react-pdf/renderer";
import React from "react";
import type { Sale } from "@/lib/types";

const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF;

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ saleId: string }> }
) {
  const session = await auth();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { saleId } = await context.params;

  const apiUrl = process.env.INVENTORY_API_URL ?? "";
  const apiKey = process.env.INVENTORY_API_KEY ?? "";

  let sale: Sale;
  try {
    const res = await fetch(
      `${apiUrl}/sales/${encodeURIComponent(saleId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    if (!res.ok) {
      const status = res.status === 404 ? 404 : 502;
      return new NextResponse("Sale not found", { status });
    }
    sale = (await res.json()) as Sale;
  } catch {
    return new NextResponse("Failed to fetch sale", { status: 502 });
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
