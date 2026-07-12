import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { salesService } from "@/services/sales.service";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { PaymentMethod, SalesStatus } from "@/types";

export function InvoiceView({ id }: { id: string }) {
  const qc = useQueryClient();
  const { data: order, isLoading, isFetched } = useQuery({
    queryKey: ["sales", id],
    queryFn: () => salesService.get(id),
  });
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["sales", id] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const pay = useMutation({
    mutationFn: (n: number) => salesService.recordPayment(id, n, method),
    onSuccess: () => {
      invalidate();
      toast.success("Payment recorded");
      setAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (status: SalesStatus) => salesService.setStatus(id, status),
    onSuccess: (_, status) => {
      invalidate();
      toast.success(`Status → ${status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convert = useMutation({
    mutationFn: () => salesService.convertQuotation(id),
    onSuccess: () => {
      invalidate();
      toast.success("Quotation converted to sales order");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (isFetched && !order) return <div className="p-6 text-sm text-destructive">Order not found.</div>;
  if (!order) return null;

  const due = order.total - order.paid;
  const busy = pay.isPending || setStatus.isPending || convert.isPending;

  return (
    <div>
      <PageHeader
        title={`${order.status === "draft" ? "Quotation" : "Invoice"} ${order.orderNo}`}
        description={`Issued to ${order.customerName} on ${formatDate(order.date)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/deliveries/new" search={{ salesOrderId: order.id }}>Create Delivery</Link>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">Insaf Gas Corp</h2>
              <p className="text-xs text-muted-foreground">Industrial · Medical · LPG</p>
            </div>
            <Badge>{order.status}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Bill To</p>
              <p className="font-medium">{order.customerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Invoice #</p>
              <p className="font-mono">{order.orderNo}</p>
            </div>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {order.items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{it.productName}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.price)}</TableCell>
                  <TableCell className="text-right">{it.taxRate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(it.price * it.quantity * (1 + it.taxRate / 100))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <Line label="Subtotal" value={formatCurrency(order.subtotal)} />
              <Line label="Tax" value={formatCurrency(order.tax)} />
              <Line label="Total" value={formatCurrency(order.total)} bold />
              <Line label="Paid" value={formatCurrency(order.paid)} />
              <Line label="Due" value={formatCurrency(due)} bold />
            </div>
          </div>
        </CardContent></Card>

        <div className="space-y-4">
          <Card><CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">Workflow</h3>
            {order.status === "draft" && (
              <Button className="w-full" disabled={busy} onClick={() => convert.mutate()}>
                Convert to Sales Order
              </Button>
            )}
            {order.status === "confirmed" && (
              <Button className="w-full" disabled={busy} onClick={() => setStatus.mutate("invoiced")}>
                Mark Invoiced
              </Button>
            )}
            {(order.status === "confirmed" || order.status === "invoiced") && (
              <Button className="w-full" variant="destructive" disabled={busy} onClick={() => setStatus.mutate("cancelled")}>
                Cancel Order
              </Button>
            )}
            {order.status === "draft" && (
              <Button className="w-full" variant="outline" disabled={busy} onClick={() => setStatus.mutate("cancelled")}>
                Cancel Quotation
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Confirming an order deducts stock. Cancelling restores it.
            </p>
          </CardContent></Card>

          <Card><CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">Record Payment</h3>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={due <= 0 || order.status === "cancelled"} />
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={due <= 0 || order.status === "cancelled"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!amount || Number(amount) <= 0 || due <= 0 || pay.isPending || order.status === "cancelled"}
              onClick={() => pay.mutate(Number(amount))}
            >
              {due <= 0 ? "Fully Paid" : "Record Payment"}
            </Button>
            <p className="text-xs text-muted-foreground">Payments post to the cash/bank ledger for live KPIs.</p>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t pt-1 font-semibold" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
