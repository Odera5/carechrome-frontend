import React, { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCheck, RefreshCw, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Toast from "../Toast";
import { getStoredUserObject } from "../../utils/authStorage";

const localDate = () => {
  const date = new Date();
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatVariance = (amount) => {
  const value = Number(amount) || 0;
  return `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
};

export default function CashReconciliation() {
  const currentUser = getStoredUserObject() || {};
  const canReview = currentUser.role === "admin";
  const [businessDate, setBusinessDate] = useState(localDate);
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closings, setClosings] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchClosings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/invoices/cash-reconciliations");
      setClosings(response.data?.data || []);
    } catch (error) {
      setToast({
        message:
          error.response?.data?.message || "Failed to load cash reconciliation history.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  const submitClose = async (event) => {
    event.preventDefault();
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) {
      setToast({ message: "Enter a valid counted cash amount.", type: "error" });
      return;
    }

    try {
      setSaving(true);
      const response = await api.post("/invoices/cash-reconciliations", {
        businessDate,
        timeZone,
        countedCash: amount,
        notes: notes.trim(),
      });
      const reconciliation = response.data?.reconciliation;
      setToast({
        message: reconciliation
          ? `Cash close submitted. Expected ${formatCurrency(reconciliation.expectedCash)}; variance ${formatVariance(reconciliation.variance)}.`
          : "Cash close submitted for independent review.",
        type: "success",
      });
      setCountedCash("");
      setNotes("");
      await fetchClosings();
    } catch (error) {
      setToast({
        message: error.response?.data?.message || "Failed to submit cash close.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const reviewClose = async (closing, status) => {
    const reviewerNotesValue = String(reviewNotes[closing.id] || "").trim();
    if (reviewerNotesValue.length < 5) {
      setToast({
        message: "Add review notes (at least 5 characters) before deciding.",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);
      await api.patch(
        `/invoices/cash-reconciliations/${closing.id}/review`,
        { status, reviewerNotes: reviewerNotesValue },
      );
      setToast({
        message: status === "approved" ? "Cash close approved." : "Cash variance flagged for follow-up.",
        type: "success",
      });
      await fetchClosings();
    } catch (error) {
      setToast({
        message: error.response?.data?.message || "Failed to review cash close.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> Independent cash close
        </p>
        <p className="mt-2 leading-6">
          Expected cash is calculated from recorded cash payments and reversals for the selected branch and local business day. Count the physical cash independently. An admin must review this submission; a submitter cannot approve their own close.
        </p>
      </div>

      <form
        onSubmit={submitClose}
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2"
      >
        <Input
          label="Business date"
          type="date"
          value={businessDate}
          onChange={(event) => setBusinessDate(event.target.value)}
          required
        />
        <Input
          label="Cash physically counted (NGN)"
          type="number"
          min="0"
          step="0.01"
          value={countedCash}
          onChange={(event) => setCountedCash(event.target.value)}
          required
        />
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-sm font-semibold text-slate-700">
            Handover / discrepancy notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Optional handover notes"
          />
        </div>
        <div className="flex items-center justify-between gap-3 md:col-span-2">
          <span className="text-xs text-slate-500">
            Time zone used for the daily cash total: {timeZone}
          </span>
          <Button type="submit" isLoading={saving} className="!w-auto">
            <ClipboardCheck size={16} className="mr-2" />
            Submit Cash Close
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <h3 className="text-lg font-bold text-slate-900">Recent Branch Cash Closes</h3>
          <Button
            type="button"
            variant="outline"
            onClick={fetchClosings}
            isLoading={loading}
            className="!w-auto"
          >
            <RefreshCw size={15} className="mr-2" /> Refresh
          </Button>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading cash closes...</p>
        ) : closings.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No cash closes submitted yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {closings.map((closing) => (
              <article key={closing.id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {closing.businessDate} · {closing.branch?.city || closing.branch?.name || "Branch"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted by {closing.submittedBy?.name || "Former staff"} · {closing.timezone}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                    closing.status === "approved"
                      ? "bg-emerald-100 text-emerald-700"
                      : closing.status === "flagged"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-800"
                  }`}>
                    {closing.status}
                  </span>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <p>Expected: <strong>{formatCurrency(closing.expectedCash)}</strong></p>
                  <p>Counted: <strong>{formatCurrency(closing.countedCash)}</strong></p>
                  <p className={Number(closing.variance) === 0 ? "text-emerald-700" : "text-rose-700"}>
                    Variance: <strong>{formatVariance(closing.variance)}</strong>
                  </p>
                </div>
                {closing.notes && <p className="text-sm text-slate-600">Handover: {closing.notes}</p>}
                {closing.reviewerNotes && (
                  <p className="text-sm text-slate-600">
                    Review by {closing.reviewedBy?.name || "Former staff"}: {closing.reviewerNotes}
                  </p>
                )}

                {canReview && closing.status === "pending" && (
                  <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row">
                    <Input
                      label="Independent review notes"
                      value={reviewNotes[closing.id] || ""}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [closing.id]: event.target.value,
                        }))
                      }
                      placeholder="Confirm physical count / explain variance"
                    />
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        onClick={() => reviewClose(closing, "approved")}
                        isLoading={saving}
                        className="!w-auto"
                      >
                        <Check size={15} className="mr-1" /> Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => reviewClose(closing, "flagged")}
                        isLoading={saving}
                        className="!w-auto border-rose-200 text-rose-700"
                      >
                        Flag
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
