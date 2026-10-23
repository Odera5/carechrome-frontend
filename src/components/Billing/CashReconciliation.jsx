import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ClipboardCheck, RefreshCw, AlertTriangle, ChevronDown } from "lucide-react";
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

const formatSubmittedAt = (date, timeZone) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));

export default function CashReconciliation({ reviewerOnly = false }) {
  const currentUser = getStoredUserObject() || {};
  const canReview = ["admin", "branch_manager"].includes(currentUser.role);
  const canSubmit = !reviewerOnly;
  const [businessDate, setBusinessDate] = useState(localDate);
  const [timeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closings, setClosings] = useState([]);
  const [activeStatus, setActiveStatus] = useState("pending");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewNotes, setReviewNotes] = useState({});
  const [followUpNotes, setFollowUpNotes] = useState({});
  const [resolutionNotes, setResolutionNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fetchSequence = useRef(0);

  const fetchClosings = useCallback(async () => {
    const requestSequence = ++fetchSequence.current;
    try {
      setLoading(true);
      const response = await api.get(
        reviewerOnly
          ? "/cash-reconciliations"
          : "/invoices/cash-reconciliations",
        {
          params: {
            status: activeStatus,
            page: pagination.page,
            pageSize: 25,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          },
        },
      );
      if (requestSequence !== fetchSequence.current) return;
      setClosings(response.data?.data || []);
      setPagination((current) => ({
        ...current,
        ...(response.data?.pagination || {}),
      }));
    } catch (error) {
      if (requestSequence !== fetchSequence.current) return;
      setToast({
        message:
          error.response?.data?.message || "Failed to load cash reconciliation history.",
        type: "error",
      });
    } finally {
      if (requestSequence === fetchSequence.current) {
        setLoading(false);
      }
    }
  }, [activeStatus, fromDate, pagination.page, reviewerOnly, toDate]);

  useEffect(() => {
    fetchClosings();
  }, [fetchClosings]);

  const fetchPendingCount = useCallback(async () => {
    if (!canReview) return;
    try {
      const response = await api.get("/cash-reconciliations/pending-count");
      setPendingCount(Number(response.data?.count) || 0);
    } catch (error) {
      console.error("Failed to load pending cash close count:", error);
    }
  }, [canReview]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

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
      await fetchPendingCount();
      window.dispatchEvent(new Event("cash-reconciliation-updated"));
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
        `${reviewerOnly ? "/cash-reconciliations" : "/invoices/cash-reconciliations"}/${closing.id}/review`,
        { status, reviewerNotes: reviewerNotesValue },
      );
      setToast({
        message: status === "approved" ? "Cash close approved." : "Cash variance flagged for follow-up.",
        type: "success",
      });
      await fetchClosings();
      await fetchPendingCount();
      window.dispatchEvent(new Event("cash-reconciliation-updated"));
    } catch (error) {
      setToast({
        message: error.response?.data?.message || "Failed to review cash close.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const respondToFlag = async (closing) => {
    const responseNotes = String(followUpNotes[closing.id] || "").trim();
    if (responseNotes.length < 5) {
      setToast({ message: "Add investigation notes (at least 5 characters).", type: "error" });
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/cash-reconciliations/${closing.id}/respond`, {
        followUpNotes: responseNotes,
      });
      setToast({ message: "Investigation response recorded.", type: "success" });
      await fetchClosings();
    } catch (error) {
      setToast({
        message: error.response?.data?.message || "Failed to record investigation response.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const resolveFlag = async (closing) => {
    const resolution = String(resolutionNotes[closing.id] || "").trim();
    if (resolution.length < 5) {
      setToast({ message: "Add resolution notes (at least 5 characters).", type: "error" });
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/cash-reconciliations/${closing.id}/resolve`, {
        resolutionNotes: resolution,
      });
      setToast({ message: "Flagged cash close resolved.", type: "success" });
      await fetchClosings();
      await fetchPendingCount();
      window.dispatchEvent(new Event("cash-reconciliation-updated"));
    } catch (error) {
      setToast({
        message: error.response?.data?.message || "Failed to resolve flagged cash close.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = (status) => {
    fetchSequence.current += 1;
    setClosings([]);
    setActiveStatus(status);
    setPagination((current) => ({ ...current, page: 1 }));
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
          {reviewerOnly
            ? "Review pending cash closes for your assigned branch. Verify the reported count and notes; you cannot review a close you submitted."
            : "Expected cash is calculated from recorded cash payments and reversals for the selected branch and local business day. Count the physical cash independently. An admin or assigned branch manager must review each close, and submitters cannot review their own."}
        </p>
      </div>

      {canSubmit && <form
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
      </form>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Branch Cash Closes</h3>
            <p className="mt-1 text-xs text-slate-500">
              Review new closes, follow up flagged discrepancies, or browse the audit history.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              fetchClosings();
              fetchPendingCount();
            }}
            isLoading={loading}
            className="!w-auto"
          >
            <RefreshCw size={15} className="mr-2" /> Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">
          {[
            { value: "pending", label: "Needs Review" },
            { value: "flagged", label: "Flagged Follow-up" },
            { value: "history", label: "History" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeStatus(tab.value)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                activeStatus === tab.value
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {tab.value === "pending" && pendingCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input
            label="From date"
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          />
          <Input
            label="To date"
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPagination((current) => ({ ...current, page: 1 }));
            }}
          />
          <p className="pb-3 text-xs text-slate-500">
            Branch: {currentUser.branch?.city || currentUser.branch?.name || "Active branch"}
          </p>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading cash closes...</p>
        ) : closings.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {activeStatus === "pending"
              ? "There are no cash closes awaiting review."
              : activeStatus === "flagged"
                ? "There are no flagged cash closes awaiting follow-up."
                : "No reviewed cash closes in history yet."}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {closings.map((closing) => (
              <details key={closing.id} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                    <div>
                      <p className="font-bold text-slate-900">
                        {closing.businessDate} · {closing.branch?.city || closing.branch?.name || "Branch"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted by {closing.submittedBy?.name || "Former staff"} ·{" "}
                        {formatSubmittedAt(closing.submittedAt, closing.timezone)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className={Number(closing.variance) === 0 ? "text-emerald-700" : "text-rose-700"}>
                      {formatVariance(closing.variance)}
                    </strong>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                      closing.status === "approved" || closing.status === "resolved"
                        ? "bg-emerald-100 text-emerald-700"
                        : closing.status === "flagged"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-800"
                    }`}>
                      {closing.status}
                    </span>
                  </div>
                </summary>
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 p-5">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <p>Expected: <strong>{formatCurrency(closing.expectedCash)}</strong></p>
                    <p>Counted: <strong>{formatCurrency(closing.countedCash)}</strong></p>
                    <p className={Number(closing.variance) === 0 ? "text-emerald-700" : "text-rose-700"}>
                      Variance: <strong>{formatVariance(closing.variance)}</strong>
                    </p>
                  </div>
                  {closing.timezone && (
                    <p className="text-xs text-slate-500">Recorded in {closing.timezone}</p>
                  )}
                  {closing.notes && <p className="text-sm text-slate-600">Handover: {closing.notes}</p>}
                  {closing.reviewerNotes && (
                    <p className="text-sm text-slate-600">
                      Review by {closing.reviewedBy?.name || "Former staff"}: {closing.reviewerNotes}
                    </p>
                  )}
                  {closing.followUpNotes && (
                    <p className="text-sm text-slate-600">
                      Investigation by {closing.respondedBy?.name || "Former staff"}: {closing.followUpNotes}
                    </p>
                  )}
                  {closing.resolutionNotes && (
                    <p className="text-sm text-slate-600">
                      Resolved by {closing.resolvedBy?.name || "Former staff"}: {closing.resolutionNotes}
                    </p>
                  )}

                  {canReview && closing.status === "pending" &&
                    closing.submittedBy?.id !== currentUser.id && (
                      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 sm:flex-row">
                        <Input
                          label="Independent review notes"
                          value={reviewNotes[closing.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((current) => ({ ...current, [closing.id]: event.target.value }))
                          }
                          placeholder="Confirm physical count / explain variance"
                        />
                        <div className="flex items-end gap-2">
                          <Button type="button" onClick={() => reviewClose(closing, "approved")} isLoading={saving} className="!w-auto">
                            <Check size={15} className="mr-1" /> Approve
                          </Button>
                          <Button type="button" variant="outline" onClick={() => reviewClose(closing, "flagged")} isLoading={saving} className="!w-auto border-rose-200 text-rose-700">
                            Flag
                          </Button>
                        </div>
                      </div>
                    )}
                  {canReview && closing.status === "pending" &&
                    closing.submittedBy?.id === currentUser.id && (
                      <p className="text-sm text-amber-800">
                        You submitted this close. Another admin or assigned branch manager must review it.
                      </p>
                    )}
                  {closing.status === "flagged" && !closing.followUpNotes &&
                    (closing.submittedBy?.id === currentUser.id || currentUser.role === "admin") && (
                      <div className="space-y-3 rounded-xl bg-white p-4">
                        <Input
                          label="Investigation response"
                          value={followUpNotes[closing.id] || ""}
                          onChange={(event) =>
                            setFollowUpNotes((current) => ({ ...current, [closing.id]: event.target.value }))
                          }
                          placeholder="Explain the discrepancy and actions taken"
                        />
                        <Button type="button" onClick={() => respondToFlag(closing)} isLoading={saving} className="!w-auto">
                          Submit investigation
                        </Button>
                      </div>
                    )}
                  {closing.status === "flagged" && closing.followUpNotes &&
                    canReview && closing.submittedBy?.id !== currentUser.id && (
                      <div className="space-y-3 rounded-xl bg-white p-4">
                        <Input
                          label="Resolution notes"
                          value={resolutionNotes[closing.id] || ""}
                          onChange={(event) =>
                            setResolutionNotes((current) => ({ ...current, [closing.id]: event.target.value }))
                          }
                          placeholder="Document the resolution and any action taken"
                        />
                        <Button type="button" onClick={() => resolveFlag(closing)} isLoading={saving} className="!w-auto">
                          Resolve follow-up
                        </Button>
                      </div>
                    )}
                  {closing.status === "flagged" && !closing.followUpNotes &&
                    closing.submittedBy?.id !== currentUser.id && currentUser.role !== "admin" && (
                      <p className="text-sm text-amber-800">
                        Awaiting an investigation response from the submitter.
                      </p>
                    )}
                  {closing.status === "flagged" && closing.followUpNotes &&
                    (!canReview || closing.submittedBy?.id === currentUser.id) && (
                      <p className="text-sm text-amber-800">
                        Investigation recorded; awaiting an authorized reviewer to resolve this follow-up.
                      </p>
                    )}
                </div>
              </details>
            ))}
          </div>
        )}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} records
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="!w-auto"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="!w-auto"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
