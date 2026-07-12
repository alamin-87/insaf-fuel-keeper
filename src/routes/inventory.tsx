import { createFileRoute } from "@tanstack/react-router";
import { InventoryPage } from "@/components/inventory/InventoryPage";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · Insaf Gas Corp" }] }),
  component: InventoryPage,
});
