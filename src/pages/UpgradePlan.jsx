import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Crown,
  FileUp,
  BookOpen,
  Building2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import api from "../services/api";
import Toast from "../components/Toast";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import {
  hasActivePaidSubscription,
  hasEnterpriseAccess,
  hasActiveProAccess,
  hasFutureSubscriptionWindow,
  isTrialingClinic,
  getTrialDaysRemaining,
  resolveSubscriptionEndDate,
} from "../utils/clinicAccess";
import { getStoredUserObject } from "../utils/authStorage";

const UPGRADE_PLAN_AUDIT_PAYLOAD = { auditSource: "upgrade_plan" };

export default function UpgradePlan() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [enterpriseCheckoutLoading, setEnterpriseCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [billingInfo, setBillingInfo] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const storedUser = getStoredUserObject() || {};
  const clinic = billingInfo || storedUser?.clinic || {};
  const currentPlan = clinic?.plan || "PRO";
  const currentPlanLabel = currentPlan === "ENTERPRISE" ? "Enterprise" : "Professional";
  const isPro = currentPlan === "PRO";
  const isEnterprise = currentPlan === "ENTERPRISE";

  const clinicCountry = String(clinic?.country || storedUser?.clinic?.country || "").trim().toLowerCase();
  const isNigerianClinic = clinicCountry === "nigeria" || clinicCountry === "ng";
  const paystackBillingAvailable =
    isNigerianClinic || Boolean(clinic?.paystackSubscriptionCode);

  const resolvedSubscriptionEnd = resolveSubscriptionEndDate(clinic);
  const subscriptionEnds = resolvedSubscriptionEnd || clinic?.subscriptionEnds || null;
  const paystackNextPaymentDate = clinic?.paystackNextPaymentDate || null;

  const paidSubscriptionActive = hasActivePaidSubscription(clinic);
  const subscriptionStatus = String(clinic?.paystackSubscriptionStatus || "").toLowerCase();

  const autoRenewCanceled = subscriptionStatus === "non-renewing";
  const subscriptionCannotResume = ["cancelled", "canceled", "completed"].includes(subscriptionStatus);

  const proAccessActive = hasActiveProAccess(clinic);
  const enterpriseAccess = hasEnterpriseAccess(clinic);
  const currentPaidPeriodActive = hasFutureSubscriptionWindow(clinic) && subscriptionCannotResume;
  const trialing = isTrialingClinic(clinic);
  const remainingTrialDays = getTrialDaysRemaining(clinic);

  const remainingPaidDays = React.useMemo(() => {
    if (!subscriptionEnds) return 0;
    const end = new Date(subscriptionEnds);
    const now = new Date();
    if (isNaN(end.getTime()) || end <= now) return 0;
    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }, [subscriptionEnds]);

  const projectedRenewalDate = React.useMemo(() => {
    if (!subscriptionEnds) return null;
    const end = new Date(subscriptionEnds);
    const now = new Date();
    const anchor = !isNaN(end.getTime()) && end > now ? new Date(end) : new Date(now);
    const nextDate = new Date(anchor);
    if (isAnnual) {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    return nextDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [subscriptionEnds, isAnnual]);

  const formattedRenewalDate = subscriptionEnds
    ? new Date(subscriptionEnds).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const formattedNextPaymentDate = paystackNextPaymentDate
    ? new Date(paystackNextPaymentDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : formattedRenewalDate;

  // Prices
  const proPrice = isAnnual ? "NGN 1,000,000" : "NGN 100,000";
  const enterprisePrice = isAnnual ? "NGN 1,500,000" : "NGN 150,000";

  const syncStoredUserClinic = (clinicPatch) => {
    [localStorage, sessionStorage].forEach((storage) => {
      const rawUser = storage.getItem("user");
      if (!rawUser) {
        return;
      }

      try {
        const parsedUser = JSON.parse(rawUser);
        storage.setItem(
          "user",
          JSON.stringify({
            ...parsedUser,
            clinic: {
              ...(parsedUser.clinic || {}),
              ...clinicPatch,
            },
          }),
        );
      } catch {
        // ignore invalid stored state
      }
    });
  };

  useEffect(() => {
    const loadBilling = async () => {
      try {
        const billingResponse = await api.get("/billing");
        const loadedClinic = billingResponse.data?.clinic || null;
        if (loadedClinic) {
          setBillingInfo(loadedClinic);
        }
      } catch (error) {
        console.error("Failed to load billing page data", error);
      }
    };

    loadBilling();
  }, []);

  const handleUpgradeClick = async (plan = "PRO", interval = isAnnual ? "annually" : "monthly") => {
    const setLoading =
      plan === "ENTERPRISE" ? setEnterpriseCheckoutLoading : setCheckoutLoading;

    try {
      setLoading(true);

      if (!paystackBillingAvailable) {
        throw new Error("Paystack billing is currently available only to Nigerian clinics.");
      }

      const response = await api.post("/billing/paystack/initialize", {
        interval,
        plan,
      });
      const authorizationUrl = response.data?.authorizationUrl;

      if (!authorizationUrl) {
        throw new Error("Paystack did not return a checkout URL.");
      }

      window.location.href = authorizationUrl;
    } catch (error) {
      setToast({
        message:
          error.response?.data?.message ||
          error.message ||
          "We could not start Paystack checkout.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeCancelAutoRenew = async () => {
    try {
      setCancelLoading(true);
      const response = await api.post(
        "/billing/paystack/cancel",
        UPGRADE_PLAN_AUDIT_PAYLOAD,
      );
      const updatedClinic = response.data?.clinic || null;
      if (updatedClinic) {
        setBillingInfo(updatedClinic);
        syncStoredUserClinic(updatedClinic);
      }
      setToast({
        message:
          response.data?.message || "Subscription canceled successfully.",
        type: "success",
      });
    } catch (error) {
      setToast({
        message:
          error.response?.data?.message ||
          error.message ||
          "We could not cancel the subscription.",
        type: "error",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const cancelActivePlanBeforeSwitch = async () => {
    const response = await api.post(
      "/billing/paystack/cancel",
      UPGRADE_PLAN_AUDIT_PAYLOAD,
    );
    const updatedClinic = response.data?.clinic || null;
    if (updatedClinic) {
      setBillingInfo(updatedClinic);
      syncStoredUserClinic(updatedClinic);
    }
  };

  const handleCancelAutoRenew = () => {
    setConfirmConfig({
      title: "Cancel Subscription",
      message:
        `Are you sure you want to cancel your ${currentPlanLabel} plan subscription? The clinic will keep ${currentPlanLabel} access until the current paid period ends.`,
      confirmText: "Yes, Cancel",
      danger: true,
      onConfirm: executeCancelAutoRenew,
    });
  };

  const handleEnterpriseUpgradeClick = () => {
    if (paidSubscriptionActive && !isEnterprise) {
      setConfirmConfig({
        title: "Upgrade to Enterprise",
        message:
          `You are upgrading your subscription from Professional to Enterprise. To avoid duplicate charges, your active Professional subscription will be automatically cancelled first. You will then be redirected to complete checkout for the Enterprise plan. Your clinic access will remain active throughout this process.`,
        confirmText: "Confirm & Proceed",
        cancelText: "Cancel",
        onConfirm: async () => {
          try {
            setEnterpriseCheckoutLoading(true);
            await cancelActivePlanBeforeSwitch();
            await handleUpgradeClick("ENTERPRISE", isAnnual ? "annually" : "monthly");
          } catch (error) {
            setToast({
              message: "Could not cancel existing plan automatically. Please cancel it manually.",
              type: "error",
            });
            setEnterpriseCheckoutLoading(false);
          }
        },
        onCancelClick: () => {
          setConfirmConfig(null);
        },
      });
    } else {
      handleUpgradeClick("ENTERPRISE", isAnnual ? "annually" : "monthly");
    }
  };

  const handleProUpgradeClick = () => {
    if (paidSubscriptionActive && isEnterprise) {
      setConfirmConfig({
        title: "Switch to Professional",
        message:
          `You are switching your subscription from Enterprise to Professional. To avoid duplicate charges, your active Enterprise subscription will be automatically cancelled first. You will then be redirected to complete checkout for the Professional plan. Your clinic access will remain active throughout this process.`,
        confirmText: "Confirm & Proceed",
        cancelText: "Cancel",
        onConfirm: async () => {
          try {
            setCheckoutLoading(true);
            await cancelActivePlanBeforeSwitch();
            await handleUpgradeClick("PRO", isAnnual ? "annually" : "monthly");
          } catch (error) {
            setToast({
              message: "Could not cancel existing plan automatically. Please cancel it manually.",
              type: "error",
            });
            setCheckoutLoading(false);
          }
        },
        onCancelClick: () => {
          setConfirmConfig(null);
        },
      });
    } else {
      handleUpgradeClick("PRO", isAnnual ? "annually" : "monthly");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl mx-auto p-6 md:p-8 min-h-full"
    >
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={4000}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        {...confirmConfig}
      />

      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
          {paidSubscriptionActive
            ? "Manage Your Subscription"
            : !proAccessActive
              ? (clinic.paystackSubscriptionStatus ? "Subscription Expired" : "Trial Ended")
              : "Unlock Full Access"}
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          {currentPaidPeriodActive
            ? `Your ${currentPlanLabel} plan has been cancelled. You still have access until the current paid period ends, but renewal requires a new checkout.`
            : paidSubscriptionActive
              ? autoRenewCanceled
                ? `Your ${currentPlanLabel} plan is canceled for auto-renewal. You still have full access until the current paid period ends.`
                : `You are currently subscribed to the ${currentPlanLabel} plan. You have full access to unlimited patients, automated reminders, and advanced analytics.`
            : !proAccessActive
              ? (clinic.paystackSubscriptionStatus
                ? "Your paid subscription has expired. Renew your plan to unlock and restore full clinic operations."
                : "Your 14-day free trial has ended. Select a paid plan to restore full clinic operations.")
              : "Start with a 14-day free trial, then continue with a paid subscription for unlimited patients, automated reminders, and advanced analytics."}
        </p>

        {trialing && (
          <p className="mt-4 text-sm inline-flex items-center gap-2 font-medium text-primary-700 bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100 shadow-sm">
            <Crown size={16} /> Your 14-day trial has {remainingTrialDays} day
            {remainingTrialDays === 1 ? "" : "s"} remaining.
          </p>
        )}

        {(paidSubscriptionActive || currentPaidPeriodActive) && (
          <p
            className={`mt-4 text-sm inline-flex items-center gap-2 font-medium px-4 py-1.5 rounded-full border shadow-sm ${
              autoRenewCanceled || currentPaidPeriodActive
                ? "text-amber-700 bg-amber-50 border-amber-100"
                : "text-emerald-700 bg-emerald-50 border-emerald-100"
            }`}
          >
            <Crown size={16} />{" "}
            {currentPaidPeriodActive
              ? `Subscription cancelled - Access until: ${formattedRenewalDate || formattedNextPaymentDate || "current period end"}${remainingPaidDays > 0 ? ` (${remainingPaidDays} days remaining)` : ""}`
              : autoRenewCanceled
                ? `Auto-renew canceled - Access until: ${formattedRenewalDate || formattedNextPaymentDate || "current period end"}${remainingPaidDays > 0 ? ` (${remainingPaidDays} days remaining)` : ""}`
                : `Subscription Active - Next payment: ${formattedNextPaymentDate || formattedRenewalDate}`}
          </p>
        )}

        {!proAccessActive && !paidSubscriptionActive && (
          <p className="mt-4 text-sm inline-flex items-center gap-2 font-medium text-rose-700 bg-rose-50 px-4 py-1.5 rounded-full border border-rose-100 shadow-sm">
            <Crown size={16} />{" "}
            {clinic.paystackSubscriptionStatus
              ? "Your subscription has expired. Please renew to continue using the platform."
              : "Your trial has ended. Subscribe to continue using the platform."}
          </p>
        )}
      </div>

      {/* Billing Interval Toggle (Monthly / Annual) */}
      <div className="flex items-center justify-center mb-8">
        <div className="bg-slate-100 p-1.5 rounded-2xl inline-flex items-center shadow-inner border border-slate-200">
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            className={`px-5 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 ${
              !isAnnual
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            className={`px-5 py-2 text-xs md:text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-2 ${
              isAnnual
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span>Annually</span>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Professional Plan Card */}
        <div className="bg-gradient-to-b from-slate-50 via-white to-slate-100 rounded-3xl p-8 md:p-7 border border-slate-200 shadow-xl flex flex-col relative transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          {isPro && (
            <div className="absolute top-5 right-5 z-10">
              {proAccessActive ? (
                <span className="bg-primary-500 text-white text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-sm">
                  {paidSubscriptionActive || currentPaidPeriodActive ? "Current Plan" : "Current Trial"}
                </span>
              ) : (
                <span className="bg-rose-600 text-white text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-sm">
                  {clinic.paystackSubscriptionStatus ? "Expired Plan" : "Expired Trial"}
                </span>
              )}
            </div>
          )}

          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-bold uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1.5">
              <Crown size={16} /> Professional
            </span>
          </div>

          <div className="mb-6 mt-4">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Professional Plan</h3>
            <p className="text-slate-600 text-sm">
              Full access for clinics that need scale, automation, and uninterrupted operations.
            </p>
          </div>

          <div className="mb-8 flex items-end gap-1">
            <span className="text-3xl md:text-4xl font-extrabold text-slate-900 transition-all">
              {proPrice}
            </span>
            <span className="text-slate-500 font-medium mb-1 transition-all">
              / {isAnnual ? "year" : "month"}
            </span>
          </div>

          {isPro && (paidSubscriptionActive || currentPaidPeriodActive) ? (
            <div className="mb-6 space-y-3">
              {currentPaidPeriodActive || autoRenewCanceled ? (
                <>
                  <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 text-sm text-amber-900 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <Sparkles size={16} className="text-amber-600 shrink-0" />
                      <span>
                        Access active until {formattedRenewalDate || "period end"}
                        {remainingPaidDays > 0 ? ` (${remainingPaidDays} day${remainingPaidDays === 1 ? "" : "s"} left)` : ""}
                      </span>
                    </div>
                    {remainingPaidDays > 0 ? (
                      <p className="text-xs text-amber-800 leading-relaxed">
                        <strong>Zero lost days:</strong> Renewing today automatically preserves your remaining days and stacks onto your balance, extending access to <strong>{projectedRenewalDate}</strong>.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Renew now to continue full operations and keep your subscription active without interruption.
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full py-4 text-base font-bold bg-primary-500 hover:bg-primary-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] border-transparent"
                    onClick={handleProUpgradeClick}
                    isLoading={checkoutLoading}
                    disabled={!paystackBillingAvailable}
                  >
                    Renew Professional Subscription
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="w-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    onClick={handleCancelAutoRenew}
                    isLoading={cancelLoading}
                  >
                    Cancel Professional Subscription
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {isPro && !proAccessActive && (
                <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {clinic.paystackSubscriptionStatus
                    ? "Your Professional subscription has expired. Clinic operations are locked until renewal."
                    : "Your Professional trial has ended. Subscribe to restore full clinic operations."}
                </div>
              )}
              <Button
                className="w-full py-4 text-base font-bold bg-primary-500 hover:bg-primary-400 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] border-transparent mb-6"
                onClick={handleProUpgradeClick}
                isLoading={checkoutLoading}
                disabled={!paystackBillingAvailable}
              >
                {isPro && !proAccessActive
                  ? (clinic.paystackSubscriptionStatus
                    ? "Renew Professional Subscription"
                    : "Unlock Professional Access")
                  : isEnterprise
                    ? "Switch to Professional"
                    : "Unlock Professional Access"}
              </Button>
            </>
          )}

          <div className="mb-5 flex justify-center items-center">
            <p className="text-slate-600 text-xs font-medium bg-white px-4 py-2 rounded-xl border border-slate-200 text-center leading-relaxed">
              Billed securely in NGN via Paystack (Debit Cards, Bank Transfer, USSD).
            </p>
          </div>
          {!paystackBillingAvailable && (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
              Paystack billing is currently available only to Nigerian clinics.
            </p>
          )}

          <div className="space-y-4 flex-1">
            <FeatureItem included highlight>
              Unlimited Patients from day one
            </FeatureItem>
            <FeatureItem included highlight>
              Unlimited Staff Accounts
            </FeatureItem>
            <FeatureItem included highlight icon={<FileUp size={18} />}>
              Unlimited X-Ray and File Uploads
            </FeatureItem>
            <FeatureItem included highlight icon={<BookOpen size={18} />}>
              1-Click Dental Formulary
            </FeatureItem>
            <FeatureItem included highlight>
              Online Patient Intake Forms
            </FeatureItem>
            <FeatureItem included>
              Automated Appointment Reminder Emails
            </FeatureItem>
            <FeatureItem included>Simple Analytics</FeatureItem>
            <FeatureItem included>Custom Invoice Branding</FeatureItem>
            <FeatureItem included>
              Advanced Role-Based Access (RBAC)
            </FeatureItem>
            <FeatureItem included>24/7 Support</FeatureItem>
          </div>
        </div>

        {/* Enterprise Plan Card */}
        <div className="relative h-full">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 rounded-3xl p-8 md:p-7 border border-slate-800 shadow-xl flex flex-col h-full relative transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
            {isEnterprise && (
              <div className="absolute top-5 right-5 z-10">
                {enterpriseAccess ? (
                  <span className="bg-primary-500 text-white text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-sm">
                    {paidSubscriptionActive || currentPaidPeriodActive ? "Current Plan" : "Current Trial"}
                  </span>
                ) : (
                  <span className="bg-rose-600 text-white text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full shadow-sm">
                    {clinic.paystackSubscriptionStatus ? "Expired Plan" : "Expired Trial"}
                  </span>
                )}
              </div>
            )}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
              <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
            </div>

            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
              <span className="bg-gradient-to-r from-slate-800 to-slate-950 border border-slate-700 text-amber-300 text-sm font-bold uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
                <Building2 size={16} /> Enterprise
              </span>
            </div>

            <div className="mb-6 mt-4 relative z-10">
              <h3 className="text-2xl font-bold text-white">Enterprise Plan</h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Built for clinic groups that need multi-branch control, branch-level separation, and centralized oversight.
              </p>
            </div>

            <div className="mb-8 flex items-end gap-1 relative z-10">
              <span className="text-3xl md:text-4xl font-extrabold text-white transition-all">
                {enterprisePrice}
              </span>
              <span className="text-slate-400 font-medium mb-1 transition-all">
                / {isAnnual ? "year" : "month"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400 mb-8 relative z-10">
              Enterprise billing for multi-location clinics and dental hospital groups.
            </p>

            {isEnterprise && (paidSubscriptionActive || currentPaidPeriodActive) ? (
              <div className="mb-6 space-y-3 relative z-10">
                <div
                  className={`mb-3 rounded-2xl p-4 text-sm font-medium ${
                    autoRenewCanceled || currentPaidPeriodActive
                      ? "border border-amber-400/30 bg-amber-500/10 text-amber-100 space-y-2"
                      : "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                  }`}
                >
                  {currentPaidPeriodActive || autoRenewCanceled ? (
                    <>
                      <div className="font-semibold flex items-center gap-2 text-amber-200">
                        <Sparkles size={16} className="text-amber-400 shrink-0" />
                        <span>
                          Enterprise access active until {formattedRenewalDate || "the current period ends"}
                          {remainingPaidDays > 0 ? ` (${remainingPaidDays} day${remainingPaidDays === 1 ? "" : "s"} left)` : ""}
                        </span>
                      </div>
                      {remainingPaidDays > 0 ? (
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          <strong>Zero lost days:</strong> Renewing today automatically stacks onto your remaining days, extending access to <strong>{projectedRenewalDate}</strong>.
                        </p>
                      ) : (
                        <p className="text-xs text-amber-200/90 leading-relaxed">
                          Renew now to keep your Enterprise subscription active without interruption.
                        </p>
                      )}
                    </>
                  ) : (
                    "Enterprise access is active on this clinic account (Paystack NGN). Branch management is unlocked."
                  )}
                </div>

                {currentPaidPeriodActive || autoRenewCanceled ? (
                  <Button
                    variant="outline"
                    className="mb-6 w-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                    onClick={handleEnterpriseUpgradeClick}
                    isLoading={enterpriseCheckoutLoading}
                    disabled={!paystackBillingAvailable}
                  >
                    Renew Enterprise Subscription
                    <ArrowRight size={16} className="ml-2" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full border-red-400/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      onClick={handleCancelAutoRenew}
                      isLoading={cancelLoading}
                    >
                      Cancel Enterprise Subscription
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="relative z-10">
                {isEnterprise && !enterpriseAccess && (
                  <div className="mb-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                    {clinic.paystackSubscriptionStatus
                      ? "Your Enterprise subscription has expired. Clinic operations are locked until renewal."
                      : "Your Enterprise trial has ended. Subscribe to restore full clinic operations."}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="mb-6 w-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                  onClick={handleEnterpriseUpgradeClick}
                  isLoading={enterpriseCheckoutLoading}
                  disabled={!paystackBillingAvailable}
                >
                  {isEnterprise && !enterpriseAccess
                    ? (clinic.paystackSubscriptionStatus
                      ? "Renew Enterprise Subscription"
                      : "Get Enterprise Features")
                    : paidSubscriptionActive && !isEnterprise
                      ? "Upgrade to Enterprise"
                      : "Get Enterprise Features"}
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </div>
            )}

            <div className="space-y-4 flex-1 relative z-10">
              <FeatureItem included dark highlight icon={<Crown size={18} />}>
                Everything in Professional Plan
              </FeatureItem>
              <FeatureItem included dark icon={<Building2 size={18} />}>
                Multi-Branch Management
              </FeatureItem>
              <FeatureItem included dark>
                Separate branches for locations
              </FeatureItem>
              <FeatureItem included dark>
                Branch identity duplicate protection
              </FeatureItem>
              <FeatureItem included dark>
                Dedicated branch management page
              </FeatureItem>
              <FeatureItem included dark>
                Branch activation and lifecycle control
              </FeatureItem>
              <FeatureItem included dark>
                Centralized admin expansion path for branch-scoped staff and analytics
              </FeatureItem>
              <FeatureItem included dark>
                Advanced Analytics
              </FeatureItem>
              <FeatureItem included dark>
                Priority 24/7 Support
              </FeatureItem>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FeatureItem({ children, included, dark, highlight, icon }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
          highlight
            ? "bg-amber-500/20 text-amber-400"
            : dark
              ? "bg-primary-500/20 text-primary-400"
              : "bg-emerald-100 text-emerald-600"
        }`}
      >
        {included ? icon || <Check size={14} strokeWidth={3} /> : null}
      </div>
      <span
        className={`text-sm font-medium ${
          highlight
            ? dark
              ? "font-bold text-slate-200"
              : "font-bold text-slate-900"
            : dark
              ? "text-slate-200"
              : "text-slate-700"
        }`}
      >
        {children}
      </span>
    </div>
  );
}
