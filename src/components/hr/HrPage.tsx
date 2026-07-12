import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { hrService } from "@/services/hr.service";
import { employeeSchema } from "@/utils/validators";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { Employee, PayrollRun } from "@/types";
import { z } from "zod";
import { useT } from "@/i18n";

type EmpForm = z.infer<typeof employeeSchema>;

export function HrPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: hrService.listEmployees });
  const { data: payroll = [] } = useQuery({ queryKey: ["payroll"], queryFn: hrService.listPayroll });
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [payEmpId, setPayEmpId] = useState("");
  const [bonus, setBonus] = useState("0");
  const [allowance, setAllowance] = useState("0");
  const [deduction, setDeduction] = useState("0");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmpForm>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      joiningDate: new Date().toISOString().slice(0, 10),
      salary: 20000,
    },
  });

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
    setStatus("active");
    reset({
      name: "",
      phone: "",
      designation: "",
      department: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      salary: 20000,
    });
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setStatus(emp.status);
    setOpen(true);
    reset({
      name: emp.name,
      phone: emp.phone,
      designation: emp.designation,
      department: emp.department,
      joiningDate: emp.joiningDate.slice(0, 10),
      salary: emp.salary,
    });
  };

  const saveEmp = useMutation({
    mutationFn: (values: EmpForm) => {
      const payload = {
        ...values,
        joiningDate: new Date(values.joiningDate).toISOString(),
        status,
      };
      return editingId
        ? hrService.updateEmployee(editingId, payload)
        : hrService.createEmployee({ ...payload, status: "active" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editingId ? t("hr.employeeUpdated") : t("hr.employeeAdded"));
      closeForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEmp = useMutation({
    mutationFn: (id: string) => hrService.removeEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("hr.deleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPay = useMutation({
    mutationFn: async () => {
      const emp = employees.find((e) => e.id === payEmpId);
      if (!emp) throw new Error(t("common.select"));
      const month = new Date().toISOString().slice(0, 7);
      return hrService.createPayroll({
        employeeId: emp.id,
        employeeName: emp.name,
        month,
        basic: emp.salary,
        bonus: Number(bonus) || 0,
        allowance: Number(allowance) || 0,
        deduction: Number(deduction) || 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      toast.success(t("hr.payslipCreated"));
      setPayEmpId("");
      setBonus("0"); setAllowance("0"); setDeduction("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payRun = useMutation({
    mutationFn: (id: string) => hrService.payPayroll(id, "bank"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("hr.salaryPaid"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("hr.title")}
        description={t("hr.desc")}
        actions={
          <Button onClick={() => {
            if (open) closeForm();
            else { setEditingId(null); setOpen(true); }
          }}>
            {open ? t("common.close") : t("hr.addEmployee")}
          </Button>
        }
      />

      {open && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-sm font-semibold">{editingId ? t("hr.editEmployee") : t("hr.addEmployee")}</h3>
            <form onSubmit={handleSubmit((v) => saveEmp.mutate(v))} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label>{t("common.name")}</Label><Input {...register("name")} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
              <div className="space-y-1.5"><Label>{t("common.phone")}</Label><Input {...register("phone")} />{errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}</div>
              <div className="space-y-1.5"><Label>{t("hr.designation")}</Label><Input {...register("designation")} /></div>
              <div className="space-y-1.5"><Label>{t("hr.department")}</Label><Input {...register("department")} /></div>
              <div className="space-y-1.5"><Label>{t("hr.joiningDate")}</Label><Input type="date" {...register("joiningDate")} /></div>
              <div className="space-y-1.5"><Label>{t("hr.basicSalary")}</Label><Input type="number" {...register("salary")} /></div>
              {editingId && (
                <div className="space-y-1.5">
                  <Label>{t("common.status")}</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t("common.active")}</SelectItem>
                      <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeForm}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={isSubmitting || saveEmp.isPending}>
                  {editingId ? t("common.save") : t("hr.saveEmployee")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">{t("hr.employees")}</TabsTrigger>
          <TabsTrigger value="payroll">{t("hr.payroll")}</TabsTrigger>
        </TabsList>
        <TabsContent value="employees">
          <DataTable<Employee>
            rows={employees}
            searchKeys={["name", "employeeNo", "department"]}
            dateKey="joiningDate"
            columns={[
              { key: "no", header: t("hr.employeeId"), sortable: true, sortValue: (r) => r.employeeNo, render: (r) => <span className="font-mono text-xs">{r.employeeNo}</span> },
              { key: "name", header: t("common.name"), sortable: true, sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "des", header: t("hr.designation"), sortable: true, sortValue: (r) => r.designation, render: (r) => r.designation },
              { key: "dept", header: t("hr.department"), sortable: true, sortValue: (r) => r.department, render: (r) => r.department },
              { key: "join", header: t("hr.joined"), sortable: true, sortValue: (r) => r.joiningDate, render: (r) => formatDate(r.joiningDate) },
              { key: "sal", header: t("hr.salary"), sortable: true, sortValue: (r) => r.salary, render: (r) => formatCurrency(r.salary), className: "text-right" },
              { key: "st", header: t("common.status"), render: (r) => (
                <Badge variant={r.status === "active" ? "default" : "secondary"}>
                  {r.status === "active" ? t("common.active") : t("common.inactive")}
                </Badge>
              ) },
              {
                key: "actions",
                header: t("common.actions"),
                className: actionsColumnClass,
                render: (r) => (
                  <RowActions
                    onEdit={() => startEdit(r)}
                    onDelete={() => {
                      if (confirm(t("hr.deleteConfirm"))) removeEmp.mutate(r.id);
                    }}
                    deleteDisabled={removeEmp.isPending}
                  />
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-5">
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("hr.employee")}</Label>
                <select className="flex h-9 w-full rounded-md border bg-background px-3 text-sm" value={payEmpId} onChange={(e) => setPayEmpId(e.target.value)}>
                  <option value="">{t("common.select")}</option>
                  {employees.filter((e) => e.status === "active").map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5"><Label>{t("hr.bonus")}</Label><Input type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{t("hr.allowance")}</Label><Input type="number" value={allowance} onChange={(e) => setAllowance(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{t("hr.deduction")}</Label><Input type="number" value={deduction} onChange={(e) => setDeduction(e.target.value)} /></div>
              <div className="md:col-span-5 flex justify-end">
                <Button disabled={!payEmpId || createPay.isPending} onClick={() => createPay.mutate()}>{t("hr.createPayslip")}</Button>
              </div>
            </CardContent>
          </Card>
          <DataTable<PayrollRun>
            rows={payroll}
            searchKeys={["employeeName", "month"]}
            dateKey={(r) => r.paidAt ?? `${r.month}-01`}
            columns={[
              { key: "month", header: t("hr.month"), sortable: true, sortValue: (r) => r.month, render: (r) => r.month },
              { key: "name", header: t("hr.employee"), sortable: true, sortValue: (r) => r.employeeName, render: (r) => r.employeeName },
              { key: "basic", header: t("hr.basic"), sortable: true, sortValue: (r) => r.basic, render: (r) => formatCurrency(r.basic), className: "text-right" },
              { key: "net", header: t("hr.net"), sortable: true, sortValue: (r) => r.net, render: (r) => formatCurrency(r.net), className: "text-right" },
              { key: "st", header: t("common.status"), render: (r) => (
                <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                  {t(`status.${r.status}` as any)}
                </Badge>
              ) },
              {
                key: "actions",
                header: t("common.actions"),
                className: actionsColumnClass,
                render: (r) => r.status === "draft" ? (
                  <Button size="sm" disabled={payRun.isPending} onClick={(e) => { e.stopPropagation(); payRun.mutate(r.id); }}>{t("hr.pay")}</Button>
                ) : <span className="text-xs text-muted-foreground">{r.paidAt ? formatDate(r.paidAt) : "—"}</span>,
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
