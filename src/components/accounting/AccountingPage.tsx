import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountingService } from "@/services/accounting.service";
import { customerService } from "@/services/customer.service";
import { supplierService } from "@/services/supplier.service";
import { voucherSchema } from "@/utils/validators";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RowActions, actionsColumnClass } from "@/components/common/RowActions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountsTab } from "./AccountsTab";
import { ChartOfAccountsTab } from "./ChartOfAccountsTab";
import { AssetsTab } from "./AssetsTab";
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
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: accountingService.listAccounts });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: customerService.list });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: supplierService.list });
  const { data: coa = [] } = useQuery({ queryKey: ["coa"], queryFn: accountingService.listCoa });
  const [open, setOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string>("all");

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(voucherSchema),
    defaultValues: { type: "payment", account: "cash", amount: 0, partyType: undefined, partyId: "", partyName: "", drAccount: "", crAccount: "", notes: "" },
  });

  const voucherType = watch("type");
  const partyType = watch("partyType");

  const create = useMutation({
    mutationFn: (values: FormValues) => accountingService.createVoucher(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("accounting.posted"));
      reset({ type: "payment", account: "cash", amount: 0, partyType: undefined, partyId: "", partyName: "", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeVoucher = useMutation({
    mutationFn: (id: string) => accountingService.removeVoucher(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vouchers"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("accounting.voided"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cashBook = ledger.filter((e) => e.account === "cash");
  const bankBook = ledger.filter((e) => e.account !== "cash" && (selectedBank === "all" || e.account === selectedBank));

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
              {voucherType === "journal" ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Dr. Account</Label>
                    <Select value={watch("drAccount") || ""} onValueChange={(v) => setValue("drAccount", v)}>
                      <SelectTrigger><SelectValue placeholder="Select Debit" /></SelectTrigger>
                      <SelectContent>
                        {coa.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        <SelectItem value="cash">{t("common.cash")}</SelectItem>
                        <SelectItem value="bank">{t("common.bank")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cr. Account</Label>
                    <Select value={watch("crAccount") || ""} onValueChange={(v) => setValue("crAccount", v)}>
                      <SelectTrigger><SelectValue placeholder="Select Credit" /></SelectTrigger>
                      <SelectContent>
                        {coa.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        <SelectItem value="cash">{t("common.cash")}</SelectItem>
                        <SelectItem value="bank">{t("common.bank")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t("common.account")}</Label>
                  <Select value={watch("account")} onValueChange={(v) => setValue("account", v as FormValues["account"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t("common.cash")}</SelectItem>
                      <SelectItem value="bank">{t("common.bank")}</SelectItem>
                      <SelectItem value="cheque">{t("common.cheque")}</SelectItem>
                      <SelectItem value="mobile">{t("common.mobileBanking")}</SelectItem>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t("common.amount")}</Label>
                <Input type="number" step="0.01" {...register("amount")} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t("common.party")}</Label>
                <div className="flex gap-2">
                  <Select value={partyType || "other"} onValueChange={(v) => {
                    if (v === "other") {
                      setValue("partyType", undefined);
                      setValue("partyId", "");
                    } else {
                      setValue("partyType", v as "customer" | "supplier");
                      setValue("partyId", "");
                      setValue("partyName", "");
                    }
                  }}>
                    <SelectTrigger className="w-1/3"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{t("common.customer")}</SelectItem>
                      <SelectItem value="supplier">{t("common.supplier")}</SelectItem>
                      <SelectItem value="other">Other / Manual</SelectItem>
                    </SelectContent>
                  </Select>

                  {partyType === "customer" ? (
                    <Select value={watch("partyId")} onValueChange={(v) => {
                      setValue("partyId", v);
                      const c = customers.find(x => x.id === v);
                      if (c) setValue("partyName", c.name);
                    }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                      <SelectContent>
                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : partyType === "supplier" ? (
                    <Select value={watch("partyId")} onValueChange={(v) => {
                      setValue("partyId", v);
                      const s = suppliers.find(x => x.id === v);
                      if (s) setValue("partyName", s.name);
                    }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="flex-1" {...register("partyName")} placeholder={t("common.name")} />
                  )}
                </div>
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
          <TabsTrigger value="accounts">{t("accounting.accounts")}</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
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
              { key: "account", header: t("common.account"), sortable: true, sortValue: (r) => r.account, render: (r) => r.type === "journal" ? `Dr: ${r.drAccount} | Cr: ${r.crAccount}` : r.account },
              { key: "party", header: t("common.party"), render: (r) => r.partyName ?? "—" },
              { key: "amount", header: t("common.amount"), sortable: true, sortValue: (r) => r.amount, render: (r) => formatCurrency(r.amount), className: "text-right" },
              {
                key: "actions",
                header: t("common.actions"),
                className: actionsColumnClass,
                render: (r) => (
                  <RowActions
                    onDelete={() => {
                      if (confirm(t("accounting.voidConfirm"))) removeVoucher.mutate(r.id);
                    }}
                    deleteDisabled={removeVoucher.isPending}
                  />
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="cash">
          <LedgerTable rows={cashBook} />
        </TabsContent>
        <TabsContent value="bank">
          <div className="mb-4 w-64">
            <Select value={selectedBank} onValueChange={setSelectedBank}>
              <SelectTrigger><SelectValue placeholder="All Banks & Mobile" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks & Mobile</SelectItem>
                <SelectItem value="bank">{t("common.bank")}</SelectItem>
                <SelectItem value="cheque">{t("common.cheque")}</SelectItem>
                <SelectItem value="mobile">{t("common.mobileBanking")}</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LedgerTable rows={bankBook} />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsTab />
        </TabsContent>
        <TabsContent value="coa">
          <ChartOfAccountsTab />
        </TabsContent>
        <TabsContent value="assets">
          <AssetsTab />
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
        { key: "acc", header: t("common.account"), sortable: true, sortValue: (r) => r.account, render: (r) => r.account },
        { key: "cat", header: t("accounting.category"), sortable: true, sortValue: (r) => r.category, render: (r) => r.category },
        { key: "dir", header: t("accounting.dir"), sortable: true, sortValue: (r) => r.direction, render: (r) => r.direction },
        { key: "amount", header: t("common.amount"), sortable: true, sortValue: (r) => r.amount, render: (r) => formatCurrency(r.amount), className: "text-right" },
        { key: "notes", header: t("common.notes"), render: (r) => r.notes ?? "—" },
      ]}
    />
  );
}
