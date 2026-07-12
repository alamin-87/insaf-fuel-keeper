import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { expenseService } from "@/services/expense.service";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { Expense } from "@/types";

const schema = z.object({
  category: z.string().min(2, "Category required"),
  description: z.string().min(2, "Description required"),
  amount: z.coerce.number().min(1, "Amount required"),
  paymentMethod: z.enum(["cash", "bank"]),
});

type FormValues = z.infer<typeof schema>;

export function ExpenseList() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["expenses"], queryFn: expenseService.list });
  const [open, setOpen] = useState(false);

  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { paymentMethod: "cash", amount: 0 },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      expenseService.create({
        ...values,
        date: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense recorded");
      reset({ paymentMethod: "cash", amount: 0, category: "", description: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => expenseService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description="Cash and bank outflows feed live dashboard KPIs."
        actions={
          <Button onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Record Expense"}
          </Button>
        }
      />

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit((v) => create.mutate(v))} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input {...register("category")} placeholder="Transport, Utilities…" />
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" {...register("amount")} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Description</Label>
                <Input {...register("description")} />
                {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Paid From</Label>
                <Select value={watch("paymentMethod")} onValueChange={(v) => setValue("paymentMethod", v as "cash" | "bank")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-end">
                <Button type="submit" disabled={isSubmitting || create.isPending}>Save Expense</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <DataTable<Expense>
        rows={data}
        searchKeys={["category", "description"]}
        columns={[
          { key: "date", header: "Date", sortable: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
          { key: "category", header: "Category", sortable: true, sortValue: (r) => r.category, render: (r) => <span className="font-medium">{r.category}</span> },
          { key: "description", header: "Description", render: (r) => r.description },
          { key: "method", header: "Account", sortable: true, sortValue: (r) => r.paymentMethod, render: (r) => r.paymentMethod },
          { key: "amount", header: "Amount", sortable: true, sortValue: (r) => r.amount, className: "text-right", render: (r) => formatCurrency(r.amount) },
          {
            key: "actions",
            header: "",
            className: "w-12",
            render: (r) => (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Delete this expense?")) remove.mutate(r.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
