import { useState } from "react";
import { FlaskConical, Package, Clock, CheckCircle, XCircle, Search, Plus, Trash2, Edit, Eye, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { labTests as initialTests, type LabTest } from "@/data/mockData";
import { toast } from "sonner";

interface LabBooking {
  id: string;
  patientName: string;
  phone: string;
  address: string;
  tests: { name: string; price: number }[];
  total: number;
  collectionDate: string;
  collectionTime: string;
  status: "pending" | "confirmed" | "collected" | "processing" | "completed" | "cancelled";
  bookedAt: string;
}

const mockBookings: LabBooking[] = [
  { id: "LB001", patientName: "Rahul Verma", phone: "9876543210", address: "12, MG Road, Hyderabad", tests: [{ name: "Complete Blood Count (CBC)", price: 350 }, { name: "Thyroid Profile (T3, T4, TSH)", price: 650 }], total: 1000, collectionDate: "2026-03-29", collectionTime: "09:00 AM", status: "pending", bookedAt: "2026-03-28 10:30 AM" },
  { id: "LB002", patientName: "Sneha Patil", phone: "9123456780", address: "45, Banjara Hills, Hyderabad", tests: [{ name: "Full Body Checkup", price: 2500 }], total: 2500, collectionDate: "2026-03-29", collectionTime: "08:00 AM", status: "confirmed", bookedAt: "2026-03-28 09:15 AM" },
  { id: "LB003", patientName: "Amit Sharma", phone: "9988776655", address: "78, Jubilee Hills, Hyderabad", tests: [{ name: "Lipid Profile", price: 500 }, { name: "Blood Sugar Fasting", price: 150 }, { name: "HbA1c", price: 450 }], total: 1100, collectionDate: "2026-03-28", collectionTime: "07:00 AM", status: "collected", bookedAt: "2026-03-27 04:00 PM" },
  { id: "LB004", patientName: "Priya Reddy", phone: "9876012345", address: "23, Madhapur, Hyderabad", tests: [{ name: "Vitamin D Test", price: 800 }], total: 800, collectionDate: "2026-03-28", collectionTime: "10:00 AM", status: "processing", bookedAt: "2026-03-27 02:00 PM" },
  { id: "LB005", patientName: "Kiran Kumar", phone: "9090909090", address: "56, Kukatpally, Hyderabad", tests: [{ name: "Kidney Function Test (KFT)", price: 550 }, { name: "Liver Function Test (LFT)", price: 600 }], total: 1150, collectionDate: "2026-03-30", collectionTime: "09:00 AM", status: "pending", bookedAt: "2026-03-28 11:00 AM" },
  { id: "LB006", patientName: "Deepa Nair", phone: "9111222333", address: "90, Gachibowli, Hyderabad", tests: [{ name: "Urine Routine", price: 200 }], total: 200, collectionDate: "2026-03-27", collectionTime: "08:00 AM", status: "completed", bookedAt: "2026-03-26 06:00 PM" },
];

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

  const filteredBookings = bookings.filter(
    (b) =>
      (statusFilter === "all" || b.status === statusFilter) &&
      (b.patientName.toLowerCase().includes(searchBooking.toLowerCase()) || b.id.toLowerCase().includes(searchBooking.toLowerCase()))
  );

  const filteredTests = tests.filter((t) => t.name.toLowerCase().includes(searchTest.toLowerCase()));

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    today: bookings.filter((b) => b.collectionDate === new Date().toISOString().split("T")[0]).length,
    revenue: bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.total, 0),
  };

  const updateStatus = (id: string, status: LabBooking["status"]) => {
    setBookings(bookings.map((b) => (b.id === id ? { ...b, status } : b)));
    toast.success(`Booking ${id} updated to ${status}`);
    setViewBooking(null);
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
      setTests([...tests, { ...newTest, id: String(tests.length + 1) }]);
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

  const nextStatus: Record<string, LabBooking["status"]> = {
    pending: "confirmed",
    confirmed: "collected",
    collected: "processing",
    processing: "completed",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Lab Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Aaroksha Diagnostics</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Bookings", value: stats.total, icon: Package, color: "text-primary" },
            { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-500" },
            { label: "Today's Collections", value: stats.today, icon: CheckCircle, color: "text-emerald-500" },
            { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, icon: FlaskConical, color: "text-primary" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="bookings">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="tests">Manage Tests</TabsTrigger>
          </TabsList>

          {/* Bookings Tab */}
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
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.id}</TableCell>
                        <TableCell className="font-medium">{b.patientName}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{b.tests.length} test(s)</TableCell>
                        <TableCell className="text-xs">{new Date(b.collectionDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}, {b.collectionTime}</TableCell>
                        <TableCell className="font-semibold">₹{b.total}</TableCell>
                        <TableCell><span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor(b.status)}`}>{b.status}</span></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setViewBooking(b)}><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBookings.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No bookings found</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tests..." value={searchTest} onChange={(e) => setSearchTest(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={() => setNewTest({ ...emptyTest })} className="gap-2"><Plus className="h-4 w-4" /> Add Test</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTests.map((test) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-foreground">{test.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{test.description}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] ml-2">{test.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-foreground">₹{test.price}</p>
                        <p className="text-[10px] text-muted-foreground">TAT: {test.turnaround}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditTest(test)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTest(test.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Detail Dialog */}
      <Dialog open={!!viewBooking} onOpenChange={() => setViewBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking {viewBooking?.id}</DialogTitle>
          </DialogHeader>
          {viewBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="text-sm font-semibold text-foreground">{viewBooking.patientName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{viewBooking.phone}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{viewBooking.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Collection</p>
                  <p className="text-sm font-semibold text-foreground">{new Date(viewBooking.collectionDate).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}, {viewBooking.collectionTime}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColor(viewBooking.status)}`}>{viewBooking.status}</span>
                </div>
              </div>

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

              <DialogFooter className="gap-2">
                {viewBooking.status !== "completed" && viewBooking.status !== "cancelled" && (
                  <>
                    <Button variant="destructive" size="sm" onClick={() => updateStatus(viewBooking.id, "cancelled")}>
                      <XCircle className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                    {nextStatus[viewBooking.status] && (
                      <Button size="sm" onClick={() => updateStatus(viewBooking.id, nextStatus[viewBooking.status])}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Mark as {nextStatus[viewBooking.status]}
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Test Dialog */}
      <Dialog open={!!editTest} onOpenChange={() => setEditTest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Test</DialogTitle></DialogHeader>
          {editTest && (
            <div className="space-y-3">
              <div><label className="text-sm font-medium text-foreground">Name</label><Input value={editTest.name} onChange={(e) => setEditTest({ ...editTest, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium text-foreground">Description</label><Input value={editTest.description} onChange={(e) => setEditTest({ ...editTest, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-foreground">Price (₹)</label><Input type="number" value={editTest.price} onChange={(e) => setEditTest({ ...editTest, price: Number(e.target.value) })} /></div>
                <div><label className="text-sm font-medium text-foreground">Category</label><Input value={editTest.category} onChange={(e) => setEditTest({ ...editTest, category: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium text-foreground">Turnaround Time</label><Input value={editTest.turnaround} onChange={(e) => setEditTest({ ...editTest, turnaround: e.target.value })} /></div>
              <DialogFooter><Button onClick={saveTest}>Save Changes</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Test Dialog */}
      <Dialog open={!!newTest} onOpenChange={() => setNewTest(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Test</DialogTitle></DialogHeader>
          {newTest && (
            <div className="space-y-3">
              <div><label className="text-sm font-medium text-foreground">Name</label><Input value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium text-foreground">Description</label><Input value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-foreground">Price (₹)</label><Input type="number" value={newTest.price} onChange={(e) => setNewTest({ ...newTest, price: Number(e.target.value) })} /></div>
                <div><label className="text-sm font-medium text-foreground">Category</label><Input value={newTest.category} onChange={(e) => setNewTest({ ...newTest, category: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium text-foreground">Turnaround Time</label><Input value={newTest.turnaround} onChange={(e) => setNewTest({ ...newTest, turnaround: e.target.value })} /></div>
              <DialogFooter><Button onClick={addTest}>Add Test</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LabDashboard;
