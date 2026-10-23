import React, { useState, useCallback, useRef, useEffect } from "react";
import { createEmptyRecord } from "./recordUtils";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Input from "../ui/Input";
import {
  CheckCircle2,
  Shield,
  AlertCircle,
  BookOpen,
  Lock,
  ImagePlus,
  X,
  FileText,
  Activity,
} from "lucide-react";
import { DENTAL_FORMULARY } from "../../utils/dentalFormulary";
import { CLINICAL_TEMPLATES } from "../../utils/clinicalTemplates";
import api from "../../services/api";
import { hasActiveProAccess } from "../../utils/clinicAccess";
import { getStoredUserObject } from "../../utils/authStorage";

const TEMPLATE_FIELD_MAP = {
  presentingComplaint: "presentingComplaint",
  diagnosis: "diagnosis",
  treatmentPlan: "treatmentPlan",
  allergies: "allergies",
  comorbidities: "comorbidities",
  extraOral: "examinationExtraOral",
  softTissue: "softTissue",
  periodontal: "periodontalStatus",
  occlusion: "occlusion",
};

const ADULT_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46,
  45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];
const CHILD_TEETH = [
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 85, 84, 83, 82, 81, 71, 72, 73, 74,
  75,
];

const TOOTH_CONDITIONS = [
  "present",
  "carious",
  "tender",
  "mobile",
  "fractured",
  "missing",
];
const CONDITION_LABELS = {
  present: "Present",
  carious: "Carious",
  tender: "Tender",
  mobile: "Mobile",
  fractured: "Fractured",
  missing: "Missing",
};

const initTeeth = (nums) => nums.map((n) => ({ number: n, conditions: [] }));

const toothLabel = (num, dentition) => {
  if (dentition === "adult") {
    if (num >= 11 && num <= 18) return num - 10;
    if (num >= 21 && num <= 28) return num - 20;
    if (num >= 31 && num <= 38) return num - 30;
    if (num >= 41 && num <= 48) return num - 40;
  } else {
    const letters = ["A", "B", "C", "D", "E"];
    if (num >= 51 && num <= 55) return letters[num - 51];
    if (num >= 61 && num <= 65) return letters[num - 61];
    if (num >= 71 && num <= 75) return letters[num - 71];
    if (num >= 81 && num <= 85) return letters[num - 81];
  }
  return num;
};

const palmerNotation = (num) => {
  if (num >= 11 && num <= 18) return `UR${num - 10}`;
  if (num >= 21 && num <= 28) return `UL${num - 20}`;
  if (num >= 31 && num <= 38) return `LL${num - 30}`;
  if (num >= 41 && num <= 48) return `LR${num - 40}`;
  if (num >= 51 && num <= 55) return `UR${num - 50}`;
  if (num >= 61 && num <= 65) return `UL${num - 60}`;
  if (num >= 71 && num <= 75) return `LL${num - 70}`;
  if (num >= 81 && num <= 85) return `LR${num - 80}`;
  return `${num}`;
};

const initializeTeethState = (initialDentition, savedTeeth = []) => {
  const baseAdultTeeth = initTeeth(ADULT_TEETH);
  const baseChildTeeth = initTeeth(CHILD_TEETH);

  const savedConditions = new Map(
    (Array.isArray(savedTeeth) ? savedTeeth : []).map((tooth) => {
      const resolvedConditions = Array.isArray(tooth?.conditions)
        ? tooth.conditions
        : tooth?.condition && tooth.condition !== "present"
          ? [tooth.condition]
          : [];
      return [Number(tooth?.number), resolvedConditions];
    }),
  );

  const applySavedConditions = (tooth) => {
    const conditions = savedConditions.has(tooth.number)
      ? savedConditions.get(tooth.number)
      : tooth.conditions;
    return {
      ...tooth,
      conditions,
      condition: conditions.length > 0 ? conditions[0] : "present",
    };
  };

  const adultWithConditions = baseAdultTeeth.map(applySavedConditions);
  const childWithConditions = baseChildTeeth.map(applySavedConditions);

  if (initialDentition === "mixed") {
    return {
      adult: baseAdultTeeth,
      child: baseChildTeeth,
      mixedAdult: adultWithConditions,
      mixedChild: childWithConditions,
    };
  }

  return {
    adult: adultWithConditions,
    child: childWithConditions,
    mixedAdult: baseAdultTeeth,
    mixedChild: baseChildTeeth,
  };
};

