import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill, Search, CheckCircle, XCircle, Clock, Eye, Package, IndianRupee, FileText, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface PrescriptionOrder {
  id: string;
  patientName: string;
  phone: string;
  address: string;
  uploadedAt: string;
  imageUrl: string;
  status: "pending" | "approved" | "rejected" | "dispatched";
  medicines: MedicineItem[];
  totalCost: number;
  adminNote: string;
}

interface MedicineItem {
  name: string;
  quantity: number;
  price: number;
  available: boolean;
}

const initialOrders: PrescriptionOrder[] = [
  {
    id: "RX001",
    patientName: "Ramesh Kumar",
    phone: "+91 98765 43210",
    address: "Flat 302, Green Valley Apts, Banjara Hills, Hyderabad",
    uploadedAt: "2026-03-28 09:15 AM",
    imageUrl: "",
    status: "pending",
    medicines: [
      { name: "Amoxicillin 500mg", quantity: 10, price: 0, available: true },
      { name: "Paracetamol 650mg", quantity: 15, price: 0, available: true },
      { name: "Omeprazole 20mg", quantity: 10, price: 0, available: true },
    ],
    totalCost: 0,
    adminNote: "",
  },
  {
    id: "RX002",
    patientName: "Sita Devi",
    phone: "+91 87654 32109",
    address: "House 12, MG Road, Secunderabad",
    uploadedAt: "2026-03-28 10:30 AM",
    imageUrl: "",
    status: "pending",
    medicines: [
      { name: "Metformin 500mg", quantity: 30, price: 0, available: true },
      { name: "Glimepiride 2mg", quantity: 30, price: 0, available: true },
    ],
    totalCost: 0,
    adminNote: "",
  },
  {
    id: "RX003",
    patientName: "Vikram Singh",
    phone: "+91 76543 21098",
    address: "Plot 5, Jubilee Hills, Hyderabad",
    uploadedAt: "2026-03-27 03:45 PM",
    imageUrl: "",
    status: "approved",
    medicines: [
      { name: "Atorvastatin 10mg", quantity: 30, price: 85, available: true },
      { name: "Amlodipine 5mg", quantity: 30, price: 45, available: true },
      { name: "Clopidogrel 75mg", quantity: 15, price: 120, available: false },
    ],
    totalCost: 250,
    adminNote: "Clopidogrel out of stock, suggested alternative.",
  },
  {
    id: "RX004",
    patientName: "Lakshmi Bai",
    phone: "+91 65432 10987",
    address: "Door 8-2, Ameerpet, Hyderabad",
    uploadedAt: "2026-03-27 11:00 AM",
    imageUrl: "",
    status: "dispatched",
    medicines: [
      { name: "Azithromycin 500mg", quantity: 3, price: 95, available: true },
      { name: "Cetirizine 10mg", quantity: 10, price: 25, available: true },
    ],
    totalCost: 120,
    adminNote: "All medicines available. Dispatched via express delivery.",
  },
];

