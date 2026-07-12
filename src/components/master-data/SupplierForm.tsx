import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supplierService } from "@/services/supplier.service";
import { supplierSchema } from "@/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";

type FormValues = z.infer<typeof supplierSchema>;

export function SupplierForm({ id }: { id?: string }) {
  const mode = id ? "edit" : "create";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => supplierService.get(id!),
    enabled: !!id,
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(supplierSchema),
    values: existing
      ? {
          name: existing.name,
          phone: existing.phone,
          email: existing.email ?? "",
          address: existing.address,
          gstin: existing.gstin ?? "",
          openingBalance: existing.openingBalance,
        }
      : undefined,
    defaultValues: { openingBalance: 0, email: "", gstin: "" },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      mode === "edit" ? supplierService.update(id!, v as never) : supplierService.create(v as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(mode === "edit" ? "Supplier updated" : "Supplier saved");
      navigate({ to: id ? "/suppliers/$id" : "/suppliers", params: id ? { id } : undefined });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (id && isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (id && !existing) return <div className="p-6 text-sm text-destructive">Supplier not found.</div>;

  return (
    <div>
      <PageHeader title={mode === "create" ? "New Supplier" : "Edit Supplier"} />
      <Card><CardContent className="pt-6">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 md:grid-cols-2">
          <Row label="Name" error={errors.name?.message}><Input {...register("name")} /></Row>
          <Row label="Phone" error={errors.phone?.message}><Input {...register("phone")} /></Row>
          <Row label="Email" error={errors.email?.message}><Input type="email" {...register("email")} /></Row>
          <Row label="GSTIN"><Input {...register("gstin")} /></Row>
          <Row label="Address" error={errors.address?.message} className="md:col-span-2"><Input {...register("address")} /></Row>
          <Row label="Opening Payable"><Input type="number" step="0.01" {...register("openingBalance")} /></Row>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: id ? "/suppliers/$id" : "/suppliers", params: id ? { id } : undefined })}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mode === "edit" ? "Update Supplier" : "Save Supplier"}
            </Button>
          </div>
        </form>
      </CardContent></Card>
    </div>
  );
}

function Row({ label, error, children, className = "" }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
