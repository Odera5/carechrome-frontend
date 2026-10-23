import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  User,
  Calendar,
  Clock,
  CreditCard,
  UserPlus,
  LogOut,
  Trash2,
  Home,
  Menu,
  X,
  Settings,
  Crown,
  BarChart3,
  Inbox,
  Building2,
  ChevronDown,
  Check,
  History,
  ChevronLeft,
  ChevronRight,
  Camera,
  Download,
  WifiOff,
} from "lucide-react";
import api, { logoutCurrentUser } from "../../services/api";
import {
  getDashboardSummary,
  readDashboardSummaryCache,
  subscribeDashboardSummary,
} from "../../services/dashboardSummary";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Toast from "../Toast";
import carechromeLogo from "../../assets/CareChrome-white.webp";
import { getStoredUserObject, updateStoredUser } from "../../utils/authStorage";
import { resolveAssetUrl } from "../../utils/assetUrl";
import {
  BRANCHES_UPDATED_EVENT,
  getActiveBranchId,
  getAvailableBranches,
  setActiveBranch,
} from "../../utils/branchStorage";
import {
  hasActiveProAccess,
  hasActivePaidSubscription,
  isSubscriptionExpired,
  isTrialingClinic,
  getTrialDaysRemaining,
  hasEnterpriseAccess,
  isCancelledPaidSubscription,
  resolveSubscriptionEndDate,
} from "../../utils/clinicAccess";

