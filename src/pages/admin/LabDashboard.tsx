import { useState } from "react";
import {
  FlaskConical, Package, Clock, CheckCircle, XCircle, Search, Plus, Trash2, Edit, Eye,
  MapPin, Phone, FileText, Upload, User, TrendingUp, Beaker, AlertCircle, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { labTests as initialTests, type LabTest } from "@/data/mockData";
import { toast } from "sonner";

interface LabBooking {
  id: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  phone: string;
  address: string;
  tests: { name: string; price: number }[];
  total: number;
  collectionDate: string;
  collectionTime: string;
  status: "pending" | "confirmed" | "collected" | "processing" | "completed" | "cancelled";
  bookedAt: string;
  assignedTechnician: string;
  sampleId: string;
  results: TestResult[];
  notes: string;
}

interface TestResult {
  testName: string;
  value: string;
  unit: string;
  normalRange: string;
  status: "normal" | "abnormal" | "critical" | "pending";
}

const mockBookings: LabBooking[] = [
  {
    id: "LB001", patientName: "Rahul Verma", patientAge: "32", patientGender: "Male",
    phone: "9876543210", address: "12, MG Road, Hyderabad",
    tests: [{ name: "Complete Blood Count (CBC)", price: 350 }, { name: "Thyroid Profile (T3, T4, TSH)", price: 650 }],
    total: 1000, collectionDate: "2026-03-29", collectionTime: "09:00 AM",
    status: "pending", bookedAt: "2026-03-28 10:30 AM",
    assignedTechnician: "", sampleId: "", results: [], notes: "",
  },
  {
    id: "LB002", patientName: "Sneha Patil", patientAge: "28", patientGender: "Female",
    phone: "9123456780", address: "45, Banjara Hills, Hyderabad",
    tests: [{ name: "Full Body Checkup", price: 2500 }],
    total: 2500, collectionDate: "2026-03-29", collectionTime: "08:00 AM",
    status: "confirmed", bookedAt: "2026-03-28 09:15 AM",
    assignedTechnician: "Technician Ravi", sampleId: "", results: [], notes: "",
  },
  {
    id: "LB003", patientName: "Amit Sharma", patientAge: "45", patientGender: "Male",
    phone: "9988776655", address: "78, Jubilee Hills, Hyderabad",
    tests: [{ name: "Lipid Profile", price: 500 }, { name: "Blood Sugar Fasting", price: 150 }, { name: "HbA1c", price: 450 }],
    total: 1100, collectionDate: "2026-03-28", collectionTime: "07:00 AM",
    status: "collected", bookedAt: "2026-03-27 04:00 PM",
    assignedTechnician: "Technician Priya", sampleId: "SMP-2026-0328-003", results: [], notes: "Sample collected at home",
  },
  {
    id: "LB004", patientName: "Priya Reddy", patientAge: "35", patientGender: "Female",
    phone: "9876012345", address: "23, Madhapur, Hyderabad",
    tests: [{ name: "Vitamin D Test", price: 800 }],
    total: 800, collectionDate: "2026-03-28", collectionTime: "10:00 AM",
    status: "processing", bookedAt: "2026-03-27 02:00 PM",
    assignedTechnician: "Technician Ravi", sampleId: "SMP-2026-0328-004",
    results: [{ testName: "Vitamin D", value: "", unit: "ng/mL", normalRange: "30-100", status: "pending" }],
    notes: "",
  },
  {
    id: "LB005", patientName: "Kiran Kumar", patientAge: "50", patientGender: "Male",
    phone: "9090909090", address: "56, Kukatpally, Hyderabad",
    tests: [{ name: "Kidney Function Test (KFT)", price: 550 }, { name: "Liver Function Test (LFT)", price: 600 }],
    total: 1150, collectionDate: "2026-03-30", collectionTime: "09:00 AM",
    status: "pending", bookedAt: "2026-03-28 11:00 AM",
    assignedTechnician: "", sampleId: "", results: [], notes: "",
  },
  {
    id: "LB006", patientName: "Deepa Nair", patientAge: "40", patientGender: "Female",
    phone: "9111222333", address: "90, Gachibowli, Hyderabad",
    tests: [{ name: "Urine Routine", price: 200 }],
    total: 200, collectionDate: "2026-03-27", collectionTime: "08:00 AM",
    status: "completed", bookedAt: "2026-03-26 06:00 PM",
    assignedTechnician: "Technician Priya", sampleId: "SMP-2026-0327-006",
    results: [
      { testName: "pH", value: "6.0", unit: "", normalRange: "4.5-8.0", status: "normal" },
      { testName: "Protein", value: "Negative", unit: "", normalRange: "Negative", status: "normal" },
      { testName: "Glucose", value: "Negative", unit: "", normalRange: "Negative", status: "normal" },
      { testName: "WBC", value: "2-3", unit: "/HPF", normalRange: "0-5", status: "normal" },
    ],
    notes: "All parameters normal. Report generated.",
  },
];

const technicians = ["Technician Ravi", "Technician Priya", "Technician Arun", "Technician Meena"];
const emptyTest: Omit<LabTest, "id"> = { name: "", description: "", price: 0, category: "", turnaround: "" };

const LabDashboard = () => {
  const [bookings, setBookings] = useState<LabBooking[]>(mockBookings);
  const [tests, setTests] = useState<LabTest[]>(initialTests);
  const [searchBooking, setSearchBooking] = useState("");
  const [searchTest, setSearchTest] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewBooking, setViewBooking] = useState<LabBooking | null>(null);
  const [editTest, setEditTest] = useState<LabTest | null>(null);
  const [newTest, setNewTest] = useState<Omit<LabTest, "id"> | null>(null);
  const [resultsDialog, setResultsDialog] = useState<LabBooking | null>(null);
  const [editResults, setEditResults] = useState<TestResult[]>([]);
  const [resultNotes, setResultNotes] = useState("");
  const [assignTechnician, setAssignTechnician] = useState("");

  const filteredBookings = bookings.filter(
    (b) =>
      (statusFilter === "all" || b.status === statusFilter) &&
      (b.patientName.toLowerCase().includes(searchBooking.toLowerCase()) || b.id.toLowerCase().includes(searchBooking.toLowerCase()))
  );

  const filteredTests = tests.filter((t) => t.name.toLowerCase().includes(searchTest.toLowerCase()));

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    processing: bookings.filter((b) => b.status === "processing").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    today: bookings.filter((b) => b.collectionDate === "2026-03-29").length,
    revenue: bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.total, 0),
  };

  const updateStatus = (id: string, status: LabBooking["status"]) => {
    setBookings(bookings.map((b) => (b.id === id ? { ...b, status } : b)));
    toast.success(`Booking ${id} updated to ${status}`);
    setViewBooking(null);
  };

  const handleAssignTechnician = (id: string) => {
    if (!assignTechnician) { toast.error("Select a technician"); return; }
    setBookings(bookings.map(b => b.id === id ? {
      ...b, assignedTechnician: assignTechnician, status: "confirmed" as const,
    } : b));
    toast.success(`Technician assigned and booking confirmed`);
    setAssignTechnician("");
    setViewBooking(null);
  };

  const handleMarkCollected = (id: string) => {
    const sampleId = `SMP-2026-${new Date().toISOString().slice(5, 10).replace("-", "")}-${id.replace("LB", "")}`;
    setBookings(bookings.map(b => b.id === id ? { ...b, status: "collected" as const, sampleId } : b));
    toast.success(`Sample collected — ID: ${sampleId}`);
    setViewBooking(null);
  };

  const handleStartProcessing = (id: string) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;
    const results: TestResult[] = booking.tests.map(t => ({
      testName: t.name, value: "", unit: "", normalRange: "", status: "pending" as const,
    }));
    setBookings(bookings.map(b => b.id === id ? { ...b, status: "processing" as const, results } : b));
    toast.success(`Processing started for ${id}`);
    setViewBooking(null);
  };

  const openResultsEntry = (booking: LabBooking) => {
    setResultsDialog(booking);
    setEditResults(booking.results.map(r => ({ ...r })));
    setResultNotes(booking.notes);
  };

  const updateResultValue = (idx: number, field: keyof TestResult, value: string) => {
    setEditResults(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSaveResults = (complete: boolean) => {
    if (!resultsDialog) return;
    setBookings(bookings.map(b => b.id === resultsDialog.id ? {
      ...b,
      results: editResults,
      notes: resultNotes,
      status: complete ? "completed" as const : b.status,
    } : b));
    setResultsDialog(null);
    toast.success(complete ? `Results saved & report completed for ${resultsDialog.id}` : `Results saved for ${resultsDialog.id}`);
  };

  const saveTest = () => {
    if (editTest) {
      setTests(tests.map((t) => (t.id === editTest.id ? editTest : t)));
      toast.success("Test updated");
      setEditTest(null);
    }
  };

  const addTest = () => {
    if (newTest && newTest.name && newTest.price > 0) {
      setTests([...tests, { ...newTest, id: String(Date.now()) }]);
      toast.success("Test added");
      setNewTest(null);
    } else {
      toast.error("Fill name and price");
    }
  };

  const deleteTest = (id: string) => {
    setTests(tests.filter((t) => t.id !== id));
    toast.success("Test removed");
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      collected: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
      processing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };
    return map[s] || "";
  };

  const resultStatusColor = (s: string) => {
    const map: Record<string, string> = {
      normal: "text-green-600", abnormal: "text-yellow-600", critical: "text-destructive", pending: "text-muted-foreground",
    };
    return map[s] || "";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Lab Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Aaroksha Diagnostics</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">Lab Admin</Badge>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total Bookings", value: stats.total, icon: Package, color: "text-primary" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-500" },
            { label: "Processing", value: stats.processing, icon: Beaker, color: "text-purple-500" },
            { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-emerald-500" },
            { label: "Today's Collections", value: stats.today, icon: User, color: "text-primary" },
            { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 flex items-center gap-2">
                <div className={`h-9 w-9 rounded-xl bg-muted flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="bookings">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="results">Results Entry</TabsTrigger>
            <TabsTrigger value="tests">Manage Tests</TabsTrigger>
          </TabsList>

          {/* ============ BOOKINGS TAB ============ */}
          <TabsContent value="bookings" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by patient or booking ID..." value={searchBooking} onChange={(e) => setSearchBooking(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {["all", "pending", "confirmed", "collected", "processing", "completed", "cancelled"].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead className="hidden md:table-cell">Tests</TableHead>
                      <TableHead>Collection</TableHead>
                      <TableHead>Technician</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{b.patientName}</p>
                            <p className="text-[10px] text-muted-foreground">{b.patientAge}y / {b.patientGender}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{b.tests.length} test(s)</TableCell>
                        <TableCell className="text-xs">
                          {new Date(b.collectionDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}, {b.collectionTime}
                        </TableCell>
                        <TableCell className="text-xs">{b.assignedTechnician || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell className="font-semibold">₹{b.total}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor(b.status)}`}>{b.status}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => { setViewBooking(b); setAssignTechnician(b.assignedTechnician); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBookings.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bookings found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ RESULTS ENTRY TAB ============ */}
          <TabsContent value="results" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Results Entry
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {bookings.filter(b => ["processing", "completed"].includes(b.status)).map(b => (
                    <div key={b.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:shadow-sm transition">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-mono text-xs text-primary">{b.id}</p>
                          <p className="font-semibold text-foreground">{b.patientName}</p>
                          <p className="text-xs text-muted-foreground">{b.tests.map(t => t.name).join(", ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {b.sampleId && <Badge variant="outline" className="text-xs font-mono">{b.sampleId}</Badge>}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor(b.status)}`}>{b.status}</span>
                        <Button size="sm" variant={b.status === "completed" ? "outline" : "default"} onClick={() => openResultsEntry(b)}>
                          {b.status === "completed" ? <><Eye className="h-4 w-4 mr-1" /> View</> : <><Edit className="h-4 w-4 mr-1" /> Enter Results</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                  {bookings.filter(b => ["processing", "completed"].includes(b.status)).length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">No samples in processing or completed</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ MANAGE TESTS TAB ============ */}
          <TabsContent value="tests" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tests..." value={searchTest} onChange={(e) => setSearchTest(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={() => setNewTest({ ...emptyTest })} className="gap-2"><Plus className="h-4 w-4" /> Add Test</Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Test Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Turnaround</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTests.map(test => (
                      <TableRow key={test.id}>
                        <TableCell className="font-medium text-foreground">{test.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{test.category}</Badge></TableCell>
                        <TableCell className="font-semibold">₹{test.price}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{test.turnaround}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{test.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditTest(test)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTest(test.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ BOOKING DETAIL DIALOG ============ */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking {viewBooking?.id}</DialogTitle>
          </DialogHeader>
          {viewBooking && (
            <div className="space-y-4">
              <Card className="bg-secondary/30 border-border/40">
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Patient</p>
                    <p className="text-sm font-semibold text-foreground">{viewBooking.patientName}</p>
                    <p className="text-xs text-muted-foreground">{viewBooking.patientAge}y, {viewBooking.patientGender}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Phone</p>
                    <p className="text-sm text-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{viewBooking.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Address</p>
                    <p className="text-sm text-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{viewBooking.address}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Collection</p>
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(viewBooking.collectionDate).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}, {viewBooking.collectionTime}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor(viewBooking.status)}`}>{viewBooking.status}</span>
                  </div>
                  {viewBooking.sampleId && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Sample ID</p>
                      <Badge variant="outline" className="font-mono">{viewBooking.sampleId}</Badge>
                    </div>
                  )}
                  {viewBooking.assignedTechnician && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground uppercase">Assigned Technician</p>
                      <p className="text-sm text-foreground">{viewBooking.assignedTechnician}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Tests Ordered</p>
                <div className="space-y-2">
                  {viewBooking.tests.map((t, i) => (
                    <div key={i} className="flex justify-between text-sm bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-foreground">{t.name}</span>
                      <span className="font-semibold text-foreground">₹{t.price}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                    <span className="text-foreground">Total</span>
                    <span className="text-primary">₹{viewBooking.total}</span>
                  </div>
                </div>
              </div>

              {/* Assign Technician for pending bookings */}
              {viewBooking.status === "pending" && (
                <div className="space-y-2">
                  <Label>Assign Technician</Label>
                  <Select value={assignTechnician} onValueChange={setAssignTechnician}>
                    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="gap-2 flex-wrap">
                {viewBooking.status !== "completed" && viewBooking.status !== "cancelled" && (
                  <Button variant="destructive" size="sm" onClick={() => updateStatus(viewBooking.id, "cancelled")}>
                    <XCircle className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                )}
                {viewBooking.status === "pending" && (
                  <Button size="sm" onClick={() => handleAssignTechnician(viewBooking.id)}>
                    <User className="h-4 w-4 mr-1" /> Assign & Confirm
                  </Button>
                )}
                {viewBooking.status === "confirmed" && (
                  <Button size="sm" onClick={() => handleMarkCollected(viewBooking.id)}>
                    <Beaker className="h-4 w-4 mr-1" /> Mark Collected
                  </Button>
                )}
                {viewBooking.status === "collected" && (
                  <Button size="sm" onClick={() => handleStartProcessing(viewBooking.id)}>
                    <FlaskConical className="h-4 w-4 mr-1" /> Start Processing
                  </Button>
                )}
                {viewBooking.status === "processing" && (
                  <Button size="sm" onClick={() => openResultsEntry(viewBooking)}>
                    <Edit className="h-4 w-4 mr-1" /> Enter Results
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ RESULTS ENTRY DIALOG ============ */}
      <Dialog open={!!resultsDialog} onOpenChange={() => setResultsDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Results — {resultsDialog?.id} ({resultsDialog?.patientName})
            </DialogTitle>
          </DialogHeader>
          {resultsDialog && (
            <div className="space-y-4 mt-2">
              {resultsDialog.sampleId && (
                <Badge variant="outline" className="font-mono">Sample: {resultsDialog.sampleId}</Badge>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Test / Parameter</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Normal Range</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editResults.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-foreground">{r.testName}</TableCell>
                      <TableCell>
                        <Input value={r.value} onChange={e => updateResultValue(idx, "value", e.target.value)}
                          className="h-8 w-24 text-sm" disabled={resultsDialog.status === "completed"} />
                      </TableCell>
                      <TableCell>
                        <Input value={r.unit} onChange={e => updateResultValue(idx, "unit", e.target.value)}
                          className="h-8 w-20 text-sm" disabled={resultsDialog.status === "completed"} />
                      </TableCell>
                      <TableCell>
                        <Input value={r.normalRange} onChange={e => updateResultValue(idx, "normalRange", e.target.value)}
                          className="h-8 w-24 text-sm" disabled={resultsDialog.status === "completed"} />
                      </TableCell>
                      <TableCell>
                        <Select value={r.status} onValueChange={v => updateResultValue(idx, "status", v)} disabled={resultsDialog.status === "completed"}>
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="abnormal">Abnormal</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-2">
                <Label>Lab Notes / Remarks</Label>
                <Textarea value={resultNotes} onChange={e => setResultNotes(e.target.value)}
                  placeholder="Add remarks about results, recommendations..." rows={3}
                  disabled={resultsDialog.status === "completed"} />
              </div>

              {resultsDialog.status === "processing" && (
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => handleSaveResults(false)}>
                    Save Draft
                  </Button>
                  <Button className="flex-1" onClick={() => handleSaveResults(true)}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Complete & Generate Report
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ EDIT TEST DIALOG ============ */}
      <Dialog open={!!editTest} onOpenChange={() => setEditTest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Test</DialogTitle></DialogHeader>
          {editTest && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editTest.name} onChange={(e) => setEditTest({ ...editTest, name: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={editTest.description} onChange={(e) => setEditTest({ ...editTest, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (₹)</Label><Input type="number" value={editTest.price} onChange={(e) => setEditTest({ ...editTest, price: Number(e.target.value) })} /></div>
                <div><Label>Category</Label><Input value={editTest.category} onChange={(e) => setEditTest({ ...editTest, category: e.target.value })} /></div>
              </div>
              <div><Label>Turnaround Time</Label><Input value={editTest.turnaround} onChange={(e) => setEditTest({ ...editTest, turnaround: e.target.value })} /></div>
              <DialogFooter><Button onClick={saveTest}>Save Changes</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ ADD TEST DIALOG ============ */}
      <Dialog open={!!newTest} onOpenChange={() => setNewTest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Test</DialogTitle></DialogHeader>
          {newTest && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (₹)</Label><Input type="number" value={newTest.price} onChange={(e) => setNewTest({ ...newTest, price: Number(e.target.value) })} /></div>
                <div><Label>Category</Label><Input value={newTest.category} onChange={(e) => setNewTest({ ...newTest, category: e.target.value })} /></div>
              </div>
              <div><Label>Turnaround Time</Label><Input value={newTest.turnaround} onChange={(e) => setNewTest({ ...newTest, turnaround: e.target.value })} /></div>
              <DialogFooter><Button onClick={addTest}>Add Test</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LabDashboard;
