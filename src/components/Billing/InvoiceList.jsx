import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { CreditCard, FileText, DollarSign, AlertCircle, Plus, Search, ChevronDown, CheckCircle, Printer, ArrowLeft, Activity } from "lucide-react";
import api from "../../services/api";
import Toast from "../Toast";
import InvoiceForm from "./InvoiceForm";
import { getEntityId } from "../../utils/entityId";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { Card, CardContent } from "../ui/Card";
import usePersistentState from "../../hooks/usePersistentState";
import { resolveAssetUrl } from "../../utils/assetUrl";
import { getStoredUserObject } from "../../utils/authStorage";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 }).format(Number(value) || 0);

const formatNumber = (value) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);

function NairaIcon({ size = 18 }) {
  return (
    <span
      className="text-sm font-semibold leading-none"
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {"\u20A6"}
    </span>
  );
}

const getStatusColor = (status) => {
  const colors = { draft: "bg-slate-100 text-slate-700", issued: "bg-blue-100 text-blue-700", paid: "bg-emerald-100 text-emerald-700", overdue: "bg-rose-100 text-rose-700", cancelled: "bg-zinc-200 text-zinc-700" };
  return colors[status] || "bg-slate-100 text-slate-700";
};

function StatCard({ label, value, tone, icon: Icon }) {
  const tones = {
    blue: "bg-blue-600 text-white shadow-blue-500/20",
    emerald: "bg-emerald-600 text-white shadow-emerald-500/20",
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    rose: "bg-rose-600 text-white shadow-rose-500/20",
    slate: "bg-slate-800 text-white shadow-slate-800/20",
  };

  return (
    <Card className="border-0 shadow-md relative overflow-hidden group">
      <div className={`absolute inset-0 opacity-90 ${tones[tone] || tones.slate}`} />
      <div className="absolute -right-4 -top-4 opacity-20 transform group-hover:scale-110 transition-transform duration-500">
        <Icon size={100} className="text-white" />
      </div>
      <CardContent className="p-5 pt-6 relative z-10 text-white flex flex-col justify-start h-full min-h-[120px]">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{label}</p>
        <p className="mt-2 text-2xl lg:text-[28px] font-bold tracking-tight whitespace-nowrap truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={strong ? "font-bold text-slate-900" : "font-medium text-slate-600"}>{label}</span>
      <span className={strong ? "text-xl font-bold text-primary-600" : "font-semibold text-slate-900"}>{value}</span>
    </div>
  );
}

function PaymentReceipt({ invoice, payment, onDone }) {
  return (
    <div className="print-container mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <div className="mb-8 flex items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Payment received</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Patient Receipt</h2>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone} className="!w-auto">Back</Button>
          <Button type="button" onClick={() => window.print()} className="!w-auto">
            <Printer size={16} className="mr-2" /> Print Receipt
          </Button>
        </div>
      </div>
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Receipt number</p>
        <p className="mt-1 font-mono text-lg font-bold text-slate-900">{payment.receiptNumber}</p>
        <p className="mt-2 text-sm text-slate-500">
          {new Date(payment.receivedAt).toLocaleString()}
        </p>
      </div>
      <div className="space-y-3 border-b border-slate-200 py-5 text-sm">
        <div className="flex justify-between gap-4"><span className="text-slate-500">Patient</span><strong className="text-right text-slate-900">{invoice.patientId?.name || "Patient"}</strong></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Invoice</span><strong className="font-mono text-slate-900">{invoice.invoiceNumber}</strong></div>
        <div className="flex justify-between gap-4"><span className="text-slate-500">Method</span><strong className="capitalize text-slate-900">{String(payment.paymentMethod).replace("_", " ")}</strong></div>
        {payment.reference && <div className="flex justify-between gap-4"><span className="text-slate-500">Reference</span><strong className="break-all text-right text-slate-900">{payment.reference}</strong></div>}
        <div className="flex justify-between gap-4"><span className="text-slate-500">Received by</span><strong className="text-right text-slate-900">{payment.recordedBy?.name || "Clinic staff"}</strong></div>
      </div>
      <div className="space-y-3 py-5 text-sm">
        <SummaryRow label="Payment received" value={formatCurrency(payment.amount)} strong />
        <SummaryRow label="Invoice total" value={formatCurrency(invoice.total)} />
        <SummaryRow label="Paid to date" value={formatCurrency(invoice.amountPaid)} />
        <SummaryRow label="Remaining balance" value={formatCurrency(invoice.balance)} />
      </div>
      {payment.paymentMethod !== "cash" && (
        <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
          This receipt confirms the payment was recorded by the clinic. Electronic payments remain subject to bank or payment-provider reconciliation.
        </p>
      )}
    </div>
  );
}

