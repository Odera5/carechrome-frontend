import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Users, Calendar, Lock, Activity, Stethoscope, HeartPulse, Building2, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { hasActiveProAccess } from "../utils/clinicAccess";
import { getStoredUserObject } from "../utils/authStorage";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const branchChartColors = [
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
  "#f43f5e",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs font-bold">
        <p className="text-slate-400 mb-0.5">{payload[0].payload.month}</p>
        <p className="text-sm text-teal-400">₦{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

const NewPatientsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const total = Number(payload[0]?.payload?.total || 0);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs font-bold text-white shadow-xl">
      <p className="mb-1 text-slate-400">{label}</p>
      <p className="mb-2 text-sm text-white">Total: {total.toLocaleString()}</p>
      {payload
        .filter((entry) => Number(entry.value) > 0)
        .map((entry) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {Number(entry.value).toLocaleString()}
          </p>
        ))}
    </div>
  );
};

export default function Reports() {
  const navigate = useNavigate();
  const storedUser = getStoredUserObject() || {};
  const proAccessActive = hasActiveProAccess(storedUser?.clinic);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  // Set default preset to last-6-months, which pre-populates dates
  const [preset, setPreset] = useState("last-6-months");
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const handlePresetChange = (selectedPreset) => {
    setPreset(selectedPreset);
    if (selectedPreset === "custom") {
      return;
    }

    const today = new Date();
    let start = "";
    let end = today.toISOString().split("T")[0];

    if (selectedPreset === "today") {
      start = today.toISOString().split("T")[0];
      end = start;
    } else if (selectedPreset === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      start = d.toISOString().split("T")[0];
      end = start;
    } else if (selectedPreset === "this-week") {
      const d = new Date();
      const dayOfWeek = d.getDay();
      const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      d.setDate(d.getDate() - distanceToMonday);
      start = d.toISOString().split("T")[0];
      end = today.toISOString().split("T")[0];
    } else if (selectedPreset === "last-week") {
      const dStart = new Date();
      const dayOfWeek = dStart.getDay();
      const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      dStart.setDate(dStart.getDate() - distanceToMonday - 7);
      start = dStart.toISOString().split("T")[0];
      
      const dEnd = new Date(dStart);
      dEnd.setDate(dEnd.getDate() + 6);
      end = dEnd.toISOString().split("T")[0];
    } else if (selectedPreset === "this-month") {
      const d = new Date();
      d.setDate(1);
      start = d.toISOString().split("T")[0];
      end = today.toISOString().split("T")[0];
    } else if (selectedPreset === "last-month") {
      const dStart = new Date();
      dStart.setMonth(dStart.getMonth() - 1);
      dStart.setDate(1);
      start = dStart.toISOString().split("T")[0];
      
      const dEnd = new Date();
      dEnd.setDate(0);
      end = dEnd.toISOString().split("T")[0];
    } else if (selectedPreset === "last-6-months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 5);
      d.setDate(1);
      start = d.toISOString().split("T")[0];
    } else if (selectedPreset === "last-12-months") {
      const d = new Date();
      d.setMonth(d.getMonth() - 11);
      d.setDate(1);
      start = d.toISOString().split("T")[0];
    } else if (selectedPreset === "this-year") {
      const d = new Date(today.getFullYear(), 0, 1);
      start = d.toISOString().split("T")[0];
    } else if (selectedPreset === "last-year") {
      const dStart = new Date(today.getFullYear() - 1, 0, 1);
      const dEnd = new Date(today.getFullYear() - 1, 11, 31);
      start = dStart.toISOString().split("T")[0];
      end = dEnd.toISOString().split("T")[0];
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleStartDateChange = (val) => {
    setStartDate(val);
    setPreset("custom");
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    setPreset("custom");
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setPreset("custom");
  };

  const getChartTitle = () => {
    if (preset === "today") return "Revenue Trends (Today)";
    if (preset === "yesterday") return "Revenue Trends (Yesterday)";
    if (preset === "this-week") return "Revenue Trends (This Week)";
    if (preset === "last-week") return "Revenue Trends (Last Week)";
    if (preset === "this-month") return "Revenue Trends (This Month)";
    if (preset === "last-month") return "Revenue Trends (Last Month)";
    if (preset === "last-6-months") return "Revenue Trends (Last 6 Months)";
    if (preset === "last-12-months") return "Revenue Trends (Last 12 Months)";
    if (preset === "this-year") return "Revenue Trends (This Year)";
    if (preset === "last-year") return "Revenue Trends (Last Year)";
    
    if (startDate && endDate) {
      const startLabel = new Date(startDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      const endLabel = new Date(endDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      return `Revenue Trends (${startLabel} - ${endLabel})`;
    }
    if (startDate) {
      const startLabel = new Date(startDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      return `Revenue Trends (Since ${startLabel})`;
    }
    if (endDate) {
      const endLabel = new Date(endDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      return `Revenue Trends (Up to ${endLabel})`;
    }
    return "Revenue Trends";
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const res = await api.get(`/analytics/dashboard?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!proAccessActive) {
      setLoading(false);
      return;
    }
    fetchAnalytics();
  }, [proAccessActive, startDate, endDate]);

  const renderContent = () => {
    if (loading) {
      return <div className="p-8 text-center text-slate-500 animate-pulse">Loading analytics data...</div>;
    }

    if (!proAccessActive || !data) {
      return (
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white min-h-[500px]">
          {/* FAKE BLURRED BACKGROUND */}
          <div className="absolute inset-0 p-8 grid grid-cols-1 md:grid-cols-2 gap-6 opacity-40 blur-sm pointer-events-none select-none">
            <div className="bg-slate-100 rounded-2xl h-64 border border-slate-200 flex items-end p-4 gap-2">
              <div className="w-1/6 bg-primary-200 h-1/3 rounded-t-md"></div>
              <div className="w-1/6 bg-primary-300 h-1/2 rounded-t-md"></div>
              <div className="w-1/6 bg-primary-400 h-2/3 rounded-t-md"></div>
              <div className="w-1/6 bg-primary-500 h-[80%] rounded-t-md"></div>
              <div className="w-1/6 bg-primary-400 h-1/2 rounded-t-md"></div>
              <div className="w-1/6 bg-primary-600 h-full rounded-t-md"></div>
            </div>
            <div className="bg-slate-100 rounded-2xl h-64 border border-slate-200 flex flex-col justify-center items-center">
              <div className="w-32 h-32 rounded-full border-8 border-r-primary-500 border-t-amber-400 border-l-rose-500 border-b-cyan-500"></div>
            </div>
          </div>

          <div className="absolute inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center z-10 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-white text-center transform transition-all hover:scale-[1.02]">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-inner">
                <BarChart3 size={40} />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Advanced Analytics</h2>
              <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                Unlock powerful financial charts, appointment trends, and patient demographic breakdowns. Make data-driven decisions to grow your clinic.
              </p>
              {storedUser?.role === "admin" ? (
                <Button 
                  onClick={() => navigate("/upgrade")} 
                  size="lg" 
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 border-none shadow-xl shadow-orange-500/20 text-white font-bold h-14 text-lg rounded-xl flex items-center justify-center gap-3"
                >
                  <Lock size={20} />
                  Unlock Pro Plan
                </Button>
              ) : (
                <div className="text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-center">
                  Advanced Analytics require Pro Plan. Please contact your clinic administrator to upgrade.
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ACTUAL PRO CONTENT
    const totalRevenue = data.revenueByMonth.reduce((acc, curr) => acc + curr.revenue, 0);
    const revenueByBranch = data.enterprise?.revenueByBranch || [];
    const branchRevenueTotal = revenueByBranch.reduce(
      (total, branch) => total + branch.total,
      0,
    );
    const maxBranchRev = Math.max(...revenueByBranch.map((branch) => branch.total), 1);
    const newPatientGrowth = data.enterprise?.newPatientsByBranch;
    const growthBranches = newPatientGrowth?.branches || [];
    const growthMonths = newPatientGrowth?.months || [];
    
    // Status color mapping
    const statusColors = {
      completed: "bg-emerald-500",
      scheduled: "bg-blue-500",
      "no-show": "bg-rose-500",
      cancelled: "bg-amber-500"
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 items-end">
           <div className="w-full md:w-64 space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Reporting Period</label>
              <select 
                value={preset} 
                onChange={(e) => handlePresetChange(e.target.value)} 
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none font-semibold text-slate-700"
              >
                 <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this-week">This Week</option>
                <option value="last-week">Last Week</option>
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="last-6-months">Last 6 Months</option>
                <option value="last-12-months">Last 12 Months</option>
                <option value="this-year">This Year</option>
                <option value="last-year">Last Year</option>
                <option value="custom">Custom Range</option>
              </select>
           </div>
           
           {preset === "custom" ? (
             <>
               <div className="flex-1 w-full space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none font-medium text-slate-800" />
               </div>
               <div className="flex-1 w-full space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none font-medium text-slate-800" />
               </div>
               <div className="w-full md:w-auto">
                  <Button onClick={handleClearFilters} variant="outline" className="w-full md:w-auto h-9 px-4 font-semibold text-slate-600">Clear Filters</Button>
               </div>
             </>
           ) : (
             <div className="flex-1 pb-2 text-xs font-semibold text-slate-500 flex items-center gap-2">
               <span>Selected Period:</span>
               <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">
                 {startDate ? new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Beginning'} 
                 {' – '} 
                 {endDate ? new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Present'}
               </span>
             </div>
           )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Card className="col-span-1 md:col-span-2 border-slate-200 shadow-sm bg-white overflow-hidden">
             <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <TrendingUp className="text-primary-500" size={20} />
                  {getChartTitle()}
                </CardTitle>
             </CardHeader>
             <CardContent className="p-6">
                <div className="mb-4">
                  <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Period Revenue</span>
                  <div className="text-3xl font-extrabold text-slate-900 mt-1">₦{totalRevenue.toLocaleString()}</div>
                </div>
                
                <div className="h-72 w-full mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.revenueByMonth}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                          dataKey="month" 
                          stroke="#94a3b8" 
                          fontSize={11} 
                          fontWeight="semibold"
                          tickLine={false} 
                          axisLine={false} 
                          dy={10}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={11} 
                          fontWeight="semibold"
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `₦${value >= 1000000 ? (value / 1000000) + 'M' : value >= 1000 ? (value / 1000) + 'k' : value}`}
                          dx={-5}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="#0d9488" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorRevenue)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
             </CardContent>
           </Card>

           <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm bg-white">
                 <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Calendar className="text-blue-500" size={20} />
                      Appointment Status
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    {data.appointments.length === 0 ? (
                      <div className="text-sm text-slate-400 italic text-center py-4">No appointment data available.</div>
                    ) : (
                      <div className="space-y-4">
                        {data.appointments.map((apt, idx) => {
                           const clr = statusColors[apt.status] || "bg-slate-400";
                           return (
                             <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                   <div className={`w-3 h-3 rounded-full ${clr} shadow-sm`}></div>
                                   <span className="text-sm font-bold text-slate-700 capitalize">{apt.status}</span>
                                </div>
                                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">{apt.count}</span>
                             </div>
                           )
                        })}
                      </div>
                    )}
                 </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-white">
                 <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                      <Users className="text-rose-500" size={20} />
                      Demographics (Gender)
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-6">
                    {data.demographics.length === 0 ? (
                       <div className="text-sm text-slate-400 italic text-center py-4">No demographic data available.</div>
                    ) : (
                       <div className="space-y-4">
                          {data.demographics.map((demo, idx) => (
                             <div key={idx} className="flex flex-col gap-1">
                                <div className="flex justify-between text-sm">
                                   <span className="font-semibold text-slate-700 capitalize">{demo.gender || "Not Specified"}</span>
                                   <span className="font-bold text-slate-900">{demo.count}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                   <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full rounded-full" style={{ width: `${Math.max((demo.count / data.demographics.reduce((s, d) => s + d.count, 0)) * 100, 5)}%` }}></div>
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                 </CardContent>
              </Card>
           </div>
        </div>

        {/* Clinical Insights Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
           <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                 <CardTitle className="flex items-center justify-between w-full text-slate-800">
                   <div className="flex items-center gap-2">
                     <Stethoscope className="text-teal-500" size={20} />
                     <span>Top Diagnoses</span>
                   </div>
                   {data.clinicalInsights?.totalDiagnoses > 0 && (
                     <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                        {data.clinicalInsights.totalDiagnoses > 5 ? `Top 5 of ${data.clinicalInsights.totalDiagnoses}` : `Showing all ${data.clinicalInsights.totalDiagnoses}`}
                     </span>
                   )}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                 {!data.clinicalInsights?.topDiagnoses?.length ? (
                    <div className="text-sm text-slate-400 italic text-center py-4">No diagnostic data available.</div>
                 ) : (
                    <div className="space-y-5">
                       {data.clinicalInsights.topDiagnoses.map((diag, idx) => {
                          const maxCount = Math.max(...data.clinicalInsights.topDiagnoses.map(d => d.count), 1);
                          return (
                            <div key={idx} className="space-y-1.5">
                               <div className="flex justify-between text-sm">
                                  <span className="font-semibold text-slate-700 capitalize truncate pr-4">{diag.name}</span>
                                  <span className="font-extrabold text-slate-900 shrink-0">{diag.count} Cases</span>
                               </div>
                               <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  <div className="bg-gradient-to-r from-teal-400 to-teal-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max((diag.count / maxCount) * 100, 2)}%` }}></div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 )}
              </CardContent>
           </Card>

           <Card className="border-slate-200 shadow-sm bg-white">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                 <CardTitle className="flex items-center justify-between w-full text-slate-800">
                   <div className="flex items-center gap-2">
                     <HeartPulse className="text-rose-500" size={20} />
                     <span>Top Presenting Complaints</span>
                   </div>
                   {data.clinicalInsights?.totalComplaints > 0 && (
                     <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                        {data.clinicalInsights.totalComplaints > 5 ? `Top 5 of ${data.clinicalInsights.totalComplaints}` : `Showing all ${data.clinicalInsights.totalComplaints}`}
                     </span>
                   )}
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                 {!data.clinicalInsights?.topComplaints?.length ? (
                    <div className="text-sm text-slate-400 italic text-center py-4">No complaint data available.</div>
                 ) : (
                    <div className="space-y-5">
                       {data.clinicalInsights.topComplaints.map((comp, idx) => {
                          const maxCount = Math.max(...data.clinicalInsights.topComplaints.map(c => c.count), 1);
                          return (
                            <div key={idx} className="space-y-1.5">
                               <div className="flex justify-between text-sm">
                                  <span className="font-semibold text-slate-700 capitalize truncate pr-4">{comp.name}</span>
                                  <span className="font-extrabold text-slate-900 shrink-0">{comp.count} Cases</span>
                               </div>
                               <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                  <div className="bg-gradient-to-r from-rose-400 to-rose-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max((comp.count / maxCount) * 100, 2)}%` }}></div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 )}
              </CardContent>
           </Card>
        </div>

        {/* Enterprise Cross-Branch Analytics Section */}
        {data.enterprise && (
           <div className="mt-10">
              <div className="flex items-center gap-3 mb-6">
                 <div className="bg-amber-100 text-amber-600 p-2 rounded-lg shadow-sm border border-amber-200">
                    <Crown size={24} />
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-900">Enterprise Analytics</h3>
                    <p className="text-sm text-slate-500">Cross-branch network performance (Admin Only)</p>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/50 to-white overflow-hidden">
                    <CardHeader className="border-b border-amber-100 pb-4 bg-amber-50/50">
                       <CardTitle className="flex items-center gap-2 text-slate-800">
                         <Building2 className="text-amber-500" size={20} />
                         Revenue by Branch
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                       {!revenueByBranch.length ? (
                          <div className="text-sm text-slate-400 italic text-center py-4">No revenue data across branches.</div>
                       ) : (
                          <div className="space-y-5">
                             {revenueByBranch.map((branch) => (
                                  <div key={branch.branchId} className="space-y-1.5">
                                     <div className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-700">{branch.branchName}</span>
                                        <span className="font-extrabold text-slate-900">₦{branch.total.toLocaleString()}</span>
                                     </div>
                                     <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max((branch.total / maxBranchRev) * 100, 2)}%` }}></div>
                                     </div>
                                  </div>
                             ))}
                             <div className="flex justify-between border-t border-amber-200 pt-4 text-sm">
                                <span className="font-bold text-slate-700">Total clinic revenue</span>
                                <span className="font-extrabold text-slate-900">₦{branchRevenueTotal.toLocaleString()}</span>
                             </div>
                          </div>
                       )}
                    </CardContent>
                 </Card>

                 <Card className="border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/50 to-white overflow-hidden">
                    <CardHeader className="border-b border-amber-100 pb-4 bg-amber-50/50">
                       <CardTitle className="flex items-center gap-2 text-slate-800">
                         <Users className="text-orange-500" size={20} />
                         New Patients by Branch
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                       {!growthBranches.length || !growthMonths.length ? (
                          <div className="text-sm text-slate-400 italic text-center py-4">No new patient data across branches for this period.</div>
                       ) : (
                          <div>
                            <div className="h-72">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={growthMonths}
                                  margin={{ top: 8, right: 8, left: -20, bottom: 8 }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                  />
                                  <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                  />
                                  <YAxis
                                    allowDecimals={false}
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                  />
                                  <Tooltip content={<NewPatientsTooltip />} />
                                  <Legend wrapperStyle={{ fontSize: 11 }} />
                                  {growthBranches.map((branch, index) => (
                                    <Bar
                                      key={branch.branchId}
                                      dataKey={branch.branchId}
                                      name={branch.branchName}
                                      stackId="new-patients"
                                      fill={
                                        branchChartColors[
                                          index % branchChartColors.length
                                        ]
                                      }
                                    />
                                  ))}
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="mt-5">
                              <h4 className="mb-2 text-sm font-bold text-slate-800">
                                Monthly breakdown
                              </h4>
                              <div className="overflow-x-auto rounded-xl border border-amber-100 bg-white">
                                <table className="min-w-full text-left text-xs">
                                  <thead className="bg-amber-50 text-slate-600">
                                    <tr>
                                      <th className="sticky left-0 bg-amber-50 px-3 py-2.5 font-semibold">
                                        Month
                                      </th>
                                      {growthBranches.map((branch) => (
                                        <th
                                          key={branch.branchId}
                                          className="whitespace-nowrap px-3 py-2.5 text-right font-semibold"
                                        >
                                          {branch.branchName}
                                        </th>
                                      ))}
                                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold text-slate-800">
                                        Total
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {growthMonths.map((month) => (
                                      <tr key={month.monthKey}>
                                        <th className="sticky left-0 bg-white px-3 py-2.5 font-medium text-slate-700">
                                          {month.month}
                                        </th>
                                        {growthBranches.map((branch) => (
                                          <td
                                            key={branch.branchId}
                                            className="px-3 py-2.5 text-right tabular-nums text-slate-600"
                                          >
                                            {Number(
                                              month[branch.branchId] || 0,
                                            ).toLocaleString()}
                                          </td>
                                        ))}
                                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-slate-900">
                                          {Number(month.total).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                       )}
                    </CardContent>
                 </Card>
              </div>
           </div>
        )}

      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-6 md:p-8 h-full overflow-y-auto">
      {renderContent()}
    </motion.div>
  );
}
