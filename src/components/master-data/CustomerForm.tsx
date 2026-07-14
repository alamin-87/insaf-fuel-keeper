import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { customerService } from "@/services/customer.service";
import { customerSchema } from "@/utils/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { useT } from "@/i18n";

type FormValues = z.infer<typeof customerSchema>;

export function CustomerForm({ id }: { id?: string }) {
  const t = useT();
  const mode = id ? "edit" : "create";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => customerService.get(id!),
    enabled: !!id,
  });

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(customerSchema),
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
    mutationFn: (values: FormValues) =>
      mode === "edit"
        ? customerService.update(id!, {
            ...values,
            email: values.email || undefined,
            gstin: values.gstin || undefined,
            openingBalance: Number(values.openingBalance) || 0,
          })
        : customerService.create({
            ...values,
            email: values.email || undefined,
            gstin: values.gstin || undefined,
            openingBalance: Number(values.openingBalance) || 0,
          } as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      if (id) qc.invalidateQueries({ queryKey: ["customers", id] });
      toast.success(mode === "edit" ? t("customers.updated") : t("customers.created"));
      navigate({ to: id ? "/customers/$id" : "/customers", params: id ? { id } : undefined });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (id && isLoading) return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (id && !existing) return <div className="p-6 text-sm text-destructive">{t("customers.notFound")}</div>;

  return (
    <div>
      <PageHeader title={mode === "create" ? t("customers.new") : t("customers.edit")} backTo={id ? { to: "/customers/$id", params: { id } } : "/customers"} />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 md:grid-cols-2">
            <Field label={t("common.name")} error={errors.name?.message}><Input {...register("name")} /></Field>
            <Field label={t("common.phone")} error={errors.phone?.message}><Input {...register("phone")} /></Field>
            <Field label={t("common.email")} error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
            <Field label={t("customers.gstin")}><Input {...register("gstin")} /></Field>
            <Field label={t("common.address")} error={errors.address?.message} className="md:col-span-2"><Input {...register("address")} /></Field>
            <Field label={t("customers.openingBal")} error={errors.openingBalance?.message}>
              <Input type="number" step="0.01" {...register("openingBalance", { valueAsNumber: true })} />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => navigate({ to: id ? "/customers/$id" : "/customers", params: id ? { id } : undefined })}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label, error, children, className = "",
}: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
