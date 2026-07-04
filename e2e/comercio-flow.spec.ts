import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";
import path from "path";

/**
 * Golden-path e2e: register a brand-new comercio (isolated by its own
 * organization_id) and exercise the core flows against it in a single
 * session. Each run uses a unique email/store name so it never touches
 * pre-existing organizations (e.g. real dev data). A teardown step removes
 * the local SQLite rows this test creates; it cannot un-provision the
 * org/location it creates in the Inventory Service, since that service has
 * no delete endpoint used here.
 *
 * This is one `test()` block (not several) because each Playwright test
 * gets its own isolated browser context by default — splitting this into
 * separate tests would drop the session cookie from registration and every
 * later step would bounce to /login.
 */

const runId = Date.now();
const email = `e2e-${runId}@example.com`;
const storeName = `E2E Store ${runId}`;
const password = "testpass123";
const productName = `E2E Producto ${runId}`;
const productSku = `E2E-${runId}`;
const staffEmail = `e2e-staff-${runId}@example.com`;

test("Golden path: comercio -> producto -> venta -> historial -> staff", async ({
  page,
}) => {
  await test.step("registra un nuevo comercio y entra a /sell", async () => {
    await page.goto("/register");
    await page.locator("#storeName").fill(storeName);
    await page.locator("#ownerName").fill("E2E Owner");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: "Crear cuenta gratis" }).click();
    await expect(page).toHaveURL(/\/sell/, { timeout: 20_000 });
  });

  await test.step("agrega un producto nuevo y aparece en el inventario", async () => {
    await page.goto("/products/new");
    await page.getByPlaceholder("Nombre del producto").fill(productName);
    await page.getByPlaceholder("SKU o código de barras").fill(productSku);
    await page.locator('input[type="number"]').nth(0).fill("9.99");
    await page.locator('input[type="number"]').nth(1).fill("20");
    await page.getByRole("button", { name: "Agregar Producto" }).click();

    await expect(page).toHaveURL(/\/products\?added=1/, { timeout: 20_000 });
    // Both a desktop table row and a mobile card render the product name.
    await expect(page.getByText(productName).first()).toBeVisible();
  });

  await test.step("ajusta el stock del producto", async () => {
    await page.goto("/adjust");
    await page
      .getByPlaceholder("O buscar por nombre / SKU…")
      .fill(productName);
    await page.getByText(productName).first().click();

    await page.getByRole("button", { name: "Aumentar" }).click();
    await page.getByRole("button", { name: "Aumentar" }).click();
    await page.getByRole("button", { name: "Aumentar" }).click();
    await page.getByRole("button", { name: "Aplicar Ajuste" }).click();

    await expect(page.getByText("Stock actualizado a 23")).toBeVisible({
      timeout: 10_000,
    });
  });

  await test.step("crea una venta del producto y descarga la factura", async () => {
    await page.goto("/sell");
    await page
      .getByPlaceholder("Buscar producto por nombre o SKU…")
      .fill(productName);
    await page.getByText(productName).first().click();
    await page.getByRole("button", { name: "Ver Factura" }).click();
    await page.getByRole("button", { name: "Generar Factura" }).click();

    await expect(page.getByText("¡Venta confirmada!")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("link", { name: "Descargar Factura (PDF)" })
    ).toBeVisible();
  });

  await test.step("la venta aparece en el historial", async () => {
    // The history table lists invoices (id, date, total), not line items, so
    // the product name never appears here — match on the invoice total
    // instead. This org is freshly isolated, so it's the only sale so far.
    await page.goto("/history");
    await expect(page.getByText("Facturas Emitidas")).toBeVisible();
    await expect(page.getByText("$9.99", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  await test.step("agrega y elimina un empleado", async () => {
    await page.goto("/staff");
    await page.getByRole("button", { name: "Agregar" }).click();
    await page.locator("#name").fill("E2E Empleado");
    await page.locator("#email").fill(staffEmail);
    await page.locator("#password").fill("staffpass123");
    await page.getByRole("button", { name: "Guardar empleado" }).click();

    await expect(page.getByText(staffEmail)).toBeVisible({ timeout: 10_000 });

    await page
      .locator("div", { has: page.getByText(staffEmail) })
      .getByRole("button", { name: "Eliminar" })
      .click();
    await expect(page.getByText(staffEmail)).not.toBeVisible({
      timeout: 10_000,
    });
  });
});

test.afterAll(() => {
  // Clean up the organization/users this run created so repeated e2e runs
  // don't accumulate rows in the local dev database. This does not remove
  // the corresponding organization/location provisioned in the Inventory
  // Service (no delete endpoint is used here) — those remain as orphans.
  const dbPath = path.join(process.cwd(), "data", "store.db");
  const db = new Database(dbPath);
  try {
    const org = db
      .prepare("SELECT id FROM organizations WHERE email = ?")
      .get(email) as { id: string } | undefined;
    if (org) {
      db.prepare("DELETE FROM users WHERE organization_id = ?").run(org.id);
      db.prepare("DELETE FROM organizations WHERE id = ?").run(org.id);
    }
  } finally {
    db.close();
  }
});
