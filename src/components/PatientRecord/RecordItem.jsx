import React, { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Activity,
  PenTool,
  Trash2,
  Edit2,
  Info,
  CheckCircle2,
  Clock,
  FileText,
  ImagePlus,
  AlertCircle,
} from "lucide-react";
import RecordForm from "./RecordForm";
import Modal from "./Modal";
import HighlightText from "../../utils/HighlightText";
import { createEmptyRecord, formatToothFindings } from "./recordUtils";
import { getEntityId } from "../../utils/entityId";
import Button from "../ui/Button";
import api from "../../services/api";
import usePersistentState from "../../hooks/usePersistentState";

function RecordSection({ title, content, icon: Icon, keyword }) {
  if (!content) return null;
  return (
    <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
      <h4 className="flex items-center text-sm font-bold text-slate-700 mb-2 uppercase tracking-widest">
        <Icon size={14} className="mr-2 text-primary-500" /> {title}
      </h4>
      <div className="text-sm text-slate-700 leading-relaxed">
        <HighlightText text={content} keyword={keyword} />
      </div>
    </div>
  );
}

function RecordItem({
  record,
  expandedRecordId,
  setExpandedRecordId,
  handleDelete,
  handleRestore,
  handleHardDelete,
  handleSaveEdit,
  searchKeyword,
  virtualizer,
  canManageRecords = false,
  canPermanentlyDelete = false,
}) {
  const formatWithCommas = (text) => {
    if (!text) return text;
    return text
      .split("\n")
      .map((s) =>
        s
          .replace(/^[-•*]\s*/, "")
          .replace(/^\d+\.\s*/, "")
          .trim()
          .replace(/\.+$/, "")
          .trim(),
      )
      .filter(Boolean)
      .join(", ");
  };

  const formatConsentDateTime = (dateValue) => {
    if (!dateValue) return "Unknown date/time";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "Unknown date/time";

    return date
      .toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
      .replace(/\s?(am|pm)$/i, (match) => match.trim().toLowerCase());
  };

  const recordId = getEntityId(record);
  const [isEditing, setIsEditing, clearEditingFlag] = usePersistentState(
    `carechrome:draft:record-edit-open:${recordId}`,
    false,
  );
  const [editingRecordData, setEditingRecordData, clearEditingDraft] =
    usePersistentState(`carechrome:draft:record-edit:${recordId}`, {
      ...createEmptyRecord(),
      ...record,
    });
  const [loading, setLoading] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const isExpanded = expandedRecordId === recordId;

  useEffect(() => {
    if (virtualizer) virtualizer.measure();
  }, [isExpanded, virtualizer]);

  useEffect(() => {
    if (!isEditing) {
      setEditingRecordData({ ...createEmptyRecord(), ...record });
    }
  }, [record, isEditing, setEditingRecordData]);

  const cancelEditing = useCallback(() => {
    clearEditingFlag();
    clearEditingDraft();
    setLoading(false);
  }, [clearEditingDraft, clearEditingFlag]);

  const saveEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleSaveEdit(recordId, editingRecordData, []);
      cancelEditing();
    } catch (err) {
      console.error("Failed to update record:", err);
      setLoading(false);
    }
  };

  const examSections = [
    ["Extra-Oral", formatWithCommas(record.examinationExtraOral)],
    ["Soft Tissue", formatWithCommas(record.softTissue)],
    ["Periodontal Status", formatWithCommas(record.periodontalStatus)],
    ["Occlusion", formatWithCommas(record.occlusion)],
  ].filter(([, value]) => value);

  const toothFindings = formatToothFindings(record.teeth, record.dentition);

  return (
    <div
      className={`border rounded-2xl mb-4 transition-all duration-300 overflow-hidden ${isExpanded ? "border-primary-300 shadow-md bg-white" : "border-slate-200 bg-white hover:border-primary-200 hover:shadow-sm"}`}
    >
      <div
        onClick={() => setExpandedRecordId(isExpanded ? null : recordId)}
        className={`flex flex-col sm:flex-row justify-between sm:items-center cursor-pointer p-5 transition-colors ${isExpanded ? "bg-primary-50/50" : "hover:bg-slate-50"}`}
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              <Calendar size={12} className="mr-1.5" />{" "}
              {record.createdAt
                ? new Date(record.createdAt).toLocaleDateString()
                : "-"}
            </span>
            <h3 className="font-bold text-slate-900 text-lg flex items-center">
              <Activity size={16} className="mr-2 text-rose-500" />{" "}
              <HighlightText
                text={
                  formatWithCommas(record.diagnosis) || "No Diagnosis Recorded"
                }
                keyword={searchKeyword}
              />
            </h3>
          </div>
          <p className="text-sm text-slate-600 line-clamp-1">
            <strong className="text-slate-800">C/O:</strong>{" "}
            <HighlightText
              text={formatWithCommas(record.presentingComplaint) || "N/A"}
              keyword={searchKeyword}
            />
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-4 flex items-center justify-end">
          <div
            className={`p-2 rounded-full transition-colors ${isExpanded ? "bg-white shadow-sm text-primary-600" : "text-slate-400 bg-slate-50"}`}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <div className="overflow-hidden">
            <div className="p-6 border-t border-slate-100 bg-white">
              <RecordSection
                title="History of Presenting Complaint"
                content={record.history}
                icon={Clock}
                keyword={searchKeyword}
              />
              <RecordSection
                title="Medical History / Comorbidities"
                content={formatWithCommas(record.comorbidities)}
                icon={Activity}
                keyword={searchKeyword}
              />
              <RecordSection
                title="Allergies"
                content={formatWithCommas(record.allergies)}
                icon={AlertCircle}
                keyword={searchKeyword}
              />
              <RecordSection
                title="Current Medications"
                content={formatWithCommas(record.currentMedication)}
                icon={Activity}
                keyword={searchKeyword}
              />

              {(() => {
                let vitals = {};
                try {
                  vitals =
                    typeof record.vitals === "string"
                      ? JSON.parse(record.vitals || "{}")
                      : record.vitals || {};
                } catch {
                  vitals = {};
                }

                const vitalsFields = [
                  [
                    "Blood Pressure",
                    vitals.bloodPressure
                      ? `${vitals.bloodPressure} mmHg`
                      : null,
                  ],
                  [
                    "Heart Rate",
                    vitals.heartRate ? `${vitals.heartRate} bpm` : null,
                  ],
                  [
                    "Temperature",
                    vitals.temperature ? `${vitals.temperature} °C` : null,
                  ],
                  ["Weight", vitals.weight ? `${vitals.weight} kg` : null],
                  [
                    "Blood Glucose",
                    vitals.bloodGlucose ? `${vitals.bloodGlucose} mg/dL` : null,
                  ],
                ].filter(([, value]) => value);

                if (vitalsFields.length === 0) return null;

                return (
                  <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <h4 className="flex items-center text-sm font-bold text-slate-700 mb-3 uppercase tracking-widest">
                      <Activity size={14} className="mr-2 text-rose-500" />{" "}
                      Patient Vitals
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {vitalsFields.map(([label, value]) => (
                        <div
                          key={label}
                          className="bg-white p-3 rounded-lg border border-slate-200"
                        >
                          <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {label}
                          </span>
                          <div className="text-sm text-slate-800 font-semibold">
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {examSections.length > 0 ? (
                <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <h4 className="flex items-center text-sm font-bold text-slate-700 mb-3 uppercase tracking-widest">
                    <Info size={14} className="mr-2 text-amber-500" /> Clinical
                    Examination
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {examSections.map(([label, value]) => (
                      <div
                        key={label}
                        className="bg-white p-3 rounded-lg border border-slate-200"
                      >
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {label}
                        </span>
                        <div className="text-sm text-slate-800">
                          <HighlightText
                            text={value || ""}
                            keyword={searchKeyword}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <RecordSection
                  title="General Examination"
                  content={record.examination}
                  icon={Info}
                  keyword={searchKeyword}
                />
              )}

              {toothFindings.length > 0 && (
                <div className="mb-4 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="flex items-center text-sm font-bold text-blue-900 uppercase tracking-widest">
                      <Activity size={14} className="mr-2 text-blue-500" />{" "}
                      Dental Chart Findings
                    </h4>
                    <span className="text-xs font-bold bg-white text-blue-700 px-2 py-1 rounded-full border border-blue-200 uppercase">
                      {record.dentition === "child"
                        ? "Child Dentition"
                        : record.dentition === "mixed"
                          ? "Mixed Dentition"
                          : "Adult Dentition"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full">
                    {toothFindings.map((finding) => {
                      if (finding.condition === "present") {
                        const quads = { UR: [], UL: [], LL: [], LR: [] };
                        finding.teeth.forEach((t) => {
                          const quad = t.notation.slice(0, 2);
                          if (quads[quad]) quads[quad].push(t);
                        });

                        const quadRows = ["UR", "UL", "LR", "LL"]
                          .map((q) => {
                            const teethInQuad = quads[q];
                            if (teethInQuad.length === 0) return null;

                            const adultTeeth = teethInQuad.filter((t) => t.number < 50);
                            const childTeeth = teethInQuad.filter((t) => t.number >= 50);

                            if (q === "UR" || q === "LR") {
                              adultTeeth.sort((a, b) => b.number - a.number);
                              childTeeth.sort((a, b) => b.number - a.number);
                            } else {
                              adultTeeth.sort((a, b) => a.number - b.number);
                              childTeeth.sort((a, b) => a.number - b.number);
                            }

                            const sortedTeeth = [...adultTeeth, ...childTeeth];
                            const labels = sortedTeeth.map((t) => t.label).join(", ");
                            return `${q} ${labels}`;
                          })
                          .filter(Boolean);

                        if (quadRows.length === 0) return null;

                        return (
                          <div
                            key={finding.condition}
                            className="bg-white border border-blue-200 rounded-xl p-3.5 text-sm w-full"
                          >
                            <div className="font-bold text-blue-800 mb-2 border-b border-blue-100 pb-1 uppercase tracking-wider text-xs">
                              {finding.label}
                            </div>
                            <div className="font-mono text-slate-700 space-y-1">
                              {quadRows.map((row, idx) => (
                                <div key={idx}>{row}</div>
                              ))}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={finding.condition}
                          className="bg-white border border-blue-200 rounded-lg p-2 text-sm"
                        >
                          <span className="font-bold text-blue-800 mr-2">
                            {finding.label}:
                          </span>
                          <span className="text-slate-700 font-mono">
                            {finding.teeth.map((t) => t.notation).join(", ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RecordSection
                  title="Investigation"
                  content={record.investigation}
                  icon={FileText}
                  keyword={searchKeyword}
                />
                <RecordSection
                  title="Treatment Plan"
                  content={formatWithCommas(record.treatmentPlan)}
                  icon={PenTool}
                  keyword={searchKeyword}
                />
              </div>

              <RecordSection
                title="Medications Prescribed"
                content={formatWithCommas(record.medication)}
                icon={Activity}
                keyword={searchKeyword}
              />

              {(() => {
                let atts = [];
                if (Array.isArray(record.attachments))
                  atts = record.attachments;
                else if (typeof record.attachments === "string") {
                  try {
                    atts = JSON.parse(record.attachments);
                  } catch {
                    atts = [];
                  }
                }

                if (atts.length > 0) {
                  return (
                    <div className="mb-4 bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                      <h4 className="flex items-center text-sm font-bold text-slate-700 uppercase tracking-widest">
                        <ImagePlus
                          size={14}
                          className="mr-2 text-primary-500"
                        />{" "}
                        Attached Media
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAttachments(true)}
                        className="bg-white border-slate-200"
                      >
                        View Attachments ({atts.length})
                      </Button>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="mt-6 border-t border-slate-100 pt-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="flex items-center gap-4">
                  <div
                    className={`p-3 rounded-xl flex items-center justify-center shrink-0 ${record.consentObtained ? "bg-emerald-100/50 text-emerald-600 border border-emerald-200" : "bg-slate-100 text-slate-400 border border-slate-200"}`}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Patient Consent
                    </p>
                    <p
                      className={`text-sm ${record.consentObtained ? "text-emerald-700" : "text-slate-500 italic"}`}
                    >
                      {record.consentObtained
                        ? `Obtained on ${formatConsentDateTime(record.consentDate)} by ${record.consentTakenBy || "Unknown"}`
                        : "Not documented"}
                    </p>
                    {record.consentNotes && (
                      <p className="text-xs text-slate-600 mt-1">
                        <HighlightText
                          text={record.consentNotes}
                          keyword={searchKeyword}
                        />
                      </p>
                    )}
                  </div>
                </div>

                {canManageRecords && !record.isDeleted && (
                  <div className="flex w-full flex-wrap items-center gap-1.5 md:w-auto md:flex-nowrap md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="w-auto flex-1 px-2.5 md:flex-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <Edit2 size={16} className="mr-1.5" /> Edit Record
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleDelete(recordId)}
                      className="ml-[-2px] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Move record to trash"
                      title="Move to Trash"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                {canManageRecords && record.isDeleted && (
                  <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(recordId)}
                      className="w-auto flex-1 md:flex-none focus:ring-2 focus:ring-emerald-500 bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    >
                      <Activity size={16} className="mr-2" /> Restore
                    </Button>
                    {canPermanentlyDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHardDelete(recordId)}
                        className="w-auto flex-1 md:flex-none text-red-600 hover:text-red-700 hover:bg-red-50 focus:ring-2 focus:ring-red-500"
                      >
                        <Trash2 size={16} className="mr-2" /> Delete Permanently
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {showAttachments &&
        (() => {
          let atts = [];
          if (Array.isArray(record.attachments)) atts = record.attachments;
          else if (typeof record.attachments === "string") {
            try {
              atts = JSON.parse(record.attachments);
            } catch {
              atts = [];
            }
          }
          return (
            <Modal onClose={() => setShowAttachments(false)}>
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Media & Attachments
                </h2>
              </div>
              <div className="flex flex-wrap gap-4">
                {atts.map((att, idx) => (
                  <a
                    key={idx}
                    href={`${api.defaults.baseURL.replace("/api", "")}${att.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group bg-slate-50 border border-slate-200 hover:border-primary-300 rounded-xl p-2 flex flex-col items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shadow-sm transition-all hover:shadow-md overflow-hidden"
                  >
                    {att.type?.includes("pdf") ? (
                      <FileText size={40} className="text-rose-500 mb-2" />
                    ) : (
                      <img
                        src={`${api.defaults.baseURL.replace("/api", "")}${att.url}`}
                        alt={att.name}
                        className="w-full h-full object-cover rounded-lg mb-1"
                      />
                    )}
                    <span className="text-xs text-slate-500 truncate w-full text-center block font-medium absolute bottom-0 left-0 bg-white/90 px-1 py-1 backdrop-blur-sm rounded-b-xl border-t border-slate-100 group-hover:text-primary-700">
                      {att.name}
                    </span>
                  </a>
                ))}
              </div>
            </Modal>
          );
        })()}

      {isEditing && canManageRecords && (
        <Modal maxWidth="max-w-6xl" onClose={cancelEditing}>
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              Edit Clinical Record
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Update assessment, dental chart, and treatment plan.
            </p>
          </div>
          <RecordForm
            recordData={editingRecordData}
            setRecordData={setEditingRecordData}
            onSubmit={saveEdit}
            submitLabel="Save Changes"
            loading={loading}
          />
        </Modal>
      )}
    </div>
  );
}

export default React.memo(RecordItem);
