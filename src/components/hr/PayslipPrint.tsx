import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/common/BrandLogo";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { PayrollRun } from "@/types";
import { useT } from "@/i18n";
import { Printer } from "lucide-react";

export function PayslipPrint({ run, open, onOpenChange }: { run: PayrollRun | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  if (!run) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0">
        <DialogHeader className="print:hidden flex flex-row items-center justify-between">
          <DialogTitle>{t("hr.payslip") || "Payslip"}</DialogTitle>
          <Button variant="outline" size="sm" className="mr-4" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("common.print")}
          </Button>
        </DialogHeader>

        {/* The printable area */}
        <div className="p-6 bg-white text-black space-y-6 print:p-0">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <BrandLogo size="lg" />
              <div>
                <h2 className="text-xl font-bold">{t("brand.name")}</h2>
                <p className="text-xs text-muted-foreground">{t("brand.tagline")}</p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-800">PAYSLIP</h1>
              <p className="text-sm font-medium mt-1">Month: {run.month}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 font-semibold mb-1">Employee Details</p>
              <p className="font-medium text-lg">{run.employeeName}</p>
              <p>Status: {t(`status.${run.status}` as any) || run.status}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 font-semibold mb-1">Payment Info</p>
              <p>Date: {run.paidAt ? formatDate(run.paidAt) : "—"}</p>
              <p>Method: {run.paymentMethod ? (t(`common.${run.paymentMethod}` as any) || run.paymentMethod) : "—"}</p>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden mt-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b text-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Earnings</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold border-l">Deductions</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-800">
                <tr>
                  <td className="px-4 py-2">{t("hr.basic")}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(run.basic)}</td>
                  <td className="px-4 py-2 border-l">{t("hr.deduction")}</td>
                  <td className="px-4 py-2 text-right text-red-600">{run.deduction > 0 ? formatCurrency(run.deduction) : "—"}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">{t("hr.bonus")}</td>
                  <td className="px-4 py-2 text-right">{run.bonus > 0 ? formatCurrency(run.bonus) : "—"}</td>
                  <td className="px-4 py-2 border-l"></td>
                  <td className="px-4 py-2 text-right"></td>
                </tr>
                <tr>
                  <td className="px-4 py-2">{t("hr.allowance")}</td>
                  <td className="px-4 py-2 text-right">{run.allowance > 0 ? formatCurrency(run.allowance) : "—"}</td>
                  <td className="px-4 py-2 border-l"></td>
                  <td className="px-4 py-2 text-right"></td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t">
                <tr>
                  <td className="px-4 py-3 text-right">Gross Earnings</td>
                  <td className="px-4 py-3 text-right text-green-700">{formatCurrency(run.basic + run.bonus + run.allowance)}</td>
                  <td className="px-4 py-3 text-right border-l">Total Deductions</td>
                  <td className="px-4 py-3 text-right text-red-700">{formatCurrency(run.deduction)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <div className="w-64 border-t-2 border-gray-800 pt-2">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Net Pay</span>
                <span>{formatCurrency(run.net)}</span>
              </div>
            </div>
          </div>
          
          <div className="pt-16 pb-8 flex justify-between px-8">
            <div className="border-t border-gray-400 w-40 text-center pt-2 text-sm">Employer Signature</div>
            <div className="border-t border-gray-400 w-40 text-center pt-2 text-sm">Employee Signature</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
