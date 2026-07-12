import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { productService } from "@/services/product.service";
import { productSchema } from "@/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type FormValues = z.infer<typeof productSchema>;

export function ProductForm({ id }: { id?: string }) {
  const mode = id ? "edit" : "create";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["products", id],
    queryFn: () => productService.get(id!),
    enabled: !!id,
  });

  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    values: existing
      ? {
          code: existing.code,
          name: existing.name,
          category: existing.category,
          uom: existing.uom,
          price: existing.price,
          taxRate: existing.taxRate,
          stock: existing.stock,
          reorderLevel: existing.reorderLevel,
        }
      : undefined,
    defaultValues: { category: "LPG", uom: "cyl", price: 0, taxRate: 5, stock: 0, reorderLevel: 0 },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      mode === "edit" ? productService.update(id!, v as never) : productService.create(v as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(mode === "edit" ? "Product updated" : "Product saved");
      navigate({ to: id ? "/products/$id" : "/products", params: id ? { id } : undefined });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (id && isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (id && !existing) return <div className="p-6 text-sm text-destructive">Product not found.</div>;

  return (
    <div>
      <PageHeader title={mode === "create" ? "New Product" : "Edit Product"} />
      <Card><CardContent className="pt-6">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 md:grid-cols-2">
          <Row label="Code" error={errors.code?.message}><Input {...register("code")} /></Row>
          <Row label="Name" error={errors.name?.message}><Input {...register("name")} /></Row>
          <Row label="Category">
            <Select value={watch("category")} onValueChange={(v) => setValue("category", v as FormValues["category"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["LPG", "Industrial", "Medical", "Other"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Unit of Measure">
            <Select value={watch("uom")} onValueChange={(v) => setValue("uom", v as FormValues["uom"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["kg", "cyl", "ltr", "pcs"].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Price"><Input type="number" step="0.01" {...register("price")} /></Row>
          <Row label="Tax %"><Input type="number" step="0.01" {...register("taxRate")} /></Row>
          <Row label="Stock"><Input type="number" {...register("stock")} /></Row>
          <Row label="Reorder Level"><Input type="number" {...register("reorderLevel")} /></Row>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: id ? "/products/$id" : "/products", params: id ? { id } : undefined })}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mode === "edit" ? "Update Product" : "Save Product"}
            </Button>
          </div>
        </form>
      </CardContent></Card>
    </div>
  );
}

function Row({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>{children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
