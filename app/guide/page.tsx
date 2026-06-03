export default function GuidePage() {
  return (
    <div className="p-4 pb-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          App Guide
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          How to use the Store Inventory app
        </p>
      </div>

      <Section
        step="1"
        color="green"
        title="Scan & Sell"
        subtitle="Main daily workflow"
        icon={
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M7 13v6a2 2 0 002 2h6a2 2 0 002-2v-6M9 21h6" />
        }
      >
        <Steps
          items={[
            { label: "Open the Sell tab" },
            {
              label: "Choose scan mode",
              detail:
                "Camera — tap the camera button and point at the barcode. Physical scanner — switch to Scanner mode and scan with your USB/Bluetooth device.",
            },
            {
              label: "Items appear in the cart",
              detail:
                "Each scan adds 1 unit. Tap + / − to adjust quantity. Swipe left or tap the trash icon to remove an item.",
            },
            {
              label: "Tap Confirm Sale",
              detail:
                "Stock is deducted automatically. A success message appears.",
            },
            {
              label: "Download the invoice",
              detail: "Tap View Invoice to download the PDF receipt.",
            },
          ]}
        />
        <Tip>
          If a product shows &quot;Out of stock&quot; it won&apos;t be added. Adjust stock
          first (see step 4).
        </Tip>
      </Section>

      <Section
        step="2"
        color="blue"
        title="Product List"
        subtitle="View and search inventory"
        icon={
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        }
      >
        <Steps
          items={[
            { label: "Open the Products tab" },
            {
              label: "Search by name or barcode",
              detail: "Type in the search box to filter the list instantly.",
            },
            {
              label: "Read the stock badge",
              detail:
                "Green = more than 10 units · Amber = 1–10 units · Red = out of stock.",
            },
            {
              label: "Tap Adjust Stock",
              detail: "Each product card has a quick link to the adjustment screen.",
            },
          ]}
        />
        <Tip>Pull down or tap the refresh button to sync the latest stock from the server.</Tip>
      </Section>

      <Section
        step="3"
        color="purple"
        title="Add Product"
        subtitle="Register a new product — admin only"
        icon={
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        }
      >
        <Steps
          items={[
            {
              label: "Open the Add Product tab",
              detail: "Only visible to admin accounts.",
            },
            {
              label: "Fill in the details",
              detail:
                "Name, Barcode (or tap the scan icon to scan it), Price, and Initial Stock are required.",
            },
            { label: "Tap Add Product to save" },
          ]}
        />
        <Tip>
          The barcode field doubles as the SKU identifier shown in the product list.
        </Tip>
      </Section>

      <Section
        step="4"
        color="amber"
        title="Stock Adjustment"
        subtitle="Correct stock after counts or deliveries"
        icon={
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        }
      >
        <Steps
          items={[
            { label: "Open the Adjust Stock tab" },
            {
              label: "Find the product",
              detail: "Scan its barcode or search by name.",
            },
            {
              label: "Enter the delta",
              detail:
                "Positive number (+10) to add stock. Negative (−3) to reduce it. Use the + / − stepper or type directly.",
            },
            {
              label: "Pick a reason",
              detail: "Restock · Shrinkage · Correction · Other.",
            },
            { label: "Tap Apply Adjustment" },
          ]}
        />
        <Tip>Stock can&apos;t go below 0. The app will block the adjustment if the delta would result in negative stock.</Tip>
      </Section>

      <Section
        step="5"
        color="rose"
        title="Sales History"
        subtitle="Review past transactions"
        icon={
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        }
      >
        <Steps
          items={[
            { label: "Open the History tab" },
            {
              label: "Filter by date range",
              detail: "Set a start and end date to narrow the list.",
            },
            {
              label: "Filter by staff member",
              detail: "Select a name from the dropdown to see their sales only.",
            },
            {
              label: "Tap a sale to expand it",
              detail: "Shows each item, quantities, and line totals.",
            },
            {
              label: "Download Invoice",
              detail: "Each sale has a button to download its PDF receipt.",
            },
          ]}
        />
      </Section>

      <div className="rounded-2xl bg-zinc-100 dark:bg-zinc-800 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Quick reference
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Sell tab", "Scan & checkout"],
            ["Products tab", "Browse inventory"],
            ["Add Product tab", "New product (admin)"],
            ["Adjust Stock tab", "Fix stock levels"],
            ["History tab", "Past sales & invoices"],
          ].map(([tab, desc]) => (
            <div key={tab} className="col-span-1">
              <p className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">{tab}</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Internal components ---

const colorMap = {
  green: {
    badge: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    icon: "text-green-600 dark:text-green-400",
    border: "border-green-200 dark:border-green-800",
  },
  blue: {
    badge: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    icon: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  purple: {
    badge: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    icon: "text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
  },
  amber: {
    badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    icon: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
  },
  rose: {
    badge: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    icon: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-800",
  },
};

function Section({
  step,
  color,
  title,
  subtitle,
  icon,
  children,
}: {
  step: string;
  color: keyof typeof colorMap;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl border ${c.border} bg-white dark:bg-zinc-900 overflow-hidden`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${c.badge}`}>
          {step}
        </span>
        <svg className={`w-5 h-5 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {icon}
        </svg>
        <div>
          <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{title}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Steps({ items }: { items: { label: string; detail?: string }[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-semibold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.label}</p>
            {item.detail && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl px-3 py-2">
      <svg className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{children}</p>
    </div>
  );
}
