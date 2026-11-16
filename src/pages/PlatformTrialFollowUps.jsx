import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, Building2, Mail, Phone, RefreshCw } from "lucide-react";
import api from "../services/api";

const milestoneLabels = {
  "7_days": "7-day reminder",
  "3_days": "3-day reminder",
  "1_day": "1-day reminder",
  expired: "Expired",
};

const formatDate = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getNotificationStyle = (status) => {
  if (status === "sent") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  if (status === "sending") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
};

export default function PlatformTrialFollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFollowUps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/platform/trial-follow-ups");
      setFollowUps(response.data.followUps || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load trial follow-ups. Sign in with an authorized CareChrome staff account.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFollowUps();
  }, [loadFollowUps]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              CareChrome internal
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Trial follow-ups
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Active unpaid trial clinics expiring within 14 days or expired in
              the last 30 days. Patient and clinical data is not included.
            </p>
          </div>
          <button
            type="button"
            onClick={loadFollowUps}
            disabled={loading}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Loading trial follow-ups…
          </div>
        ) : !error && followUps.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <Building2 size={28} className="mx-auto text-slate-400" />
            <p className="mt-3 font-semibold text-slate-800">
              No trial follow-ups right now
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Clinics due for follow-up will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Clinic</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Trial status</th>
                    <th className="px-5 py-3">Notifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {followUps.map(({ clinic, daysRemaining, daysExpired, notifications }) => (
                    <tr key={clinic.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{clinic.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {clinic.plan} · Trial ends {formatDate(clinic.subscriptionEnds)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Clinic ID: {clinic.id}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {clinic.adminUser?.name || clinic.contactPerson || "No contact name"}
                        </p>
                        {clinic.adminUser?.email || clinic.email ? (
                          <a
                            className="mt-1 flex items-center gap-1.5 text-sm text-teal-700 hover:underline"
                            href={`mailto:${clinic.adminUser?.email || clinic.email}`}
                          >
                            <Mail size={14} />
                            {clinic.adminUser?.email || clinic.email}
                          </a>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">No email on file</p>
                        )}
                        {clinic.phone && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                            <Phone size={14} />
                            {clinic.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {daysRemaining <= 0 ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            Expired {daysExpired} day(s) ago
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              daysRemaining <= 3
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {daysRemaining} day(s) remaining
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {notifications.length === 0 ? (
                          <span className="text-sm text-slate-500">No reminder sent yet</span>
                        ) : (
                          <ul className="space-y-2">
                            {notifications.map((notification) => (
                              <li
                                key={`${notification.milestone}-${notification.status}`}
                                className="flex flex-wrap items-center gap-2"
                              >
                                <span className="text-xs text-slate-600">
                                  {milestoneLabels[notification.milestone] ||
                                    notification.milestone}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getNotificationStyle(
                                    notification.status,
                                  )}`}
                                >
                                  {notification.status}
                                </span>
                                {notification.status === "failed" && (
                                  <span className="text-[11px] text-slate-500">
                                    Retry {notification.attempts}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
