import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ui/ConfirmModal";
import { getEntityId } from "../utils/entityId";

export default function TrashPatients() {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(new Set()); // Use Set for persistent selection
  const [toast, setToast] = useState({ message: "", type: "", show: false });
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 700);
    return () => clearTimeout(handler);
  }, [search]);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [pageCursors, setPageCursors] = useState([null]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);

  // =========================
  // FETCH TRASHED PATIENTS
  // =========================
  const fetchPatients = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      const res = await api.get("/patients/trash/all", {
        params: {
          page: currentPage,
          limit: perPage,
          cursor: pageCursors[currentPage - 1] || undefined,
          search: debouncedSearch.trim() || undefined,
        },
      });
      if (requestId !== requestIdRef.current) return;
      const pageData = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];
      setPatients(pageData);
      setTotalPages(Number(res.data?.totalPages) || 1);
      setTotalResults(Number(res.data?.total) || pageData.length);
      setNextCursor(res.data?.nextCursor || null);
      setHasMore(Boolean(res.data?.hasMore));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error(err);
      showToast("Failed to fetch patients", "error");
      setPatients([]);
      setTotalPages(1);
      setTotalResults(0);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [currentPage, pageCursors, perPage, debouncedSearch]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    setCurrentPage(1);
    setPageCursors([null]);
  }, [debouncedSearch]);

  // =========================
  // TOAST
  // =========================
  const showToast = (message, type = "success") => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: "", type, show: false }), 3000);
  };

  // =========================
  // SELECTION
  // =========================
  const toggleSelect = (id) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const toggleSelectAll = () => {
    const currentIds = patients.map((patient) => getEntityId(patient));
    const allSelected = currentIds.every((id) => selected.has(id));
    const newSet = new Set(selected);
    currentIds.forEach((id) => (allSelected ? newSet.delete(id) : newSet.add(id)));
    setSelected(newSet);
  };

  // =========================
  // BULK ACTIONS
  // =========================
  const executeRestore = async () => {
    setLoading(true);
    try {
      await api.put("/patients/trash/restore", { ids: Array.from(selected) });
      showToast("Selected patients restored");
      setSelected(new Set());
      fetchPatients();
    } catch (err) {
      console.error(err);
      showToast("Failed to restore patients", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = () => {
    if (!selected.size) return showToast("No patients selected", "error");
    setConfirmConfig({
      title: "Restore Patients",
      message: `Are you sure you want to restore the selected ${selected.size} patient(s)? Their clinical records will be active again.`,
      confirmText: "Restore Patients",
      danger: false,
      onConfirm: executeRestore,
    });
  };

  const executePermanentDelete = async () => {
    setLoading(true);
    try {
      await api.delete("/patients/trash/permanent", { data: { ids: Array.from(selected) } });
      showToast("Selected patients permanently deleted");
      setSelected(new Set());
      fetchPatients();
    } catch (err) {
      console.error(err);
      showToast("Failed to delete patients", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = () => {
    if (!selected.size) return showToast("No patients selected", "error");
    setConfirmConfig({
      title: "Delete Permanently",
      message: `Are you sure you want to permanently delete the selected ${selected.size} patient(s)? This action cannot be undone and all associated records will be lost forever.`,
      confirmText: "Delete Forever",
      danger: true,
      onConfirm: executePermanentDelete,
    });
  };

  // =========================
  // PAGINATION
  // =========================
  const goToNextPage = () => {
    if (!hasMore || !nextCursor) return;
    setPageCursors((current) => {
      const next = current.slice(0, currentPage);
      next[currentPage] = nextCursor;
      return next;
    });
    setCurrentPage((page) => page + 1);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage((page) => page - 1);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-4">
      <h1 className="text-xl font-bold mb-4">Trash Patients</h1>

      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
        <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" />
        <div>
          <span className="font-semibold">Notice:</span> Records moved to the Trash will stay here for 6 months from the day they were deleted. After 6 months, they will be automatically and permanently deleted forever.
        </div>
      </div>

      {toast.show && <Toast message={toast.message} type={toast.type} />}

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <input
          type="text"
          placeholder="Search by name or age..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-2 py-1 border rounded mb-2 sm:mb-0 flex-1"
        />
        <button
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          disabled={!selected.size || loading}
          onClick={handleRestore}
        >
          Restore
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
              <th className="p-3 text-center w-12">
                <input
                  type="checkbox"
                  checked={
                    patients.length > 0 &&
                    patients.every((patient) =>
                      selected.has(getEntityId(patient)),
                    )
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="p-3">Name</th>
              <th className="p-3">Age</th>
              <th className="p-3">Deleted At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {patients.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center p-8 text-slate-400 font-medium">
                  No trashed patients
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr key={getEntityId(p)} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(getEntityId(p))}
                      onChange={() => toggleSelect(getEntityId(p))}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600">{p.age}</td>
                  <td className="p-3 text-slate-500">{new Date(p.updatedAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            className="px-3 py-1 border rounded"
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span className="px-3 py-1 text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="px-3 py-1 border rounded"
            onClick={goToNextPage}
            disabled={!hasMore || !nextCursor}
          >
            Next
          </button>
        </div>
      )}
      <div className="mt-3 text-center text-sm text-slate-500">
        Showing {patients.length} of {totalResults} trashed patients
      </div>

      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        {...confirmConfig}
      />
    </motion.div>
  );
}
