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

type FormValues = z.infer<typeof cylinderSchema>;

export function CylinderForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productService.list });

  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(cylinderSchema),
    defaultValues: { status: "in_stock", location: "Warehouse A", capacity: 0 },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) => cylinderService.create(v as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cylinders"] });
      toast.success("Cylinder registered");
      navigate({ to: "/cylinders" });
    },
  });

  return (
    <div>
      <PageHeader title="Register Cylinder" />
      <Card><CardContent className="pt-6">
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 md:grid-cols-2">
          <Row label="Serial Number" error={errors.serialNumber?.message}><Input {...register("serialNumber")} /></Row>
          <Row label="Product">
            <Select value={watch("productId")} onValueChange={(v) => setValue("productId", v)}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Capacity"><Input type="number" step="0.01" {...register("capacity")} /></Row>
          <Row label="Status">
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["in_stock", "at_customer", "in_transit", "refilling", "damaged"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="Location" error={errors.location?.message} className="md:col-span-2">
            <Input {...register("location")} />
          </Row>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/cylinders" })}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>Register</Button>
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
