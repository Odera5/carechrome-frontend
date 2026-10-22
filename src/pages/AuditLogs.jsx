import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Calendar,
  User,
  Clock,
  Filter,
  X,
  FileText,
  Shield,
  CornerDownRight,
  Database,
  ArrowRight,
  Trash2,
  AlertCircle
} from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";
import { getStoredUserObject } from "../utils/authStorage";

const isSubscriptionPlanLog = (log) => {
  const action = String(log?.action || "").toLowerCase();
  const type = String(log?.resourceType || "").toLowerCase();

  return (type === "billing" || type === "upgrade_plan") && (action.startsWith("billing.subscription_") || action.startsWith("upgrade_plan.subscription_"));
};

const getResourceLabel = (log) => {
  if (isSubscriptionPlanLog(log)) return "upgrade plan";
  return String(log?.resourceType || "").replace("_", " ");
};
// Helper to map resourceType to frontend page route
const getResourceRoute = (log) => {
  if (!log) return null;
  const type = log.resourceType?.toLowerCase();
  if (isSubscriptionPlanLog(log)) return "/upgrade";
  if (type === "waiting_room") return "/waiting-room";
  if (type === "invoice") return `/billing?invoiceId=${log.resourceId}&action=${log.action}`;
  if (type === "record") return `/patients/${log.patientId}/records?recordId=${log.resourceId}`;
  if (type === "appointment") return "/appointments";
  if (type === "branch") return "/branches";
  if (type === "clinic_settings" || type === "clinic") return "/clinic-settings";
  if (type === "patient") return `/patients/${log.resourceId || log.patientId}/records`;
  if (type === "user" || type === "staff") return "/signup";
  if (type === "intake" || type === "pending_intake") return "/pending-intakes";
  if (type === "billing") return "/billing";
  if (type === "upgrade_plan") return "/upgrade";
  return null;
};

// Helper to get friendly redirect button label based on resourceType
const getResourceButtonLabel = (log) => {
  if (!log) return "Go to Record";
  const type = log.resourceType?.toLowerCase();
  if (isSubscriptionPlanLog(log)) return "Go to Upgrade Plan";
  if (type === "waiting_room") return "Go to Waiting Room";
  if (type === "invoice") return "Go to Billing";
  if (type === "record") return "Go to Record";
  if (type === "appointment") return "Go to Appointments";
  if (type === "branch") return "Go to Branches";
  if (type === "clinic_settings" || type === "clinic") return "Go to Settings";
  if (type === "user" || type === "staff") return "Go to Staff Management";
  if (type === "intake" || type === "pending_intake") return "Go to Intakes";
  if (type === "billing") return "Go to Billing";
  if (type === "upgrade_plan") return "Go to Upgrade Plan";
  return "Go to Page";
};

// Helper to format actions into friendly readable labels
const formatActionLabel = (action) => {
  if (!action) return "";
  const parts = action.split(".");
  if (parts.length === 2) {
    const resource = parts[0].replace("_", " ");
    const verb = parts[1];
    
    // Custom overrides for standard clinical verbs
    if (verb === "create") return `Created ${resource}`;
    if (verb === "update") return `Updated ${resource}`;
    if (verb === "delete") return `Deleted ${resource}`;
  }
  return action.replace(/[._]/g, " ");
};

// Helper to get action badge styles (color-coded by CRUD category)
const getActionBadgeStyle = (action) => {
  if (!action) return "bg-slate-100 text-slate-700";
  if (action.endsWith(".create")) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-100";
  }
  if (action.endsWith(".update")) {
    return "bg-amber-50 text-amber-700 border border-amber-100";
  }
  if (action.endsWith(".delete")) {
    return "bg-rose-50 text-rose-700 border border-rose-100";
  }
  return "bg-blue-50 text-blue-700 border border-blue-100";
};

// Helper to get role badge styles
const getRoleBadgeStyle = (role) => {
  switch (role?.toLowerCase()) {
    case "admin":
      return "bg-purple-50 text-purple-700 border border-purple-100";
    case "doctor":
      return "bg-sky-50 text-sky-700 border border-sky-100";
    case "nurse":
      return "bg-teal-50 text-teal-700 border border-teal-100";
    case "branch_manager":
      return "bg-indigo-50 text-indigo-700 border border-indigo-100";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-100";
  }
};

