import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { hrService } from "@/services/hr.service";
import { employeeSchema } from "@/utils/validators";
import { PageHeader } from "@/components/common/PageHeader";
import { DetailOrOutlet } from "@/components/common/DetailOrOutlet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { useT } from "@/i18n";

type EmpForm = z.infer<typeof employeeSchema>;

export const Route = createFileRoute("/hr/$id")({
  head: () => ({ meta: [{ title: "Employee · Insaf Gas Corp" }] }),
  component: EmployeeDetail,
});

function EmployeeDetail() {
  return (
    <DetailOrOutlet>
      <EmployeeDetailBody />
    </DetailOrOutlet>
  );
}

function EmployeeDetailBody() {
  const t = useT();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const {
    data: e,
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: ["employees", id],
    queryFn: () => hrService.getEmployee(id),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmpForm>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    if (!e) return;
    setStatus(e.status);
    reset({
      name: e.name,
      phone: e.phone,
      designation: e.designation,
      department: e.department,
      joiningDate: e.joiningDate.slice(0, 10),
      salary: e.salary,
    });
  }, [e, reset]);

  const save = useMutation({
    mutationFn: (values: EmpForm) =>
      hrService.updateEmployee(id, {
        ...values,
        joiningDate: new Date(values.joiningDate).toISOString(),
        status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees", id] });
      toast.success(t("hr.employeeUpdated"));
      setEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => hrService.removeEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("hr.deleted"));
      navigate({ to: "/hr" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading)
    return <div className="p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (isFetched && !e)
    return <div className="p-6 text-sm text-destructive">{t("hr.notFound")}</div>;
  if (!e) return null;

  return (
    <div>
      <PageHeader
        title={e.name}
        description={`${e.employeeNo} · ${e.designation}`}
        backTo="/hr"
        backLabel={t("hr.title")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing((v) => !v)}>
              <Pencil className="mr-1 h-4 w-4" /> {editing ? t("common.close") : t("common.edit")}
            </Button>
            <Button asChild>
              <Link to="/hr/$id/statement" params={{ id }}>
                <FileText className="mr-1 h-4 w-4" /> {t("hr.statement")}
              </Link>
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(t("hr.deleteConfirm"))) remove.mutate();
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> {t("common.delete")}
            </Button>
          </div>
        }
      />

      {editing && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">{t("hr.editEmployee")}</h3>
            <form
              onSubmit={handleSubmit((v) => save.mutate(v))}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-1.5">
                <Label>{t("common.name")}</Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.phone")}</Label>
                <Input {...register("phone")} />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("hr.designation")}</Label>
                <Input {...register("designation")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("hr.department")}</Label>
                <Input {...register("department")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("hr.joiningDate")}</Label>
                <Input type="date" {...register("joiningDate")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("hr.basicSalary")}</Label>
                <Input type="number" {...register("salary")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.status")}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("common.active")}</SelectItem>
                    <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting || save.isPending}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-2">
          <Info label={t("hr.employeeId")} value={e.employeeNo} />
          <Info label={t("common.phone")} value={e.phone} />
          <Info label={t("hr.designation")} value={e.designation} />
          <Info label={t("hr.department")} value={e.department} />
          <Info label={t("hr.joiningDate")} value={formatDate(e.joiningDate)} />
          <Info label={t("hr.basicSalary")} value={formatCurrency(e.salary)} />
          <div>
            <p className="text-xs uppercase text-muted-foreground">{t("common.status")}</p>
            <Badge variant={e.status === "active" ? "default" : "secondary"} className="mt-1">
              {e.status === "active" ? t("common.active") : t("common.inactive")}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
