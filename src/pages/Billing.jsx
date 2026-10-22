import React, { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, ClipboardCheck } from "lucide-react";
import InvoiceList from "../components/Billing/InvoiceList";
import CashReconciliation from "../components/Billing/CashReconciliation";
import { getStoredUserObject } from "../utils/authStorage";
import Button from "../components/ui/Button";

export default function Billing() {
  const [activeTab, setActiveTab] = useState("invoices");
  const currentUser = getStoredUserObject() || {};

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeTab === "invoices" ? "primary" : "outline"}
          onClick={() => setActiveTab("invoices")}
          className="!w-auto"
        >
          <CreditCard size={16} className="mr-2" /> Invoices
        </Button>
        <Button
          type="button"
          variant={activeTab === "cash" ? "primary" : "outline"}
          onClick={() => setActiveTab("cash")}
          className="!w-auto"
        >
          <ClipboardCheck size={16} className="mr-2" /> Cash Reconciliation
        </Button>
      </div>
      {activeTab === "invoices" ? (
        <InvoiceList />
      ) : (
        <CashReconciliation key={currentUser.branchId || "current-branch"} />
      )}
    </motion.div>
  );
}
