import { createFileRoute } from "@tanstack/react-router";
import { HrPage } from "@/components/hr/HrPage";

export const Route = createFileRoute("/hr")({
  head: () => ({ meta: [{ title: "HR & Payroll · Insaf Gas Corp" }] }),
  component: HrPage,
});
