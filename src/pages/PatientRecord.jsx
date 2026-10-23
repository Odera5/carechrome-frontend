import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, UserCog, ArrowLeft, Activity, User, Phone, MapPin, Hash, AlertTriangle, HeartPulse } from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";
import Modal from "../components/PatientRecord/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import RecordForm from "../components/PatientRecord/RecordForm";
import RecordItem from "../components/PatientRecord/RecordItem";
import SearchFilterSort from "../components/PatientRecord/SearchFilterSort";
import { createEmptyRecord } from "../components/PatientRecord/recordUtils";
import { getEntityId } from "../utils/entityId";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Card, CardContent } from "../components/ui/Card";
import usePersistentState from "../hooks/usePersistentState";
import { readStoredJson } from "../utils/persistence";
import { getStoredUserObject } from "../utils/authStorage";

const RECORDS_PER_PAGE = 10;

export default function PatientRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const storedUser = getStoredUserObject() || {};
  const canEditPatient =
    storedUser.role === "admin" ||
    storedUser.role === "branch_manager" ||
    storedUser.role === "doctor" ||
    storedUser.role === "nurse";
  const canManageRecords =
    storedUser.role === "admin" ||
    storedUser.role === "branch_manager" ||
    storedUser.role === "doctor";
  const patientEditDraftKey = `carechrome:draft:patient-edit:${id}`;
  const patientEditModalKey = `carechrome:draft:patient-edit-modal:${id}`;
  const recordFiltersStorageKey = `carechrome:draft:patient-record:filters:${id}`;
  const hasSavedPatientEditDraft = Boolean(readStoredJson(patientEditDraftKey, null));

  const [patient, setPatient] = useState(null);
  const [clinicalHistoryEntries, setClinicalHistoryEntries] = useState([]);
  const [historyDraft, setHistoryDraft] = useState({
    category: "allergy",
    value: "",
    reaction: "",
  });
  const [historySaving, setHistorySaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordMeta, setRecordMeta] = useState({
    page: 1,
    limit: RECORDS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });
  const [recordFilters, setRecordFilters] = useState({
    ...{
      searchText: "",
      sortOption: "recent",
      startDate: "",
      endDate: "",
    },
    ...(readStoredJson(recordFiltersStorageKey, null) || {}),
  });
  const [patientForm, setPatientForm, clearPatientFormDraft] = usePersistentState(
    patientEditDraftKey,
    { name: "", cardNumber: "", age: "", dateOfBirth: "", gender: "other", occupation: "", phone: "", email: "", address: "", nextOfKinName: "", nextOfKinPhone: "", nextOfKinRelationship: "", nextOfKinAddress: "" },
  );

  const [newRecord, setNewRecord, clearNewRecordDraft] = usePersistentState(
    `carechrome:draft:patient-record:new:${id}`,
    createEmptyRecord(),
  );
  const [showAddModal, setShowAddModal, clearShowAddModalDraft] = usePersistentState(
    `carechrome:draft:patient-record:new-modal:${id}`,
    false,
  );
  const [showEditPatientModal, setShowEditPatientModal, clearShowEditPatientModalDraft] = usePersistentState(
    patientEditModalKey,
    false,
  );
  const [expandedRecordId, setExpandedRecordId] = useState(null);
  const [searchParams] = useSearchParams();
  const recordIdParam = searchParams.get("recordId");

  useEffect(() => {
    if (recordIdParam) {
      setExpandedRecordId(recordIdParam);
    }
  }, [recordIdParam]);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [patientSaveLoading, setPatientSaveLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [isTrashView, setIsTrashView] = useState(false);
  const [recordsRefreshToken, setRecordsRefreshToken] = useState(0);

  const showToast = (message, type = "success") => setToast({ show: true, message, type });

  const totalPages = Math.max(1, recordMeta.totalPages || 1);
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStartIndex = Math.max(0, (currentPageSafe - 1) * RECORDS_PER_PAGE);

  const createFormData = (recordData, removedAttachments = []) => {
    const formData = new FormData();
    Object.keys(recordData).forEach((key) => {
      if (key === "attachments") {
        const attachments = Array.isArray(recordData.attachments)
          ? recordData.attachments
          : [];
        const uploadedAttachments = attachments.filter(
          (attachment) => !(attachment instanceof File),
        );
        const pendingFiles = attachments.filter(
          (attachment) => attachment instanceof File,
        );

        if (uploadedAttachments.length > 0) {
          formData.append(
            "attachmentsMetadata",
            JSON.stringify(uploadedAttachments),
          );
        }
        pendingFiles.forEach((file) => formData.append("attachments", file));
      } else if (key === "teeth") {
        formData.append("teeth", JSON.stringify(recordData.teeth || []));
      } else if (key === "vitals") {
        formData.append("vitals", typeof recordData.vitals === 'string' ? recordData.vitals : JSON.stringify(recordData.vitals || {}));
      } else {
        formData.append(key, recordData[key] || "");
      }
    });
    removedAttachments.forEach((filename) => formData.append("removedAttachments", filename));
    return formData;
  };

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        if (!patient) {
          setLoading(true);
        }
        const params = new URLSearchParams({
          trash: String(isTrashView),
          page: String(currentPage),
          limit: String(RECORDS_PER_PAGE),
          sortOption: recordFilters.sortOption,
        });
        if (recordFilters.searchText.trim()) {
          params.append("search", recordFilters.searchText.trim());
        }
        if (recordFilters.startDate) {
          params.append("startDate", recordFilters.startDate);
        }
        if (recordFilters.endDate) {
          params.append("endDate", recordFilters.endDate);
        }

        const [resPatient, resRecords] = await Promise.all([
          api.get(`/patients/${id}`),
          api.get(`/patients/${id}/records?${params}`),
        ]);
        setPatient(resPatient.data);
        setClinicalHistoryEntries(resPatient.data?.clinicalHistoryEntries || []);
        if (!hasSavedPatientEditDraft) {
          setPatientForm({
            name: resPatient.data?.name || "", cardNumber: resPatient.data?.cardNumber || "",
            age: resPatient.data?.age || "", dateOfBirth: resPatient.data?.dateOfBirth || "", gender: resPatient.data?.gender || "other",
            occupation: resPatient.data?.occupation || "",
            phone: resPatient.data?.phone || "", email: resPatient.data?.email || "", address: resPatient.data?.address || "",
            nextOfKinName: resPatient.data?.nextOfKinName || "", nextOfKinPhone: resPatient.data?.nextOfKinPhone || "",
            nextOfKinRelationship: resPatient.data?.nextOfKinRelationship || "", nextOfKinAddress: resPatient.data?.nextOfKinAddress || "",
          });
        }
        setRecords(resRecords.data?.data || []);
        setRecordMeta({
          page: resRecords.data?.page || 1,
          limit: resRecords.data?.limit || RECORDS_PER_PAGE,
          total: resRecords.data?.total || 0,
          totalPages: resRecords.data?.totalPages || 1,
        });
      } catch { showToast("Failed to fetch patient data", "error"); } finally { setLoading(false); }
    };
    fetchPatient();
  }, [
    currentPage,
    hasSavedPatientEditDraft,
    id,
    isTrashView,
    recordsRefreshToken,
    recordFilters.endDate,
    recordFilters.searchText,
    recordFilters.sortOption,
    recordFilters.startDate,
    setPatientForm,
  ]);

  const handleAddRecord = async (recordData) => {
    try {
      setAddLoading(true);
      await api.post(`/patients/${id}/records`, createFormData(recordData));
      setCurrentPage(1);
      setRecordsRefreshToken((current) => current + 1);
      showToast("Record added successfully!", "success");
      return true;
    } catch (err) { showToast(err.response?.data?.message || "Failed to add record", "error"); return false; } finally { setAddLoading(false); }
  };

  const addClinicalHistoryEntry = async (entry) => {
    const value = String(entry?.value || "").trim();
    if (!value) {
      showToast("Enter an allergy or medical condition first.", "error");
      return;
    }
    try {
      setHistorySaving(true);
      const response = await api.post(`/patients/${id}/clinical-history`, {
        category: entry.category,
        value,
        reaction: entry.reaction || "",
      });
      setClinicalHistoryEntries((current) =>
        [...current, response.data].sort((a, b) =>
          `${a.status}-${a.category}-${a.createdAt}`.localeCompare(
            `${b.status}-${b.category}-${b.createdAt}`,
          ),
        ),
      );
      setHistoryDraft({ category: "allergy", value: "", reaction: "" });
      showToast("Added to the patient's current medical history.");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to add clinical history.",
        "error",
      );
    } finally {
      setHistorySaving(false);
    }
  };

  const updateClinicalHistoryStatus = async (entry, status) => {
    try {
      const response = await api.patch(
        `/patients/${id}/clinical-history/${entry.id}`,
        { status },
      );
      setClinicalHistoryEntries((current) =>
        current.map((item) => (item.id === entry.id ? response.data : item)),
      );
      showToast(
        status === "active"
          ? "Restored to current medical history."
          : status === "resolved"
            ? "Marked as resolved; retained in history."
            : "Marked as entered in error; retained in history.",
      );
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to update clinical history.",
        "error",
      );
    }
  };

  const reviewClinicalHistory = async () => {
    try {
      setHistorySaving(true);
      const response = await api.post(
        `/patients/${id}/clinical-history/review`,
      );
      setClinicalHistoryEntries(response.data || []);
      showToast("Active medical history marked as reviewed.");
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to review clinical history.",
        "error",
      );
    } finally {
      setHistorySaving(false);
    }
  };

  const executeDeleteRecord = async (recordId) => {
    try {
      await api.delete(`/patients/${id}/records/${recordId}`);
      const updatedTotal = Math.max(0, (recordMeta.total || 0) - 1);
      const nextTotalPages = Math.max(1, Math.ceil(updatedTotal / RECORDS_PER_PAGE));
      if (currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages);
      } else {
        setRecords((current) => current.filter((r) => getEntityId(r) !== recordId));
        setRecordMeta((current) => ({
          ...current,
          total: updatedTotal,
          totalPages: nextTotalPages,
        }));
      }
      setRecordsRefreshToken((current) => current + 1);
      showToast("Record moved to Trash", "success");
    } catch (err) { showToast(err.response?.data?.message || "Failed to move record to Trash", "error"); }
  };

  const handleDeleteRecord = (recordId) => {
    setConfirmConfig({
      title: "Move Record to Trash",
      message: "Are you sure you want to move this clinical record to Trash? You can restore it later from the Trash tab.",
      confirmText: "Move to Trash",
      danger: true,
      onConfirm: () => executeDeleteRecord(recordId)
    });
  };

  const executeRestoreRecord = async (recordId) => {
    try {
      await api.patch(`/patients/${id}/records/${recordId}/restore`);
      const updatedTotal = Math.max(0, (recordMeta.total || 0) - 1);
      const nextTotalPages = Math.max(1, Math.ceil(updatedTotal / RECORDS_PER_PAGE));
      if (currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages);
      } else {
        setRecords((current) => current.filter((r) => getEntityId(r) !== recordId));
        setRecordMeta((current) => ({
          ...current,
          total: updatedTotal,
          totalPages: nextTotalPages,
        }));
      }
      setRecordsRefreshToken((current) => current + 1);
      showToast("Record restored successfully!", "success");
    } catch (err) { showToast(err.response?.data?.message || "Failed to restore record", "error"); }
  };

  const handleRestoreRecord = (recordId) => {
    setConfirmConfig({
      title: "Restore Clinical Record",
      message: "Are you sure you want to restore this clinical record?",
      confirmText: "Restore Record",
      danger: false,
      onConfirm: () => executeRestoreRecord(recordId)
    });
  };

  const executeHardDeleteRecord = async (recordId) => {
    try {
      await api.delete(`/patients/${id}/records/${recordId}/hard`);
      const updatedTotal = Math.max(0, (recordMeta.total || 0) - 1);
      const nextTotalPages = Math.max(1, Math.ceil(updatedTotal / RECORDS_PER_PAGE));
      if (currentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages);
      } else {
        setRecords((current) => current.filter((r) => getEntityId(r) !== recordId));
        setRecordMeta((current) => ({
          ...current,
          total: updatedTotal,
          totalPages: nextTotalPages,
        }));
      }
      setRecordsRefreshToken((current) => current + 1);
      showToast("Record permanently deleted!", "success");
    } catch (err) { showToast(err.response?.data?.message || "Failed to permanently delete record", "error"); }
  };

  const handleHardDeleteRecord = (recordId) => {
    setConfirmConfig({
      title: "Delete Clinical Record Permanently",
      message: "Are you sure you want to permanently delete this clinical record? This action CANNOT be undone and all attachments will be lost.",
      confirmText: "Delete Permanently",
      danger: true,
      onConfirm: () => executeHardDeleteRecord(recordId)
    });
  };

  const handleSaveEdit = async (recordId, updatedData, removedAttachments = []) => {
    try {
      const res = await api.put(`/patients/${id}/records/${recordId}`, createFormData(updatedData, removedAttachments));
      const updatedRecords = records.map((r) => getEntityId(r) === recordId ? res.data : r);
      setRecords(updatedRecords);
      setRecordsRefreshToken((current) => current + 1);
      showToast("Record updated successfully!", "success");
    } catch (err) { showToast(err.response?.data?.message || "Failed to update record", "error"); }
  };

  const handlePatientFormChange = (e) => setPatientForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  
  const handleDateOfBirthChange = (e) => {
    const dobValue = e.target.value;
    let computedAge = "";
    if (dobValue) {
      const birthDate = new Date(dobValue);
      const today = new Date();
      let ageDiff = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        ageDiff--;
      }
      computedAge = ageDiff >= 0 ? ageDiff.toString() : "";
    }
    setPatientForm((prev) => ({
      ...prev,
      dateOfBirth: dobValue,
      age: computedAge,
    }));
  };

  const openEditPatientModal = () => {
    if (!patient) return;
    setPatientForm({
      name: patient.name || "", cardNumber: patient.cardNumber || "", age: patient.age || "",
      dateOfBirth: patient.dateOfBirth || "",
      occupation: patient.occupation || "",
      gender: patient.gender || "other", phone: patient.phone || "", email: patient.email || "", address: patient.address || "",
      nextOfKinName: patient.nextOfKinName || "", nextOfKinPhone: patient.nextOfKinPhone || "",
      nextOfKinRelationship: patient.nextOfKinRelationship || "", nextOfKinAddress: patient.nextOfKinAddress || "",
    });
    setShowEditPatientModal(true);
  };

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    if (!patientForm.name.trim()) return showToast("Patient name cannot be empty.", "error");
    if (!patientForm.age || Number(patientForm.age) <= 0) return showToast("Age must be greater than 0.", "error");
    if (!patientForm.phone?.trim()) return showToast("Phone number is required.", "error");
    if (!patientForm.address?.trim()) return showToast("Home address is required.", "error");
    if (patientForm.email && !/\S+@\S+\.\S+/.test(patientForm.email)) return showToast("Invalid email.", "error");

    try {
      setPatientSaveLoading(true);
      const res = await api.put(`/patients/${id}`, patientForm);
      setPatient(res.data);
      clearPatientFormDraft();
      clearShowEditPatientModalDraft();
      setShowEditPatientModal(false);
      showToast("Patient information updated successfully!");
    } catch (err) { showToast(err.response?.data?.message || "Failed to update patient information", "error"); } finally { setPatientSaveLoading(false); }
  };

  useEffect(() => { setCurrentPage(1); }, [id, isTrashView, recordFilters.endDate, recordFilters.searchText, recordFilters.sortOption, recordFilters.startDate]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  if (loading) return <div className="p-8 text-center flex flex-col items-center justify-center min-h-[50vh]"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div><p className="text-slate-500 font-medium">Loading patient data...</p></div>;
  if (!patient) return <div className="p-8 text-center text-rose-500 font-medium"><p>Patient not found or you don't have access.</p></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="patient-record-page space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col bg-white p-6 rounded-2xl shadow-sm border border-surface-200">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
               <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="bg-white border-slate-200"><ArrowLeft size={16} className="mr-1" /> Back</Button>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-1 flex items-center">{patient.name}</h2>
            <div className="text-sm font-medium text-slate-500 flex items-center flex-wrap gap-x-4 gap-y-1 mt-2">
               <span className="flex items-center"><Hash size={14} className="mr-1 text-slate-400" /> {patient.cardNumber || "No ID"}</span>
               <span className="flex items-center"><User size={14} className="mr-1 text-slate-400" /> {patient.age}y, <span className="capitalize ml-1">{patient.gender || "Other"}</span></span>
               {patient.phone && <span className="flex items-center"><Phone size={14} className="mr-1 text-slate-400" /> {patient.phone}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto mt-4 md:mt-0">
            {canEditPatient && <Button variant="outline" onClick={openEditPatientModal} className="flex-1 md:flex-none border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"><UserCog size={18} className="mr-2" /> Edit Info</Button>}
            {canManageRecords && <Button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none shadow-md"><Plus size={18} className="mr-2" /> New Record</Button>}
          </div>
        </div>

        {(patient.email || patient.address || patient.occupation || patient.nextOfKinName) && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
            {patient.occupation && (
              <div>
                <span className="font-semibold text-slate-700 block text-xs uppercase tracking-wider mb-0.5">Occupation</span>
                <span className="break-words">{patient.occupation}</span>
              </div>
            )}
            {patient.email && (
              <div>
                <span className="font-semibold text-slate-700 block text-xs uppercase tracking-wider mb-0.5">Email</span>
                <span className="break-words">{patient.email}</span>
              </div>
            )}
            {patient.address && (
              <div className="md:col-span-2">
                <span className="font-semibold text-slate-700 block text-xs uppercase tracking-wider mb-0.5">Home Address</span>
                <span className="break-words">{patient.address}</span>
              </div>
            )}
            {patient.nextOfKinName && (
              <div className="col-span-1 md:col-span-3 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                <span className="font-bold text-slate-800 block text-xs uppercase tracking-wider mb-2">Next of Kin / Emergency Contact</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="font-medium text-slate-500 block">Name</span>
                    <span className="font-semibold text-slate-800">{patient.nextOfKinName}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Relationship</span>
                    <span className="font-semibold text-slate-800">{patient.nextOfKinRelationship || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Phone</span>
                    <span className="font-semibold text-slate-800">{patient.nextOfKinPhone || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-500 block">Address</span>
                    <span className="font-semibold text-slate-800">{patient.nextOfKinAddress || "Not specified"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <section
        aria-labelledby="clinical-history-summary-title"
        className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <h3 id="clinical-history-summary-title" className="text-base font-bold text-amber-950">
              Current allergies and medical history
            </h3>
            <p className="mt-1 text-sm text-amber-900">
              This list persists across visits. Confirm it with the patient and
              update it when information changes. Resolved or incorrect entries
              remain in history.
            </p>
            <div className="mt-4 space-y-3">
              {clinicalHistoryEntries.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-slate-600">
                  No current entries have been added. A blank list does not mean none.
                </div>
              ) : (
                clinicalHistoryEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.category === "allergy" ? (
                            <AlertTriangle size={16} className="text-rose-700" />
                          ) : (
                            <HeartPulse size={16} className="text-orange-700" />
                          )}
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            {entry.category === "allergy" ? "Allergy" : "Condition"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                            {entry.status === "entered_in_error" ? "Entered in error" : entry.status}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">
                          {entry.value}
                        </p>
                        {entry.category === "allergy" && entry.reaction && (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            Reaction: {entry.reaction}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          Added {new Date(entry.createdAt).toLocaleDateString()}
                          {entry.recordedBy?.name ? ` by ${entry.recordedBy.name}` : ""}
                          {entry.lastReviewedAt
                            ? ` · Reviewed ${new Date(entry.lastReviewedAt).toLocaleDateString()}${entry.reviewedBy?.name ? ` by ${entry.reviewedBy.name}` : ""}`
                            : ""}
                        </p>
                      </div>
                      {canManageRecords && (
                        <div className="flex shrink-0 gap-2">
                          {entry.status === "active" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateClinicalHistoryStatus(entry, "resolved")}
                            >
                              Mark resolved
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateClinicalHistoryStatus(entry, "active")}
                            >
                              Restore
                            </Button>
                          )}
                          {entry.status !== "entered_in_error" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => updateClinicalHistoryStatus(entry, "entered_in_error")}
                            >
                              Incorrect
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {canManageRecords && (
              <>
                <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-white p-4 md:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Entry type
                    <select
                      value={historyDraft.category}
                      onChange={(event) => setHistoryDraft((current) => ({
                        ...current,
                        category: event.target.value,
                      }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="allergy">Allergy</option>
                      <option value="comorbidity">Medical condition</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    {historyDraft.category === "allergy" ? "Allergen / medication" : "Condition"}
                    <input
                      value={historyDraft.value}
                      onChange={(event) => setHistoryDraft((current) => ({
                        ...current,
                        value: event.target.value,
                      }))}
                      maxLength={500}
                      placeholder={historyDraft.category === "allergy" ? "e.g. Aspirin" : "e.g. Diabetes"}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  {historyDraft.category === "allergy" ? (
                    <label className="text-xs font-semibold text-slate-700">
                      Reaction (if known)
                      <input
                        value={historyDraft.reaction}
                        onChange={(event) => setHistoryDraft((current) => ({
                          ...current,
                          reaction: event.target.value,
                        }))}
                        maxLength={500}
                        placeholder="e.g. Rash, swelling"
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  ) : (
                    <p className="self-end text-xs text-slate-500">
                      Add each condition separately so it can be reviewed or resolved independently.
                    </p>
                  )}
                  <div className="md:col-span-3">
                    <Button
                      type="button"
                      size="sm"
                      disabled={historySaving || !historyDraft.value.trim()}
                      onClick={() => addClinicalHistoryEntry(historyDraft)}
                    >
                      Add to current history
                    </Button>
                  </div>
                </div>
                {clinicalHistoryEntries.some((entry) => entry.status === "active") && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={historySaving}
                      onClick={reviewClinicalHistory}
                    >
                      Confirmed with patient - mark reviewed today
                    </Button>
                  </div>
                )}
              </>
            )}
            {(patient.clinicalHistorySummary?.allergies ||
              patient.clinicalHistorySummary?.comorbidities) && (
              <details className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-amber-950">
                  Prior visit notes - not yet confirmed in the current list
                </summary>
                <p className="mt-2 text-xs text-slate-600">
                  Review these historical free-text notes with the patient before adding them to the current list.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {patient.clinicalHistorySummary?.allergies && (
                    <div className="rounded-lg border border-rose-100 p-3">
                      <p className="text-xs font-bold uppercase text-rose-800">Allergy note</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                        {patient.clinicalHistorySummary.allergies.value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(patient.clinicalHistorySummary.allergies.recordedAt).toLocaleDateString()}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={!canManageRecords || historySaving}
                        onClick={() => addClinicalHistoryEntry({
                          category: "allergy",
                          value: patient.clinicalHistorySummary.allergies.value,
                        })}
                      >
                        Add prior note to current list
                      </Button>
                    </div>
                  )}
                  {patient.clinicalHistorySummary?.comorbidities && (
                    <div className="rounded-lg border border-orange-100 p-3">
                      <p className="text-xs font-bold uppercase text-orange-800">Medical history note</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                        {patient.clinicalHistorySummary.comorbidities.value}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(patient.clinicalHistorySummary.comorbidities.recordedAt).toLocaleDateString()}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={!canManageRecords || historySaving}
                        onClick={() => addClinicalHistoryEntry({
                          category: "comorbidity",
                          value: patient.clinicalHistorySummary.comorbidities.value,
                        })}
                      >
                        Add prior note to current list
                      </Button>
                    </div>
                  )}
                </div>
              </details>
            )}
            <p className="mt-3 text-xs font-medium text-amber-900">
              A blank list does not mean none. Document “no known allergies” only after confirming with the patient.
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-center md:justify-start gap-2 border-b border-slate-200 mt-6">
         <button onClick={() => setIsTrashView(false)} className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${!isTrashView ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Active Records</button>
         <button onClick={() => setIsTrashView(true)} className={`py-3 px-6 font-bold text-sm border-b-2 transition-colors ${isTrashView ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Trash</button>
      </div>

      <SearchFilterSort
        filters={recordFilters}
        onChange={setRecordFilters}
        storageKey={recordFiltersStorageKey}
      />

      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center shadow-sm flex flex-col items-center">
             <Activity size={48} className="text-slate-300 mb-4" />
             <p className="text-lg font-medium text-slate-700">No clinical records found</p>
             <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Create a new record to begin adding history, exams, and dental charting.</p>
          </div>
        ) : (
          records.map((record) => (
            <RecordItem key={getEntityId(record)} record={record} expandedRecordId={expandedRecordId} setExpandedRecordId={setExpandedRecordId} handleDelete={handleDeleteRecord} handleRestore={handleRestoreRecord} handleHardDelete={handleHardDeleteRecord} handleSaveEdit={handleSaveEdit} searchKeyword={recordFilters.searchText} canManageRecords={canManageRecords} />
          ))
        )}
      </div>

      {recordMeta.total > 0 && (
        <Card className="border-0 shadow-sm bg-white mt-6">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-600">Showing <strong className="text-slate-900">{pageStartIndex + 1}-{Math.min(pageStartIndex + records.length, recordMeta.total)}</strong> of <strong className="text-slate-900">{recordMeta.total}</strong> records</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPageSafe === 1} className="bg-white">Previous</Button>
              <span className="text-sm font-bold text-slate-700 px-2 lg:px-4 whitespace-nowrap">{currentPageSafe} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPageSafe === totalPages} className="bg-white">Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAddModal && (
        <Modal maxWidth="max-w-6xl" onClose={() => { clearShowAddModalDraft(); setShowAddModal(false); }}>
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">New Clinical Record</h2>
            <p className="text-slate-500 text-sm mt-1">Add history, examinations, dental charting and treatment plan.</p>
          </div>
          <RecordForm recordData={newRecord} setRecordData={setNewRecord} onSubmit={async (e) => { e.preventDefault(); const ok = await handleAddRecord(newRecord); if (ok) { clearNewRecordDraft(); clearShowAddModalDraft(); setShowAddModal(false); } }} submitLabel="Save Record" loading={addLoading} />
        </Modal>
      )}

      {showEditPatientModal && (
        <Modal onClose={() => { clearPatientFormDraft(); clearShowEditPatientModalDraft(); setShowEditPatientModal(false); }}>
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">Edit Patient Details</h2>
          </div>
          <form onSubmit={handleUpdatePatient} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <Input label="Patient Name *" name="name" value={patientForm.name} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" required />
              <div className="space-y-1.5 focus-within:text-primary-600"><label className="text-sm font-semibold text-slate-700 leading-none">Patient UID <span className="opacity-50">(Auto)</span></label><input type="text" value={patientForm.cardNumber} disabled className="w-full rounded-xl border border-slate-200 p-3 bg-slate-100 text-slate-500 text-sm font-mono h-[46px]" /></div>
              <Input label="Date of Birth *" name="dateOfBirth" type="date" value={patientForm.dateOfBirth || ""} onChange={handleDateOfBirthChange} disabled={patientSaveLoading} className="bg-white" required />
              <Input label="Age (Auto-calculated)" name="age" type="number" value={patientForm.age} disabled={true} className="bg-slate-100 text-slate-500 h-[46px]" required />
              <div className="space-y-1.5 focus-within:text-primary-600"><label className="text-sm font-semibold text-slate-700 leading-none">Sex</label><select name="gender" value={patientForm.gender} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm h-[46px] capitalize"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
              <Input label="Occupation" name="occupation" value={patientForm.occupation || ""} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" />
              <Input label="Phone Number *" name="phone" value={patientForm.phone} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" required />
              <Input label="Email Address" name="email" type="email" value={patientForm.email} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" />
              <div className="sm:col-span-2 space-y-1.5"><label className="text-sm font-semibold text-slate-700 leading-none">Home Address *</label><textarea name="address" value={patientForm.address} onChange={handlePatientFormChange} disabled={patientSaveLoading} rows="2" className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none" required /></div>
              
              <div className="sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
                <h4 className="text-sm font-bold text-slate-800 mb-4">Next of Kin / Emergency Contact</h4>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Input label="Next of Kin Name" name="nextOfKinName" value={patientForm.nextOfKinName} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" />
                  <Input label="Relationship" name="nextOfKinRelationship" value={patientForm.nextOfKinRelationship} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" />
                  <Input label="Contact Number" name="nextOfKinPhone" value={patientForm.nextOfKinPhone} onChange={handlePatientFormChange} disabled={patientSaveLoading} className="bg-white" />
                  <div className="sm:col-span-2 space-y-1.5"><label className="text-sm font-semibold text-slate-700 leading-none">Address</label><textarea name="nextOfKinAddress" value={patientForm.nextOfKinAddress} onChange={handlePatientFormChange} disabled={patientSaveLoading} rows="2" className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none" /></div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => { clearPatientFormDraft(); clearShowEditPatientModalDraft(); setShowEditPatientModal(false); }} disabled={patientSaveLoading} className="flex-1">Cancel</Button>
              <Button type="submit" isLoading={patientSaveLoading} className="flex-1 shadow-md">Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}
      
      {toast.show && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast({ ...toast, show: false })} />}
      <ConfirmModal 
        isOpen={!!confirmConfig} 
        onClose={() => setConfirmConfig(null)} 
        {...confirmConfig} 
      />
    </motion.div>
  );
}