function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
  rows = 1,
  required = false,
  placeholder = "",
  unit,
  max,
  error,
  readOnly = false,
}) {
  return (
    <div className="space-y-1.5 focus-within:text-primary-600 transition-colors w-full">
      <label className="text-sm font-semibold text-slate-700 leading-none">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          required={required}
          placeholder={placeholder}
          className={`w-full rounded-xl border ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-slate-200 focus:ring-primary-500"} p-3 bg-white text-sm focus:outline-none focus:ring-2 shadow-sm resize-none transition-shadow`}
        />
      ) : unit ? (
        <div className="relative flex flex-col w-full">
          <div className="relative flex items-center w-full">
            <input
              name={name}
              type={type}
              value={value}
              onChange={onChange}
              required={required}
              placeholder={placeholder}
              max={max}
              readOnly={readOnly}
              className={`w-full rounded-xl border ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-slate-200 focus:ring-primary-500"} p-3 pr-16 bg-white text-sm focus:outline-none focus:ring-2 shadow-sm transition-shadow h-[46px]`}
            />
            <span className="absolute right-4 text-slate-400 text-sm font-medium">
              {unit}
            </span>
          </div>
          {error && (
            <span className="text-red-500 text-[11px] font-medium mt-1 leading-tight animate-in fade-in slide-in-from-top-1 duration-150">
              {error}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col w-full">
          <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            required={required}
            placeholder={placeholder}
            max={max}
            readOnly={readOnly}
            className={`w-full rounded-xl border ${error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-slate-200 focus:ring-primary-500"} p-3 bg-white text-sm focus:outline-none focus:ring-2 shadow-sm transition-shadow h-[46px]`}
          />
          {error && (
            <span className="text-red-500 text-[11px] font-medium mt-1 leading-tight animate-in fade-in slide-in-from-top-1 duration-150">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CheckboxField({ label, name, checked, onChange, required = false }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm focus-within:ring-2 focus-within:ring-primary-500">
      <div className="relative flex items-center">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={onChange}
          className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
        />
      </div>
      <span className="font-semibold text-slate-800 select-none flex-1">
        {label} {required && <span className="text-red-500 ml-1">*</span>}
      </span>
    </label>
  );
}

const CONDITION_COLORS = {
  present: "#10b981", // emerald-500
  carious: "#f43f5e", // rose-500
  tender: "#fbbf24", // amber-400
  mobile: "#fb923c", // orange-400
  fractured: "#a855f7", // purple-500
  missing: "#cbd5e1", // slate-300
};

const getLoggedInClinicianName = () => {
  const storedUser = getStoredUserObject() || {};
  const displayName = String(storedUser.name || "").trim();
  if (displayName) {
    return storedUser.role === "doctor" && !/^dr\.?\s/i.test(displayName)
      ? `Dr. ${displayName}`
      : displayName;
  }

  return storedUser.email || "Current user";
};

const formatDateTimeLocal = (dateValue) => {
  if (!dateValue) return "";
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
};

const getCurrentDateTimeLocal = () => formatDateTimeLocal(new Date());

const getToothStyleAndClass = (conditions = []) => {
  if (!conditions || conditions.length === 0) {
    return {
      style: {},
      className: "bg-white text-slate-700 border-slate-300 hover:bg-slate-100",
    };
  }

  if (conditions.includes("missing")) {
    return {
      style: {},
      className:
        "bg-slate-300 text-slate-500 border-slate-400 opacity-60 line-through",
    };
  }

  if (conditions.length === 1) {
    const cond = conditions[0];
    const baseClass = "text-white ring-2 ring-offset-1";
    if (cond === "present")
      return {
        style: {},
        className: `${baseClass} bg-emerald-500 border-emerald-600 ring-emerald-500`,
      };
    if (cond === "carious")
      return {
        style: {},
        className: `${baseClass} bg-rose-500 border-rose-600 ring-rose-500`,
      };
    if (cond === "tender")
      return {
        style: {},
        className: `${baseClass} bg-amber-400 text-amber-900 border-amber-500 ring-amber-400`,
      };
    if (cond === "mobile")
      return {
        style: {},
        className: `${baseClass} bg-orange-400 border-orange-500 ring-orange-400`,
      };
    if (cond === "fractured")
      return {
        style: {},
        className: `${baseClass} bg-purple-500 border-purple-600 ring-purple-500`,
      };
  }

  const stopPercent = 100 / conditions.length;
  const gradientStops = conditions.map((cond, idx) => {
    const color = CONDITION_COLORS[cond] || "#ffffff";
    const start = idx * stopPercent;
    const end = (idx + 1) * stopPercent;
    return `${color} ${start}%, ${color} ${end}%`;
  });

  const isTenderOnlyOrMissing = !conditions.some(
    (c) => c !== "tender" && c !== "missing",
  );
  const textColorClass = isTenderOnlyOrMissing
    ? "text-slate-800"
    : "text-white";

  return {
    style: {
      background: `linear-gradient(135deg, ${gradientStops.join(", ")})`,
    },
    className: `border-slate-400 ring-2 ring-slate-400 ring-offset-1 shadow-sm ${textColorClass}`,
  };
};

function ToothChart({ teeth, onToothClick, dentition }) {
  const quadrants = {
    UR: teeth
      .filter((t) =>
        [11, 12, 13, 14, 15, 16, 17, 18, 51, 52, 53, 54, 55].includes(t.number),
      )
      .sort((a, b) => b.number - a.number),
    UL: teeth
      .filter((t) =>
        [21, 22, 23, 24, 25, 26, 27, 28, 61, 62, 63, 64, 65].includes(t.number),
      )
      .sort((a, b) => a.number - b.number),
    LL: teeth
      .filter((t) =>
        [31, 32, 33, 34, 35, 36, 37, 38, 71, 72, 73, 74, 75].includes(t.number),
      )
      .sort((a, b) => a.number - b.number),
    LR: teeth
      .filter((t) =>
        [41, 42, 43, 44, 45, 46, 47, 48, 81, 82, 83, 84, 85].includes(t.number),
      )
      .sort((a, b) => b.number - a.number),
  };

  const renderRow = (left, right) => (
    <div className="flex justify-center md:justify-between items-center w-full max-w-3xl mx-auto flex-wrap md:flex-nowrap gap-1 md:gap-8 mb-2 px-2">
      <div className="flex gap-1.5 flex-1 justify-end md:justify-end border-b-2 border-slate-300 pb-2 md:border-b-0 md:pb-0 md:border-r-2 md:pr-4">
        {left.map((t) => {
          const resolvedConditions = Array.isArray(t.conditions)
            ? t.conditions
            : t.condition && t.condition !== "present"
              ? [t.condition]
              : [];
          const { style, className } =
            getToothStyleAndClass(resolvedConditions);
          const label =
            resolvedConditions.length > 0
              ? resolvedConditions.map((c) => CONDITION_LABELS[c]).join(", ")
              : "Present";
          return (
            <button
              key={t.number}
              type="button"
              onClick={() => onToothClick(t.number)}
              style={style}
              className={`w-8 h-8 sm:w-9 sm:h-9 md:sm:w-10 md:sm:h-10 rounded-lg text-sm font-bold flex items-center justify-center cursor-pointer transition-all hover:-translate-y-1 ${className}`}
              title={`${palmerNotation(t.number)} - ${label}`}
            >
              {toothLabel(t.number, dentition)}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 flex-1 justify-start md:justify-start border-t-2 border-slate-300 pt-2 md:border-t-0 md:pt-0">
        {right.map((t) => {
          const resolvedConditions = Array.isArray(t.conditions)
            ? t.conditions
            : t.condition && t.condition !== "present"
              ? [t.condition]
              : [];
          const { style, className } =
            getToothStyleAndClass(resolvedConditions);
          const label =
            resolvedConditions.length > 0
              ? resolvedConditions.map((c) => CONDITION_LABELS[c]).join(", ")
              : "Present";
          return (
            <button
              key={t.number}
              type="button"
              onClick={() => onToothClick(t.number)}
              style={style}
              className={`w-8 h-8 sm:w-9 sm:h-9 md:sm:w-10 md:sm:h-10 rounded-lg text-sm font-bold flex items-center justify-center cursor-pointer transition-all hover:-translate-y-1 ${className}`}
              title={`${palmerNotation(t.number)} - ${label}`}
            >
              {toothLabel(t.number, dentition)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 py-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
      <div className="flex justify-between w-full max-w-4xl mx-auto px-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">
          Patient's Right (UR/LR)
        </span>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-slate-200">
          Patient's Left (UL/LL)
        </span>
      </div>
      <div className="text-center">
        <span className="inline-block bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full mb-2">
          Maxillary (Upper)
        </span>
      </div>
      {renderRow(quadrants.UR, quadrants.UL)}

      <div className="w-full max-w-4xl mx-auto border-t-2 border-slate-300 border-dashed my-4"></div>

      {renderRow(quadrants.LR, quadrants.LL)}
      <div className="text-center mt-2">
        <span className="inline-block bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
          Mandibular (Lower)
        </span>
      </div>
    </div>
  );
}

const groupByQuadrant = (teeth) => {
  const quads = { UR: [], UL: [], LL: [], LR: [] };
  teeth.forEach((num) => {
    const label = toothLabel(num, num >= 50 ? "child" : "adult");
    const notation = palmerNotation(num).slice(0, 2);
    if (quads[notation]) quads[notation].push(label);
  });
  return quads;
};

export default function RecordForm({
  recordData,
  setRecordData,
  onSubmit,
  submitLabel,
  loading,
}) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!recordData.consentObtained) {
      setNotificationModal({
        show: true,
        message:
          "Informed consent must be obtained and documented before saving the record.",
      });
      return;
    }
    if (!recordData.consentDate || !recordData.consentTakenBy?.trim()) {
      setNotificationModal({
        show: true,
        message:
          "Please provide the consent date and the clinician who took the consent.",
      });
      return;
    }

    const hasVitalsErrors = Object.values(vitalsErrors).some(
      (error) => error !== "",
    );
    if (hasVitalsErrors) {
      setNotificationModal({
        show: true,
        message: "Please fix the invalid vital signs before saving the record.",
      });
      return;
    }

    onSubmit(e);
  };
  const [activeExamTab, setActiveExamTab] = useState("extraoral");
  const [showFormulary, setShowFormulary] = useState(false);
  const [formularyCategory, setFormularyCategory] = useState("Antibiotics");
  const [activeTemplateType, setActiveTemplateType] = useState(null);
  const [templateCategory, setTemplateCategory] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [notificationModal, setNotificationModal] = useState({
    show: false,
    message: "",
  });
  const [vitalsErrors, setVitalsErrors] = useState({});

  useEffect(() => {
    const initialVitals =
      typeof recordData.vitals === "string"
        ? JSON.parse(recordData.vitals || "{}")
        : recordData.vitals || {};
    const errors = {};
    Object.entries(initialVitals).forEach(([name, value]) => {
      if (value && String(value).trim() !== "") {
        const valStr = String(value).trim();
        if (name === "bloodPressure") {
          if (!/^\d{2,3}\/\d{2,3}$/.test(valStr)) {
            errors.bloodPressure =
              "Format must be Systolic/Diastolic (e.g. 120/80)";
          }
        } else {
          const numVal = parseFloat(valStr);
          if (isNaN(numVal)) {
            errors[name] = "Must be a valid number";
          } else {
            if (name === "heartRate") {
              if (numVal <= 0 || numVal >= 300)
                errors.heartRate = "Must be between 1 and 299 bpm";
            } else if (name === "temperature") {
              if (numVal <= 20 || numVal >= 45)
                errors.temperature = "Must be between 20.1°C and 44.9°C";
            } else if (name === "weight") {
              if (numVal <= 0 || numVal >= 500)
                errors.weight = "Must be between 0.1 and 499.9 kg";
            } else if (name === "bloodGlucose") {
              if (numVal <= 0 || numVal >= 1000)
                errors.bloodGlucose = "Must be between 0.1 and 999.9 mg/dL";
            }
          }
        }
      }
    });
    setVitalsErrors(errors);
  }, []);

  const storedUser = getStoredUserObject() || {};
  const proAccessActive = hasActiveProAccess(storedUser?.clinic);

  useEffect(() => {
    if (
      !recordData.consentObtained ||
      (recordData.consentDate && recordData.consentTakenBy?.trim())
    ) {
      return;
    }

    setRecordData((prev) => {
      if (
        !prev.consentObtained ||
        (prev.consentDate && prev.consentTakenBy?.trim())
      ) {
        return prev;
      }

      return {
        ...prev,
        consentDate: prev.consentDate || getCurrentDateTimeLocal(),
        consentTakenBy: prev.consentTakenBy?.trim()
          ? prev.consentTakenBy
          : getLoggedInClinicianName(),
      };
    });
  }, [
    recordData.consentDate,
    recordData.consentObtained,
    recordData.consentTakenBy,
    setRecordData,
  ]);

  const handleFormularySelect = (medValue) => {
    let currentMed = recordData.medication ? recordData.medication.trim() : "";
    if (currentMed.includes(medValue)) {
      currentMed = currentMed
        .replace(medValue, "")
        .replace(/\n\s*\n/g, "\n")
        .trim();
    } else {
      currentMed = currentMed ? `${currentMed}\n${medValue}` : medValue;
    }
    setRecordData({ ...recordData, medication: currentMed });
  };

  const handleTemplateSelect = (value) => {
    if (!activeTemplateType) return;
    const targetField =
      TEMPLATE_FIELD_MAP[activeTemplateType] || activeTemplateType;
    let currentText = recordData[targetField]
      ? recordData[targetField].trim()
      : "";
    if (currentText.includes(value)) {
      currentText = currentText
        .replace(value, "")
        .replace(/\n\s*\n/g, "\n")
        .trim();
    } else {
      currentText = currentText ? `${currentText}\n${value}` : value;
    }
    setRecordData({ ...recordData, [targetField]: currentText });
  };

  const openTemplateModal = (type) => {
    if (!proAccessActive) {
      setShowUpgradeModal(true);
      return;
    }
    setActiveTemplateType(type);
    setTemplateCategory(CLINICAL_TEMPLATES[type].defaultCategory);
  };

  const getActiveTemplateFieldValue = () => {
    if (!activeTemplateType) return "";
    const targetField =
      TEMPLATE_FIELD_MAP[activeTemplateType] || activeTemplateType;
    return recordData[targetField] || "";
  };

  const processSelectedFiles = async (files) => {
    if (files.length === 0) return;

    try {
      const uploadPromises = files.map((file) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      });

      const responses = await Promise.all(uploadPromises);
      const newAttachments = responses.map((res) => ({
        url: res.data.url,
        name: res.data.fileName,
        type: res.data.mimetype,
      }));

      // Parse current attachments (handles stringified JSON if it came from DB as string)
      let currentAttachments = [];
      if (typeof recordData.attachments === "string") {
        try {
          currentAttachments = JSON.parse(recordData.attachments);
        } catch {
          currentAttachments = [];
        }
      } else if (Array.isArray(recordData.attachments)) {
        currentAttachments = recordData.attachments;
      }

      setRecordData({
        ...recordData,
        attachments: [...currentAttachments, ...newAttachments],
      });
    } catch (err) {
      console.error("Upload failed", err);
      if (
        err.response?.status === 403 ||
        err.response?.data?.errorCode === "UPGRADE_REQUIRED"
      ) {
        setShowUpgradeModal(true);
      } else {
        setNotificationModal({
          show: true,
          message:
            "Failed to upload some files. " +
            (err.response?.data?.message || err.message),
        });
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    await processSelectedFiles(files);
  };

  const openFilePicker = async () => {
    if (!proAccessActive) {
      setShowUpgradeModal(true);
      return;
    }

    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: "Images and PDF files",
              accept: {
                "image/jpeg": [".jpg", ".jpeg"],
                "image/png": [".png"],
                "image/webp": [".webp"],
                "application/pdf": [".pdf"],
              },
            },
          ],
          excludeAcceptAllOption: false,
        });

        const files = await Promise.all(
          handles.map((handle) => handle.getFile()),
        );
        await processSelectedFiles(files);
        return;
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error(
            "Advanced file picker failed, falling back to input:",
            error,
          );
        } else {
          return;
        }
      }
    }

    fileInputRef.current?.click();
  };

  const removeAttachment = (index) => {
    let currentAttachments = Array.isArray(recordData.attachments)
      ? [...recordData.attachments]
      : [];
    if (typeof recordData.attachments === "string") {
      try {
        currentAttachments = JSON.parse(recordData.attachments);
      } catch {
        currentAttachments = [];
      }
    }
    currentAttachments.splice(index, 1);
    setRecordData({ ...recordData, attachments: currentAttachments });
  };

  const initialRecord = { ...createEmptyRecord(), ...recordData };
  const initialTeethState = initializeTeethState(
    initialRecord.dentition,
    initialRecord.teeth,
  );

  const [dentition, setDentition] = useState(
    initialRecord.dentition || "adult",
  );
  const [activeCondition, setActiveCondition] = useState("carious");
  const [adultTeeth, setAdultTeeth] = useState(initialTeethState.adult);
  const [childTeeth, setChildTeeth] = useState(initialTeethState.child);
  const [mixedAdultTeeth, setMixedAdultTeeth] = useState(
    initialTeethState.mixedAdult,
  );
  const [mixedChildTeeth, setMixedChildTeeth] = useState(
    initialTeethState.mixedChild,
  );

  const mixedTeeth = [...mixedAdultTeeth, ...mixedChildTeeth];
  const teeth =
    dentition === "adult"
      ? adultTeeth
      : dentition === "child"
        ? childTeeth
        : mixedTeeth;

  const buildOrderedTeethList = useCallback((allTeeth) => {
    const selectedTeeth = allTeeth.filter((t) => {
      const resolvedConditions = Array.isArray(t.conditions)
        ? t.conditions
        : t.condition && t.condition !== "present"
          ? [t.condition]
          : [];
      return resolvedConditions.length > 0;
    });

    // Sort: adult teeth (numbers) first, then child teeth (alphabets, 50+)
    return [...selectedTeeth].sort((a, b) => {
      const aIsChild = a.number >= 50;
      const bIsChild = b.number >= 50;
      if (aIsChild && !bIsChild) return 1;
      if (!aIsChild && bIsChild) return -1;
      return 0;
    });
  }, []);

  const syncRecordTeeth = useCallback(
    (nextDentition, nextTeeth) => {
      setRecordData((prev) => ({
        ...prev,
        dentition: nextDentition,
        teeth: nextTeeth,
      }));
    },
    [setRecordData],
  );

  const areAllTeethPresent =
    teeth.length > 0 &&
    teeth.every((t) => {
      const resolvedConditions = Array.isArray(t.conditions)
        ? t.conditions
        : t.condition && t.condition !== "present"
          ? [t.condition]
          : [];
      return resolvedConditions.includes("present");
    });

  const isAnyToothPresent =
    teeth.length > 0 &&
    teeth.some((t) => {
      const resolvedConditions = Array.isArray(t.conditions)
        ? t.conditions
        : t.condition && t.condition !== "present"
          ? [t.condition]
          : [];
      return resolvedConditions.includes("present");
    });

  const handleToothClick = useCallback(
    (num) => {
      const applyUpdate = (t) => {
        const resolvedConditions = Array.isArray(t.conditions)
          ? t.conditions
          : t.condition && t.condition !== "present"
            ? [t.condition]
            : [];

        let nextConditions;
        if (activeCondition === "present") {
          const cleanConditions = resolvedConditions.filter(
            (c) => c !== "missing",
          );
          nextConditions = cleanConditions.includes("present")
            ? cleanConditions.filter((c) => c !== "present")
            : [...cleanConditions, "present"];
        } else if (activeCondition === "missing") {
          nextConditions = resolvedConditions.includes("missing")
            ? []
            : ["missing"];
        } else {
          const cleanConditions = resolvedConditions.filter(
            (c) => c !== "missing",
          );
          nextConditions = cleanConditions.includes(activeCondition)
            ? cleanConditions.filter((c) => c !== activeCondition)
            : [...cleanConditions, activeCondition];
        }

        return {
          ...t,
          conditions: nextConditions,
          condition: nextConditions[0] || "present",
        };
      };

      const isAdultTooth = ADULT_TEETH.includes(num);

      if (dentition === "mixed") {
        if (isAdultTooth) {
          setMixedAdultTeeth((prevMixedAdult) => {
            const updatedMixedAdult = prevMixedAdult.map((t) =>
              t.number === num ? applyUpdate(t) : t,
            );
            syncRecordTeeth(
              dentition,
              buildOrderedTeethList([...updatedMixedAdult, ...mixedChildTeeth]),
            );
            return updatedMixedAdult;
          });
        } else {
          setMixedChildTeeth((prevMixedChild) => {
            const updatedMixedChild = prevMixedChild.map((t) =>
              t.number === num ? applyUpdate(t) : t,
            );
            syncRecordTeeth(
              dentition,
              buildOrderedTeethList([...mixedAdultTeeth, ...updatedMixedChild]),
            );
            return updatedMixedChild;
          });
        }
      } else if (isAdultTooth) {
        setAdultTeeth((prevAdult) => {
          const updatedAdult = prevAdult.map((t) =>
            t.number === num ? applyUpdate(t) : t,
          );
          syncRecordTeeth(dentition, buildOrderedTeethList(updatedAdult));
          return updatedAdult;
        });
      } else {
        setChildTeeth((prevChild) => {
          const updatedChild = prevChild.map((t) =>
            t.number === num ? applyUpdate(t) : t,
          );
          syncRecordTeeth(dentition, buildOrderedTeethList(updatedChild));
          return updatedChild;
        });
      }
    },
    [
      activeCondition,
      adultTeeth,
      childTeeth,
      dentition,
      mixedAdultTeeth,
      mixedChildTeeth,
      syncRecordTeeth,
    ],
  );

  const handleMarkAllPresent = useCallback(() => {
    const updater = (t) => {
      const resolvedConditions = Array.isArray(t.conditions)
        ? t.conditions
        : t.condition && t.condition !== "present"
          ? [t.condition]
          : [];
      const cleanConditions = resolvedConditions.filter((c) => c !== "missing");
      const nextConditions = cleanConditions.includes("present")
        ? cleanConditions
        : [...cleanConditions, "present"];

      return {
        ...t,
        conditions: nextConditions,
        condition: nextConditions[0] || "present",
      };
    };

    if (dentition === "adult") {
      setAdultTeeth((prev) => {
        const updated = prev.map(updater);
        syncRecordTeeth(dentition, buildOrderedTeethList(updated));
        return updated;
      });
    } else if (dentition === "child") {
      setChildTeeth((prev) => {
        const updated = prev.map(updater);
        syncRecordTeeth(dentition, buildOrderedTeethList(updated));
        return updated;
      });
    } else {
      setMixedAdultTeeth((prevMixedAdult) => {
        const updatedMixedAdult = prevMixedAdult.map(updater);
        setMixedChildTeeth((prevMixedChild) => {
          const updatedMixedChild = prevMixedChild.map(updater);
          syncRecordTeeth(
            dentition,
            buildOrderedTeethList([...updatedMixedAdult, ...updatedMixedChild]),
          );
          return updatedMixedChild;
        });
        return updatedMixedAdult;
      });
    }
  }, [
    dentition,
    syncRecordTeeth,
    adultTeeth,
    childTeeth,
    mixedAdultTeeth,
    mixedChildTeeth,
  ]);

  const handleRemoveAllPresent = useCallback(() => {
    const updater = (t) => {
      const resolvedConditions = Array.isArray(t.conditions)
        ? t.conditions
        : t.condition && t.condition !== "present"
          ? [t.condition]
          : [];
      const nextConditions = resolvedConditions.filter((c) => c !== "present");

      return {
        ...t,
        conditions: nextConditions,
        condition: nextConditions[0] || "present",
      };
    };

    if (dentition === "adult") {
      setAdultTeeth((prev) => {
        const updated = prev.map(updater);
        syncRecordTeeth(dentition, buildOrderedTeethList(updated));
        return updated;
      });
    } else if (dentition === "child") {
      setChildTeeth((prev) => {
        const updated = prev.map(updater);
        syncRecordTeeth(dentition, buildOrderedTeethList(updated));
        return updated;
      });
    } else {
      setMixedAdultTeeth((prevMixedAdult) => {
        const updatedMixedAdult = prevMixedAdult.map(updater);
        setMixedChildTeeth((prevMixedChild) => {
          const updatedMixedChild = prevMixedChild.map(updater);
          syncRecordTeeth(
            dentition,
            buildOrderedTeethList([...updatedMixedAdult, ...updatedMixedChild]),
          );
          return updatedMixedChild;
        });
        return updatedMixedAdult;
      });
    }
  }, [
    dentition,
    syncRecordTeeth,
    adultTeeth,
    childTeeth,
    mixedAdultTeeth,
    mixedChildTeeth,
  ]);

  const getAffectedTeethByQuadrant = (condition) => {
    const targetTeeth =
      dentition === "mixed" ? [...mixedAdultTeeth, ...mixedChildTeeth] : teeth;
    const affected = targetTeeth
      .filter((t) => {
        const resolvedConditions = Array.isArray(t.conditions)
          ? t.conditions
          : t.condition && t.condition !== "present"
            ? [t.condition]
            : [];
        return resolvedConditions.includes(condition);
      })
      .map((t) => t.number);
    return groupByQuadrant(affected);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setRecordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVitalsChange = (e) => {
    const { name, value } = e.target;

    let errorMsg = "";
    if (value.trim() !== "") {
      if (name === "bloodPressure") {
        if (!/^\d{2,3}\/\d{2,3}$/.test(value.trim())) {
          errorMsg = "Format must be Systolic/Diastolic (e.g. 120/80)";
        }
      } else {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) {
          errorMsg = "Must be a valid number";
        } else {
          if (name === "heartRate") {
            if (numVal <= 0 || numVal >= 300) {
              errorMsg = "Must be between 1 and 299 bpm";
            }
          } else if (name === "temperature") {
            if (numVal <= 20 || numVal >= 45) {
              errorMsg = "Must be between 20.1°C and 44.9°C";
            }
          } else if (name === "weight") {
            if (numVal <= 0 || numVal >= 500) {
              errorMsg = "Must be between 0.1 and 499.9 kg";
            }
          } else if (name === "bloodGlucose") {
            if (numVal <= 0 || numVal >= 1000) {
              errorMsg = "Must be between 0.1 and 999.9 mg/dL";
            }
          }
        }
      }
    }

    setVitalsErrors((prev) => ({
      ...prev,
      [name]: errorMsg,
    }));

    setRecordData((prev) => {
      const currentVitals =
        typeof prev.vitals === "string"
          ? JSON.parse(prev.vitals || "{}")
          : prev.vitals || {};
      return {
        ...prev,
        vitals: {
          ...currentVitals,
          [name]: value,
        },
      };
    });
  };

  const parsedVitals =
    typeof recordData.vitals === "string"
      ? JSON.parse(recordData.vitals || "{}")
      : recordData.vitals || {};

  const handleCheckboxChange = (e) => {
    const checked = e.target.checked;
    
    setRecordData((prev) => {
      let extraFields = {};
      if (checked) {
        extraFields = {
          consentDate: getCurrentDateTimeLocal(),
          consentTakenBy: getLoggedInClinicianName(),
        };
      } else {
        extraFields = {
          consentDate: "",
          consentTakenBy: "",
          consentNotes: "",
        };
      }
      return {
        ...prev,
        consentObtained: checked,
        ...extraFields,
      };
    });
  };

  const handleReset = () => {
    const emptyRecord = createEmptyRecord();
    const emptyTeethState = initializeTeethState("adult", []);
    setRecordData(emptyRecord);
    setDentition("adult");
    setAdultTeeth(emptyTeethState.adult);
    setChildTeeth(emptyTeethState.child);
    setMixedAdultTeeth(emptyTeethState.mixedAdult);
    setMixedChildTeeth(emptyTeethState.mixedChild);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
        <h2 className="font-bold mb-4 text-lg text-slate-900 border-b border-slate-100 pb-2 flex items-center">
          Case History
        </h2>
        <p className="mb-4 text-xs text-amber-800">
          Confirm allergies and medical history with the patient at this visit.
          Any non-empty allergy or comorbidity recorded here will appear in the
          patient&apos;s important clinical notice and remain visible across visits.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Presenting Complaint <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => openTemplateModal("presentingComplaint")}
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
              >
                <BookOpen size={12} className="mr-1" /> Quick List{" "}
                {!proAccessActive && (
                  <Lock size={10} className="ml-1 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="presentingComplaint"
              value={recordData.presentingComplaint || ""}
              onChange={handleChange}
              rows={3}
              required
              placeholder="C/O..."
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
          <FormField
            label="History of Presenting Complaint"
            name="history"
            value={recordData.history || ""}
            onChange={handleChange}
            type="textarea"
            rows={3}
            placeholder="HPC..."
          />
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Medical History / Comorbidities
              </label>
              <button
                type="button"
                onClick={() => openTemplateModal("comorbidities")}
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
              >
                <BookOpen size={12} className="mr-1" /> Quick List{" "}
                {!proAccessActive && (
                  <Lock size={10} className="ml-1 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="comorbidities"
              value={recordData.comorbidities || ""}
              onChange={handleChange}
              rows={2}
              placeholder="e.g. Hypertension, Diabetes, Asthma, or No known comorbidities"
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Allergies
              </label>
              <button
                type="button"
                onClick={() => openTemplateModal("allergies")}
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
              >
                <BookOpen size={12} className="mr-1" /> Quick List{" "}
                {!proAccessActive && (
                  <Lock size={10} className="ml-1 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="allergies"
              value={recordData.allergies || ""}
              onChange={handleChange}
              rows={2}
              placeholder="e.g. Penicillin (rash), NSAIDs, Latex, or No known allergies"
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Current Medications
              </label>
            </div>
            <textarea
              name="currentMedication"
              value={recordData.currentMedication || ""}
              onChange={handleChange}
              rows={2}
              placeholder="E.g. Lisinopril 10mg daily..."
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
        <h2 className="font-bold mb-4 text-lg text-slate-900 border-b border-slate-100 pb-2 flex items-center">
          <Activity size={20} className="mr-2 text-rose-500" /> Patient Vitals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <FormField
            label="Blood Pressure"
            unit="mmHg"
            name="bloodPressure"
            value={parsedVitals.bloodPressure || ""}
            onChange={handleVitalsChange}
            placeholder="120/80"
            error={vitalsErrors.bloodPressure}
          />
          <FormField
            label="Heart Rate"
            unit="bpm"
            name="heartRate"
            type="number"
            value={parsedVitals.heartRate || ""}
            onChange={handleVitalsChange}
            placeholder="72"
            error={vitalsErrors.heartRate}
          />
          <FormField
            label="Temperature"
            unit="°C"
            name="temperature"
            type="number"
            step="0.1"
            value={parsedVitals.temperature || ""}
            onChange={handleVitalsChange}
            placeholder="36.5"
            error={vitalsErrors.temperature}
          />
          <FormField
            label="Weight"
            unit="kg"
            name="weight"
            type="number"
            step="0.1"
            value={parsedVitals.weight || ""}
            onChange={handleVitalsChange}
            placeholder="70.5"
            error={vitalsErrors.weight}
          />
          <FormField
            label="Blood Glucose"
            unit="mg/dL"
            name="bloodGlucose"
            type="number"
            step="0.1"
            value={parsedVitals.bloodGlucose || ""}
            onChange={handleVitalsChange}
            placeholder="90"
            error={vitalsErrors.bloodGlucose}
          />
        </div>
      </div>

      <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
        <h2 className="font-bold mb-4 text-lg text-slate-900 border-b border-slate-100 pb-2 flex items-center">
          Clinical Examination
        </h2>
        <div className="flex gap-2 border-b border-slate-200 mb-6 pb-2">
          <button
            type="button"
            className={`py-2 px-4 rounded-lg text-sm font-bold transition-colors ${activeExamTab === "extraoral" ? "bg-primary-50 text-primary-700" : "text-slate-500 hover:bg-slate-50"}`}
            onClick={() => setActiveExamTab("extraoral")}
          >
            Extra-Oral
          </button>
          <button
            type="button"
            className={`py-2 px-4 rounded-lg text-sm font-bold transition-colors ${activeExamTab === "intraoral" ? "bg-primary-50 text-primary-700" : "text-slate-500 hover:bg-slate-50"}`}
            onClick={() => setActiveExamTab("intraoral")}
          >
            Intra-Oral & Chart
          </button>
        </div>

        {activeExamTab === "extraoral" && (
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Extra-Oral Examination Notes
              </label>
              <button
                type="button"
                onClick={() => openTemplateModal("extraOral")}
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
              >
                <BookOpen size={12} className="mr-1" /> Quick List{" "}
                {!proAccessActive && (
                  <Lock size={10} className="ml-1 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="examinationExtraOral"
              value={recordData.examinationExtraOral || ""}
              onChange={handleChange}
              rows={4}
              placeholder="Facial symmetry, TMJ, lymph nodes..."
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
        )}

        {activeExamTab === "intraoral" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700 leading-none">
                    Soft Tissue Findings
                  </label>
                  <button
                    type="button"
                    onClick={() => openTemplateModal("softTissue")}
                    className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
                  >
                    <BookOpen size={12} className="mr-1" /> Quick List{" "}
                    {!proAccessActive && (
                      <Lock size={10} className="ml-1 text-amber-500" />
                    )}
                  </button>
                </div>
                <textarea
                  name="softTissue"
                  value={recordData.softTissue || ""}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Mucosa, tongue, palate..."
                  className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
                />
              </div>

              <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-700 leading-none">
                    Periodontal Status
                  </label>
                  <button
                    type="button"
                    onClick={() => openTemplateModal("periodontal")}
                    className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
                  >
                    <BookOpen size={12} className="mr-1" /> Quick List{" "}
                    {!proAccessActive && (
                      <Lock size={10} className="ml-1 text-amber-500" />
                    )}
                  </button>
                </div>
                <textarea
                  name="periodontalStatus"
                  value={recordData.periodontalStatus || ""}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Gingival condition, B.O.P..."
                  className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
                />
              </div>
            </div>
            <div className="mb-8 space-y-1.5 focus-within:text-primary-600 transition-colors">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-slate-700 leading-none">
                  Occlusion
                </label>
                <button
                  type="button"
                  onClick={() => openTemplateModal("occlusion")}
                  className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
                >
                  <BookOpen size={12} className="mr-1" /> Quick List{" "}
                  {!proAccessActive && (
                    <Lock size={10} className="ml-1 text-amber-500" />
                  )}
                </button>
              </div>
              <textarea
                name="occlusion"
                value={recordData.occlusion || ""}
                onChange={handleChange}
                rows={2}
                placeholder="Class I/II/III..."
                className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
              />
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Dental Chart
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click a condition below, then select teeth on the chart.
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={dentition}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDentition(next);
                        if (next === "adult") {
                          syncRecordTeeth(next, adultTeeth);
                        } else if (next === "child") {
                          syncRecordTeeth(next, childTeeth);
                        } else {
                          syncRecordTeeth(
                            next,
                            buildOrderedTeethList([
                              ...mixedAdultTeeth,
                              ...mixedChildTeeth,
                            ]),
                          );
                        }
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm focus:ring-2 focus:ring-primary-500 h-[40px]"
                    >
                      <option value="adult">Adult Dentition (32)</option>
                      <option value="child">Child Dentition (20)</option>
                      <option value="mixed">Mixed Dentition</option>
                    </select>

                    <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-1">
                      {TOOTH_CONDITIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setActiveCondition(c)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${activeCondition === c ? "bg-slate-800 text-white shadow-md transform scale-105" : "text-slate-600 hover:bg-slate-100"}`}
                        >
                          {CONDITION_LABELS[c]}
                        </button>
                      ))}
                    </div>

                    {activeCondition === "present" && dentition !== "mixed" && (
                      <button
                        type="button"
                        onClick={
                          areAllTeethPresent
                            ? handleRemoveAllPresent
                            : handleMarkAllPresent
                        }
                        className={`px-4 py-2 text-xs font-bold rounded-xl text-white shadow-sm transition-all h-[40px] cursor-pointer flex items-center justify-center gap-1.5 ${areAllTeethPresent ? "bg-slate-600 hover:bg-slate-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                      >
                        {areAllTeethPresent
                          ? "Click to Remove All"
                          : "Click to Mark All"}
                      </button>
                    )}
                  </div>
                  {activeCondition === "present" && isAnyToothPresent && (
                    <span className="text-[11px] text-slate-500 font-semibold italic animate-in fade-in slide-in-from-top-1 duration-200">
                      * If a tooth is missing, click on the marked tooth on the
                      chart to remove it from the list.
                    </span>
                  )}
                </div>
              </div>

              <div className="p-6">
                {dentition === "mixed" ? (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="font-semibold text-slate-800">
                          Adult Dentition
                        </span>
                        <span className="text-xs text-slate-500">
                          32 permanent teeth
                        </span>
                      </div>
                      <ToothChart
                        teeth={mixedAdultTeeth}
                        onToothClick={handleToothClick}
                        dentition="adult"
                      />
                    </div>

                    <div className="space-y-4 mt-10">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <span className="font-semibold text-slate-800">
                          Child Dentition
                        </span>
                        <span className="text-xs text-slate-500">
                          20 primary teeth
                        </span>
                      </div>
                      <ToothChart
                        teeth={mixedChildTeeth}
                        onToothClick={handleToothClick}
                        dentition="child"
                      />
                    </div>
                  </>
                ) : (
                  <ToothChart
                    teeth={teeth}
                    onToothClick={handleToothClick}
                    dentition={dentition}
                  />
                )}

                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TOOTH_CONDITIONS.map((c) => {
                    const grouped = getAffectedTeethByQuadrant(c);
                    if (!Object.values(grouped).some((q) => q.length > 0))
                      return null;
                    return (
                      <div
                        key={c}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-sm"
                      >
                        <strong className="block text-slate-900 mb-2 uppercase tracking-wide text-xs border-b border-slate-200 pb-1">
                          {c === "present"
                            ? "Teeth Present"
                            : c === "missing"
                              ? "Missing Teeth"
                              : `${CONDITION_LABELS[c]} Affected`}
                        </strong>
                        <div className="space-y-1">
                          {["UR", "UL", "LR", "LL"].map(
                            (q) =>
                              grouped[q].length > 0 && (
                                <div key={q} className="flex justify-between">
                                  <span className="text-slate-500 font-semibold text-xs">
                                    {q}
                                  </span>
                                  <span className="font-mono text-slate-900 font-bold">
                                    {grouped[q].join(", ")}
                                  </span>
                                </div>
                              ),
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
        <h2 className="font-bold mb-4 text-lg text-slate-900 border-b border-slate-100 pb-2 flex items-center">
          Assessment & Plan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Diagnosis <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => openTemplateModal("diagnosis")}
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
              >
                <BookOpen size={12} className="mr-1" /> Quick List{" "}
                {!proAccessActive && (
                  <Lock size={10} className="ml-1 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="diagnosis"
              value={recordData.diagnosis || ""}
              onChange={handleChange}
              rows={3}
              required
              placeholder="Definitive or provisional diagnosis..."
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Treatment Plan <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => openTemplateModal("treatmentPlan")}
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-2 py-1 rounded-full border border-primary-200"
              >
                <BookOpen size={12} className="mr-1" /> Quick List{" "}
                {!proAccessActive && (
                  <Lock size={10} className="ml-1 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="treatmentPlan"
              value={recordData.treatmentPlan || ""}
              onChange={handleChange}
              rows={3}
              required
              placeholder="Proposed procedures..."
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
          <FormField
            label="Investigations Ordered"
            name="investigation"
            value={recordData.investigation}
            onChange={handleChange}
            type="textarea"
            rows={2}
            placeholder="X-rays, lab tests..."
          />
          <div className="space-y-1.5 focus-within:text-primary-600 transition-colors md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-slate-700 leading-none">
                Medications Prescribed
              </label>
              <button
                type="button"
                onClick={() =>
                  !proAccessActive
                    ? setShowUpgradeModal(true)
                    : setShowFormulary(true)
                }
                className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-3 py-1.5 rounded-full border border-primary-200"
              >
                <BookOpen size={14} className="mr-1.5" /> 1-Click Formulary{" "}
                {!proAccessActive && (
                  <Lock size={12} className="ml-1.5 text-amber-500" />
                )}
              </button>
            </div>
            <textarea
              name="medication"
              value={recordData.medication || ""}
              onChange={handleChange}
              rows={3}
              placeholder="Prescriptions..."
              className="w-full rounded-xl border border-slate-200 p-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm resize-none transition-shadow"
            />
          </div>
        </div>
      </div>

      <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
          <h2 className="font-bold text-lg text-slate-900 flex items-center">
            <ImagePlus size={20} className="mr-2 text-primary-500" /> Media &
            Attachments
          </h2>
          <button
            type="button"
            onClick={openFilePicker}
            className="flex items-center text-primary-600 hover:text-primary-800 text-xs font-bold transition-colors bg-primary-50 px-3 py-1.5 rounded-full border border-primary-200"
          >
            Attach Files{" "}
            {!proAccessActive && (
              <Lock size={12} className="ml-1.5 text-amber-500" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
          />
        </div>
        <p className="mb-4 text-xs text-slate-500">
          You can select and upload multiple files at once. Use the{" "}
          <span className="font-bold">X</span> on any preview to remove a file
          before saving.
        </p>

        {(() => {
          let atts = [];
          if (Array.isArray(recordData.attachments))
            atts = recordData.attachments;
          else if (typeof recordData.attachments === "string") {
            try {
              atts = JSON.parse(recordData.attachments);
            } catch {
              atts = [];
            }
          }

          if (atts.length === 0) {
            return (
              <p className="text-sm text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No attachments. Upload X-Rays, Lab Results, or Photos.
              </p>
            );
          }

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {atts.map((att, idx) => (
                <div
                  key={idx}
                  className="relative group bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col items-center justify-center aspect-square overflow-hidden"
                >
                  {att.type?.includes("pdf") ? (
                    <FileText size={32} className="text-rose-500 mb-2" />
                  ) : (
                    <img
                      src={`${api.defaults.baseURL.replace("/api", "")}${att.url}`}
                      alt={att.name}
                      className="w-full h-full object-cover rounded-lg mb-1"
                    />
                  )}
                  <span className="text-[10px] text-slate-500 truncate w-full text-center block font-medium absolute bottom-0 left-0 bg-white/90 px-1 py-0.5 backdrop-blur-sm rounded-b-xl border-t border-slate-100">
                    {att.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-10 border border-white/80"
                    aria-label={`Remove ${att.name || "attachment"}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-gradient-to-br from-slate-50 to-white">
        <h2 className="font-bold mb-4 text-lg text-slate-900 border-b border-slate-200 pb-2 flex items-center">
          <Shield size={20} className="mr-2 text-slate-400" /> Informed Consent{" "}
          <span className="text-red-500 ml-1">*</span>
        </h2>

        <div className="space-y-6">
          <CheckboxField
            label="I confirm that informed consent was obtained from the patient (or guardian) before commencing treatment."
            name="consentObtained"
            checked={Boolean(recordData.consentObtained)}
            onChange={handleCheckboxChange}
            required={true}
          />

          {recordData.consentObtained && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-200">
              <FormField
                label="Date Obtained"
                name="consentDate"
                type="datetime-local"
                value={formatDateTimeLocal(recordData.consentDate)}
                onChange={() => {}}
                required={true}
                max={getCurrentDateTimeLocal()}
                readOnly
              />
              <FormField
                label="Taken By (Clinician)"
                name="consentTakenBy"
                value={recordData.consentTakenBy || ""}
                onChange={() => {}}
                placeholder="Dr. Name"
                required={true}
                readOnly
              />
              <div className="md:col-span-2">
                <FormField
                  label="Consent Details (Optional)"
                  name="consentNotes"
                  value={recordData.consentNotes || ""}
                  onChange={handleChange}
                  type="textarea"
                  rows={2}
                  placeholder="Verbal consent obtained after discussing risks and alternatives..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="ghost"
          onClick={handleReset}
          className="w-full sm:w-auto"
        >
          Reset Form
        </Button>
        <div className="flex-1"></div>
        <Button
          type="submit"
          isLoading={loading}
          size="lg"
          className="w-full sm:w-auto shadow-md"
        >
          {submitLabel}
        </Button>
      </div>

      {showUpgradeModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowUpgradeModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 text-center flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
              <Lock size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Pro Plan Feature
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              The 1-Click Dental Formulary allows you to instantly insert
              pre-formatted prescription dosages, saving you massive amounts of
              typing. Upgrade to the Pro Plan to unlock this feature.
              {storedUser?.role !== "admin" && " Please contact your clinic administrator to upgrade."}
            </p>
            <div className="flex w-full gap-3">
              <Button
                type="button"
                variant="outline"
                className={storedUser?.role === "admin" ? "flex-1 border-slate-200" : "w-full border-slate-200"}
                onClick={() => setShowUpgradeModal(false)}
              >
                Close
              </Button>
              {storedUser?.role === "admin" && (
                <Button
                  type="button"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg font-bold"
                  onClick={() => navigate("/upgrade")}
                >
                  Upgrade Now
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTemplateType && CLINICAL_TEMPLATES[activeTemplateType] && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setActiveTemplateType(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full flex flex-col border border-slate-200 max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <BookOpen size={20} className="mr-2 text-primary-600" />{" "}
                {CLINICAL_TEMPLATES[activeTemplateType].title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveTemplateType(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[300px]">
              <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-3 overflow-y-auto">
                <div className="space-y-1">
                  {Object.keys(
                    CLINICAL_TEMPLATES[activeTemplateType].categories,
                  ).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setTemplateCategory(category)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${templateCategory === category ? "bg-primary-600 text-white shadow-md transform scale-[1.02]" : "text-slate-600 hover:bg-slate-200"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-2/3 p-4 overflow-y-auto">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {templateCategory}
                </p>
                <div className="space-y-2">
                  {(
                    CLINICAL_TEMPLATES[activeTemplateType].categories[
                      templateCategory
                    ] || []
                  ).map((item, idx) => {
                    const isSelected = getActiveTemplateFieldValue().includes(
                      item.value,
                    );
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleTemplateSelect(item.value)}
                        className={`w-full text-left p-3 rounded-xl border transition-all group flex flex-col focus:outline-none ${isSelected ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 shadow-sm" : "border-slate-200 hover:border-primary-400 hover:bg-primary-50 focus:ring-2 focus:ring-primary-500"}`}
                      >
                        <span
                          className={`font-bold text-sm mb-1 ${isSelected ? "text-primary-800" : "text-slate-800"}`}
                        >
                          {item.label}
                        </span>
                        <span
                          className={`text-sm font-mono px-2 py-1 rounded inline-block w-fit mt-1 border ${isSelected ? "text-primary-700 bg-primary-100 border-primary-200" : "text-slate-500 group-hover:text-primary-700 bg-white border-slate-100"}`}
                        >
                          {item.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFormulary && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowFormulary(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full flex flex-col border border-slate-200 max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <BookOpen size={20} className="mr-2 text-primary-600" /> Dental
                Formulary
              </h3>
              <button
                type="button"
                onClick={() => setShowFormulary(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[300px]">
              <div className="w-full md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-3 overflow-y-auto">
                <div className="space-y-1">
                  {Object.keys(DENTAL_FORMULARY).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setFormularyCategory(category)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${formularyCategory === category ? "bg-primary-600 text-white shadow-md transform scale-[1.02]" : "text-slate-600 hover:bg-slate-200"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full md:w-2/3 p-4 overflow-y-auto">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {formularyCategory} Prescriptions
                </p>
                <div className="space-y-2">
                  {DENTAL_FORMULARY[formularyCategory].map((med, idx) => {
                    const isSelected = recordData.medication?.includes(
                      med.value,
                    );
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleFormularySelect(med.value)}
                        className={`w-full text-left p-3 rounded-xl border transition-all group flex flex-col focus:outline-none ${isSelected ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500 shadow-sm" : "border-slate-200 hover:border-primary-400 hover:bg-primary-50 focus:ring-2 focus:ring-primary-500"}`}
                      >
                        <span
                          className={`font-bold text-sm mb-1 ${isSelected ? "text-primary-800" : "text-slate-800"}`}
                        >
                          {med.label}
                        </span>
                        <span
                          className={`text-sm font-mono px-2 py-1 rounded inline-block w-fit mt-1 border ${isSelected ? "text-primary-700 bg-primary-100 border-primary-200" : "text-slate-500 group-hover:text-primary-700 bg-white border-slate-100"}`}
                        >
                          {med.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {notificationModal.show && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setNotificationModal({ show: false, message: "" })}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 border border-slate-200 text-center flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Notice</h3>
            <p className="text-slate-500 text-sm mb-6">
              {notificationModal.message}
            </p>
            <div className="flex w-full justify-center">
              <Button
                type="button"
                className="w-full bg-primary-600 text-white"
                onClick={() =>
                  setNotificationModal({ show: false, message: "" })
                }
              >
                Acknowledge
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
