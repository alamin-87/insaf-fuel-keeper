import { createFileRoute } from "@tanstack/react-router";
import { SupplierReturnForm } from "@/components/supplier-return/SupplierReturnForm";

export const Route = createFileRoute("/suppliers/returns/new")({
  head: () => ({ meta: [{ title: "New Suppliers Return · Insaf Gas Corp" }] }),
  component: SupplierReturnForm,
});
