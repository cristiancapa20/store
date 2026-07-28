import { NextResponse } from "next/server";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { getSale } from "@/lib/actions";
import type { ActionErrorCode, Sale } from "@/lib/types";

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

// A sale that belongs to another organization is a 404, never a 403: the service
// answers 404 for it, and turning that into a 403 here would confirm the id
// exists. Anything else the service says is a gateway failure, not the caller's.
const STATUS_BY_CODE: Partial<Record<ActionErrorCode, number>> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ saleId: string }> }
) {
  const { saleId } = await context.params;

  // The amounts come from the service and only from the service: the invoice is
  // the store's word about what it charged, so nothing on it may originate in
  // the browser that asked for it.
  const sale = await getSale(saleId);
  if ("error" in sale) {
    const status = (sale.code && STATUS_BY_CODE[sale.code]) ?? 502;
    return new NextResponse(sale.error, { status });
  }

  const storeName = process.env.STORE_NAME ?? "Store";
  const taxRate = parseFloat(process.env.TAX_RATE ?? "0");

  const buffer = await renderToBuffer(
    <InvoiceDocument sale={sale} storeName={storeName} taxRate={taxRate} />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // El nombre sale del id que devolvio el servicio, no del de la URL: ese
      // llega sin validar y acabaria dentro de una cabecera.
      "Content-Disposition": `attachment; filename="invoice-${sale.id}.pdf"`,
    },
  });
}