// Helper to normalize IP addresses (e.g. ::1 -> 127.0.0.1, ::ffff:127.0.0.1 -> 127.0.0.1)
const formatIpAddress = (ip) => {
  if (!ip) return "";
  let cleanIp = ip.trim();
  if (cleanIp.startsWith("::ffff:")) {
    cleanIp = cleanIp.substring(7);
  }
  if (cleanIp === "::1") {
    cleanIp = "127.0.0.1";
  }
  return cleanIp;
};

export default function AuditLogs() {
  const currentUser = getStoredUserObject() || {};
  const isAdmin = currentUser.role === "admin";
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "", show: false });
  
  // Available filters populated by backend response
  const [availableActions, setAvailableActions] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [availableActors, setAvailableActors] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);

  // Active filters state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 700);
    return () => clearTimeout(handler);
  }, [search]);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [limit] = useState(15);

  // Selected log for inspection details modal
  const [selectedLog, setSelectedLog] = useState(null);

  // Toast notifier helper
  const showToast = (message, type = "success") => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: "", type, show: false }), 3000);
  };

  // Fetch logic
  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/audit-logs", {
        params: {
          page: currentPage,
          limit,
          search: debouncedSearch.trim() || undefined,
          action: actionFilter || undefined,
          resourceType: resourceFilter || undefined,
          actorId: actorFilter || undefined,
          branchId: isAdmin ? branchFilter || undefined : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });

      setLogs(response.data?.data || []);
      setTotalPages(response.data?.totalPages || 1);
      setTotalResults(response.data?.total || 0);

      // Populate filter dropdowns from response data
      if (response.data?.filters) {
        setAvailableActions(response.data.filters.actions || []);
        setAvailableResources(response.data.filters.resourceTypes || []);
        setAvailableActors(response.data.filters.actors || []);
        setAvailableBranches(response.data.filters.branches || []);
      }
    } catch (error) {
      console.error("Failed to load audit logs:", error);
      showToast(error.response?.data?.message || "Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, debouncedSearch, actionFilter, resourceFilter, actorFilter, branchFilter, startDate, endDate, isAdmin]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Reset to first page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  useEffect(() => {
    handleFilterChange();
  }, [debouncedSearch, actionFilter, resourceFilter, actorFilter, branchFilter, startDate, endDate]);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setActionFilter("");
    setResourceFilter("");
    setActorFilter("");
    setBranchFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 max-w-7xl mx-auto space-y-6"
    >
      {toast.show && <Toast message={toast.message} type={toast.type} />}

      {/* Header and Summary Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Activity Logs</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? "Review activity across your clinic and filter by branch."
              : "Review activity recorded at your active branch."}
          </p>
        </div>
        <button
          onClick={fetchAuditLogs}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <Clock size={16} className={`${loading ? "animate-spin" : ""}`} />
          Refresh Feed
        </button>
      </div>

      {/* Filters Dashboard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-semibold text-slate-800 border-b border-slate-100 pb-3">
          <Filter size={18} className="text-primary-500" />
          Filter Operations
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search actions or staff name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all shadow-inner"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">All Actions</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {formatActionLabel(act)}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">All Branches</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Resource Filter */}
          <div>
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">All Resource Types</option>
              {availableResources.map((resType) => (
                <option key={resType} value={resType}>
                  {resType.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="">All Staff Members</option>
              {availableActors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name} ({actor.role})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={16} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 text-slate-400 pointer-events-none" size={16} />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-primary-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Clear Filters indicator */}
        {(search || actionFilter || resourceFilter || actorFilter || branchFilter || startDate || endDate) && (
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1 hover:underline"
            >
              <X size={14} />
              Clear Active Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                <th className="p-4 w-52">Timestamp</th>
                <th className="p-4">Staff Member</th>
                <th className="p-4">Branch</th>
                <th className="p-4 w-44">Action Taken</th>
                <th className="p-4">Resource Target</th>
                <th className="p-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center p-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
                      <span className="text-slate-500 font-medium">Fetching secure records...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center p-16 text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <Database size={40} className="text-slate-300" />
                      <span className="font-semibold text-slate-500">No activity logs found</span>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Try adjusting your search queries or filter attributes to find logs.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                    {/* Timestamp */}
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">
                          {new Date(log.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-xs text-slate-400 inline-flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Staff Member */}
                    <td className="p-4">
                      {log.actor ? (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                            {log.actor.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">{log.actor.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${getRoleBadgeStyle(log.actor.role)}`}>
                                {log.actor.role}
                              </span>
                              {log.ipAddress && formatIpAddress(log.ipAddress) !== "127.0.0.1" && (
                                <span className="text-[10px] text-slate-400 font-semibold uppercase">{formatIpAddress(log.ipAddress)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Shield size={16} />
                          <span className="text-xs font-medium uppercase tracking-wider">System Process</span>
                        </div>
                      )}
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className="font-medium text-slate-700">
                        {log.branch?.name || "Unassigned / legacy"}
                      </span>
                    </td>

                    {/* Action Taken */}
                    <td className="p-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${getActionBadgeStyle(log.action)}`}>
                        {formatActionLabel(log.action)}
                      </span>
                    </td>

                    {/* Resource Target */}
                    <td className="p-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          {getResourceRoute(log) ? (
                            <Link
                              to={getResourceRoute(log)}
                              className="inline-flex items-center gap-1 hover:underline font-semibold text-primary-600 hover:text-primary-700"
                            >
                              <span className="capitalize">
                                {getResourceLabel(log)}
                              </span>
                              <span className="text-slate-400 text-xs font-mono">
                                (#{log.resourceId})
                              </span>
                            </Link>
                          ) : (
                            <>
                              <span className="font-semibold text-slate-800 capitalize">
                                {getResourceLabel(log)}
                              </span>
                              <span className="text-slate-400 text-xs font-mono">
                                (#{log.resourceId})
                              </span>
                            </>
                          )}
                        </div>
                        {log.patient && (
                          <Link
                            to={getResourceRoute(log) || `/patients/${log.patientId}/records`}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 mt-1 hover:underline"
                          >
                            <CornerDownRight size={12} className="text-slate-400" />
                            Patient: {log.patient.name} ({log.patient.cardNumber})
                          </Link>
                        )}
                      </div>
                    </td>

                    {/* Inspect button */}
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
            <span className="text-xs text-slate-500 font-semibold">
              Page {currentPage} of {totalPages} ({totalResults} total logs)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                disabled={currentPage === totalPages || loading}
                className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Inspector Overlay Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-700 border border-primary-100 flex items-center justify-center shrink-0">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Event Audit Inspector</h3>
                    <p className="text-xs text-slate-400">Log ID: {selectedLog.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Basic Meta Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                      Who Performed Action
                    </span>
                    {selectedLog.actor ? (
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800 text-sm">{selectedLog.actor.name}</p>
                        <p className="text-xs text-slate-500">{selectedLog.actor.email}</p>
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider mt-1 ${getRoleBadgeStyle(selectedLog.actor.role)}`}>
                          {selectedLog.actor.role}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">System Process</span>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                      Event Timestamp
                    </span>
                    <p className="font-bold text-slate-800 text-sm">
                      {new Date(selectedLog.createdAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(selectedLog.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Resource targets */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                    Affected Resource Scope
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 font-medium block">Action Event Code:</span>
                      <span className="font-bold text-slate-800 text-sm capitalize">{formatActionLabel(selectedLog.action)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Resource Category:</span>
                      <span className="font-semibold text-slate-800 capitalize">{getResourceLabel(selectedLog)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Branch:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedLog.branch?.name || "Unassigned / legacy"}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400 font-medium block">Resource Reference ID:</span>
                      <span className="font-mono bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded text-slate-600">
                        {selectedLog.resourceId || "None"}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-400 font-medium block">Source IP Address:</span>
                      <span className="font-mono text-slate-600">{formatIpAddress(selectedLog.ipAddress) || "Unknown"}</span>
                    </div>
                  </div>

                  {selectedLog.patient && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400 font-medium block">Associated Patient Context:</span>
                        <span className="font-bold text-slate-800">{selectedLog.patient.name}</span>
                        <span className="text-slate-400 ml-1">({selectedLog.patient.cardNumber})</span>
                      </div>
                      <Link
                        to={getResourceRoute(selectedLog) || `/patients/${selectedLog.patientId}/records`}
                        onClick={() => setSelectedLog(null)}
                        className="px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-primary-100"
                      >
                        {getResourceButtonLabel(selectedLog)}
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Metadata JSON Viewer */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                    Event Log Metadata Context
                  </h4>
                  {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-sm divide-y divide-slate-100">
                      {Object.entries(selectedLog.metadata).map(([key, val]) => (
                        <div key={key} className="p-3 text-xs flex justify-between items-center hover:bg-slate-50/50 transition-colors">
                          <span className="font-semibold text-slate-500 font-mono">{key}</span>
                          <span className="font-mono text-slate-800 font-medium">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                      <AlertCircle size={14} className="text-slate-400" />
                      No complex metadata payloads recorded for this action.
                    </div>
                  )}
                </div>
              </div>


            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