function NavItem({
  icon: Icon,
  label,
  path,
  danger,
  badge,
  location,
  onNavigate,
}) {
  const NavIcon = Icon;
  const active =
    location.pathname === path.split("?")[0] &&
    (path.includes("tab=trash")
      ? location.search.includes("tab=trash")
      : !location.search.includes("tab=trash"));

  return (
    <button
      onClick={() => onNavigate(path)}
      className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl transition-all duration-200 mt-1 font-medium text-sm ${
        active && !danger
          ? "bg-primary-50 text-primary-700 shadow-sm"
          : danger
            ? "text-red-600 hover:bg-red-50 hover:text-red-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <NavIcon
        size={18}
        className={active && !danger ? "text-primary-600 shrink-0" : "shrink-0"}
      />
      <span className="whitespace-nowrap text-left flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center justify-center min-w-[20px] shadow-sm shrink-0">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

const BRANCH_SWITCH_SAFE_ROUTES = [
  "/dashboard",
  "/register-patient",
  "/appointments",
  "/waiting-room",
  "/pending-intakes",
  "/billing",
  "/reports",
  "/signup",
  "/clinic-settings",
  "/branches",
];

function getBranchSwitchDestination(pathname, search = "") {
  const isSafeRoute = BRANCH_SWITCH_SAFE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (!isSafeRoute) {
    return "/dashboard";
  }

  return `${pathname}${search || ""}`;
}

export default function DashboardLayout() {
  const MotionDiv = motion.div;
  const MotionAside = motion.aside;
  const navigate = useNavigate();
  const location = useLocation();
  const cachedSummary = readDashboardSummaryCache().data;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstallable(false);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", JSON.stringify(next));
      } catch (e) {
        console.error("Failed to save sidebar collapsed state", e);
      }
      return next;
    });
  };
  const [appointmentCount, setAppointmentCount] = useState(
    cachedSummary?.appointments?.scheduled || 0,
  );
  const [waitingCount, setWaitingCount] = useState(
    cachedSummary?.waitingRoom?.active || 0,
  );
  const [pendingIntakesCount, setPendingIntakesCount] = useState(
    cachedSummary?.intakes?.pending || 0,
  );
  const [showTrialBanner, setShowTrialBanner] = useState(false);
  const [clinicState, setClinicState] = useState(null);
  const [branchState, setBranchState] = useState(() => {
    const stored = getStoredUserObject() || {};
    return stored.branch || null;
  });
  const [availableBranches, setAvailableBranches] = useState(() =>
    getAvailableBranches(),
  );
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchMenuRef = useRef(null);

  const storedUser = getStoredUserObject() || {};
  const [profileRoleLabel] = useState(() => {
    if (storedUser.isClinicOwner && storedUser.role === "admin") return "Clinic Owner";
    if (storedUser.customRoleTitle) return storedUser.customRoleTitle;
    if (storedUser.role === "nurse") return "Nurse / Desk";
    if (storedUser.role === "branch_manager") return "Branch Manager";
    return storedUser.role || "Role unavailable";
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserDob, setCurrentUserDob] = useState("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDob, setProfileDob] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileToast, setProfileToast] = useState(null);
  const [layoutToast, setLayoutToast] = useState(null);

  useEffect(() => {
    const stored = getStoredUserObject() || {};
    setCurrentUserName(stored.name || stored.email || "User");
    setCurrentUserDob(stored.dateOfBirth || "");
    setCurrentUserAvatar(stored.avatarUrl || "");
  }, []);

  const user = {
    name: currentUserName || storedUser.name || storedUser.email || "User",
    role: storedUser.role || "",
    displayRole: profileRoleLabel,
    clinicName: clinicState?.name || storedUser.clinic?.name || "Clinic",
    avatarUrl: currentUserAvatar || storedUser.avatarUrl || "",
  };

  const clinic = clinicState || storedUser.clinic || {};
  const activeBranch = branchState || storedUser.branch || null;
  const isAdmin = user.role === "admin";
  const isBranchManager = user.role === "branch_manager";
  const isBillingStaff = user.role === "billing_staff";
  const canAccessBilling =
    isAdmin || isBillingStaff || Boolean(storedUser.canAccessBilling);
  const clinicPlan = clinic.plan || "PRO";
  const isPaidTier = ["PRO", "ENTERPRISE"].includes(clinicPlan);
  const subscriptionExpired = isSubscriptionExpired(clinic);
  const subscriptionEnds = resolveSubscriptionEndDate(clinic) || clinic.subscriptionEnds;
  const paidSubscriptionActive = hasActivePaidSubscription(clinic);
  const activeProAccess = hasActiveProAccess(clinic);
  const enterpriseAccess = hasEnterpriseAccess(clinic);
  const trialing = isTrialingClinic(clinic);
  const remainingTrialDays = getTrialDaysRemaining(clinic);
  const isSubscriptionCancelled = isCancelledPaidSubscription(clinic);
  let remainingPaidDays = 0;

  if (isPaidTier && subscriptionEnds && paidSubscriptionActive) {
    const end = new Date(subscriptionEnds);
    const now = new Date();
    const endDate = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const nowDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.max(
      0,
      Math.ceil((endDate - nowDate) / (1000 * 60 * 60 * 24)),
    );
    remainingPaidDays = days;
  }

  useEffect(() => {
    if (
      !isPaidTier ||
      paidSubscriptionActive ||
      remainingTrialDays <= 0
    )
      return;

    let hideTimer;
    const showTimer = setTimeout(() => {
      setShowTrialBanner(true);

      if (remainingTrialDays > 3) {
        hideTimer = setTimeout(() => {
          setShowTrialBanner(false);
        }, 10000);
      }
    }, 2000);

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isPaidTier, remainingTrialDays, paidSubscriptionActive]);

  const canViewRecords =
    ["admin", "branch_manager", "doctor", "nurse"].includes(user.role) && activeProAccess;
  const showRestrictedAdminShell =
    subscriptionExpired && isAdmin;

  const applySummary = (summary = {}) => {
    setAppointmentCount(summary?.appointments?.scheduled || 0);
    setWaitingCount(summary?.waitingRoom?.active || 0);
    setPendingIntakesCount(summary?.intakes?.pending || 0);
  };

  useEffect(() => {
    if (!canViewRecords) return;

    const unsubscribe = subscribeDashboardSummary((summary) => {
      applySummary(summary || {});
    });

    const fetchCounts = async ({ forceRefresh = false } = {}) => {
      if (!canViewRecords) return;
      try {
        const summary = await getDashboardSummary({ forceRefresh });
        applySummary(summary);
      } catch {
        // ignore for badges
      }
    };

    fetchCounts({ forceRefresh: true });
    const intervalId = setInterval(() => fetchCounts({ forceRefresh: true }), 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCounts({ forceRefresh: true });
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canViewRecords]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!branchMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (branchMenuRef.current?.contains(event.target)) return;
      setBranchMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setBranchMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [branchMenuOpen]);

  useEffect(() => {
    let isMounted = true;

    const syncClinicState = async () => {
      try {
        const response = await api.get("/auth/clinic-profile");
        const latestClinic = response.data?.clinic || null;
        const latestBranches = response.data?.branches || getAvailableBranches();
        const latestActiveBranch = response.data?.activeBranch || null;

        if (!isMounted || !latestClinic) {
          return;
        }

        setClinicState(latestClinic);
        setAvailableBranches(latestBranches);
        setBranchState(latestActiveBranch);
        updateStoredUser({
          clinic: latestClinic,
          branches: latestBranches,
          branchId: latestActiveBranch?.id || null,
          branch: latestActiveBranch,
        });

        if (!isAdmin && isSubscriptionExpired(latestClinic)) {
          await logoutCurrentUser();
          window.location.href = "/login";
          return;
        }

        if (isAdmin && isSubscriptionExpired(latestClinic)) {
          navigate("/upgrade", { replace: true });
        }
      } catch {
        // Let existing auth handling manage failures.
      }
    };

    syncClinicState();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, navigate]);

  useEffect(() => {
    let isMounted = true;

    const loadBranches = async () => {
      try {
        const response = await api.get("/branches");
        if (!isMounted) return;
        const branches = (response.data?.branches || []).filter(
          (branch) => branch?.isActive,
        );
        setAvailableBranches(branches);

        const requestedBranchId = getActiveBranchId();
        const primaryBranch = branches.find((branch) => branch.isPrimary) || branches[0] || null;
        const nextBranch = enterpriseAccess
          ? (branches.find((branch) => branch.id === requestedBranchId) || primaryBranch)
          : primaryBranch;

        if (nextBranch) {
          setBranchState(nextBranch);
          setActiveBranch(nextBranch);
          updateStoredUser({
            branches,
            branchId: nextBranch.id,
            branch: nextBranch,
          });
        }
      } catch {
        // ignore branch list failures and fall back to stored branch
      }
    };

    loadBranches();
    window.addEventListener(BRANCHES_UPDATED_EVENT, loadBranches);

    return () => {
      isMounted = false;
      window.removeEventListener(BRANCHES_UPDATED_EVENT, loadBranches);
    };
  }, [enterpriseAccess]);

  const handleBranchChange = async (nextBranchId) => {
    const nextBranch = availableBranches.find((branch) => branch.id === nextBranchId);
    if (!nextBranch) return;

    setBranchMenuOpen(false);
    setBranchState(nextBranch);
    setActiveBranch(nextBranch);
    updateStoredUser({
      branchId: nextBranch.id,
      branch: nextBranch,
      branches: availableBranches,
    });

    try {
      await getDashboardSummary({ forceRefresh: true });
    } catch {
      // page-level fetchers will retry
    }

    const destination = getBranchSwitchDestination(
      location.pathname,
      location.search,
    );
    window.location.assign(destination);
  };

  const handleOpenProfileModal = () => {
    const stored = getStoredUserObject() || {};
    setProfileName(stored.name || "");
    setProfileDob(stored.dateOfBirth || "");
    setProfileAvatar(stored.avatarUrl || "");
    setProfileToast(null);
    setShowProfileModal(true);
  };

  const compressAvatar = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.85
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      const optimizedFile = await compressAvatar(file);
      const formData = new FormData();
      formData.append("file", optimizedFile);
      const response = await api.post("/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfileAvatar(response.data.url);
      setProfileToast({ message: "Profile picture uploaded successfully", type: "success" });
    } catch (err) {
      console.error(err);
      setProfileToast({ message: err.response?.data?.message || "Upload failed", type: "error" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setProfileAvatar("");
    setProfileToast({ message: "Profile picture removed", type: "success" });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim()) {
      setProfileToast({ message: "Name is required", type: "error" });
      return;
    }
    try {
      setProfileSaving(true);
      const res = await api.put("/auth/profile", {
        name: profileName.trim(),
        dateOfBirth: profileDob || "",
        avatarUrl: profileAvatar || "",
      });

      updateStoredUser({
        name: res.data.user.name,
        dateOfBirth: res.data.user.dateOfBirth || "",
        avatarUrl: res.data.user.avatarUrl || "",
      });

      setCurrentUserName(res.data.user.name);
      setCurrentUserDob(res.data.user.dateOfBirth || "");
      setCurrentUserAvatar(res.data.user.avatarUrl || "");

      setProfileToast({ message: "Profile updated successfully!", type: "success" });
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileToast(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setProfileToast({ message: err.response?.data?.message || "Failed to update profile", type: "error" });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logoutCurrentUser();
    window.location.href = "/login";
  };

  const handleNavClick = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const canDisplayActiveBranch = enterpriseAccess && activeBranch;
  const canSwitchBranches =
    canDisplayActiveBranch && availableBranches.length > 1;

  // Determine header title based on pathname
  let headerTitle = "Overview";
  if (location.pathname.includes("/register-patient"))
    headerTitle = "Register Patient";
  else if (location.pathname.includes("/appointments"))
    headerTitle = "Appointments";
  else if (location.pathname.includes("/waiting-room"))
    headerTitle = "Waiting Room";
  else if (location.pathname.includes("/billing")) headerTitle = "Billing";
  else if (location.pathname.includes("/cash-reconciliation"))
    headerTitle = "Cash Reconciliation Review";
  else if (location.pathname.includes("/signup")) headerTitle = "Manage Staff";
  else if (location.pathname.includes("/clinic-settings"))
    headerTitle = "Clinic Settings";
  else if (location.pathname.includes("/audit-logs"))
    headerTitle = "Activity Logs";
  else if (location.pathname.includes("/branches"))
    headerTitle = "Manage Branches";
  else if (location.pathname.includes("/patients/"))
    headerTitle = "Patient Record";
  else if (location.pathname.includes("/upgrade")) headerTitle = "Upgrade Plan";
  else if (location.pathname.includes("/reports"))
    headerTitle = "Advanced Analytics";
  else if (location.pathname.includes("/pending-intakes"))
    headerTitle = "Pending Intakes";

  if (location.search.includes("tab=trash")) headerTitle = "Trash Management";

  return (
    <div className="flex h-screen bg-surface-50 font-sans overflow-hidden print:h-auto print:overflow-visible">
      <AnimatePresence>
        {mobileMenuOpen && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <MotionAside
        className={`fixed inset-y-0 left-0 z-50 bg-white flex flex-col print:hidden
          ${mobileMenuOpen ? "translate-x-0 w-64 border-r border-surface-200" : "-translate-x-full lg:translate-x-0 lg:relative lg:flex"}
          transition-all duration-300 ease-in-out
          ${isSidebarCollapsed ? "lg:w-0 lg:opacity-0 lg:border-r-0 lg:pointer-events-none lg:overflow-hidden" : "lg:w-64 lg:opacity-100 lg:border-r lg:border-surface-200"}
        `}
      >
        <div className="w-64 h-full flex flex-col shrink-0">
          <div className="flex items-center justify-between p-6 h-20 border-b border-surface-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl  p-1 ">
                <img
                  src={carechromeLogo}
                  alt="CareChrome logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight block leading-4">
                  CareChrome
                </span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                  {user.clinicName}
                  {enterpriseAccess && <Crown size={12} className="text-amber-500 shrink-0" />}
                </span>
                {enterpriseAccess && activeBranch && (
                  <span className="text-[10px] text-primary-600 font-semibold uppercase tracking-widest block mt-1">
                    {activeBranch.city || activeBranch.name}{activeBranch.area ? ` - ${activeBranch.area}` : ""}
                  </span>
                )}
              </div>
            </div>
            <button
              className="lg:hidden text-slate-500"
              onClick={() => setMobileMenuOpen(false)}
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Main Menu
              </p>
              {!showRestrictedAdminShell && (
                !isBillingStaff && <NavItem
                  icon={Home}
                  label="Dashboard"
                  path="/dashboard"
                  location={location}
                  onNavigate={handleNavClick}
                />
              )}
              {!showRestrictedAdminShell && canViewRecords && (
                <>
                  <NavItem
                    icon={UserPlus}
                    label="Register Patient"
                    path="/register-patient"
                    location={location}
                    onNavigate={handleNavClick}
                  />
                  <NavItem
                    icon={Inbox}
                    label="Pending Intakes"
                    path="/pending-intakes"
                    badge={pendingIntakesCount}
                    location={location}
                    onNavigate={handleNavClick}
                  />
                  <NavItem
                    icon={Calendar}
                    label="Appointments"
                    path="/appointments"
                    badge={appointmentCount}
                    location={location}
                    onNavigate={handleNavClick}
                  />
                  <NavItem
                    icon={Clock}
                    label="Waiting Room"
                    path="/waiting-room"
                    badge={waitingCount}
                    location={location}
                    onNavigate={handleNavClick}
                  />
                  {(isAdmin || isBranchManager) && (
                    <NavItem
                      icon={BarChart3}
                      label="Reports"
                      path="/reports"
                      location={location}
                      onNavigate={handleNavClick}
                    />
                  )}
                </>
              )}
              {!showRestrictedAdminShell && canAccessBilling && (
                <NavItem
                  icon={CreditCard}
                  label="Billing"
                  path="/billing"
                  location={location}
                  onNavigate={handleNavClick}
                />
              )}
            </div>

            {(isAdmin || isBranchManager) && !showRestrictedAdminShell && (
              <div>
                <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Administration
                </p>
                <NavItem
                  icon={Users}
                  label="Manage Staff"
                  path="/signup"
                  location={location}
                  onNavigate={handleNavClick}
                />
                {isBranchManager && (
                  <NavItem
                    icon={CreditCard}
                    label="Cash Reconciliation"
                    path="/cash-reconciliation"
                    location={location}
                    onNavigate={handleNavClick}
                  />
                )}
                {(isAdmin || isBranchManager) && (
                  <>
                    <NavItem
                      icon={History}
                      label="Activity Logs"
                      path="/audit-logs"
                      location={location}
                      onNavigate={handleNavClick}
                    />
                    {isAdmin && (
                      <NavItem
                        icon={Settings}
                        label="Clinic Settings"
                        path="/clinic-settings"
                        location={location}
                        onNavigate={handleNavClick}
                      />
                    )}
                    {isAdmin && (
                      <>
                        {enterpriseAccess && (
                          <NavItem
                            icon={Building2}
                            label="Manage Branches"
                            path="/branches"
                            location={location}
                            onNavigate={handleNavClick}
                          />
                        )}
                        <NavItem
                          icon={Trash2}
                          label="Trash"
                          path="/dashboard?tab=trash"
                          location={location}
                          onNavigate={handleNavClick}
                        />
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {isAdmin && (
              <div>
                <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {showRestrictedAdminShell ? "Renewal" : "Clinic Plan"}
                </p>
                <NavItem
                  icon={Crown}
                  label={showRestrictedAdminShell ? "Renew Subscription" : "Upgrade Plan"}
                  path="/upgrade"
                  location={location}
                  onNavigate={handleNavClick}
                />
              </div>
            )}

            {isInstallable && (
              <div className="mx-2 mt-4 p-4 bg-gradient-to-br from-primary-50 to-teal-50 border border-primary-100 rounded-2xl shadow-sm text-center">
                <p className="text-xs font-bold text-primary-800 mb-1 flex items-center justify-center gap-1.5">
                  <Download size={14} className="text-primary-600" />
                  Install CareChrome
                </p>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                  Access the clinic dashboard directly from your desktop or home screen.
                </p>
                <Button 
                  onClick={handleInstallClick} 
                  size="sm" 
                  className="w-full text-xs bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  Install App
                </Button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-surface-100 bg-surface-50 shrink-0">
            <div 
              onClick={handleOpenProfileModal} 
              className="flex items-center gap-3 px-4 py-2 mb-2 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors group"
              title="Click to edit profile"
            >
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200 group-hover:scale-105 transition-transform relative shrink-0 overflow-hidden">
                {user.avatarUrl ? (
                  <img src={resolveAssetUrl(user.avatarUrl)} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
                <div className="absolute -bottom-1 -right-1 bg-white border border-slate-200 rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Settings size={10} className="text-slate-500" />
                </div>
              </div>
              <div className="flex-1 truncate">
                <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary-700 transition-colors">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 capitalize truncate">{user.displayRole}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start pl-4 text-slate-600 hover:text-red-600 hover:bg-red-50"
              onClick={handleLogout}
              isLoading={isLoggingOut}
            >
              {!isLoggingOut && <LogOut size={18} className="mr-3" />}
              {isLoggingOut ? "Signing out…" : "Sign Out"}
            </Button>
          </div>
        </div>
      </MotionAside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-50/50 print:bg-white print:h-auto print:overflow-visible">
        {!isOnline && (
          <div className="bg-red-600 text-white text-xs font-semibold py-2.5 px-6 flex items-center justify-center gap-2 shadow-sm animate-pulse z-[20] shrink-0 print:hidden">
            <WifiOff size={14} />
            <span>You are currently offline. Running in offline mode; some changes will not sync until connection is restored.</span>
          </div>
        )}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-surface-200 flex items-center justify-between px-6 z-10 shrink-0 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <button
              className="hidden lg:flex p-2 rounded-lg bg-white border border-surface-200 text-slate-600 hover:bg-surface-50 hover:text-primary-600 transition-colors"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            <button
              className="p-2 rounded-lg bg-white border border-surface-200 text-slate-600 lg:hidden hover:bg-surface-50"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold text-slate-800">
              {headerTitle}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {canDisplayActiveBranch && (
              <div ref={branchMenuRef} className="relative hidden md:block">
                {canSwitchBranches ? (
                  <button
                    type="button"
                    onClick={() => setBranchMenuOpen((open) => !open)}
                    className={`group flex min-w-[220px] max-w-[320px] items-center gap-3 rounded-2xl border bg-white px-3.5 py-2.5 text-left shadow-sm transition-all duration-200 ${
                      branchMenuOpen
                        ? "border-primary-300 ring-4 ring-primary-100"
                        : "border-surface-200 hover:border-primary-200 hover:shadow-md"
                    }`}
                    aria-haspopup="listbox"
                    aria-expanded={branchMenuOpen}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100">
                      <Building2 size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Active Branch
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {activeBranch?.city || activeBranch?.name || "Select branch"}{activeBranch?.area ? ` - ${activeBranch.area}` : ""}
                      </span>
                    </span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-primary-500 ${branchMenuOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : (
                  <div className="flex min-w-[220px] max-w-[320px] cursor-default items-center gap-3 rounded-2xl border border-surface-200 bg-white px-3.5 py-2.5 text-left shadow-sm">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                      <Building2 size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Active Branch
                      </span>
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {activeBranch?.city || activeBranch?.name || "Select branch"}{activeBranch?.area ? ` - ${activeBranch.area}` : ""}
                      </span>
                    </span>
                  </div>
                )}

                <AnimatePresence>
                  {canSwitchBranches && branchMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-80 overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-2xl shadow-slate-200/70 ring-1 ring-slate-900/5"
                      role="listbox"
                    >
                      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Switch Branch</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">Choose where you are working from.</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto p-2">
                        {availableBranches.map((branch) => {
                          const isSelected = branch.id === activeBranch?.id;
                          const branchLabel = `${branch.city || branch.name}${branch.area ? ` - ${branch.area}` : ""}`;

                          return (
                            <button
                              key={branch.id}
                              type="button"
                              onClick={() => handleBranchChange(branch.id)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                                isSelected
                                  ? "bg-primary-50 text-primary-800"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-primary-100 text-primary-700" : "bg-slate-100 text-slate-500"}`}>
                                <Building2 size={16} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">{branchLabel}</span>
                                <span className="block truncate text-xs text-slate-500">{branch.name}</span>
                              </span>
                              {isSelected && <Check size={17} className="shrink-0 text-primary-600" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <div className="flex items-center gap-2 pl-4 text-sm font-medium text-slate-600 bg-white border border-surface-200 px-4 py-2 rounded-full shadow-sm">
              <Clock size={16} className="text-primary-500 hidden sm:block" />
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              })}
            </div>
          </div>
        </header>

        <AnimatePresence>
          {showRestrictedAdminShell && (
            <MotionDiv
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="bg-gradient-to-r from-rose-600 to-red-600 text-white px-4 py-3 text-center text-sm font-bold shadow-sm shrink-0 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 print:hidden"
            >
              <span className="flex items-center gap-2">
                <Crown size={18} />
                {clinic?.paystackSubscriptionStatus
                  ? "Your paid plan access has expired. Clinic operations are locked until renewal."
                  : "Your 14-day free trial has ended. Select a paid plan to restore full clinic operations."}
              </span>
              {location.pathname !== "/upgrade" && (
                <button
                  onClick={() => navigate("/upgrade")}
                  className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-xs transition-colors border border-white/30 backdrop-blur-sm shadow-sm"
                >
                  {clinic?.paystackSubscriptionStatus ? "Renew Now" : "Upgrade Plan"}
                </button>
              )}
            </MotionDiv>
          )}
          {trialing &&
            remainingTrialDays > 0 &&
            !showRestrictedAdminShell &&
            showTrialBanner && (
              <MotionDiv
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className={`text-white px-4 py-2.5 text-center text-sm font-bold shadow-sm shrink-0 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 overflow-hidden print:hidden ${
                  remainingTrialDays <= 3
                    ? "bg-gradient-to-r from-red-600 to-rose-600"
                    : "bg-gradient-to-r from-amber-500 to-orange-500"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Crown size={18} />
                  {remainingTrialDays <= 3 ? "URGENT: " : ""}You have{" "}
                  {remainingTrialDays} days left on your 14-day {clinicPlan === "ENTERPRISE" ? "Enterprise" : "Pro"} Trial.
                </span>
                <div className="flex items-center gap-2">
                  {location.pathname !== "/upgrade" && (
                    <button
                      onClick={() => {
                        if (isAdmin) {
                          navigate("/upgrade");
                        } else {
                          setLayoutToast({
                            message: "Only clinic administrators are authorized to manage subscription and billing.",
                            type: "error",
                          });
                        }
                      }}
                      className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-xs transition-colors border border-white/30 backdrop-blur-sm shadow-sm focus:outline-none"
                    >
                      Upgrade Now
                    </button>
                  )}
                  {remainingTrialDays > 3 && (
                    <button
                      onClick={() => {
                        setShowTrialBanner(false);
                      }}
                      className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full text-xs transition-colors focus:outline-none ml-2"
                      aria-label="Dismiss banner"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </MotionDiv>
            )}
        </AnimatePresence>

        {isPaidTier &&
          isSubscriptionCancelled &&
          subscriptionEnds &&
          new Date(subscriptionEnds) >= new Date() &&
          !showRestrictedAdminShell &&
          remainingPaidDays <= 7 && (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 text-center text-sm font-bold shadow-sm shrink-0 relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 print:hidden">
              <span className="flex items-center gap-2">
                <Crown size={18} /> {clinicPlan === "ENTERPRISE" ? "Enterprise" : "Pro"} Plan expires in {remainingPaidDays} {remainingPaidDays === 1 ? "day" : "days"} (
                {new Date(subscriptionEnds).toLocaleDateString("en-NG", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}). Reactivate subscription to avoid interruption.
              </span>
              {location.pathname !== "/upgrade" && (
                <button
                  onClick={() => {
                    if (isAdmin) {
                      navigate("/upgrade");
                    } else {
                      setLayoutToast({
                        message: "Only clinic administrators are authorized to manage subscription and billing.",
                        type: "error",
                      });
                    }
                  }}
                  className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full text-xs transition-colors border border-white/30 backdrop-blur-sm shadow-sm"
                >
                  Manage Billing
                </button>
              )}
            </div>
          )}

        <div className="flex-1 overflow-y-auto w-full relative print:overflow-visible">
          <Outlet />
        </div>
      </main>

      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 relative"
            >
              {/* Top Gradient Banner */}
              <div className="h-2 bg-gradient-to-r from-primary-500 via-rose-500 to-amber-500" />
              
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Edit Profile</h3>
                    <p className="text-xs text-slate-500 mt-1">Keep your clinic staff credentials and birthday up to date.</p>
                  </div>
                  <button 
                    onClick={() => setShowProfileModal(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  {/* Avatar Upload Container */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="relative group">
                      <div 
                        onClick={() => !uploadingAvatar && document.getElementById('avatar-upload').click()}
                        className="h-24 w-24 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-3xl cursor-pointer relative overflow-hidden transition-all duration-200 hover:border-primary-400 hover:shadow-md"
                      >
                        {uploadingAvatar ? (
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                        ) : profileAvatar ? (
                          <img src={resolveAssetUrl(profileAvatar)} alt="Preview" className="w-full h-full object-cover animate-fade-in" />
                        ) : (
                          profileName.charAt(0).toUpperCase() || <User size={40} />
                        )}
                        
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                          <Camera size={20} className="mb-0.5" />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Change</span>
                        </div>
                      </div>
                      
                      {profileAvatar && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="absolute -top-1 -right-1 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full p-1.5 shadow-sm border border-slate-200 transition-all active:scale-95 z-10"
                          title="Remove profile picture"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <input 
                      type="file" 
                      id="avatar-upload" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleAvatarUpload} 
                      disabled={uploadingAvatar} 
                    />
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">JPEG, PNG, or WEBP (Max 10MB)</p>
                  </div>

                  <Input
                    label="Full Name"
                    type="text"
                    icon={User}
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your Full Name"
                    required
                  />

                  <Input
                    label="Date of Birth"
                    type="date"
                    icon={Calendar}
                    value={profileDob}
                    onChange={(e) => setProfileDob(e.target.value)}
                    placeholder="YYYY-MM-DD"
                  />

                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1 border-slate-200" 
                      onClick={() => setShowProfileModal(false)}
                      disabled={profileSaving}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-semibold shadow-md"
                      isLoading={profileSaving}
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>

            {profileToast && (
              <Toast
                message={profileToast.message}
                type={profileToast.type}
                duration={3000}
                onClose={() => setProfileToast(null)}
              />
            )}
          </div>
        )}
      </AnimatePresence>

      {layoutToast && (
        <Toast
          message={layoutToast.message}
          type={layoutToast.type}
          duration={3000}
          onClose={() => setLayoutToast(null)}
        />
      )}
    </div>
  );
}
