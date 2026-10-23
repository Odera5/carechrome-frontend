import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Users, Calendar, Activity, CreditCard, Search, RefreshCw, ArchiveRestore, Trash2, Upload, Download, Lock, Globe, AlertCircle
} from "lucide-react";
import CsvImportModal from "../components/Patients/CsvImportModal";
import api from "../services/api";
import Toast from "../components/Toast";
import { getEntityId } from "../utils/entityId";
import { Card, CardContent } from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import usePersistentState from "../hooks/usePersistentState";
import {
  getDashboardSummary,
  subscribeDashboardSummary,
  readDashboardSummaryCache,
} from "../services/dashboardSummary";
import {
  hasActiveProAccess,
  hasEnterpriseAccess,
} from "../utils/clinicAccess";
import { getStoredUserObject } from "../utils/authStorage";

const PATIENTS_PER_PAGE = 25;

const formatLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const defaultWaitingSummary = { waiting: 0, called: 0, in_consultation: 0, completed: 0, total: 0 };

const shouldSuppressDashboardError = (error) => {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.message || error?.message || "").toLowerCase().trim();
  if ([400, 404].includes(status)) return true;
  return message.includes("not found") || message.includes("no appointment") || message.includes("no invoice") || message.includes("no record") || message.includes("no data");
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const cachedSummary = readDashboardSummaryCache().data;

  const storedUser = getStoredUserObject() || {};
  const enterpriseAccess = hasEnterpriseAccess(storedUser?.clinic);
  const user = {
    role: storedUser.role || "nurse",
  };
  const canViewRevenue = storedUser.isClinicOwner || ["admin", "branch_manager"].includes(user.role);
  
  const canViewRecords = ["admin", "branch_manager", "doctor", "nurse"].includes(user.role);
  const canDeletePatients = ["admin", "branch_manager", "doctor", "nurse"].includes(user.role);

  const [patients, setPatients] = useState([]);
  const [patientsToday, setPatientsToday] = useState(
    cachedSummary?.patients?.today || 0,
  );
  const [appointmentsToday, setAppointmentsToday] = useState(
    cachedSummary?.appointments?.today || 0,
  );
  const [scheduledAppointments, setScheduledAppointments] = useState(
    cachedSummary?.appointments?.scheduled || 0,
  );
  const [waitingSummary, setWaitingSummary] = useState(
    cachedSummary?.waitingRoom || defaultWaitingSummary,
  );
  const [monthlyRevenue, setMonthlyRevenue] = useState(
    canViewRevenue ? cachedSummary?.billing?.monthlyRevenue || 0 : 0,
  );
  const [trash, setTrash] = useState([]);
  const [directoryState, setDirectoryState] = usePersistentState(
    "carechrome:draft:dashboard-directory",
    { searchQuery: "", sortConfig: { key: null, direction: "asc" }, currentPage: 1, globalSearch: false },
  );
  const { searchQuery, sortConfig, currentPage, globalSearch } = directoryState;
  const [loading, setLoading] = useState(true);
  const directoryRequestId = useRef(0);
  const [toast, setToast] = useState(null);
  const [currentDay, setCurrentDay] = useState(formatLocalDateKey());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [patientTotal, setPatientTotal] = useState(0);
  const [patientTotalPages, setPatientTotalPages] = useState(1);
  const [patientNextCursor, setPatientNextCursor] = useState(null);
  const [patientHasMore, setPatientHasMore] = useState(false);
  const [trashTotal, setTrashTotal] = useState(0);
  const [trashTotalPages, setTrashTotalPages] = useState(1);
  const [trashNextCursor, setTrashNextCursor] = useState(null);
  const [trashHasMore, setTrashHasMore] = useState(false);
  const [pageCursors, setPageCursors] = useState([null]);

  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  const triggerConfetti = () => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.pointerEvents = "none";
    container.style.zIndex = "99999";
    document.body.appendChild(container);

    const colors = ["#f43f5e", "#3b82f6", "#10b981", "#eab308", "#a855f7", "#ff7849"];
    for (let i = 0; i < 150; i++) {
      const p = document.createElement("div");
      p.style.position = "absolute";
      p.style.width = `${Math.random() * 10 + 6}px`;
      p.style.height = `${Math.random() * 10 + 6}px`;
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      
      p.style.top = `-20px`;
      p.style.left = `${Math.random() * 100}vw`;
      
      const duration = Math.random() * 3 + 2.5;
      const delay = Math.random() * 1.5;
      p.style.transition = `transform ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s, opacity ${duration}s ease ${delay}s`;
      
      container.appendChild(p);

      setTimeout(() => {
        p.style.transform = `translate(${Math.random() * 300 - 150}px, 105vh) rotate(${Math.random() * 720}deg)`;
        p.style.opacity = "0";
      }, 100);
    }

    setTimeout(() => {
      container.remove();
    }, 7000);
  };

  useEffect(() => {
    if (storedUser?.dateOfBirth && storedUser?.name) {
      const todayObj = new Date();
      const currentYear = todayObj.getFullYear();
      const curMonth = String(todayObj.getMonth() + 1).padStart(2, "0");
      const curDay = String(todayObj.getDate()).padStart(2, "0");
      
      const dob = storedUser.dateOfBirth;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        const [, birthMonth, birthDay] = dob.split("-");
        
        if (birthMonth === curMonth && birthDay === curDay) {
          const celebrationKey = `carechrome:birthday-celebrated:${storedUser.id}:${currentYear}`;
          const alreadyCelebrated = localStorage.getItem(celebrationKey);
          if (!alreadyCelebrated) {
            setShowBirthdayModal(true);
            localStorage.setItem(celebrationKey, "true");
          }
        }
      }
    }
  }, [storedUser?.dateOfBirth, storedUser?.name, storedUser?.id]);

  useEffect(() => {
    if (showBirthdayModal) {
      triggerConfetti();
      const timer = setTimeout(triggerConfetti, 1200);
      return () => clearTimeout(timer);
    }
  }, [showBirthdayModal]);

  const showTrash = location.search.includes("tab=trash");
  const proAccessActive = hasActiveProAccess(storedUser?.clinic);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery.trim());
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 700);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const showToast = (message, type = "success") => setToast({ message, type });

  const applySummary = useCallback((summary = {}) => {
    setPatientsToday(summary?.patients?.today || 0);
    setAppointmentsToday(summary?.appointments?.today || 0);
    setScheduledAppointments(summary?.appointments?.scheduled || 0);
    setWaitingSummary(summary?.waitingRoom || defaultWaitingSummary);
    setMonthlyRevenue(
      canViewRevenue ? summary?.billing?.monthlyRevenue || 0 : 0,
    );
  }, [canViewRevenue]);

  useEffect(() => {
    const unsubscribe = subscribeDashboardSummary((summary) => {
      applySummary(summary || {});
    });

    return () => {
      unsubscribe();
    };
  }, [applySummary]);

  const exportCSV = () => {
    if (!proAccessActive) {
      setShowUpgradeModal(true);
      return;
    }
    const runExport = async () => {
      try {
        const res = await api.get("/patients/export.csv", {
          responseType: "blob",
        });
        const blob = res.data;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `patients_export_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showToast("Export successful!");
      } catch (err) {
        console.error(err);
        showToast("Failed to export patients", "error");
      }
    };

    runExport();
  };

  const handleImportClick = () => {
    if (!proAccessActive) {
      setShowUpgradeModal(true);
      return;
    }
    setShowImportModal(true);
  };

  const handleImportSuccess = (count) => {
    setShowImportModal(false);
    showToast(`Successfully imported ${count} legacy patient records!`);
    fetchPatients();
    fetchSummary();
  };

  const fetchSummary = useCallback(async () => {
    try {
      const cachedSummary = readDashboardSummaryCache();
      if (cachedSummary.data) {
        applySummary(cachedSummary.data);
      }

      const summary = await getDashboardSummary({ forceRefresh: true });
      applySummary(summary);
    } catch (err) {
      console.error(err);
      applySummary();
      if (!shouldSuppressDashboardError(err)) showToast("Failed to load dashboard summary", "error");
    }
  }, [applySummary]);

  const fetchPatients = useCallback(async () => {
    const requestId = ++directoryRequestId.current;
    try {
      setLoading(true);
      const res = await api.get("/patients", {
        params: {
          page: currentPage,
          limit: PATIENTS_PER_PAGE,
          cursor: pageCursors[currentPage - 1] || undefined,
          search: debouncedSearchQuery || undefined,
          sortBy: sortConfig.key || undefined,
          sortDirection: sortConfig.key ? sortConfig.direction : "desc",
          global: globalSearch || undefined,
        },
      });
      if (requestId !== directoryRequestId.current) return;
      const pageData = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];

      setPatients(pageData.filter((p) => p && !p.isDeleted));
      setPatientTotal(Number(res.data?.total) || pageData.length);
      setPatientTotalPages(Number(res.data?.totalPages) || 1);
      setPatientNextCursor(res.data?.nextCursor || null);
      setPatientHasMore(Boolean(res.data?.hasMore));
    } catch (err) {
      if (requestId !== directoryRequestId.current) return;
      console.error(err);
      setPatients([]);
      setPatientTotal(0);
      setPatientTotalPages(1);
      setPatientNextCursor(null);
      setPatientHasMore(false);
      showToast("Failed to load patients", "error");
    } finally {
      if (requestId === directoryRequestId.current) setLoading(false);
    }
  }, [currentPage, debouncedSearchQuery, globalSearch, pageCursors, sortConfig.direction, sortConfig.key]);

  const fetchTrash = useCallback(async () => {
    if (user.role !== "admin") return;
    const requestId = ++directoryRequestId.current;
    try {
      setLoading(true);
      const res = await api.get("/patients/trash/all", {
        params: {
          page: currentPage,
          limit: PATIENTS_PER_PAGE,
          cursor: pageCursors[currentPage - 1] || undefined,
          search: debouncedSearchQuery || undefined,
          sortBy: sortConfig.key || undefined,
          sortDirection: sortConfig.key ? sortConfig.direction : "desc",
        },
      });
      if (requestId !== directoryRequestId.current) return;
      const pageData = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];

      setTrash(pageData.map((p) => ({ ...p, name: p.name || p.fullName || "Unknown" })));
      setTrashTotal(Number(res.data?.total) || pageData.length);
      setTrashTotalPages(Number(res.data?.totalPages) || 1);
      setTrashNextCursor(res.data?.nextCursor || null);
      setTrashHasMore(Boolean(res.data?.hasMore));
    } catch (err) {
      if (requestId !== directoryRequestId.current) return;
      console.error(err);
      setTrash([]);
      setTrashTotal(0);
      setTrashTotalPages(1);
      setTrashNextCursor(null);
      setTrashHasMore(false);
      if (!shouldSuppressDashboardError(err)) showToast("Failed to load trash", "error");
    } finally {
      if (requestId === directoryRequestId.current) setLoading(false);
    }
  }, [
    currentPage,
    debouncedSearchQuery,
    pageCursors,
    sortConfig.direction,
    sortConfig.key,
    user.role,
  ]);

  useEffect(() => {
    if (showTrash) return;
    fetchPatients();
    fetchSummary();
  }, [fetchPatients, fetchSummary, showTrash]);

  useEffect(() => {
    if (showTrash && user.role === "admin") {
      fetchTrash();
    }
  }, [fetchTrash, showTrash, user.role]);

  useEffect(() => {
    if (location.state?.newPatient) {
      fetchPatients();
      fetchSummary();
      window.history.replaceState({}, document.title);
    }
  }, [fetchPatients, fetchSummary, location.state]);

  useEffect(() => {
    const today = formatLocalDateKey();
    if (today !== currentDay) setCurrentDay(today);
  }, [currentDay]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setDirectoryState((current) => ({ ...current, sortConfig: { key, direction } }));
  };

  const activeList = showTrash ? trash : patients.filter((p) => p && p.name);
  const totalPages = showTrash ? Math.max(1, trashTotalPages) : Math.max(1, patientTotalPages);
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStartIndex = (currentPageSafe - 1) * PATIENTS_PER_PAGE;
  const paginatedPatients = activeList;
  const totalResults = showTrash ? trashTotal : patientTotal;
  const hasMorePages = showTrash ? trashHasMore : patientHasMore;
  const nextPageCursor = showTrash ? trashNextCursor : patientNextCursor;

  useEffect(() => {
    setDirectoryState((current) => ({ ...current, currentPage: 1 }));
    setPageCursors([null]);
  }, [debouncedSearchQuery, globalSearch, setDirectoryState, showTrash, sortConfig]);

  const goToNextPatientPage = () => {
    if (!hasMorePages || !nextPageCursor) return;
    setPageCursors((current) => {
      const next = current.slice(0, currentPage);
      next[currentPage] = nextPageCursor;
      return next;
    });
    setDirectoryState((current) => ({
      ...current,
      currentPage: current.currentPage + 1,
    }));
  };

  const goToPreviousPatientPage = () => {
    if (currentPageSafe <= 1) return;
    setDirectoryState((current) => ({
      ...current,
      currentPage: current.currentPage - 1,
    }));
  };
  useEffect(() => {
    if (currentPage > totalPages) {
      setDirectoryState((current) => ({ ...current, currentPage: totalPages }));
    }
  }, [currentPage, setDirectoryState, totalPages]);

  const executeDelete = async (patientId) => {
    try {
      const res = await api.delete(`/patients/${patientId}`);
      if (res.status === 200) {
        fetchPatients();
        fetchTrash();
        fetchSummary();
        showToast(res.data.message || "Patient moved to Trash");
      } else showToast("Failed to delete patient", "error");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete patient", "error");
    }
  };

  const handleDelete = (patientId) => {
    setConfirmConfig({
      title: "Move to Trash",
      message: "Move this patient to the Trash? You can restore them later if needed.",
      confirmText: "Move to Trash",
      danger: true,
      onConfirm: () => executeDelete(patientId)
    });
  };

  const executeRestore = async (patientId) => {
    try {
      const res = await api.put(`/patients/${patientId}/restore`);
      if (res.status === 200) {
        fetchPatients();
        fetchTrash();
        fetchSummary();
        showToast("Patient restored successfully");
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to restore patient", "error");
    }
  };

  const handleRestore = (patientId) => {
    setConfirmConfig({
      title: "Restore Patient",
      message: "Are you sure you want to restore this patient? Their clinical records will be active again.",
      confirmText: "Restore Patient",
      danger: false,
      onConfirm: () => executeRestore(patientId)
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-4 md:p-6 space-y-8 h-full">
      {toast && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast(null)} />}
      {showImportModal && (
        <CsvImportModal 
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {!showTrash && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mt-2">
                <div>
                  <p className="text-sm font-medium text-slate-500">Patients Today</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">{patientsToday}</h3>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
                  <Users size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mt-2">
                <div>
                  <p className="text-sm font-medium text-slate-500">Appointments</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2 flex items-center">
                    {scheduledAppointments}
                    <span className="ml-3 text-xs font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full shadow-sm">
                      Today {appointmentsToday}
                    </span>
                  </h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
                  <Calendar size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mt-2">
                <div>
                  <p className="text-sm font-medium text-slate-500">Waiting Room</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">{waitingSummary.waiting}</h3>
                </div>
                <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
                  <Activity size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          {canViewRevenue && (
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Monthly Revenue</p>
                    <h3 className="text-2xl lg:text-[28px] font-bold text-slate-900 mt-2 tracking-tight whitespace-nowrap">
                      <span className="text-base text-slate-400 font-medium align-top mr-1">₦</span>
                      {monthlyRevenue.toLocaleString()}
                    </h3>
                  </div>
                  <div className="p-3 bg-primary-100 rounded-xl text-primary-600">
                    <CreditCard size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surface-200 bg-surface-50 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full lg:w-auto">
            <h2 className="text-lg font-semibold text-slate-800 shrink-0">
              {showTrash ? "Deleted Records" : "Patient Directory"}
            </h2>
            
            {/* Search Bar - Shifted towards the center/next to title */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto lg:ml-4">
              <div className="w-full sm:w-72">
                <Input 
                  placeholder="Search by name, card, age, phone..."
                  value={searchQuery}
                  onChange={(e) => setDirectoryState((current) => ({ ...current, searchQuery: e.target.value }))}
                  onClear={() => setDirectoryState((current) => ({ ...current, searchQuery: "" }))}
                  icon={Search}
                  className="bg-white"
                />
              </div>
              {enterpriseAccess && !showTrash && (
                <button
                  type="button"
                  onClick={() => setDirectoryState(s => ({ ...s, globalSearch: !s.globalSearch }))}
                  className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors shrink-0 h-[38px] ${
                    globalSearch 
                      ? "bg-primary-50 border-primary-200 text-primary-700" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Search across all clinic branches"
                >
                  <Globe size={16} className={globalSearch ? "text-primary-500" : "text-slate-400"} />
                  <span className="hidden sm:inline">Global Search</span>
                </button>
              )}
            </div>
          </div>

          {!showTrash && canViewRecords && (
            <div className="flex flex-row items-center gap-3 shrink-0 mt-4 lg:mt-0">
              <Button variant="outline" size="sm" onClick={exportCSV} className="px-4 py-1.5 h-9 text-sm bg-white shadow-sm border-slate-300 whitespace-nowrap">
                <Download size={14} className="mr-2 shrink-0" /> Export
                {!proAccessActive && <Lock size={12} className="ml-1.5 text-amber-500 shrink-0" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportClick} className="px-4 py-1.5 h-9 text-sm bg-white shadow-sm border-slate-300 whitespace-nowrap">
                <Upload size={14} className="mr-2 shrink-0" /> Import
                {!proAccessActive && <Lock size={12} className="ml-1.5 text-amber-500 shrink-0" />}
              </Button>
            </div>
          )}
        </div>

        {showTrash && (
          <div className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <span className="font-semibold">Notice:</span> Records moved to the Trash will stay here for 6 months from the day they were deleted. After 6 months, they will be automatically and permanently deleted forever.
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="patient-directory-table w-full text-left text-sm text-slate-600 whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 border-b border-surface-200">
              <tr>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("name")}>
                  Patient Name
                </th>
                <th className="px-6 py-4 font-semibold cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => requestSort("age")}>
                  Age
                </th>
                <th className="px-6 py-4 font-semibold">Card Number</th>
                <th className="px-6 py-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin mb-2" />
                    Loading records...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center text-slate-500">
                     <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="bg-slate-50 p-4 rounded-full border border-slate-200 text-slate-400 mb-2">
                          {showTrash ? <Trash2 size={32} /> : searchQuery ? <Search size={32} /> : <Users size={32} />}
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">
                          {searchQuery ? "No matches found" : showTrash ? "Trash is empty" : "No patients yet"}
                        </h3>
                        <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                          {searchQuery 
                            ? "We couldn't find any patients matching that search. Try adjusting your key words." 
                            : showTrash 
                              ? "Your deleted records will appear here. Currently, it's squeaky clean!" 
                              : "Your clinic database is waiting. Start by securely registering your first patient!"}
                        </p>
                     </div>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((p) => {
                  const patientId = getEntityId(p);
                  const isToday = formatLocalDateKey(p.createdAt) === currentDay;
                  return (
                    <tr key={patientId} className={`hover:bg-slate-50 transition-colors ${!showTrash && isToday ? "bg-primary-50/50" : ""}`}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{p.name}</div>
                        {isToday && !showTrash && <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-100 text-primary-800">New Today</span>}
                      </td>
                      <td className="px-6 py-4">{p.age}</td>
                      <td className="px-6 py-4"><span className="font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{p.cardNumber || "--"}</span></td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          {!showTrash && canViewRecords && (
                            <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${patientId}/records`)}>
                              Records
                            </Button>
                          )}
                          {showTrash ? (
                            <>
                              <Button variant="outline" size="sm" className="text-emerald-600 border-emerald-200 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => handleRestore(patientId)}>
                                <ArchiveRestore size={16} className="mr-1" /> Restore
                              </Button>
                            </>
                          ) : canDeletePatients ? (
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(patientId)}>
                              <Trash2 size={18} />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-surface-200 bg-surface-50 gap-4">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-900">{activeList.length > 0 ? pageStartIndex + 1 : 0}</span> to <span className="font-medium text-slate-900">{pageStartIndex + activeList.length}</span> of <span className="font-medium text-slate-900">{totalResults}</span> results
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousPatientPage} disabled={currentPageSafe <= 1}>
              Previous
            </Button>
            <div className="flex items-center px-4 text-sm font-medium text-slate-700 whitespace-nowrap">
              {currentPageSafe} / {totalPages}
            </div>
            <Button variant="outline" size="sm" onClick={goToNextPatientPage} disabled={!hasMorePages || !nextPageCursor}>
              Next
            </Button>
          </div>
        </div>
      </div>

      {showUpgradeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Pro Plan Feature</h3>
            <p className="text-slate-500 text-sm mb-6">
              Bulk importing legacy patients and exporting your patient database require active Pro access through your 14-day trial or paid Pro subscription.
              {user.role !== "admin" && " Please contact your clinic administrator to upgrade."}
            </p>
            <div className="flex w-full gap-3">
              <Button type="button" variant="outline" className={user.role === "admin" ? "flex-1 border-slate-200" : "w-full border-slate-200"} onClick={() => setShowUpgradeModal(false)}>Close</Button>
              {user.role === "admin" && (
                <Button type="button" className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg font-bold" onClick={() => navigate("/upgrade")}>Upgrade Now</Button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={!!confirmConfig} 
        onClose={() => setConfirmConfig(null)} 
        {...confirmConfig} 
      />

      {/* Birthday Celebration Modal */}
      {showBirthdayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-gradient-to-br from-indigo-900 via-slate-900 to-emerald-950 text-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-white/10 relative p-8 text-center"
          >
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center">
              <span className="text-6xl mb-4 animate-bounce">🎂</span>
              
              <h2 className="text-3xl font-black bg-gradient-to-r from-amber-200 via-rose-300 to-primary-300 bg-clip-text text-transparent mb-2">
                Happy Birthday, {storedUser?.name?.split(" ")[0]}!
              </h2>
              
              <p className="text-slate-300 font-medium text-lg mb-6">
                From all of us at CareChrome, we wish you a beautiful day filled with love, laughter, and happiness!
              </p>

              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 w-full mb-8 text-left">
                <p className="text-slate-200 text-sm leading-relaxed italic">
                  "Thank you for everything you do to make our clinic a warm, supportive, and wonderful place. We appreciate your dedication and care every single day. Have a fabulous celebration!"
                </p>
              </div>

              <button
                onClick={() => setShowBirthdayModal(false)}
                className="w-full h-14 bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black text-lg rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200"
              >
                Thank you! 💖
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
