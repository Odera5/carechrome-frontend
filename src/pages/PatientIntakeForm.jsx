import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Building, HeartPulse, ChevronRight, ChevronLeft, Calendar, Clock } from "lucide-react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import api from "../services/api";
import { resolveAssetUrl } from "../utils/assetUrl";
import carechromeLogo from "../assets/CareChrome-white.webp";

export default function PatientIntakeForm() {
  const { clinicId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const accessToken = searchParams.get("access") || "";
  const requestedBranchId = searchParams.get("branchId") || "";
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    otherName: "",
    dateOfBirth: "",
    age: "",
    occupation: "",
    gender: "other",
    phone: "",
    email: "",
    address: "",
    nextOfKinName: "",
    nextOfKinPhone: "",
    nextOfKinRelationship: "",
    nextOfKinAddress: "",
    preferredDate: "",
    preferredTime: ""
  });

  const [formErrors, setFormErrors] = useState({
    phone: "",
    email: ""
  });

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const branchQuery = requestedBranchId ? `&branchId=${encodeURIComponent(requestedBranchId)}` : "";
        const res = await api.get(`/intake/${clinicId}?access=${encodeURIComponent(accessToken)}${branchQuery}`);
        setClinic(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Clinic intake form unavailable.");
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [accessToken, clinicId, requestedBranchId]);

  useEffect(() => {
    const favicon =
      document.querySelector("link[rel='icon']") ||
      document.querySelector("link[rel='shortcut icon']");
    const previousHref = favicon?.getAttribute("href") || "";
    const previousTitle = document.title;

    if (clinic?.name) {
      document.title = `${clinic.name} Patient Intake`;
    }

    if (favicon) {
      favicon.setAttribute(
        "href",
        clinic?.logoUrl ? resolveAssetUrl(clinic.logoUrl) : carechromeLogo,
      );
    }

    return () => {
      document.title = previousTitle;
      if (favicon) {
        favicon.setAttribute("href", previousHref || carechromeLogo);
      }
    };
  }, [clinic?.logoUrl, clinic?.name]);

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!form.preferredDate) {
        setAvailableSlots([]);
        setForm((current) => ({ ...current, preferredTime: "" }));
        return;
      }

      try {
        setSlotLoading(true);
        const res = await api.get(
          `/intake/${clinicId}/available-slots?date=${form.preferredDate}&duration=30&access=${encodeURIComponent(accessToken)}${requestedBranchId ? `&branchId=${encodeURIComponent(requestedBranchId)}` : ""}`,
        );
        let nextSlots = res.data?.availableSlots || [];

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const todayStr = `${year}-${month}-${day}`;

        if (form.preferredDate === todayStr) {
          const currentHours = today.getHours();
          const currentMinutes = today.getMinutes();
          const currentTimeInMinutes = currentHours * 60 + currentMinutes;

          nextSlots = nextSlots.filter((slot) => {
            const [slotHours, slotMinutes] = slot.split(":").map(Number);
            const slotTimeInMinutes = slotHours * 60 + slotMinutes;
            return slotTimeInMinutes > currentTimeInMinutes;
          });
        }

        setAvailableSlots(nextSlots);
        setForm((current) => ({
          ...current,
          preferredTime: nextSlots.includes(current.preferredTime)
            ? current.preferredTime
            : "",
        }));
      } catch (err) {
        setAvailableSlots([]);
        setForm((current) => ({ ...current, preferredTime: "" }));
        setError(
          err.response?.data?.message ||
            "Unable to load available appointment times right now.",
        );
      } finally {
        setSlotLoading(false);
      }
    };

    fetchAvailableSlots();
  }, [accessToken, clinicId, form.preferredDate, requestedBranchId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));

    if (name === "phone") {
      const hasLetters = /[a-zA-Z]/.test(value);
      const isValidFormat = value.trim() === "" || /^[0-9+\-() ]*$/.test(value);
      
      if (hasLetters) {
        setFormErrors(errs => ({ ...errs, phone: "Invalid phone number. Letters are not allowed." }));
      } else if (!isValidFormat) {
        setFormErrors(errs => ({ ...errs, phone: "Invalid phone number format." }));
      } else {
        setFormErrors(errs => ({ ...errs, phone: "" }));
      }
    }

    if (name === "email") {
      const isEmailValid = value.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isEmailValid) {
        setFormErrors(errs => ({ ...errs, email: "Invalid email address format." }));
      } else {
        setFormErrors(errs => ({ ...errs, email: "" }));
      }
    }
  };

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
    setForm(f => ({
      ...f,
      dateOfBirth: dobValue,
      age: computedAge,
    }));
  };

  const formatSelectedDateLabel = (value) => {
    if (!value) return "selected date";

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return "selected date";
    }

    return parsedDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getMinDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const nextStep = () => {
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      const ageNum = parseInt(form.age, 10);
      const isAgeValid = !isNaN(ageNum) && ageNum >= 0 && ageNum <= 120;
      return form.firstName.trim() !== "" && form.lastName.trim() !== "" && form.dateOfBirth.trim() !== "" && isAgeValid;
    }
    if (currentStep === 2) {
      const isPhoneValid = form.phone.trim() !== "" && !formErrors.phone && /^[0-9+\-() ]*$/.test(form.phone) && !/[a-zA-Z]/.test(form.phone);
      const isEmailValid = !formErrors.email && (form.email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email));
      const isAddressValid = form.address.trim() !== "";
      return isPhoneValid && isEmailValid && isAddressValid;
    }
    if (currentStep === 3) {
      return true; // Next of kin fields are optional
    }
    if (currentStep === 4) {
      return true; // Date/Time are optional, but good to have
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fullName = `${form.firstName?.trim() || ""} ${form.lastName?.trim() || ""} ${form.otherName?.trim() || ""}`.trim();
      await api.post(`/intake/${clinicId}`, {
        ...form,
        name: fullName,
        access: accessToken,
        branchId: requestedBranchId,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Internal error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
     return (
       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800"></div>
       </div>
     );
  }

  if (error && !clinic) {
     return (
       <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
             <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
             <h2 className="text-xl font-bold text-slate-900 mb-2">Form Unavailable</h2>
             <p className="text-slate-500">{error}</p>
          </div>
       </div>
     );
  }

  if (success) {
     return (
       <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center relative" style={{ backgroundColor: clinic.brandColor ? `${clinic.brandColor}10` : '#f8fafc' }}>
          <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full relative z-10 border border-white">
             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={40} />
             </motion.div>
             <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Request Sent!</h2>
             <p className="text-slate-600 mb-6">Your registration and appointment request have been securely sent to <strong>{clinic?.name}</strong>{clinic?.branch && clinic?.plan === "ENTERPRISE" ? ` (${clinic.branch.city || clinic.branch.name}${clinic.branch.area ? ` - ${clinic.branch.area}` : ""})` : ""}.</p>
             <p className="text-sm font-medium text-slate-400">The clinic staff will review and confirm your appointment shortly. You may now close this window.</p>
          </div>
       </div>
     );
  }

  const brandStyle = clinic?.brandColor ? { color: clinic.brandColor } : {};
  const buttonStyle = clinic?.brandColor ? { backgroundColor: clinic.brandColor } : {};

  // Framer motion variants
  const variants = {
    initial: (direction) => {
      return { x: direction > 0 ? 50 : -50, opacity: 0 };
    },
    animate: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: (direction) => {
      return { x: direction < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.2 } };
    }
  };

  return (
    <div className="min-h-screen flex flex-col py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-primary-100 selection:text-primary-900" style={{ backgroundColor: clinic?.brandColor ? `${clinic.brandColor}08` : '#f8fafc' }}>
      
      {/* HEADER LOGO */}
      <div className="flex flex-col items-center justify-center mb-8 w-full max-w-2xl mx-auto">
         {clinic?.logoUrl ? (
            <motion.img initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} src={resolveAssetUrl(clinic.logoUrl)} alt={clinic.name} className="h-20 w-20 object-contain mb-4 rounded-xl shadow-md bg-white p-2 border border-white" />
         ) : (
             <motion.img initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} src={carechromeLogo} alt={clinic?.name || "Clinic"} className="h-20 w-20 object-contain mb-4 rounded-xl shadow-md bg-white p-2 border border-white" />
         )}
         <motion.h1 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-2xl sm:text-3xl font-black text-slate-900 text-center tracking-tight leading-tight">{clinic?.name}</motion.h1>
         <motion.p initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mt-2 text-sm text-slate-500 uppercase tracking-widest font-semibold flex items-center"><Building size={14} className="mr-1.5" /> Patient Intake</motion.p>
         {clinic?.branch && clinic?.plan === "ENTERPRISE" && (
            <motion.p initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="mt-2 text-sm font-semibold text-primary-700 text-center">
               {clinic.branch.city || clinic.branch.name}{clinic.branch.area ? ` - ${clinic.branch.area}` : ""}
            </motion.p>
         )}
      </div>

      {/* FORM CONTAINER */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="w-full max-w-2xl mx-auto bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden border border-white">
         
         {/* PROGRESS BAR */}
         <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-5 flex items-center justify-between">
            <div className="flex gap-2">
               {[1, 2, 3, 4].map((step) => (
                  <div key={step} className={`h-2.5 rounded-full transition-all duration-500 ${step === currentStep ? 'w-10' : step < currentStep ? 'w-6 opacity-60' : 'w-4 opacity-30 bg-slate-300'}`} style={step <= currentStep ? buttonStyle : {}} />
               ))}
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step {currentStep} of {totalSteps}</span>
         </div>

         <div className="p-8 sm:p-10 min-h-[400px] flex flex-col">
            {error && (
               <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-medium flex items-start gap-3">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" /> {error}
               </div>
            )}

            <div className="flex-1 relative">
               <AnimatePresence mode="wait" custom={1}>
                  
                  {/* STEP 1: PERSONAL DETAILS */}
                  {currentStep === 1 && (
                     <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div>
                           <h2 className="text-2xl font-bold text-slate-900">Personal Details</h2>
                           <p className="text-slate-500 text-sm mt-1">Let's start with your basic information.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <Input label="First Name *" name="firstName" value={form.firstName} onChange={handleChange} required placeholder="e.g. Jane" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <Input label="Last Name *" name="lastName" value={form.lastName} onChange={handleChange} required placeholder="e.g. Doe" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <div className="md:col-span-2">
                             <Input label="Other Name" name="otherName" value={form.otherName} onChange={handleChange} placeholder="Optional" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           </div>
                           <Input label="Occupation" name="occupation" value={form.occupation} onChange={handleChange} placeholder="Optional" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <Input label="Date of Birth *" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleDateOfBirthChange} required className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <Input label="Age (Auto-calculated)" name="age" type="number" value={form.age} placeholder="Auto-calculated" disabled={true} required className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <div className="space-y-1.5">
                              <label className="text-sm font-semibold text-slate-700 block">Gender *</label>
                              <select name="gender" value={form.gender} onChange={handleChange} required className="w-full h-14 rounded-xl border border-slate-200 px-4 bg-slate-50 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow">
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {/* STEP 2: CONTACT INFO */}
                  {currentStep === 2 && (
                     <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div>
                           <h2 className="text-2xl font-bold text-slate-900">Contact Information</h2>
                           <p className="text-slate-500 text-sm mt-1">How can we reach you?</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <Input label="Mobile Phone *" name="phone" value={form.phone} onChange={handleChange} required error={formErrors.phone} placeholder="e.g. +234..." className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <Input label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} error={formErrors.email} placeholder="Optional" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <div className="md:col-span-2 space-y-1.5">
                              <label className="text-sm font-semibold text-slate-700 block">Home Address *</label>
                              <textarea name="address" value={form.address} onChange={handleChange} required rows="3" placeholder="Residential address" className="w-full rounded-xl border border-slate-200 p-4 bg-slate-50 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow resize-none"></textarea>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {/* STEP 3: NEXT OF KIN */}
                  {currentStep === 3 && (
                     <motion.div key="step3" variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div>
                           <h2 className="text-2xl font-bold text-slate-900">Next of Kin Details</h2>
                           <p className="text-slate-500 text-sm mt-1">Please provide emergency contact details (Optional).</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <Input label="Next of Kin Name" name="nextOfKinName" value={form.nextOfKinName} onChange={handleChange} placeholder="e.g. John Doe" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <Input label="Relationship" name="nextOfKinRelationship" value={form.nextOfKinRelationship} onChange={handleChange} placeholder="e.g. Spouse, Parent, Sibling" className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <Input label="Contact Number" name="nextOfKinPhone" value={form.nextOfKinPhone} onChange={handleChange} placeholder="e.g. +234..." className="bg-slate-50 h-14 rounded-xl border-slate-200 text-lg" />
                           <div className="md:col-span-2 space-y-1.5">
                              <label className="text-sm font-semibold text-slate-700 block">Address</label>
                              <textarea name="nextOfKinAddress" value={form.nextOfKinAddress} onChange={handleChange} rows="2" placeholder="Next of kin residential address" className="w-full rounded-xl border border-slate-200 p-4 bg-slate-50 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow resize-none"></textarea>
                           </div>
                        </div>
                     </motion.div>
                  )}

                  {/* STEP 4: APPOINTMENT PREFERENCE */}
                  {currentStep === 4 && (
                     <motion.div key="step4" variants={variants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                        <div>
                           <h2 className="text-2xl font-bold text-slate-900">Appointment Request</h2>
                           <p className="text-slate-500 text-sm mt-1">When would you like to visit us? (Optional)</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                 <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Calendar size={16} /> Preferred Date</label>
                                 <input type="date" name="preferredDate" value={form.preferredDate} onChange={handleChange} min={getMinDate()} className="w-full h-14 rounded-xl border border-slate-200 px-4 bg-white text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow" />
                              </div>
                              <div className="space-y-1.5">
                                 <label className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Clock size={16} /> Preferred Time</label>
                                 <select
                                    name="preferredTime"
                                    value={form.preferredTime}
                                    onChange={handleChange}
                                    disabled={!form.preferredDate || slotLoading || availableSlots.length === 0}
                                    className="w-full h-14 rounded-xl border border-slate-200 px-4 bg-white text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow disabled:bg-slate-100 disabled:text-slate-400"
                                 >
                                    <option value="">
                                      {!form.preferredDate
                                        ? "Select a date first"
                                        : slotLoading
                                          ? "Loading available times..."
                                          : availableSlots.length === 0
                                            ? "No available times for this day"
                                            : `Time available for ${formatSelectedDateLabel(form.preferredDate)}`}
                                    </option>
                                    {availableSlots.map((slot) => (
                                      <option key={slot} value={slot}>
                                        {slot}
                                      </option>
                                    ))}
                                 </select>
                              </div>
                           </div>
                           <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                               * Note: Your selected time is based on current availability. The clinic will review and confirm the appointment.
                           </p>
                        </div>
                     </motion.div>
                  )}

               </AnimatePresence>
            </div>

            {/* NAVIGATION FOOTER */}
            <div className="pt-8 mt-4 flex items-center justify-between border-t border-slate-100">
               {currentStep > 1 ? (
                  <Button type="button" variant="ghost" onClick={prevStep} className="text-slate-500 hover:text-slate-900">
                     <ChevronLeft size={18} className="mr-1" /> Back
                  </Button>
               ) : (
                  <div></div>
               )}

               {currentStep < totalSteps ? (
                  <Button type="button" onClick={nextStep} disabled={!isStepValid()} className="h-12 px-8 rounded-xl shadow-md text-white font-bold" style={isStepValid() ? buttonStyle : {}}>
                     Continue <ChevronRight size={18} className="ml-1" />
                  </Button>
               ) : (
                  <Button type="button" onClick={handleSubmit} isLoading={submitting} className="h-12 px-8 rounded-xl shadow-lg text-white font-bold" style={buttonStyle}>
                     Submit Registration <CheckCircle size={18} className="ml-2" />
                  </Button>
               )}
            </div>
         </div>
      </motion.div>
      
      {/* SECURE BADGE */}
      <div className="mt-8 text-center flex flex-col items-center">
         <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-widest bg-slate-100/50 px-4 py-2 rounded-full border border-slate-200">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
            Secure 256-bit Encryption
         </div>
      </div>
    </div>
  );
}
