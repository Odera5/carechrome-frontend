import React from "react";
import ConfirmModal from "./ConfirmModal";

export default function ReasonConfirmModal({
  reason,
  onReasonChange,
  ...modalProps
}) {
  return (
    <ConfirmModal
      {...modalProps}
      closeOnConfirm={false}
      confirmDisabled={!reason.trim()}
    >
      <div className="mt-4">
        <label
          htmlFor="permanent-deletion-reason"
          className="block text-sm font-semibold text-slate-700"
        >
          Reason for permanent deletion (required)
        </label>
        <p className="mt-1 font-normal text-slate-500">
          This reason is saved in the audit log. Do not include patient-identifying or clinical details.
        </p>
        <textarea
          id="permanent-deletion-reason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          maxLength={500}
          rows={3}
          required
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
          placeholder="e.g. Duplicate entry created in error"
        />
      </div>
    </ConfirmModal>
  );
}