const PharmacyDashboard = () => {
  const [orders, setOrders] = useState<PrescriptionOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PrescriptionOrder | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editMedicines, setEditMedicines] = useState<MedicineItem[]>([]);
  const [adminNote, setAdminNote] = useState("");

  const filtered = orders.filter(o =>
    o.patientName.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  const openReview = (order: PrescriptionOrder) => {
    setSelectedOrder(order);
    setEditMedicines(order.medicines.map(m => ({ ...m })));
    setAdminNote(order.adminNote);
    setReviewDialogOpen(true);
  };

  const updateMedicinePrice = (idx: number, price: number) => {
    setEditMedicines(prev => prev.map((m, i) => i === idx ? { ...m, price } : m));
  };

  const toggleMedicineAvailability = (idx: number) => {
    setEditMedicines(prev => prev.map((m, i) => i === idx ? { ...m, available: !m.available } : m));
  };

  const handleApprove = () => {
    if (!selectedOrder) return;
    const total = editMedicines.filter(m => m.available).reduce((s, m) => s + m.price * m.quantity, 0);
    setOrders(orders.map(o => o.id === selectedOrder.id ? {
      ...o, status: "approved", medicines: editMedicines, totalCost: total, adminNote,
    } : o));
    setReviewDialogOpen(false);
    toast.success(`Prescription ${selectedOrder.id} approved — ₹${total}`);
  };

  const handleReject = () => {
    if (!selectedOrder) return;
    setOrders(orders.map(o => o.id === selectedOrder.id ? {
      ...o, status: "rejected", adminNote,
    } : o));
    setReviewDialogOpen(false);
    toast.error(`Prescription ${selectedOrder.id} rejected`);
  };

  const handleDispatch = (id: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: "dispatched" } : o));
    toast.success(`Order ${id} dispatched for delivery`);
  };

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const approvedCount = orders.filter(o => o.status === "approved").length;
  const dispatchedCount = orders.filter(o => o.status === "dispatched").length;
  const totalRevenue = orders.filter(o => o.status !== "rejected").reduce((s, o) => s + o.totalCost, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-border/40">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
              <Pill className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AAROKSHA</h1>
              <p className="text-xs text-muted-foreground">Pharmacy Dashboard</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">Pharmacy Admin</Badge>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Pending Review", value: pendingCount, icon: Clock, color: "text-accent" },
            { label: "Approved", value: approvedCount, icon: CheckCircle, color: "text-green-600" },
            { label: "Dispatched", value: dispatchedCount, icon: Package, color: "text-primary" },
            { label: "Revenue", value: `₹${totalRevenue}`, icon: TrendingUp, color: "text-primary" },
          ].map((stat) => (
            <Card key={stat.label} className="glass-card border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content */}
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="all">All Orders</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          {["all", "pending", "approved", "dispatched"].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card className="glass-card border-border/40">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Patient</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Medicines</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered
                          .filter(o => tab === "all" || o.status === tab)
                          .map(order => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono font-medium text-primary">{order.id}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{order.patientName}</p>
                                <p className="text-xs text-muted-foreground">{order.phone}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{order.uploadedAt}</TableCell>
                            <TableCell>{order.medicines.length} items</TableCell>
                            <TableCell className="font-semibold">
                              {order.totalCost > 0 ? `₹${order.totalCost}` : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                order.status === "pending" ? "secondary" :
                                order.status === "approved" ? "default" :
                                order.status === "dispatched" ? "outline" : "destructive"
                              }>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openReview(order)}>
                                  <Eye className="h-4 w-4 mr-1" /> Review
                                </Button>
                                {order.status === "approved" && (
                                  <Button size="sm" onClick={() => handleDispatch(order.id)}>
                                    <Package className="h-4 w-4 mr-1" /> Dispatch
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Review Prescription — {selectedOrder?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-5 mt-2">
              {/* Patient Info */}
              <Card className="bg-secondary/30 border-border/40">
                <CardContent className="p-4 space-y-1">
                  <p className="font-semibold text-foreground">{selectedOrder.patientName}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.phone}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.address}</p>
                </CardContent>
              </Card>

              {/* Prescription Image Placeholder */}
              <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Prescription image uploaded by patient</p>
              </div>

              {/* Medicine List */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" /> Medicines
                </h3>
                {editMedicines.map((med, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${med.available ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleMedicineAvailability(idx)}
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
                            med.available ? "border-green-500 bg-green-500" : "border-destructive bg-destructive"
                          }`}
                        >
                          {med.available ? (
                            <CheckCircle className="h-3 w-3 text-primary-foreground" />
                          ) : (
                            <XCircle className="h-3 w-3 text-primary-foreground" />
                          )}
                        </button>
                        <span className={`font-medium ${!med.available ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {med.name}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">Qty: {med.quantity}</span>
                    </div>
                    {med.available && (
                      <div className="flex items-center gap-2 ml-7">
                        <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="Price per unit"
                          value={med.price || ""}
                          onChange={e => updateMedicinePrice(idx, +e.target.value)}
                          className="h-8 w-32 text-sm"
                          disabled={selectedOrder.status !== "pending"}
                        />
                        {med.price > 0 && (
                          <span className="text-sm font-medium text-foreground">
                            = ₹{med.price * med.quantity}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Total */}
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="font-semibold text-foreground">Total Cost</span>
                  <span className="text-xl font-bold text-primary">
                    ₹{editMedicines.filter(m => m.available).reduce((s, m) => s + m.price * m.quantity, 0)}
                  </span>
                </div>
              </div>

              {/* Admin Note */}
              <div className="space-y-2">
                <Label>Note to Patient</Label>
                <Textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder="Add any notes about availability, alternatives, etc."
                  rows={3}
                  disabled={selectedOrder.status !== "pending"}
                />
              </div>

              {/* Actions */}
              {selectedOrder.status === "pending" && (
                <div className="flex gap-3">
                  <Button onClick={handleApprove} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve & Set Price
                  </Button>
                  <Button variant="destructive" onClick={handleReject} className="flex-1">
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              )}
              {selectedOrder.status === "approved" && (
                <Button onClick={() => { handleDispatch(selectedOrder.id); setReviewDialogOpen(false); }} className="w-full">
                  <Package className="h-4 w-4 mr-2" /> Mark as Dispatched
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacyDashboard;
