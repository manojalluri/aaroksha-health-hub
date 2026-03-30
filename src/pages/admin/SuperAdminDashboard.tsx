import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Shield, TrendingUp, IndianRupee, Users, Stethoscope, FlaskConical, Pill,
  Settings, BarChart3, Percent, Truck, Activity, Eye, CheckCircle, XCircle,
  Clock, Calendar, Package, AlertTriangle, Building2, Crown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Wallet, CreditCard, FileText, Star
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CommissionConfig {
  id: string;
  category: string;
  type: "hospital" | "pharmacy" | "lab";
  commissionPercent: number;
  deliveryFee: number;
  platformFee: number;
  gstPercent: number;
  active: boolean;
}

interface RevenueEntry {
  date: string;
  hospital: number;
  pharmacy: number;
  lab: number;
  commission: number;
}

interface PlatformUser {
  id: string;
  name: string;
  role: "patient" | "doctor" | "pharmacist" | "lab_tech";
  email: string;
  phone: string;
  status: "active" | "inactive" | "suspended";
  joinedAt: string;
  lastActive: string;
}

interface TransactionRecord {
  id: string;
  type: "appointment" | "prescription" | "lab_test";
  patientName: string;
  amount: number;
  commission: number;
  deliveryFee: number;
  platformFee: number;
  netRevenue: number;
  status: "completed" | "pending" | "refunded";
  date: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const initialCommissions: CommissionConfig[] = [
  { id: "1", category: "General Consultation", type: "hospital", commissionPercent: 10, deliveryFee: 0, platformFee: 20, gstPercent: 18, active: true },
  { id: "2", category: "Specialist Consultation", type: "hospital", commissionPercent: 12, deliveryFee: 0, platformFee: 30, gstPercent: 18, active: true },
  { id: "3", category: "Medicine Delivery", type: "pharmacy", commissionPercent: 15, deliveryFee: 49, platformFee: 10, gstPercent: 12, active: true },
  { id: "4", category: "Prescription Fulfillment", type: "pharmacy", commissionPercent: 12, deliveryFee: 49, platformFee: 15, gstPercent: 12, active: true },
  { id: "5", category: "Home Sample Collection", type: "lab", commissionPercent: 18, deliveryFee: 99, platformFee: 25, gstPercent: 18, active: true },
  { id: "6", category: "Walk-in Lab Tests", type: "lab", commissionPercent: 10, deliveryFee: 0, platformFee: 15, gstPercent: 18, active: true },
  { id: "7", category: "Health Packages", type: "lab", commissionPercent: 20, deliveryFee: 0, platformFee: 30, gstPercent: 18, active: true },
  { id: "8", category: "Emergency Consultation", type: "hospital", commissionPercent: 5, deliveryFee: 0, platformFee: 50, gstPercent: 18, active: true },
];

const mockRevenue: RevenueEntry[] = [
  { date: "2026-03-24", hospital: 15200, pharmacy: 8400, lab: 12800, commission: 4250 },
  { date: "2026-03-25", hospital: 18500, pharmacy: 11200, lab: 9500, commission: 5100 },
  { date: "2026-03-26", hospital: 12800, pharmacy: 7600, lab: 14200, commission: 3900 },
  { date: "2026-03-27", hospital: 22400, pharmacy: 13800, lab: 11600, commission: 6400 },
  { date: "2026-03-28", hospital: 19600, pharmacy: 9200, lab: 16800, commission: 5800 },
  { date: "2026-03-29", hospital: 24800, pharmacy: 15400, lab: 13200, commission: 7200 },
  { date: "2026-03-30", hospital: 16200, pharmacy: 10600, lab: 18400, commission: 5400 },
];

const mockUsers: PlatformUser[] = [
  { id: "U001", name: "Ramesh Kumar", role: "patient", email: "ramesh@gmail.com", phone: "+91 98765 43210", status: "active", joinedAt: "2026-01-15", lastActive: "2026-03-30" },
  { id: "U002", name: "Sita Devi", role: "patient", email: "sita@gmail.com", phone: "+91 87654 32109", status: "active", joinedAt: "2026-02-01", lastActive: "2026-03-29" },
  { id: "U003", name: "Dr. Rajesh Kumar", role: "doctor", email: "dr.rajesh@aaroksha.com", phone: "+91 99999 11111", status: "active", joinedAt: "2025-12-01", lastActive: "2026-03-30" },
  { id: "U004", name: "Dr. Priya Sharma", role: "doctor", email: "dr.priya@aaroksha.com", phone: "+91 99999 22222", status: "active", joinedAt: "2025-12-15", lastActive: "2026-03-30" },
  { id: "U005", name: "Ravi Pharmacist", role: "pharmacist", email: "ravi@pharmacy.com", phone: "+91 88888 11111", status: "active", joinedAt: "2026-01-10", lastActive: "2026-03-30" },
  { id: "U006", name: "Priya Lab Tech", role: "lab_tech", email: "priya@lab.com", phone: "+91 88888 22222", status: "active", joinedAt: "2026-01-20", lastActive: "2026-03-29" },
  { id: "U007", name: "Vikram Singh", role: "patient", email: "vikram@gmail.com", phone: "+91 76543 21098", status: "suspended", joinedAt: "2026-02-10", lastActive: "2026-03-15" },
  { id: "U008", name: "Arjun Patel", role: "patient", email: "arjun@gmail.com", phone: "+91 54321 09876", status: "inactive", joinedAt: "2026-03-01", lastActive: "2026-03-20" },
];

const mockTransactions: TransactionRecord[] = [
  { id: "TXN001", type: "appointment", patientName: "Ramesh Kumar", amount: 500, commission: 50, deliveryFee: 0, platformFee: 20, netRevenue: 70, status: "completed", date: "2026-03-30" },
  { id: "TXN002", type: "prescription", patientName: "Sita Devi", amount: 1250, commission: 187, deliveryFee: 49, platformFee: 10, netRevenue: 246, status: "completed", date: "2026-03-30" },
  { id: "TXN003", type: "lab_test", patientName: "Rahul Verma", amount: 1000, commission: 180, deliveryFee: 99, platformFee: 25, netRevenue: 304, status: "completed", date: "2026-03-29" },
  { id: "TXN004", type: "appointment", patientName: "Lakshmi Bai", amount: 800, commission: 96, deliveryFee: 0, platformFee: 30, netRevenue: 126, status: "refunded", date: "2026-03-29" },
  { id: "TXN005", type: "lab_test", patientName: "Amit Sharma", amount: 1100, commission: 198, deliveryFee: 99, platformFee: 25, netRevenue: 322, status: "completed", date: "2026-03-28" },
  { id: "TXN006", type: "prescription", patientName: "Priya Reddy", amount: 870, commission: 130, deliveryFee: 49, platformFee: 10, netRevenue: 189, status: "pending", date: "2026-03-30" },
  { id: "TXN007", type: "appointment", patientName: "Suresh Reddy", amount: 700, commission: 84, deliveryFee: 0, platformFee: 20, netRevenue: 104, status: "completed", date: "2026-03-28" },
  { id: "TXN008", type: "lab_test", patientName: "Sneha Patil", amount: 2500, commission: 500, deliveryFee: 0, platformFee: 30, netRevenue: 530, status: "pending", date: "2026-03-30" },
];

// ─── Component ───────────────────────────────────────────────────────────────
const SuperAdminDashboard = () => {
  const [commissions, setCommissions] = useState<CommissionConfig[]>(initialCommissions);
  const [users, setUsers] = useState<PlatformUser[]>(mockUsers);
  const [editCommission, setEditCommission] = useState<CommissionConfig | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [userFilter, setUserFilter] = useState("all");
  const [txnFilter, setTxnFilter] = useState("all");
  const [searchUsers, setSearchUsers] = useState("");

  // Computed stats
  const totalRevenue = mockRevenue.reduce((s, r) => s + r.hospital + r.pharmacy + r.lab, 0);
  const totalCommission = mockRevenue.reduce((s, r) => s + r.commission, 0);
  const totalAppointments = mockTransactions.filter(t => t.type === "appointment").length;
  const totalPrescriptions = mockTransactions.filter(t => t.type === "prescription").length;
  const totalLabBookings = mockTransactions.filter(t => t.type === "lab_test").length;
  const activeUsers = users.filter(u => u.status === "active").length;
  const todayRevenue = mockRevenue[mockRevenue.length - 1];
  const yesterdayRevenue = mockRevenue[mockRevenue.length - 2];
  const revenueGrowth = todayRevenue && yesterdayRevenue
    ? (((todayRevenue.hospital + todayRevenue.pharmacy + todayRevenue.lab) - (yesterdayRevenue.hospital + yesterdayRevenue.pharmacy + yesterdayRevenue.lab)) / (yesterdayRevenue.hospital + yesterdayRevenue.pharmacy + yesterdayRevenue.lab) * 100).toFixed(1)
    : "0";

  const handleEditCommission = (c: CommissionConfig) => {
    setEditCommission({ ...c });
    setEditDialogOpen(true);
  };

  const handleSaveCommission = () => {
    if (!editCommission) return;
    setCommissions(prev => prev.map(c => c.id === editCommission.id ? editCommission : c));
    setEditDialogOpen(false);
    toast.success(`Commission for "${editCommission.category}" updated successfully`);
  };

  const toggleCommissionActive = (id: string) => {
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    toast.success("Status updated");
  };

  const handleUserStatus = (userId: string, newStatus: PlatformUser["status"]) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    toast.success("User status updated");
  };

