import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cylinderService } from "@/services/cylinder.service";
import { productService } from "@/services/product.service";
import { cylinderSchema } from "@/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useT } from "@/i18n";

type FormValues = z.infer<typeof cylinderSchema>;

export function CylinderForm({ id }: { id?: string }) {
  const t = useT();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });
  const { data: existing, isLoading } = useQuery({
    queryKey: ["cylinders", id],
    queryFn: () => cylinderService.get(id!),
    enabled: editing,
  });

  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(cylinderSchema),
    values: existing
      ? {
          serialNumber: existing.serialNumber,
          productId: existing.productId,
          capacity: existing.capacity,
          status: existing.status,
          location: existing.location,
        }
      : undefined,
    defaultValues: { status: "in_stock", location: "Warehouse A", capacity: 0 },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      editing
        ? cylinderService.update(id!, {
            ...v,
            lastMovementAt: existing?.lastMovementAt ?? new Date().toISOString(),
          } as never)
        : cylinderService.create(v as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cylinders"] });
      toast.success(editing ? t("cylinders.updated") : t("cylinders.new"));
      navigate({ to: editing ? "/cylinders/$id" : "/cylinders", params: editing ? { id: id! } : undefined });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (editing && isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (editing && !existing) return <div className="p-6 text-sm text-destructive">{t("cylinders.notFound")}</div>;

  return (
    <div>
      <PageHeader title={editing ? t("cylinders.edit") : t("cylinders.new")} />
      <Card><CardContent className="pt-6">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 md:grid-cols-2">
          <Row label={t("cylinders.serial")} error={errors.serialNumber?.message}><Input {...register("serialNumber")} /></Row>
          <Row label={t("common.product")}>
            <Select value={watch("productId")} onValueChange={(v) => setValue("productId", v)}>
              <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("cylinders.capacity")}><Input type="number" step="0.01" {...register("capacity")} /></Row>
          <Row label={t("common.status")}>
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["in_stock", "at_customer", "in_transit", "refilling", "damaged", "lost"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{t(`status.${s}` as any)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={t("cylinders.location")} error={errors.location?.message} className="md:col-span-2">
            <Input {...register("location")} />
          </Row>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: editing ? "/cylinders/$id" : "/cylinders", params: editing ? { id: id! } : undefined })}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>{t("common.save")}</Button>
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
