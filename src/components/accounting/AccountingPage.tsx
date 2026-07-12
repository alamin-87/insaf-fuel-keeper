import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountingService } from "@/services/accounting.service";
import { voucherSchema } from "@/utils/validators";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { LedgerEntry, Voucher } from "@/types";
import { z } from "zod";
import { useT } from "@/i18n";

type FormValues = z.infer<typeof voucherSchema>;

export function AccountingPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: ledger = [] } = useQuery({ queryKey: ["ledger"], queryFn: accountingService.listLedger });
  const { data: vouchers = [] } = useQuery({ queryKey: ["vouchers"], queryFn: accountingService.listVouchers });
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: { type: "payment", account: "cash", amount: 0 },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) => accountingService.createVoucher(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("accounting.posted"));
      reset({ type: "payment", account: "cash", amount: 0, partyName: "", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cashBook = ledger.filter((e) => e.account === "cash");
  const bankBook = ledger.filter((e) => e.account === "bank");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("accounting.title")}
        description={t("accounting.desc")}
        actions={<Button onClick={() => setOpen((v) => !v)}>{open ? t("common.close") : t("accounting.newVoucher")}</Button>}
      />

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit((v) => create.mutate(v))} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("common.type")}</Label>
                <Select value={watch("type")} onValueChange={(v) => setValue("type", v as FormValues["type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">{t("accounting.paymentVoucher")}</SelectItem>
                    <SelectItem value="receipt">{t("accounting.receiptVoucher")}</SelectItem>
                    <SelectItem value="journal">{t("accounting.journalEntry")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.account")}</Label>
                <Select value={watch("account")} onValueChange={(v) => setValue("account", v as FormValues["account"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("common.cash")}</SelectItem>
                    <SelectItem value="bank">{t("common.bank")}</SelectItem>
                    <SelectItem value="cheque">{t("common.cheque")}</SelectItem>
                    <SelectItem value="mobile">{t("common.mobileBanking")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.amount")}</Label>
                <Input type="number" step="0.01" {...register("amount")} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.party")}</Label>
                <Input {...register("partyName")} placeholder={`${t("common.customer")} / ${t("common.supplier")}`} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("common.notes")}</Label>
                <Input {...register("notes")} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={isSubmitting || create.isPending}>{t("accounting.postVoucher")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="vouchers">
        <TabsList>
          <TabsTrigger value="vouchers">{t("accounting.vouchers")}</TabsTrigger>
          <TabsTrigger value="cash">{t("accounting.cashBook")}</TabsTrigger>
          <TabsTrigger value="bank">{t("accounting.bankBook")}</TabsTrigger>
        </TabsList>
        <TabsContent value="vouchers">
          <DataTable<Voucher>
            rows={vouchers}
            searchKeys={["voucherNo", "partyName", "notes"]}
            dateKey="date"
            columns={[
              { key: "no", header: t("accounting.voucherNo"), sortable: true, sortValue: (r) => r.voucherNo, render: (r) => <span className="font-mono text-xs">{r.voucherNo}</span> },
              { key: "date", header: t("common.date"), sortable: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
              { key: "type", header: t("common.type"), sortable: true, sortValue: (r) => r.type, render: (r) => r.type },
              { key: "account", header: t("common.account"), sortable: true, sortValue: (r) => r.account, render: (r) => r.account },
              { key: "party", header: t("common.party"), render: (r) => r.partyName ?? "—" },
              { key: "amount", header: t("common.amount"), sortable: true, sortValue: (r) => r.amount, render: (r) => formatCurrency(r.amount), className: "text-right" },
            ]}
          />
        </TabsContent>
        <TabsContent value="cash">
          <LedgerTable rows={cashBook} />
        </TabsContent>
        <TabsContent value="bank">
          <LedgerTable rows={bankBook} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LedgerTable({ rows }: { rows: LedgerEntry[] }) {
  const t = useT();
  return (
    <DataTable<LedgerEntry>
      rows={rows}
      searchKeys={["notes", "category"]}
      dateKey="date"
      columns={[
        { key: "date", header: t("common.date"), sortable: true, sortValue: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "cat", header: t("accounting.category"), sortable: true, sortValue: (r) => r.category, render: (r) => r.category },
        { key: "dir", header: t("accounting.dir"), sortable: true, sortValue: (r) => r.direction, render: (r) => r.direction },
        { key: "amount", header: t("common.amount"), sortable: true, sortValue: (r) => r.amount, render: (r) => formatCurrency(r.amount), className: "text-right" },
        { key: "notes", header: t("common.notes"), render: (r) => r.notes ?? "—" },
      ]}
    />
  );
}