  const filteredUsers = users.filter(u => {
    const matchRole = userFilter === "all" || u.role === userFilter;
    const matchSearch = u.name.toLowerCase().includes(searchUsers.toLowerCase()) || u.email.toLowerCase().includes(searchUsers.toLowerCase());
    return matchRole && matchSearch;
  });

  const filteredTransactions = mockTransactions.filter(t => txnFilter === "all" || t.type === txnFilter);

  const typeIcon = (type: string) => {
    switch (type) {
      case "hospital": return <Stethoscope className="h-4 w-4" />;
      case "pharmacy": return <Pill className="h-4 w-4" />;
      case "lab": return <FlaskConical className="h-4 w-4" />;
      default: return null;
    }
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case "hospital": return "bg-blue-100 text-blue-700 border-blue-200";
      case "pharmacy": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "lab": return "bg-purple-100 text-purple-700 border-purple-200";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
                <Crown className="h-7 w-7 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight font-['Poppins']">Aaroksha Super Admin</h1>
                <p className="text-sm text-slate-400">Complete platform control & analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1">
                <Activity className="h-3 w-3 mr-1.5 animate-pulse" /> System Online
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-3 py-1">
                <Shield className="h-3 w-3 mr-1.5" /> Super Admin
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <IndianRupee className="h-5 w-5 text-blue-600" />
                <span className={`text-xs flex items-center font-medium ${Number(revenueGrowth) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {Number(revenueGrowth) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {revenueGrowth}%
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">₹{(totalRevenue / 1000).toFixed(0)}K</p>
              <p className="text-xs text-muted-foreground mt-1">Total Revenue (7d)</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Wallet className="h-5 w-5 text-amber-600" />
                <Percent className="h-3 w-3 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-foreground">₹{(totalCommission / 1000).toFixed(1)}K</p>
              <p className="text-xs text-muted-foreground mt-1">Commission Earned</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Stethoscope className="h-5 w-5 text-emerald-600" />
                <span className="text-xs text-emerald-600 font-medium">{totalAppointments}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalAppointments}</p>
              <p className="text-xs text-muted-foreground mt-1">Appointments</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-violet-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Pill className="h-5 w-5 text-violet-600" />
                <span className="text-xs text-violet-600 font-medium">{totalPrescriptions}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalPrescriptions}</p>
              <p className="text-xs text-muted-foreground mt-1">Prescriptions</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-rose-50 to-rose-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <FlaskConical className="h-5 w-5 text-rose-600" />
                <span className="text-xs text-rose-600 font-medium">{totalLabBookings}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalLabBookings}</p>
              <p className="text-xs text-muted-foreground mt-1">Lab Bookings</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-cyan-50 to-cyan-100/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-cyan-600" />
                <span className="text-xs text-emerald-600 font-medium">{activeUsers} active</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Users</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Stethoscope className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Hospital Revenue</p>
                  <p className="text-xl font-bold text-foreground">₹{mockRevenue.reduce((s, r) => s + r.hospital, 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(mockRevenue.reduce((s, r) => s + r.hospital, 0) / totalRevenue * 100).toFixed(0)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{(mockRevenue.reduce((s, r) => s + r.hospital, 0) / totalRevenue * 100).toFixed(1)}% of total</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg"><Pill className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Pharmacy Revenue</p>
                  <p className="text-xl font-bold text-foreground">₹{mockRevenue.reduce((s, r) => s + r.pharmacy, 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(mockRevenue.reduce((s, r) => s + r.pharmacy, 0) / totalRevenue * 100).toFixed(0)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{(mockRevenue.reduce((s, r) => s + r.pharmacy, 0) / totalRevenue * 100).toFixed(1)}% of total</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg"><FlaskConical className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Lab Revenue</p>
                  <p className="text-xl font-bold text-foreground">₹{mockRevenue.reduce((s, r) => s + r.lab, 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(mockRevenue.reduce((s, r) => s + r.lab, 0) / totalRevenue * 100).toFixed(0)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{(mockRevenue.reduce((s, r) => s + r.lab, 0) / totalRevenue * 100).toFixed(1)}% of total</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="commissions" className="space-y-4">
          <TabsList className="bg-card border shadow-sm h-auto p-1 flex-wrap">
            <TabsTrigger value="commissions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Percent className="h-4 w-4" /> Commissions & Fees
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <BarChart3 className="h-4 w-4" /> Revenue Log
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <CreditCard className="h-4 w-4" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Users className="h-4 w-4" /> User Management
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5">
              <Settings className="h-4 w-4" /> Platform Settings
            </TabsTrigger>
          </TabsList>

          {/* ─── COMMISSIONS & FEES TAB ─── */}
          <TabsContent value="commissions" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary" /> Commission & Fee Configuration</CardTitle>
                <CardDescription>Set commission rates, delivery fees, platform fees, and GST for each service category</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Commission %</TableHead>
                      <TableHead className="text-center">Delivery Fee</TableHead>
                      <TableHead className="text-center">Platform Fee</TableHead>
                      <TableHead className="text-center">GST %</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map(c => (
                      <TableRow key={c.id} className={!c.active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{c.category}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${typeBadgeColor(c.type)}`}>
                            {typeIcon(c.type)} {c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-primary">{c.commissionPercent}%</TableCell>
                        <TableCell className="text-center">₹{c.deliveryFee}</TableCell>
                        <TableCell className="text-center">₹{c.platformFee}</TableCell>
                        <TableCell className="text-center">{c.gstPercent}%</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={c.active} onCheckedChange={() => toggleCommissionActive(c.id)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleEditCommission(c)} className="gap-1">
                            <Settings className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── REVENUE LOG TAB ─── */}
          <TabsContent value="revenue" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Daily Revenue Breakdown</CardTitle>
                <CardDescription>Revenue from all verticals over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Hospital</TableHead>
                      <TableHead className="text-right">Pharmacy</TableHead>
                      <TableHead className="text-right">Lab</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockRevenue.map(r => (
                      <TableRow key={r.date}>
                        <TableCell className="font-medium">{new Date(r.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</TableCell>
                        <TableCell className="text-right text-blue-600 font-medium">₹{r.hospital.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-medium">₹{r.pharmacy.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-purple-600 font-medium">₹{r.lab.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold">₹{(r.hospital + r.pharmacy + r.lab).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-amber-600 font-semibold">₹{r.commission.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-blue-600">₹{mockRevenue.reduce((s, r) => s + r.hospital, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-600">₹{mockRevenue.reduce((s, r) => s + r.pharmacy, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-purple-600">₹{mockRevenue.reduce((s, r) => s + r.lab, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">₹{totalRevenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-amber-600">₹{totalCommission.toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TRANSACTIONS TAB ─── */}
          <TabsContent value="transactions" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> All Transactions</CardTitle>
                    <CardDescription>Detailed view of all platform transactions</CardDescription>
                  </div>
                  <Select value={txnFilter} onValueChange={setTxnFilter}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="appointment">Appointments</SelectItem>
                      <SelectItem value="prescription">Prescriptions</SelectItem>
                      <SelectItem value="lab_test">Lab Tests</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Delivery</TableHead>
                      <TableHead className="text-right">Platform</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                            t.type === "appointment" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            t.type === "prescription" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            "bg-purple-50 text-purple-700 border-purple-200"
                          }`}>
                            {t.type === "appointment" ? <Stethoscope className="h-3 w-3" /> : t.type === "prescription" ? <Pill className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
                            {t.type.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>{t.patientName}</TableCell>
                        <TableCell className="text-right font-medium">₹{t.amount}</TableCell>
                        <TableCell className="text-right text-amber-600">₹{t.commission}</TableCell>
                        <TableCell className="text-right">₹{t.deliveryFee}</TableCell>
                        <TableCell className="text-right">₹{t.platformFee}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">₹{t.netRevenue}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === "completed" ? "default" : t.status === "refunded" ? "destructive" : "secondary"}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── USER MANAGEMENT TAB ─── */}
          <TabsContent value="users" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Platform Users</CardTitle>
                    <CardDescription>Manage all users across the platform</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Search users..." value={searchUsers} onChange={e => setSearchUsers(e.target.value)} className="w-48" />
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="patient">Patients</SelectItem>
                        <SelectItem value="doctor">Doctors</SelectItem>
                        <SelectItem value="pharmacist">Pharmacists</SelectItem>
                        <SelectItem value="lab_tech">Lab Techs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-xs">{u.id}</TableCell>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{u.role.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell className="text-sm">{u.phone}</TableCell>
                        <TableCell className="text-sm">{new Date(u.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</TableCell>
                        <TableCell className="text-sm">{new Date(u.lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</TableCell>
                        <TableCell>
                          <Badge variant={u.status === "active" ? "default" : u.status === "suspended" ? "destructive" : "secondary"}>
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {u.status !== "active" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleUserStatus(u.id, "active")}>
                                <CheckCircle className="h-3 w-3" /> Activate
                              </Button>
                            )}
                            {u.status === "active" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={() => handleUserStatus(u.id, "suspended")}>
                                <XCircle className="h-3 w-3" /> Suspend
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── PLATFORM SETTINGS TAB ─── */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-primary" /> Platform Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Platform Name</Label>
                    <Input defaultValue="Aaroksha" />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Email</Label>
                    <Input defaultValue="support@aaroksha.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Support Phone</Label>
                    <Input defaultValue="+91 1800-XXX-XXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Currency</Label>
                    <Input defaultValue="INR (₹)" disabled />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Maintenance Mode</p>
                      <p className="text-xs text-muted-foreground">Disable platform for users during maintenance</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">New User Registration</p>
                      <p className="text-xs text-muted-foreground">Allow new users to sign up</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Button className="w-full" onClick={() => toast.success("Platform settings saved!")}>Save Changes</Button>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Truck className="h-5 w-5 text-primary" /> Delivery & Logistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Default Delivery Radius (km)</Label>
                    <Input type="number" defaultValue="15" />
                  </div>
                  <div className="space-y-2">
                    <Label>Free Delivery Above (₹)</Label>
                    <Input type="number" defaultValue="999" />
                  </div>
                  <div className="space-y-2">
                    <Label>Express Delivery Surcharge (₹)</Label>
                    <Input type="number" defaultValue="99" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Delivery Time (hours)</Label>
                    <Input type="number" defaultValue="4" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Lab Home Collection</p>
                      <p className="text-xs text-muted-foreground">Enable home sample collection service</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">COD for Pharmacy</p>
                      <p className="text-xs text-muted-foreground">Allow cash on delivery for medicine orders</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Button className="w-full" onClick={() => toast.success("Delivery settings saved!")}>Save Changes</Button>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" /> Notification Templates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "Appointment Confirmation SMS", active: true },
                    { label: "Prescription Status Update", active: true },
                    { label: "Lab Report Ready Notification", active: true },
                    { label: "Payment Receipt Email", active: true },
                    { label: "Doctor Availability Alert", active: false },
                    { label: "Promotional Offers", active: false },
                  ].map((n, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <p className="text-sm font-medium">{n.label}</p>
                      <Switch defaultChecked={n.active} />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Star className="h-5 w-5 text-primary" /> Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Hospital Dashboard", path: "/admin/hospital", icon: <Stethoscope className="h-4 w-4" />, color: "text-blue-600" },
                    { label: "Pharmacy Dashboard", path: "/admin/pharmacy", icon: <Pill className="h-4 w-4" />, color: "text-emerald-600" },
                    { label: "Lab Dashboard", path: "/admin/lab", icon: <FlaskConical className="h-4 w-4" />, color: "text-purple-600" },
                  ].map((link, i) => (
                    <a key={i} href={link.path} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className={link.color}>{link.icon}</span>
                        <span className="font-medium text-sm">{link.label}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </a>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Commission Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Commission & Fees</DialogTitle>
          </DialogHeader>
          {editCommission && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{editCommission.category}</p>
                <p className="text-sm text-muted-foreground capitalize">{editCommission.type}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Commission %</Label>
                  <Input type="number" value={editCommission.commissionPercent} onChange={e => setEditCommission({ ...editCommission, commissionPercent: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Fee (₹)</Label>
                  <Input type="number" value={editCommission.deliveryFee} onChange={e => setEditCommission({ ...editCommission, deliveryFee: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Platform Fee (₹)</Label>
                  <Input type="number" value={editCommission.platformFee} onChange={e => setEditCommission({ ...editCommission, platformFee: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>GST %</Label>
                  <Input type="number" value={editCommission.gstPercent} onChange={e => setEditCommission({ ...editCommission, gstPercent: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCommission}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminDashboard;
