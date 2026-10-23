import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, Users, Mail, Shield, ShieldAlert, Key, Link as LinkIcon, Trash2, Power, CheckCircle2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Card, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Toast from "../components/Toast";
import ConfirmModal from "../components/ui/ConfirmModal";
import usePersistentState from "../hooks/usePersistentState";
import { getStoredUserObject } from "../utils/authStorage";
import { hasEnterpriseAccess } from "../utils/clinicAccess";

const initialSignupDraft = {
  name: "",
  email: "",
  password: "",
  role: "nurse",
  customRoleTitle: "",
  canAccessBilling: false,
  assignedBranchIds: [],
};

const supportEmail = "support@carechrome.com";
const whatsappLink = "https://wa.me/2348068073362";
const ROLE_LABELS = {
  nurse: "Nurse / Front Desk",
  doctor: "Doctor",
  branch_manager: "Branch Manager",
};

export default function Signup() {
  const MotionDiv = motion.div;
  const MotionTr = motion.tr;
  const [signupDraft, setSignupDraft, clearSignupDraft] = usePersistentState(
    "carechrome:draft:signup",
    initialSignupDraft,
  );
  const {
    name,
    email,
    password,
    customRoleTitle,
  } = signupDraft;
  const role =
    signupDraft.role === "billing_staff" ? "nurse" : signupDraft.role || "nurse";
  const canAccessBilling =
    signupDraft.role === "billing_staff"
      ? true
      : Boolean(signupDraft.canAccessBilling);
  const [showPassword, setShowPassword] = useState(false);
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(true);
  const [busyStaffId, setBusyStaffId] = useState("");
  const [branchEditor, setBranchEditor] = useState(null);
  const [branchSaving, setBranchSaving] = useState(false);
  const [legacyRoleEditor, setLegacyRoleEditor] = useState(null);
  const [legacyRoleSaving, setLegacyRoleSaving] = useState(false);
  const [roleEditor, setRoleEditor] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmConfig, setConfirmConfig] = useState(null);
  const navigate = useNavigate();
  const currentUser = getStoredUserObject();
  const signupAssignedBranchIds = Array.isArray(signupDraft.assignedBranchIds)
    ? signupDraft.assignedBranchIds
    : [];
  const enterpriseAccess = hasEnterpriseAccess(currentUser?.clinic || {});

  const showToast = (message, type = "success") => setToast({ show: true, message, type });

  const fetchStaff = useCallback(async () => {
    try { setStaffLoading(true); const response = await api.get("/auth/staff"); setStaff(response.data || []); } 
    catch (err) { showToast(err.response?.data?.message || "Failed to load staff accounts", "error"); } 
    finally { setStaffLoading(false); }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await api.get("/branches");
      setBranches(response.data?.branches || []);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to load branches", "error");
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !["admin", "branch_manager"].includes(currentUser.role)) {
      navigate("/login", { replace: true });
      return;
    }
    fetchStaff();
    fetchBranches();

    if (currentUser?.branchId && (!signupDraft.assignedBranchIds || signupDraft.assignedBranchIds.length === 0)) {
      updateSignupDraft({ assignedBranchIds: [currentUser.branchId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role, fetchBranches, fetchStaff, navigate]);

  const updateSignupDraft = (patch) =>
    setSignupDraft((current) => ({ ...current, ...patch }));

  const toggleAssignedBranch = (branchId) =>
    updateSignupDraft({
      assignedBranchIds: signupAssignedBranchIds.includes(branchId)
        ? signupAssignedBranchIds.filter((id) => id !== branchId)
        : [...signupAssignedBranchIds, branchId],
    });

  const resetForm = () => { 
    setSignupDraft({
      ...initialSignupDraft,
      assignedBranchIds: currentUser?.branchId ? [currentUser.branchId] : []
    }); 
  };

  const submitStaffCreation = async () => {
    if (!name || !email || !password) return showToast("All fields are required", "error");
    if (enterpriseAccess && signupAssignedBranchIds.length === 0) {
      return showToast("Assign at least one branch to this staff account", "error");
    }
    try {
      setLoading(true);
      setConfirmConfig((current) =>
        current?.title === "Confirm Staff Role"
          ? { ...current, confirmLoading: true }
          : current,
      );
      await api.post("/auth/signup", {
        name,
        email,
        password,
        role,
        customRoleTitle,
        canAccessBilling: currentUser?.role === "admin" && canAccessBilling,
        assignedBranchIds: enterpriseAccess ? signupAssignedBranchIds : (branches[0] ? [branches[0].id] : []),
      });
      showToast("Staff account created. The user must verify their email before they can log in.", "success");
      resetForm();
      setConfirmConfig(null);
      fetchStaff();
    } catch (err) { showToast(err.response?.data?.message || "Staff creation failed", "error"); } 
    finally {
      setLoading(false);
      setConfirmConfig((current) =>
        current?.title === "Confirm Staff Role"
          ? { ...current, confirmLoading: false }
          : current,
      );
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    if (!name || !email || !password) return showToast("All fields are required", "error");
    if (enterpriseAccess && signupAssignedBranchIds.length === 0) {
      return showToast("Assign at least one branch to this staff account", "error");
    }

    const selectedRoleLabel = ROLE_LABELS[role] || "Staff";
    setConfirmConfig({
      title: "Confirm Staff Role",
      message: `${name} will be created as ${selectedRoleLabel}${canAccessBilling ? " with billing access" : ""}. An admin can update their role later from Manage Staff. Continue?`,
      confirmText: "Continue",
      cancelText: "Cancel",
      confirmLoading: false,
      closeOnConfirm: false,
      onConfirm: submitStaffCreation,
    });
  };

  const handleBillingAccessChange = async (staffMember) => {
    if (staffMember.role === "billing_staff") return;
    const canAccessBilling = !staffMember.canAccessBilling;
    try {
      setBusyStaffId(staffMember.id);
      const response = await api.patch(
        `/auth/staff/${staffMember.id}/billing-access`,
        { canAccessBilling },
      );
      showToast(response.data?.message || "Billing access updated", "success");
      fetchStaff();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to update billing access",
        "error",
      );
    } finally {
      setBusyStaffId("");
    }
  };

  const convertLegacyBillingRole = async () => {
    if (!legacyRoleEditor) return;
    try {
      setLegacyRoleSaving(true);
      await api.patch(
        `/auth/staff/${legacyRoleEditor.id}/convert-legacy-billing-role`,
        { role: legacyRoleEditor.role },
      );
      showToast(
        "Account converted; billing access remains enabled.",
        "success",
      );
      setLegacyRoleEditor(null);
      fetchStaff();
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to convert the legacy account",
        "error",
      );
    } finally {
      setLegacyRoleSaving(false);
    }
  };

  const handleStatusChange = async (staffMember) => {
    const nextStatus = !staffMember.isActive;
    try {
      setBusyStaffId(staffMember.id);
      const response = await api.patch(`/auth/staff/${staffMember.id}/status`, { isActive: nextStatus });
      showToast(response.data?.message || `Staff account ${nextStatus ? "activated" : "deactivated"}`, "success");
      fetchStaff();
    } catch (err) { showToast(err.response?.data?.message || "Failed to update status", "error"); } 
    finally { setBusyStaffId(""); }
  };

  const openRoleEditor = (member) => {
    const assignedBranchIds = Array.isArray(member.assignedBranchIds)
      ? member.assignedBranchIds
      : [];
    setRoleEditor({
      id: member.id,
      name: member.name,
      currentRole: member.role,
      role: member.role,
      assignedBranchIds:
        assignedBranchIds.length > 0
          ? assignedBranchIds
          : [member.branchId || branches.find((branch) => branch.isPrimary)?.id || branches[0]?.id].filter(Boolean),
    });
  };

  const toggleRoleBranch = (branchId) => {
    setRoleEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        assignedBranchIds: current.assignedBranchIds.includes(branchId)
          ? current.assignedBranchIds.filter((id) => id !== branchId)
          : [...current.assignedBranchIds, branchId],
      };
    });
  };

  const submitRoleChange = async () => {
    if (!roleEditor) return;
    if (
      roleEditor.role !== "admin" &&
      roleEditor.assignedBranchIds.length === 0
    ) {
      setConfirmConfig(null);
      showToast("Assign at least one branch to this staff account.", "error");
      return;
    }
    try {
      setBusyStaffId(roleEditor.id);
      setConfirmConfig((current) =>
        current ? { ...current, confirmLoading: true } : current,
      );
      await api.patch(`/auth/staff/${roleEditor.id}/role`, {
        role: roleEditor.role,
        assignedBranchIds: roleEditor.assignedBranchIds,
      });
      setRoleEditor(null);
      setConfirmConfig(null);
      showToast(
        "Staff role updated. They must sign in again for the change to take effect.",
        "success",
      );
      fetchStaff();
    } catch (err) {
      setConfirmConfig(null);
      showToast(err.response?.data?.message || "Failed to update staff role", "error");
    } finally {
      setBusyStaffId("");
    }
  };

  const confirmRoleChange = () => {
    if (!roleEditor || roleEditor.role === roleEditor.currentRole) return;
    const promotesToAdmin = roleEditor.role === "admin";
    setConfirmConfig({
      title: promotesToAdmin ? "Promote to Admin" : "Confirm Role Change",
      message: promotesToAdmin
        ? `${roleEditor.name} will receive full clinic administrator access. Their current sessions will be ended and they must sign in again. Continue?`
        : `${roleEditor.name}'s role will change from ${ROLE_LABELS[roleEditor.currentRole] || roleEditor.currentRole} to ${ROLE_LABELS[roleEditor.role] || roleEditor.role}. Their sessions will be ended and they must sign in again. Continue?`,
      confirmText: promotesToAdmin ? "Promote to Admin" : "Change Role",
      cancelText: "Cancel",
      confirmLoading: false,
      closeOnConfirm: false,
      danger: promotesToAdmin || roleEditor.currentRole === "admin",
      onConfirm: submitRoleChange,
    });
  };

  const executeDelete = async (staffMember) => {
    try {
      setBusyStaffId(staffMember.id);
      const response = await api.delete(`/auth/staff/${staffMember.id}`);
      showToast(response.data?.message || "Staff account deleted", "success");
      fetchStaff();
    } catch (err) { showToast(err.response?.data?.message || "Failed to delete account", "error"); } 
    finally { setBusyStaffId(""); }
  };

  const handleDelete = (staffMember) => {
    setConfirmConfig({
      title: "Delete Staff Account",
      message: `Are you sure you want to permanently delete ${staffMember.name}'s account? They will immediately lose access to the platform.`,
      confirmText: "Delete Account",
      danger: true,
      onConfirm: () => executeDelete(staffMember)
    });
  };

  const filteredStaff = staff.filter(member => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return member.name.toLowerCase().includes(query) || 
           member.email.toLowerCase().includes(query) || 
           member.role.toLowerCase().includes(query);
  });

  const getAssignedBranchLabel = (member) => {
    if (member.role === "admin") {
      return "All clinic branches";
    }

    const assignedIds = Array.isArray(member.assignedBranchIds) ? member.assignedBranchIds : [];
    const assignedLabels = branches
      .filter((branch) => assignedIds.includes(branch.id))
      .map((branch) => `${branch.city || branch.name}${branch.area ? ` - ${branch.area}` : ""}`);

    return assignedLabels.length > 0 ? assignedLabels.join(", ") : "No branches assigned";
  };

  const openBranchEditor = (member) => {
    setBranchEditor({
      id: member.id,
      name: member.name,
      role: member.role,
      assignedBranchIds: Array.isArray(member.assignedBranchIds) ? member.assignedBranchIds : [],
    });
  };

  const toggleEditedBranch = (branchId) => {
    setBranchEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        assignedBranchIds: current.assignedBranchIds.includes(branchId)
          ? current.assignedBranchIds.filter((id) => id !== branchId)
          : [...current.assignedBranchIds, branchId],
      };
    });
  };

  const saveBranchAssignments = async () => {
    if (!branchEditor) return;
    if (branchEditor.role !== "admin" && branchEditor.assignedBranchIds.length === 0) {
      return showToast("Assign at least one branch to this staff account", "error");
    }

    try {
      setBranchSaving(true);
      await api.patch(`/auth/staff/${branchEditor.id}/branches`, {
        assignedBranchIds: branchEditor.assignedBranchIds,
      });
      showToast("Staff branch assignments updated", "success");
      setBranchEditor(null);
      fetchStaff();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update branch assignments", "error");
    } finally {
      setBranchSaving(false);
    }
  };

  return (
    <MotionDiv initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-surface-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">Staff Directory & Access</h2>
          <p className="text-sm text-slate-500 max-w-xl">
             Manage clinic personnel. Only active accounts configured here can sign in to the platform.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* Left Col: Create & Support */}
        <div className="space-y-6">
          <Card className="border border-surface-200 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-bold text-lg mb-6 mt-3 flex items-center text-slate-900"><UserPlus size={18} className="mr-2 text-primary-500" /> Provision Account</h3>
              <form onSubmit={handleSignup} className="space-y-4">
                <Input label="Full Name *" value={name} onChange={(e) => updateSignupDraft({ name: e.target.value })} icon={UserPlus} className="bg-slate-50" />
                <Input label="Email Address *" type="email" value={email} onChange={(e) => updateSignupDraft({ email: e.target.value })} icon={Mail} className="bg-slate-50" />
                
                <div className="space-y-1.5">
                   <label className="text-sm font-medium text-slate-700">Password *</label>
                   <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Key size={18} className="text-slate-400" /></div>
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => updateSignupDraft({ password: e.target.value })} className="w-full rounded-xl border border-slate-200 pl-10 pr-12 py-3 bg-slate-50 text-sm focus:ring-primary-500 shadow-sm h-[46px]" />
                      <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 font-medium text-xs uppercase tracking-wider">{showPassword ? "Hide" : "Show"}</button>
                   </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Account Role *</label>
                    <div className="relative">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Shield size={18} className="text-slate-400" /></div>
                       <select value={role} onChange={(e) => updateSignupDraft({ role: e.target.value })} className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 bg-slate-50 text-sm focus:ring-primary-500 shadow-sm appearance-none h-[46px] capitalize">
                         <option value="nurse">Nurse / Front Desk</option>
                         <option value="doctor">Doctor</option>
                         {currentUser?.role === "admin" && enterpriseAccess && <option value="branch_manager">Branch Manager</option>}
                       </select>
                    </div>
                 </div>

                 {currentUser?.role === "admin" && (
                   <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                     <input
                       type="checkbox"
                       checked={Boolean(canAccessBilling)}
                       onChange={(event) =>
                         updateSignupDraft({
                           canAccessBilling: event.target.checked,
                         })
                       }
                       className="mt-0.5"
                     />
                     <span>
                       <span className="block font-semibold">Grant billing access</span>
                       <span className="mt-1 block text-xs text-slate-500">
                         Adds billing permissions while keeping this staff member’s selected role and branch access.
                       </span>
                     </span>
                   </label>
                 )}

                 <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Custom Job Title <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <div className="relative">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><ShieldAlert size={18} className="text-slate-400" /></div>
                       <input type="text" placeholder="e.g. Senior Hygienist" value={customRoleTitle || ""} onChange={(e) => updateSignupDraft({ customRoleTitle: e.target.value })} className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 bg-slate-50 text-sm focus:ring-primary-500 shadow-sm h-[46px]" />
                    </div>
                 </div>

                {enterpriseAccess && (
                  currentUser?.role === "admin" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Assigned Branches *</label>
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {branches.filter((branch) => branch.isActive).length === 0 ? (
                          <p className="text-sm text-slate-500">No active branches available yet.</p>
                        ) : (
                          branches
                            .filter((branch) => branch.isActive)
                            .map((branch) => (
                              <label
                                key={branch.id}
                                className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={signupAssignedBranchIds.includes(branch.id)}
                                  onChange={() => toggleAssignedBranch(branch.id)}
                                />
                                <span>{branch.city || branch.name}{branch.area ? ` - ${branch.area}` : ""}</span>
                              </label>
                            ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Assigned Branch</label>
                      <div className="w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-100 text-sm text-slate-500 shadow-sm h-[46px] flex items-center cursor-not-allowed">
                        {currentUser?.branch?.city || currentUser?.branch?.name}{currentUser?.branch?.area ? ` - ${currentUser?.branch?.area}` : ""} (Default)
                      </div>
                    </div>
                  )
                )}

                <div className="pt-4">
                   <Button type="submit" isLoading={loading} className="w-full shadow-md h-12 text-sm sm:text-base font-semibold">Generate Staff Credentials</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50">
             <CardContent className="p-6">
                <h3 className="font-bold text-teal-900 mb-2 mt-3 flex items-center"><ShieldAlert size={18} className="mr-2" /> Support Context</h3>
                <p className="text-sm text-teal-800 leading-relaxed mb-4">If you require structural administrative assistance or need to verify billing parameters, reach out to our team.</p>
                <div className="space-y-2">
                   <a href={`mailto:${supportEmail}`} className="flex items-center text-sm font-medium text-teal-700 hover:text-teal-900 bg-white/50 px-3 py-2 rounded-lg transition-colors border border-teal-100"><Mail size={16} className="mr-3" /> {supportEmail}</a>
                   <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex items-center text-sm font-medium text-teal-700 hover:text-teal-900 bg-white/50 px-3 py-2 rounded-lg transition-colors border border-teal-100"><LinkIcon size={16} className="mr-3" /> WhatsApp Support</a>
                </div>
             </CardContent>
          </Card>
        </div>

        {/* Right Col: Staff List */}
        <Card className="border border-surface-200 shadow-sm">
           <CardContent className="p-0">
             <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center text-slate-900"><Users size={18} className="mr-2 text-primary-500" /> Provisioned Accounts Directory</h3>
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">{staff.length} Accounts</span>
                </div>
                <Input 
                   icon={Search} 
                   placeholder="Search by name, email, or role..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-slate-50"
                />
             </div>

             {staffLoading ? (
               <div className="p-12 text-center flex flex-col items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-4" /><p className="text-slate-500 font-medium">Fetching directory...</p></div>
             ) : staff.length === 0 ? (
               <div className="p-16 text-center flex flex-col items-center"><Users size={48} className="text-slate-300 mb-4" /><p className="text-lg font-medium text-slate-700">No personnel accounts</p></div>
             ) : filteredStaff.length === 0 ? (
               <div className="p-16 text-center flex flex-col items-center"><Search size={48} className="text-slate-300 mb-4" /><p className="text-lg font-medium text-slate-700">No accounts match your search</p></div>
             ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-sm">
                   <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                     <tr><th className="px-6 py-4 text-left font-semibold">User details</th><th className="px-6 py-4 text-left font-semibold">Role assignment</th>{enterpriseAccess && <th className="px-6 py-4 text-left font-semibold">Assigned branches</th>}<th className="px-6 py-4 text-center font-semibold">Billing permission</th><th className="px-6 py-4 text-center font-semibold">System Access</th><th className="px-6 py-4 text-right font-semibold">Actions</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     <AnimatePresence>
                       {filteredStaff.map((member) => {
                         const isCurrentUser = member.id === currentUser?.id;
                         const isBusy = busyStaffId === member.id;
                         const cannotManageAdmin =
                           member.role === "admin" &&
                           !currentUser?.isClinicOwner;
                         
                         return (
                           <MotionTr key={member.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`hover:bg-slate-50/50 transition-colors ${!member.isActive ? "bg-slate-50/80" : "bg-white"}`}>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                   <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-bold uppercase tracking-wider ${isCurrentUser ? "bg-primary-100 text-primary-700 border border-primary-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                                      {member.name.slice(0, 2)}
                                   </div>
                                   <div>
                                      <p className="font-bold text-slate-900 flex items-center">
                                         {member.name} {isCurrentUser && <span className="ml-2 text-[10px] bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full uppercase tracking-wider">You</span>}
                                      </p>
                                      <p className="text-xs text-slate-500">{member.email}</p>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold capitalize tracking-wider ${member.isClinicOwner ? 'bg-amber-100 text-amber-800' : member.role === 'admin' ? 'bg-purple-100 text-purple-700' : member.role === 'doctor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {member.isClinicOwner ? "Clinic Owner" : member.customRoleTitle || (member.role === "nurse" ? "Nurse / Desk" : member.role === "branch_manager" ? "Branch Manager" : member.role)}
                                  </span>
                                </div>
                             </td>
                             {enterpriseAccess && (
                               <td className="px-6 py-4">
                                  <p className="max-w-xs text-xs leading-5 text-slate-600">
                                    {getAssignedBranchLabel(member)}
                                  </p>
                               </td>
                             )}
                             <td className="px-6 py-4 text-center">
                               {member.role === "admin" ? (
                                 <span className="text-xs text-slate-500">Included with admin role</span>
                               ) : member.role === "billing_staff" ? (
                                 <span className="text-xs text-amber-700">Legacy billing-only role</span>
                               ) : (
                                 <Button
                                   variant={member.canAccessBilling ? "primary" : "outline"}
                                   size="sm"
                                   onClick={() => handleBillingAccessChange(member)}
                                   disabled={isBusy || currentUser?.role !== "admin"}
                                 >
                                   {member.canAccessBilling ? "Granted" : "Grant access"}
                                 </Button>
                               )}
                             </td>
                             <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center justify-center w-full max-w-[100px] px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest ${member.isActive ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                                   {member.isActive ? "Enabled" : "Suspended"}
                                </span>
                             </td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {enterpriseAccess && member.role !== "admin" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openBranchEditor(member)}
                                      disabled={isBusy}
                                      className="hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200"
                                    >
                                      Branches
                                    </Button>
                                  )}
                                  {currentUser?.role === "admin" &&
                                    member.role !== "billing_staff" &&
                                    !member.isClinicOwner &&
                                    (member.role !== "admin" ||
                                      currentUser?.isClinicOwner) && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openRoleEditor(member)}
                                        disabled={isBusy}
                                      >
                                        Change role
                                      </Button>
                                    )}
                                  {member.role === "billing_staff" &&
                                    currentUser?.role === "admin" && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setLegacyRoleEditor({
                                            id: member.id,
                                            name: member.name,
                                            role: "nurse",
                                          })
                                        }
                                        disabled={isBusy}
                                      >
                                        Convert role
                                      </Button>
                                    )}
                                  <Button variant={member.isActive ? "outline" : "primary"} size="sm" onClick={() => handleStatusChange(member)} disabled={isBusy || isCurrentUser || member.isClinicOwner || cannotManageAdmin} className={member.isActive ? "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200" : "bg-green-600 hover:bg-green-700 text-white"}>
                                    {isBusy ? "..." : member.isActive ? <Power size={14} className="mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
                                    {member.isActive ? <span className="hidden sm:inline">Suspend</span> : <span className="hidden sm:inline">Enable</span>}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(member)} disabled={isBusy || isCurrentUser || member.isClinicOwner || cannotManageAdmin} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                             </td>
                           </MotionTr>
                         );
                       })}
                     </AnimatePresence>
                   </tbody>
                 </table>
               </div>
             )}
           </CardContent>
        </Card>
      </div>

      {toast.show && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast({ ...toast, show: false })} />}
      <ConfirmModal 
        isOpen={!!confirmConfig} 
        onClose={() => setConfirmConfig(null)} 
        {...confirmConfig} 
      />
      {branchEditor && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !branchSaving && setBranchEditor(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-bold text-slate-900">
                Assign Branches to {branchEditor.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                This staff account will only see and use the branches selected here.
              </p>
            </div>
            <div className="space-y-3 px-6 py-5">
              {branches.filter((branch) => branch.isActive).map((branch) => (
                <label
                  key={branch.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={(branchEditor.assignedBranchIds || []).includes(branch.id)}
                    onChange={() => toggleEditedBranch(branch.id)}
                  />
                  <span>{branch.city || branch.name}{branch.area ? ` - ${branch.area}` : ""}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="outline" className="bg-white" onClick={() => setBranchEditor(null)} disabled={branchSaving}>
                Cancel
              </Button>
              <Button onClick={saveBranchAssignments} isLoading={branchSaving}>
                Save Branches
              </Button>
            </div>
          </div>
        </div>
      )}
      {legacyRoleEditor && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !legacyRoleSaving && setLegacyRoleEditor(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-bold text-slate-900">
                Convert {legacyRoleEditor.name}'s legacy account
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Choose their primary staff role. Their billing permission and branch assignments will be preserved.
              </p>
            </div>
            <div className="px-6 py-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Primary role
              </label>
              <select
                value={legacyRoleEditor.role}
                onChange={(event) =>
                  setLegacyRoleEditor((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                <option value="nurse">Nurse / Front Desk</option>
                <option value="doctor">Doctor</option>
                {enterpriseAccess && (
                  <option value="branch_manager">Branch Manager</option>
                )}
              </select>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="bg-white"
                onClick={() => setLegacyRoleEditor(null)}
                disabled={legacyRoleSaving}
              >
                Cancel
              </Button>
              <Button onClick={convertLegacyBillingRole} isLoading={legacyRoleSaving}>
                Convert account
              </Button>
            </div>
          </div>
        </div>
      )}
      {roleEditor && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setRoleEditor(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-100 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="text-lg font-bold text-slate-900">
                Change role for {roleEditor.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Role changes are recorded, and the staff member will need to sign in again.
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Primary role
                </label>
                <select
                  value={roleEditor.role}
                  onChange={(event) =>
                    setRoleEditor((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                >
                  <option value="nurse">Nurse / Front Desk</option>
                  <option value="doctor">Doctor</option>
                  {enterpriseAccess && (
                    <option value="branch_manager">Branch Manager</option>
                  )}
                  {currentUser?.isClinicOwner && (
                    <option value="admin">Admin</option>
                  )}
                </select>
              </div>
              {roleEditor.role !== "admin" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    Assigned branches *
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {branches.filter((branch) => branch.isActive).map((branch) => (
                      <label
                        key={branch.id}
                        className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={roleEditor.assignedBranchIds.includes(branch.id)}
                          onChange={() => toggleRoleBranch(branch.id)}
                        />
                        <span>{branch.city || branch.name}{branch.area ? ` - ${branch.area}` : ""}</span>
                      </label>
                    ))}
                  </div>
                  {roleEditor.assignedBranchIds.length === 0 && (
                    <p className="text-xs text-rose-600">
                      Select at least one branch before continuing.
                    </p>
                  )}
                </div>
              )}
              {roleEditor.role === "admin" && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                  Admins receive clinic-wide access. Only the Clinic Owner can promote staff to Admin.
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="bg-white"
                onClick={() => setRoleEditor(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRoleChange}
                disabled={
                  roleEditor.role === roleEditor.currentRole ||
                  (roleEditor.role !== "admin" &&
                    roleEditor.assignedBranchIds.length === 0)
                }
              >
                Review role change
              </Button>
            </div>
          </div>
        </div>
      )}
    </MotionDiv>
  );
}