function InvoiceViewer({ invoice: rawInvoice, actionParam, onClose, onPaymentReceipt }) {
  const invoice = React.useMemo(() => {
    if (actionParam === "invoice.create") {
      return {
        ...rawInvoice,
        status: "draft",
        amountPaid: 0,
        balance: rawInvoice.total,
        payments: [],
      };
    }
    if (actionParam === "invoice.issue") {
      return {
        ...rawInvoice,
        status: "issued",
        amountPaid: 0,
        balance: rawInvoice.total,
        payments: [],
      };
    }
    return rawInvoice;
  }, [rawInvoice, actionParam]);

  const storedUser = getStoredUserObject();
  const clinic = storedUser?.clinic || {};
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reversalTarget, setReversalTarget] = useState(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalLoading, setReversalLoading] = useState(false);
  const isAdmin = storedUser?.role === "admin";

  const handleCancelInvoice = async () => {
    if (cancelReason.trim().length < 5) {
      setToast({ show: true, message: "Provide a cancellation reason (at least 5 characters).", type: "error" });
      return;
    }
    setCancelLoading(true);
    try {
      await api.delete(`/invoices/${getEntityId(invoice)}`, {
        data: { reason: cancelReason.trim() },
      });
      setToast({ show: true, message: "Invoice cancelled successfully", type: "success" });
      setTimeout(() => {
        setConfirmCancelOpen(false);
        onClose();
      }, 1200);
    } catch (error) {
      setToast({ show: true, message: error.response?.data?.message || "Failed to cancel invoice", type: "error" });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return setToast({ show: true, message: "Enter valid payment amount", type: "error" });
    if (paymentMethod !== "cash" && !paymentReference.trim()) return setToast({ show: true, message: "A transaction or receipt reference is required for non-cash payments.", type: "error" });
    setLoading(true);
    try {
      const response = await api.post(`/invoices/${getEntityId(invoice)}/payments`, {
        amount: parseFloat(paymentAmount),
        paymentMethod,
        reference: paymentReference.trim(),
        notes: paymentNotes.trim(),
      });
      const savedInvoice = response.data;
      const savedPayment = (savedInvoice?.payments || [])
        .filter((payment) => payment.kind === "recorded")
        .at(-1);
      if (savedInvoice && savedPayment) {
        onPaymentReceipt(savedInvoice, savedPayment);
      } else {
        setToast({ show: true, message: "Payment recorded, but the receipt could not be loaded.", type: "error" });
      }
    } catch (error) { setToast({ show: true, message: error.response?.data?.message || "Failed to record payment", type: "error" }); } finally { setLoading(false); }
  };

  const handleReversePayment = async () => {
    if (!reversalTarget || reversalReason.trim().length < 5) {
      setToast({ show: true, message: "Provide a reversal reason (at least 5 characters).", type: "error" });
      return;
    }
    try {
      setReversalLoading(true);
      await api.post(
        `/invoices/${getEntityId(invoice)}/payments/${reversalTarget.id}/reverse`,
        { reason: reversalReason.trim() },
      );
      setToast({ show: true, message: "Payment reversal recorded in the audit trail.", type: "success" });
      setReversalTarget(null);
      setReversalReason("");
      setTimeout(onClose, 700);
    } catch (error) {
      setToast({ show: true, message: error.response?.data?.message || "Failed to reverse payment", type: "error" });
    } finally {
      setReversalLoading(false);
    }
  };

  return (
    <div className="print-container mx-auto max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden mb-8 border border-slate-200 print:shadow-none print:border-0 print:m-0 print:p-0">
      {actionParam && (
        <div className="bg-blue-50 border-b border-blue-200 px-8 py-3 flex items-center gap-2.5 text-blue-800 text-sm print:hidden">
          <AlertCircle size={18} className="text-blue-500 shrink-0" />
          <span>
            <strong>Historical Event Log View:</strong> Showing invoice state at the time of{" "}
            <span className="font-semibold underline">
              {actionParam === "invoice.create" ? "Invoice Creation" : actionParam === "invoice.issue" ? "Invoice Issuance" : "Payment Recording"}
            </span>.
            {actionParam !== "invoice.payment.recorded" && rawInvoice.status !== invoice.status && (
              <span className="ml-1 text-blue-700 font-medium">
                (Note: Current live status of this invoice is <span className="uppercase">{rawInvoice.status === 'overdue' ? 'over due' : rawInvoice.status}</span>).
              </span>
            )}
          </span>
        </div>
      )}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
         <button onClick={onClose} className="flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"><ArrowLeft size={16} className="mr-2" /> Back to Billing</button>
         <button onClick={() => window.print()} className="flex items-center text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"><Printer size={16} className="mr-2" /> Print</button>
      </div>

      <div className="p-8">
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-10">
          <div>
            {clinic.logoUrl && (
              <img src={resolveAssetUrl(clinic.logoUrl)} alt="Clinic Logo" className="h-16 w-auto object-contain mb-6 print:h-12" />
            )}
            <div className="bg-primary-50 text-primary-700 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest w-fit mb-4 mix-blend-multiply" style={clinic.brandColor ? { backgroundColor: `${clinic.brandColor}20`, color: clinic.brandColor } : {}}>Invoice</div>
            <h2 className="text-4xl font-bold text-slate-900 tracking-tight">{invoice.invoiceNumber}</h2>
            <div className="mt-4 space-y-1 text-sm text-slate-600">
              <p>Generated: <span className="font-semibold text-slate-900">{new Date(invoice.invoiceDate).toLocaleDateString()}</span></p>
              {invoice.dueDate && <p>Due: <span className="font-semibold text-slate-900">{new Date(invoice.dueDate).toLocaleDateString()}</span></p>}
            </div>
          </div>
          <div className="print-card-reset bg-slate-900 rounded-2xl p-6 text-white min-w-[300px]" style={clinic.brandColor ? { backgroundColor: clinic.brandColor } : {}}>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Billed To</p>
            <p className="text-2xl font-bold mb-1">{invoice.patientId?.name || "Unknown patient"}</p>
            <p className="text-sm text-slate-300 font-mono mb-2">{invoice.patientId?.phone || "No phone"}</p>
            <p className="text-sm text-slate-300 opacity-80">{invoice.patientId?.address || "No address"}</p>
          </div>
        </div>

        <div className="print-grid-1 grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-8">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><FileText size={18} className="mr-2" style={{ color: clinic.brandColor || 'currentColor' }} /> Items & Charges</h3>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th><th className="px-4 py-3 text-right font-semibold text-slate-700">Qty</th><th className="px-4 py-3 text-right font-semibold text-slate-700">Unit Price</th><th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(invoice.items || []).map((item, index) => (
                    <tr key={`${getEntityId(invoice)}-${index}`}>
                      <td className="px-4 py-4"><p className="font-medium text-slate-900">{item.description}</p><p className="text-xs text-slate-500 capitalize mt-0.5">{item.category}</p></td>
                      <td className="px-4 py-4 text-right text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-4 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invoice.notes && (
              <div className="mt-8 rounded-xl bg-slate-50 border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Billing Notes</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-50 p-6 border border-slate-200">
              <SummaryRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
              <SummaryRow label={`Tax (${invoice.taxPercentage || 0}%)`} value={formatCurrency(invoice.tax)} />
              <SummaryRow label="Discount" value={formatCurrency(invoice.discount)} />
              <div className="my-4 border-t border-slate-200 border-dashed" />
              <SummaryRow label="Total Billed" value={formatCurrency(invoice.total)} />
              <SummaryRow label="Amount Paid" value={formatCurrency(invoice.amountPaid)} />
              <div className="mt-6 pt-4 border-t-2 border-slate-200">
                <SummaryRow label="Amount Due" value={formatCurrency(invoice.balance)} strong />
              </div>
            </div>

            <div className={`rounded-2xl p-6 border flex items-center justify-between ${invoice.status === 'paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200'}`}>
               <div>
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Status</p>
                  <p className="text-2xl font-bold uppercase">{invoice.status === 'overdue' ? 'over due' : invoice.status}</p>
               </div>
               {invoice.status === 'paid' && <CheckCircle size={40} className="opacity-50" />}
            </div>

            {isAdmin && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (invoice.amountPaid === 0 || (invoice.payments || []).length === 0) && (
              <Button
                variant="outline"
                className="w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 shadow-sm transition-all"
                onClick={() => setConfirmCancelOpen(true)}
              >
                Cancel Invoice
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-8 mt-8 pt-8 border-t border-slate-200">
          <div className="space-y-4">
             <h3 className="text-lg font-bold text-slate-900 flex items-center"><CreditCard size={18} className="mr-2" style={{ color: clinic.brandColor || 'currentColor' }} /> Payment History</h3>
             {(invoice.payments || []).length === 0 ? (
               <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 bg-slate-50/50">No payments verified yet.</div>
             ) : (
               <div className="space-y-3">
                 {(invoice.payments || []).slice().reverse().map((payment) => (
                   <div key={payment.id} className={`rounded-xl bg-white border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4 ${payment.kind === "reversal" ? "border-rose-200 bg-rose-50/40" : ""}`}>
                     <div>
                       <p className={`font-bold text-lg mb-0.5 ${payment.kind === "reversal" ? "text-rose-700" : "text-slate-900"}`}>{payment.kind === "reversal" ? "Reversal " : ""}{formatCurrency(payment.amount)}</p>
                       <p className="text-xs text-slate-500 flex items-center"><span className="uppercase tracking-wider font-semibold mr-2">{String(payment.paymentMethod).replace("_", " ")}</span> {new Date(payment.receivedAt).toLocaleString()}</p>
                       {payment.receiptNumber && <p className="mt-1 font-mono text-xs text-slate-500">{payment.receiptNumber}</p>}
                       {payment.recordedBy?.name && <p className="mt-1 text-xs text-slate-500">Recorded by {payment.recordedBy.name}</p>}
                       {payment.reversalReason && <p className="mt-2 text-sm text-rose-700">Reason: {payment.reversalReason}</p>}
                       {payment.notes && <p className="text-sm italic text-slate-600 mt-2 bg-slate-50 p-2 rounded">{payment.notes}</p>}
                     </div>
                     <div className="flex flex-col items-end gap-2">
                       {payment.kind === "recorded" && (
                         <Button type="button" variant="outline" onClick={() => onPaymentReceipt(invoice, payment)} className="!w-auto !text-xs">
                           <Printer size={14} className="mr-1" /> Receipt
                         </Button>
                       )}
                       {isAdmin && payment.kind === "recorded" && !(invoice.payments || []).some((entry) => entry.reversalOfId === payment.id) && (
                         <Button type="button" variant="outline" onClick={() => setReversalTarget(payment)} className="!w-auto !text-xs border-rose-200 text-rose-700">
                           Reverse
                         </Button>
                       )}
                       {payment.kind === "reversal" ? <AlertCircle size={22} className="text-rose-500 shrink-0" /> : <CheckCircle size={24} className="text-emerald-500 shrink-0 opacity-50" />}
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>

          {["issued", "overdue"].includes(invoice.status) && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 h-fit print:hidden">
              <h3 className="text-lg font-bold text-emerald-900 mb-4">Record New Payment</h3>
              <div className="space-y-4">
                <Input label="Amount (NGN)" type="number" step="1" min="0" max={invoice.balance} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} icon={NairaIcon} className="bg-white" />
                <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700">Method</label><div className="relative"><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-white text-sm focus:ring-2 focus:ring-primary-500 shadow-sm appearance-none h-[46px]"><option value="cash">Cash</option><option value="card">Card / POS</option><option value="bank_transfer">Bank Transfer</option><option value="check">Check</option></select></div></div>
                {paymentMethod !== "cash" && <Input label="Transaction / POS reference *" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} maxLength={120} className="bg-white" required />}
                <div className="space-y-1.5"><label className="text-sm font-semibold text-slate-700">Notes (optional)</label><textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} maxLength={500} rows="2" className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:ring-2 focus:ring-primary-500 shadow-sm resize-none" /></div>
                <div className="pt-2"> 
                   <p className="text-sm text-slate-600 mb-3 bg-white p-3 rounded-lg border border-emerald-100 flex justify-between">New Balance: <span className="font-bold text-emerald-700">{formatCurrency(Math.max(0, Number(invoice.balance || 0) - Number(paymentAmount || 0)))}</span></p>
                   <Button onClick={handleRecordPayment} isLoading={loading} className="w-full shadow-md bg-emerald-600 hover:bg-emerald-700">Record Payment</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {toast.show && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast({ ...toast, show: false })} />}
      {confirmCancelOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={(event) => { event.preventDefault(); handleCancelInvoice(); }}
            className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-xl font-bold text-slate-900">Cancel Invoice</h3>
            <p className="text-sm text-slate-600">
              Cancelling {invoice.invoiceNumber} is recorded in the activity log. Provide a reason to continue.
            </p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              maxLength={500}
              minLength={5}
              rows={3}
              required
              placeholder="Reason for cancellation"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmCancelOpen(false)} className="!w-auto">Keep Invoice</Button>
              <Button type="submit" isLoading={cancelLoading} className="!w-auto bg-rose-600 hover:bg-rose-700">Cancel Invoice</Button>
            </div>
          </form>
        </div>
      )}
      {reversalTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={(event) => { event.preventDefault(); handleReversePayment(); }}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-900">Reverse Payment</h3>
            <p className="text-sm text-slate-600">
              This creates a permanent reversal entry and adjusts the invoice balance. It does not erase the original receipt.
            </p>
            <textarea
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              maxLength={500}
              minLength={5}
              rows={3}
              required
              placeholder="Reason for reversal (required)"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setReversalTarget(null)} className="!w-auto">Keep Payment</Button>
              <Button type="submit" isLoading={reversalLoading} className="!w-auto bg-rose-600 hover:bg-rose-700">Record Reversal</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function InvoiceList({ patientId = null }) {
  const INVOICES_PER_PAGE = 20;
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uiState, setUiState, clearUiState] = usePersistentState(
    `carechrome:draft:invoice-list:${patientId || "general"}`,
    {
      showForm: false,
      filterStatus: "all",
      searchQuery: "",
      selectedPatientId: patientId || "",
      startDate: "",
      endDate: "",
    },
  );
  const { showForm, filterStatus, searchQuery, selectedPatientId, startDate, endDate } = uiState;
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get("invoiceId");
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (invoiceIdParam) {
      const fetchInvoiceForViewing = async () => {
        try {
          const response = await api.get(`/invoices/${invoiceIdParam}`);
          if (response.data) {
            setViewingInvoice(response.data);
          }
        } catch (error) {
          console.error("Error loading invoice from URL parameter:", error);
        }
      };
      fetchInvoiceForViewing();
    }
  }, [invoiceIdParam]);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [report, setReport] = useState(null);
  const [invoicePatients, setInvoicePatients] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: INVOICES_PER_PAGE,
    total: 0,
    totalPages: 1,
  });

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (patientId) params.append("patientId", patientId);
      if (selectedPatientId) params.append("patientId", selectedPatientId);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", String(pagination.page || 1));
      params.append("limit", String(INVOICES_PER_PAGE));
      const response = await api.get(`/invoices?${params}`);
      setInvoices(response.data?.data || []);
      setPagination((current) => ({
        ...current,
        page: response.data?.page || current.page,
        limit: response.data?.limit || current.limit,
        total: response.data?.total || 0,
        totalPages: response.data?.totalPages || 1,
      }));
    } catch (error) {
      setToast({ show: true, message: error.response?.data?.message || "Failed to fetch invoices", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, pagination.page, patientId, selectedPatientId, startDate, endDate]);

  const fetchReport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (patientId) params.append("patientId", patientId);
      if (selectedPatientId) params.append("patientId", selectedPatientId);

      if (startDate) {
        params.append("startDate", new Date(startDate).toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.append("endDate", end.toISOString());
      }

      if (!startDate && !endDate && !patientId && !selectedPatientId) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        params.append("startDate", startOfMonth);
        params.append("endDate", endOfMonth);
      }

      const response = await api.get(`/invoices/report?${params}`);
      setReport(response.data);
    } catch (error) { console.error(error); }
  }, [patientId, selectedPatientId, startDate, endDate]);

  const fetchInvoicePatients = useCallback(async () => {
    if (patientId) return;
    try {
      const response = await api.get("/invoices/patients");
      setInvoicePatients(response.data || []);
    } catch (error) {
      console.error(error);
    }
  }, [patientId]);

  useEffect(() => { fetchInvoices(); fetchReport(); fetchInvoicePatients(); }, [fetchInvoicePatients, fetchInvoices, fetchReport]);
  useEffect(() => {
    setPagination((current) => ({ ...current, page: 1 }));
  }, [filterStatus, patientId, selectedPatientId, startDate, endDate]);

  const handleFormSuccess = () => { clearUiState(); setViewingInvoice(null); fetchInvoices(); fetchReport(); };
  const handlePaymentReceipt = (invoice, payment) => {
    setViewingInvoice(null);
    setReceiptData({ invoice, payment });
    fetchInvoices();
    fetchReport();
  };
  const handleIssueInvoice = async (id) => {
    try { await api.put(`/invoices/${id}/issue`); setToast({ show: true, message: "Invoice issued", type: "success" }); fetchInvoices(); fetchReport(); } catch (error) { setToast({ show: true, message: error.response?.data?.message || "Failed to issue", type: "error" }); }
  };

  const filteredInvoices = useMemo(() => {
    const text = searchQuery.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (!text) return true;
      const haystack = [invoice.invoiceNumber, invoice.patientId?.name, invoice.patientId?.phone, ...(invoice.items || []).map((item) => item.description)].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(text);
    });
  }, [invoices, searchQuery]);

  const selectedPatientSummary = useMemo(() => {
    if (!selectedPatientId) return null;
    const patient = invoicePatients.find((summary) => getEntityId(summary) === selectedPatientId) || null;
    if (!patient || !report) return null;
    return {
      patient,
      outstanding: report.totalOutstanding || 0,
      unpaidInvoices: (report.overdueInvoices || 0) + Math.max(0, (report.totalInvoices || 0) - (report.paidInvoices || 0) - (report.drafts || 0)),
    };
  }, [invoicePatients, report, selectedPatientId]);

  const receptionistHighlights = useMemo(() => {
    return {
      unpaidPatients: report?.unpaidPatients || 0,
      incompletePatients: report?.incompletePatients || 0,
      dueToday: report?.dueToday || 0,
      drafts: report?.drafts || 0,
    };
  }, [report]);

  if (receiptData) {
    return (
      <PaymentReceipt
        invoice={receiptData.invoice}
        payment={receiptData.payment}
        onDone={() => setReceiptData(null)}
      />
    );
  }
  if (showForm) return <InvoiceForm patientId={selectedPatientId || patientId} draftStorageKey={`carechrome:draft:invoice-form:${selectedPatientId || patientId || "new"}`} onSuccess={handleFormSuccess} onCancel={() => clearUiState()} />;
  if (viewingInvoice) return (
    <InvoiceViewer
      invoice={viewingInvoice}
      actionParam={actionParam}
      onPaymentReceipt={handlePaymentReceipt}
      onClose={() => {
        setViewingInvoice(null);
        const nextParams = new URLSearchParams(searchParams);
        if (nextParams.has("invoiceId")) nextParams.delete("invoiceId");
        if (nextParams.has("action")) nextParams.delete("action");
        setSearchParams(nextParams);
        fetchInvoices();
        fetchReport();
      }}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-surface-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Billing & Collections</h2>
          <p className="text-sm text-slate-500 max-w-xl">Create invoices, manage outstanding balances, and record payments.</p>
        </div>
        <Button onClick={() => setUiState((current) => ({ ...current, showForm: true }))} className="w-full md:w-auto shadow-md"><Plus size={18} className="mr-2" /> New Invoice</Button>
      </div>

      {report && !patientId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Invoices (This Month)" value={formatNumber(report.totalInvoices)} tone="blue" icon={FileText} />
          <StatCard label="Revenue (This Month)" value={formatCurrency(report.totalRevenue)} tone="slate" icon={DollarSign} />
          <StatCard label="Collections (This Month)" value={formatCurrency(report.totalPaid)} tone="emerald" icon={CheckCircle} />
          <StatCard label="Outstanding (This Month)" value={formatCurrency(report.totalOutstanding)} tone="amber" icon={AlertCircle} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-3/4 space-y-6">
          <Card className="border border-surface-200 shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 mb-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Search</label>
                  <Input value={searchQuery} onChange={(e) => setUiState((current) => ({ ...current, searchQuery: e.target.value }))} placeholder="Search records..." icon={Search} className="bg-slate-50" />
                </div>
                <div>
                   <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                   <div className="relative">
                      <select value={filterStatus} onChange={(e) => setUiState((current) => ({ ...current, filterStatus: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 text-sm focus:ring-primary-500 shadow-sm appearance-none h-[46px]"><option value="all">All Statuses</option><option value="unpaid">Unpaid</option><option value="incomplete">Incomplete</option><option value="draft">Drafts</option><option value="issued">Issued</option><option value="paid">Paid</option><option value="overdue">Over Due</option><option value="cancelled">Cancelled</option></select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><ChevronDown size={16} className="text-slate-400" /></div>
                   </div>
                </div>
                <div>
                   <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</label>
                   <div className="relative">
                      <select value={selectedPatientId} onChange={(e) => setUiState((current) => ({ ...current, selectedPatientId: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-50 text-sm focus:ring-primary-500 shadow-sm appearance-none h-[46px]"><option value="">All Patients</option>{invoicePatients.map((patient) => (<option key={getEntityId(patient)} value={getEntityId(patient)}>{patient?.name || "Unknown patient"}</option>))}</select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"><ChevronDown size={16} className="text-slate-400" /></div>
                   </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">From</span>
                    <Input type="date" value={startDate} onChange={(e) => setUiState((current) => ({ ...current, startDate: e.target.value }))} className="bg-slate-50 !w-[150px] !h-9 text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">To</span>
                    <Input type="date" value={endDate} onChange={(e) => setUiState((current) => ({ ...current, endDate: e.target.value }))} className="bg-slate-50 !w-[150px] !h-9 text-xs" />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => setUiState((current) => ({ ...current, startDate: "", endDate: "" }))}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors uppercase tracking-wider sm:ml-2"
                    >
                      Clear Period
                    </button>
                  )}
                </div>
              </div>

              {selectedPatientSummary?.patient && selectedPatientSummary.patient.name && (
                <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">{selectedPatientSummary.patient.name}</h3>
                    <p className="text-sm text-blue-700 mt-1">{[selectedPatientSummary.patient.phone, selectedPatientSummary.patient.email].filter(Boolean).join(" | ")}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <div className="bg-white px-4 py-2 rounded-lg border border-blue-100 shadow-sm flex-1 md:flex-none">
                       <p className="text-xs text-slate-500 uppercase font-semibold">Total Due</p>
                       <p className="text-lg font-bold text-rose-600">{formatCurrency(selectedPatientSummary.outstanding)}</p>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-lg border border-blue-100 shadow-sm flex-1 md:flex-none">
                       <p className="text-xs text-slate-500 uppercase font-semibold">Unpaid Bills</p>
                       <p className="text-lg font-bold text-blue-900">{selectedPatientSummary.unpaidInvoices}</p>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="py-20 text-center flex flex-col items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-4" /><p className="text-slate-500">Loading billing records...</p></div>
              ) : filteredInvoices.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center text-slate-500 flex flex-col items-center">
                  <FileText size={48} className="text-slate-300 mb-4" />
                  <p className="text-lg font-medium text-slate-700">No invoices found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInvoices.map((invoice) => (
                    <div key={getEntityId(invoice)} className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-primary-300 hover:shadow-md transition-all flex flex-col lg:flex-row gap-5 lg:items-center justify-between overflow-hidden">
                       <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                             <h4 className="font-bold text-slate-900 text-sm md:text-base break-all">{invoice.invoiceNumber}</h4>
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border shrink-0 ${getStatusColor(invoice.status)}`}>{invoice.status === 'overdue' ? 'over due' : invoice.status}</span>
                          </div>
                          <p className="text-sm font-medium text-slate-700 mb-1">{invoice.patientId?.name || "Unknown patient"}</p>
                          <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                             <span>Issued: {new Date(invoice.invoiceDate).toLocaleDateString()}</span>
                             {invoice.dueDate && <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>}
                          </div>
                       </div>

                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 lg:w-auto lg:min-w-[300px]">
                          <div><p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total</p><p className="font-semibold text-slate-900">{formatCurrency(invoice.total)}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Paid</p><p className="font-semibold text-emerald-700">{formatCurrency(invoice.amountPaid)}</p></div>
                          <div><p className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">Balance</p><p className="font-semibold text-rose-600">{formatCurrency(invoice.balance)}</p></div>
                       </div>

                        <div className="flex flex-row lg:flex-col gap-2 pt-4 border-t border-slate-100 lg:w-auto lg:pt-0 lg:border-t-0 shrink-0 items-center lg:items-end justify-end lg:mr-4">
                           {invoice.status === "draft" && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleIssueInvoice(getEntityId(invoice))}
                               className="!w-auto !text-[11px] !h-8 px-3 whitespace-nowrap"
                             >
                               Issue
                             </Button>
                           )}
                           <Button
                             size="sm"
                             onClick={() => setViewingInvoice(invoice)}
                             className="!w-auto !text-[11px] !h-8 px-3 whitespace-nowrap shadow-sm"
                           >
                             Open Bill
                           </Button>
                        </div>
                    </div>
                  ))}
                </div>
              )}
              {pagination.total > 0 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <p className="text-sm font-medium text-slate-600">Showing <strong className="text-slate-900">{((pagination.page - 1) * INVOICES_PER_PAGE) + 1}-{Math.min(((pagination.page - 1) * INVOICES_PER_PAGE) + invoices.length, pagination.total)}</strong> of <strong className="text-slate-900">{pagination.total}</strong> invoices</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={(pagination.page || 1) === 1} className="bg-white">Previous</Button>
                    <span className="text-sm font-bold text-slate-700 px-2 lg:px-4 whitespace-nowrap">{pagination.page || 1} / {Math.max(1, pagination.totalPages || 1)}</span>
                    <Button variant="outline" size="sm" onClick={() => setPagination((current) => ({ ...current, page: Math.min(Math.max(1, current.totalPages || 1), current.page + 1) }))} disabled={(pagination.page || 1) >= Math.max(1, pagination.totalPages || 1)} className="bg-white">Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-1/4 space-y-6">
          <Card className="border border-slate-200 bg-white overflow-hidden shadow-sm">
             <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-6 flex items-center text-slate-900"><Activity size={18} className="mr-2 text-primary-500" /> Focus Areas</h3>
                <div className="space-y-4">
                   <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                      <p className="text-rose-600 font-semibold text-sm uppercase tracking-wider">Due Today</p>
                      <p className="text-3xl font-bold mt-1 text-slate-900">{receptionistHighlights.dueToday}</p>
                   </div>
                   <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider">Draft Bills</p>
                      <p className="text-3xl font-bold mt-1 text-slate-900">{receptionistHighlights.drafts}</p>
                   </div>
                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                       <p className="text-amber-700 font-semibold text-sm uppercase tracking-wider">Unpaid Patients</p>
                       <p className="text-3xl font-bold mt-1 text-slate-900">{receptionistHighlights.unpaidPatients}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                       <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider">Incomplete Payments</p>
                       <p className="text-3xl font-bold mt-1 text-slate-900">{receptionistHighlights.incompletePatients}</p>
                    </div>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
      {toast.show && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast({ ...toast, show: false })} />}
    </div>
  );
}
