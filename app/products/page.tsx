import InventoryDashboard from "./InventoryDashboard";

type Props = {
  searchParams: Promise<{ added?: string }>;
};

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const added = params.added === "1";

  return (
    <div className="flex flex-col h-full">
      <InventoryDashboard added={added} />
    </div>
  );
}
