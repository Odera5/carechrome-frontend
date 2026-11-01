import React from "react";
import { motion } from "framer-motion";
import InvoiceList from "../components/Billing/InvoiceList";

export default function Billing() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-6 md:p-8 h-full overflow-y-auto">
      <InvoiceList />
    </motion.div>
  );
}
