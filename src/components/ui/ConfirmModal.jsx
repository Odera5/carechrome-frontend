import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, X } from 'lucide-react';
import Button from './Button';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action", 
  message = "Are you sure you want to proceed?", 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  danger = false,
  confirmLoading = false,
  confirmDisabled = false,
  closeOnConfirm = true,
  onCancelClick,
  children,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (!confirmLoading) {
                onClose();
              }
            }}
          />
          
          {/* Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden text-left border border-slate-100"
          >
            {/* Header Strip */}
            <div className={`h-1.5 w-full ${danger ? 'bg-red-500' : 'bg-primary-500'}`} />
            
            <div className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-3 rounded-full ${danger ? 'bg-red-100 text-red-600' : 'bg-primary-100 text-primary-600'} mr-4`}>
                  {danger ? <AlertTriangle size={24} /> : <Info size={24} />}
                </div>
                <button 
                  onClick={onClose}
                  disabled={confirmLoading}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 focus:outline-none"
                >
                  <X size={20} />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mt-2">{title}</h3>
              <p className="text-slate-500 mt-2 text-sm leading-relaxed text-left">
                {message}
              </p>
              {children}
            </div>
            
            <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-100">
              <Button
                variant="outline"
                className="w-full sm:w-auto bg-white"
                onClick={() => {
                  if (onCancelClick) {
                    onCancelClick();
                  } else {
                    onClose();
                  }
                }}
                disabled={confirmLoading}
              >
                {cancelText}
              </Button>
              <Button 
                className={`w-full sm:w-auto shadow-sm ${danger ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : ''}`}
                isLoading={confirmLoading}
                disabled={confirmLoading || confirmDisabled}
                onClick={() => {
                  onConfirm();
                  if (closeOnConfirm) {
                    onClose();
                  }
                }}
              >
                {confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
