import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Calendar, Mail, MapPin, Phone, Hash, Info, UserPlus, ArrowRight } from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import usePersistentState from "../hooks/usePersistentState";
import { isTrialingClinic, getTrialDaysRemaining } from "../utils/clinicAccess";
import { getStoredUserObject } from "../utils/authStorage";

const emptyPatientForm = {
  firstName: "",
  lastName: "",
  otherName: "",
  dateOfBirth: "",
  age: "",
  occupation: "",
  email: "",
  gender: "other",
  phone: "",
  address: "",
  nextOfKinName: "",
  nextOfKinPhone: "",
  nextOfKinRelationship: "",
  nextOfKinAddress: "",
};

export default function RegisterPatient() {
  const [form, setForm, clearFormDraft] = usePersistentState(
    "carechrome:draft:register-patient",
    emptyPatientForm,
  );
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const navigate = useNavigate();
  const showToast = (message, type = "success") => setToast({ message, type });

  const storedUser = getStoredUserObject() || {};
  const clinic = storedUser?.clinic || {};
  const trialing = isTrialingClinic(clinic);
  const remainingTrialDays = getTrialDaysRemaining(clinic);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
    setForm({
      ...form,
      dateOfBirth: dobValue,
      age: computedAge,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const fullName = `${form.firstName?.trim() || ""} ${form.lastName?.trim() || ""} ${form.otherName?.trim() || ""}`.trim();
    if (!form.firstName?.trim() || !form.lastName?.trim()) return showToast("First and Last name are required.", "error");
    if (!form.age || Number(form.age) <= 0) return showToast("Age must be greater than 0.", "error");
    if (!form.phone?.trim()) return showToast("Phone number is required.", "error");
    if (!form.address?.trim()) return showToast("Residential address is required.", "error");
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) return showToast("Invalid email address.", "error");

    try {
      setLoading(true);

      const payload = {
        name: fullName,
        age: form.age.toString(),
        dateOfBirth: form.dateOfBirth || "",
        gender: form.gender || "other",
        occupation: form.occupation?.trim() || "",
        phone: form.phone?.trim() || "",
        address: form.address?.trim() || "",
        email: form.email?.trim() || "",
        nextOfKinName: form.nextOfKinName?.trim() || "",
        nextOfKinPhone: form.nextOfKinPhone?.trim() || "",
        nextOfKinRelationship: form.nextOfKinRelationship?.trim() || "",
        nextOfKinAddress: form.nextOfKinAddress?.trim() || "",
      };

      const res = await api.post("/patients", payload);

      showToast(`Patient "${res.data.name}" added successfully!`, "success");

      clearFormDraft();

      navigate("/waiting-room", {
        state: {
          newPatient: res.data,
          preselectPatientId: res.data?.id || res.data?._id || "",
        },
      });
    } catch (err) {
      console.error("Add patient error:", err.response?.data || err);
      const msg = err.response?.data?.message || "Failed to add patient. Please check your inputs.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl w-full mx-auto h-full overflow-y-auto">
      {toast && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast(null)} />}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {trialing && (
          <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-indigo-900">Your Pro trial is active</h4>
              <p className="text-sm text-indigo-700 mt-0.5">
                You have {remainingTrialDays} day{remainingTrialDays === 1 ? "" : "s"} left before paid Pro billing is required.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/upgrade')} className="whitespace-nowrap bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-100">
               Manage Pro Plan <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        )}

        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <div className="relative px-8 py-10 text-white overflow-hidden bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-800 rounded-t-xl">
            {/* Ambient background glows */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-black/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="absolute top-1/2 right-4 md:right-12 opacity-15 transform -translate-y-1/2 pointer-events-none">
               <UserPlus size={180} />
            </div>
            
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-sm font-medium border border-white/20 backdrop-blur-md shadow-sm">
                 <Info size={16} className="text-cyan-200" />
                 Card numbers are assigned automatically
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">Patient Registration</h2>
              <p className="text-primary-100 max-w-xl text-lg leading-relaxed">
                 Fill out the details below to create a new patient record. Once registered, the patient will be placed directly in the waiting room triage queue.
              </p>
            </div>
          </div>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section 1: Demographics */}
              <div className="bg-slate-50/60 p-6 md:p-7 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200/80">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-100 text-primary-700 font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Personal Demographics</h3>
                    <p className="text-xs text-slate-500">Legal identity and birth information</p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <Input
                    label="First Name *"
                    name="firstName"
                    icon={User}
                    value={form.firstName || ""}
                    onChange={handleChange}
                    placeholder="e.g. Jane"
                    disabled={loading}
                    required
                  />
                  
                  <Input
                    label="Last Name *"
                    name="lastName"
                    icon={User}
                    value={form.lastName || ""}
                    onChange={handleChange}
                    placeholder="e.g. Doe"
                    disabled={loading}
                    required
                  />

                  <Input
                    label="Other Name"
                    name="otherName"
                    icon={User}
                    value={form.otherName || ""}
                    onChange={handleChange}
                    placeholder="Optional"
                    disabled={loading}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Gender</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Hash size={18} className="text-slate-400" />
                      </div>
                      <select
                        name="gender"
                        value={form.gender}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none h-[46px]"
                        disabled={loading}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    label="Date of Birth *"
                    name="dateOfBirth"
                    type="date"
                    icon={Calendar}
                    value={form.dateOfBirth || ""}
                    onChange={handleDateOfBirthChange}
                    disabled={loading}
                    required
                  />

                  <Input
                    label="Age (Auto-calculated)"
                    name="age"
                    type="number"
                    icon={Calendar}
                    value={form.age}
                    placeholder="Auto-calculated from DOB"
                    disabled={true}
                    required
                  />
                </div>
              </div>

              {/* Section 2: Contact & Location */}
              <div className="bg-slate-50/60 p-6 md:p-7 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200/80">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Contact & Residence</h3>
                    <p className="text-xs text-slate-500">Phone number, email, and residential address</p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    label="Phone Number *"
                    name="phone"
                    icon={Phone}
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    disabled={loading}
                    required
                  />

                  <Input
                    label="Email Address"
                    name="email"
                    type="email"
                    icon={Mail}
                    value={form.email}
                    onChange={handleChange}
                    placeholder="patient@example.com (Optional)"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Input
                    label="Residential Address *"
                    name="address"
                    icon={MapPin}
                    value={form.address}
                    onChange={handleChange}
                    placeholder="Full street address"
                    disabled={loading}
                    required
                  />
                </div>

                <Input
                  label="Occupation"
                  name="occupation"
                  icon={User}
                  value={form.occupation || ""}
                  onChange={handleChange}
                  placeholder="Optional"
                  disabled={loading}
                />
              </div>

              {/* Section 3: Next of Kin */}
              <div className="bg-slate-50/60 p-6 md:p-7 rounded-2xl border border-slate-100 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-bold text-sm">
                      3
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Next of Kin / Emergency Contact</h3>
                      <p className="text-xs text-slate-500">Primary contact person in emergency situations</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-600">
                    Optional
                  </span>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    label="Next of Kin Name"
                    name="nextOfKinName"
                    icon={User}
                    value={form.nextOfKinName || ""}
                    onChange={handleChange}
                    placeholder="e.g. John Doe"
                    disabled={loading}
                  />
                  <Input
                    label="Relationship"
                    name="nextOfKinRelationship"
                    value={form.nextOfKinRelationship || ""}
                    onChange={handleChange}
                    placeholder="e.g. Spouse, Parent, Sibling"
                    disabled={loading}
                  />
                  <Input
                    label="Contact Number"
                    name="nextOfKinPhone"
                    icon={Phone}
                    value={form.nextOfKinPhone || ""}
                    onChange={handleChange}
                    placeholder="e.g. +1 (555) 000-0000"
                    disabled={loading}
                  />
                  <Input
                    label="Address"
                    name="nextOfKinAddress"
                    icon={MapPin}
                    value={form.nextOfKinAddress || ""}
                    onChange={handleChange}
                    placeholder="Next of Kin residential address"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 order-2 sm:order-1">
                  * Fields marked with an asterisk are required.
                </p>
                <div className="flex items-center gap-3 order-1 sm:order-2">
                  <Button type="button" variant="ghost" size="lg" onClick={() => navigate(-1)} disabled={loading} className="w-full sm:w-auto whitespace-nowrap">
                    Cancel
                  </Button>
                  <Button type="submit" size="lg" isLoading={loading} className="w-full sm:w-auto whitespace-nowrap shadow-md">
                    Complete Registration <ArrowRight size={16} className="ml-2" />
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
