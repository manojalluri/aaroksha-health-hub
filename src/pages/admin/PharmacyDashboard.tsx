import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pill, Search, CheckCircle, XCircle, Clock, Eye, Package, IndianRupee, FileText, TrendingUp,
  Plus, Edit, Trash2, AlertCircle, Truck, Phone, MapPin, ShoppingCart, BarChart3, Filter
} from "lucide-react";
import { toast } from "sonner";

interface PrescriptionOrder {
  id: string;
  patientName: string;
  phone: string;
  address: string;
  uploadedAt: string;
  status: "pending" | "approved" | "rejected" | "dispatched" | "delivered";
  medicines: MedicineItem[];
  totalCost: number;
  adminNote: string;
  deliveryPartner: string;
  estimatedDelivery: string;
}

interface MedicineItem {
  name: string;
  quantity: number;
  price: number;
  available: boolean;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  expiryDate: string;
  manufacturer: string;
}

const initialOrders: PrescriptionOrder[] = [
  {
    id: "RX001", patientName: "Ramesh Kumar", phone: "+91 98765 43210",
    address: "Flat 302, Green Valley Apts, Banjara Hills, Hyderabad",
    uploadedAt: "2026-03-28 09:15 AM", status: "pending",
    medicines: [
      { name: "Amoxicillin 500mg", quantity: 10, price: 0, available: true },
      { name: "Paracetamol 650mg", quantity: 15, price: 0, available: true },
      { name: "Omeprazole 20mg", quantity: 10, price: 0, available: true },
    ],
    totalCost: 0, adminNote: "", deliveryPartner: "", estimatedDelivery: "",
  },
  {
    id: "RX002", patientName: "Sita Devi", phone: "+91 87654 32109",
    address: "House 12, MG Road, Secunderabad",
    uploadedAt: "2026-03-28 10:30 AM", status: "pending",
    medicines: [
      { name: "Metformin 500mg", quantity: 30, price: 0, available: true },
      { name: "Glimepiride 2mg", quantity: 30, price: 0, available: true },
    ],
    totalCost: 0, adminNote: "", deliveryPartner: "", estimatedDelivery: "",
  },
  {
    id: "RX003", patientName: "Vikram Singh", phone: "+91 76543 21098",
    address: "Plot 5, Jubilee Hills, Hyderabad",
    uploadedAt: "2026-03-27 03:45 PM", status: "approved",
    medicines: [
      { name: "Atorvastatin 10mg", quantity: 30, price: 85, available: true },
      { name: "Amlodipine 5mg", quantity: 30, price: 45, available: true },
      { name: "Clopidogrel 75mg", quantity: 15, price: 120, available: false },
    ],
    totalCost: 3900, adminNote: "Clopidogrel out of stock, suggested alternative.", deliveryPartner: "", estimatedDelivery: "",
  },
  {
    id: "RX004", patientName: "Lakshmi Bai", phone: "+91 65432 10987",
    address: "Door 8-2, Ameerpet, Hyderabad",
    uploadedAt: "2026-03-27 11:00 AM", status: "dispatched",
    medicines: [
      { name: "Azithromycin 500mg", quantity: 3, price: 95, available: true },
      { name: "Cetirizine 10mg", quantity: 10, price: 25, available: true },
    ],
    totalCost: 535, adminNote: "All medicines available. Dispatched via express delivery.",
    deliveryPartner: "Dunzo", estimatedDelivery: "2026-03-28 06:00 PM",
  },
  {
    id: "RX005", patientName: "Anand Verma", phone: "+91 54321 09876",
    address: "Flat 101, Sapphire Tower, Kondapur, Hyderabad",
    uploadedAt: "2026-03-26 02:00 PM", status: "delivered",
    medicines: [
      { name: "Pantoprazole 40mg", quantity: 14, price: 12, available: true },
      { name: "Domperidone 10mg", quantity: 14, price: 8, available: true },
    ],
    totalCost: 280, adminNote: "Delivered successfully.",
    deliveryPartner: "Swiggy Instamart", estimatedDelivery: "2026-03-27 10:00 AM",
  },
  {
    id: "RX006", patientName: "Fatima Begum", phone: "+91 43210 98765",
    address: "House 45, Tolichowki, Hyderabad",
    uploadedAt: "2026-03-28 12:00 PM", status: "rejected",
    medicines: [
      { name: "Controlled Substance X", quantity: 5, price: 0, available: false },
    ],
    totalCost: 0, adminNote: "Prescription not valid for controlled substances. Please visit clinic.",
    deliveryPartner: "", estimatedDelivery: "",
  },
];

const initialInventory: InventoryItem[] = [
  { id: "M001", name: "Paracetamol 650mg", category: "Pain Relief", stock: 500, price: 5, expiryDate: "2027-06-15", manufacturer: "Cipla" },
  { id: "M002", name: "Amoxicillin 500mg", category: "Antibiotic", stock: 200, price: 12, expiryDate: "2027-03-20", manufacturer: "Sun Pharma" },
  { id: "M003", name: "Omeprazole 20mg", category: "Gastric", stock: 300, price: 8, expiryDate: "2027-09-10", manufacturer: "Dr. Reddy's" },
  { id: "M004", name: "Metformin 500mg", category: "Diabetes", stock: 450, price: 6, expiryDate: "2027-12-01", manufacturer: "USV" },
  { id: "M005", name: "Atorvastatin 10mg", category: "Cardio", stock: 180, price: 85, expiryDate: "2027-08-22", manufacturer: "Lupin" },
  { id: "M006", name: "Amlodipine 5mg", category: "Cardio", stock: 220, price: 45, expiryDate: "2027-11-30", manufacturer: "Cipla" },
  { id: "M007", name: "Azithromycin 500mg", category: "Antibiotic", stock: 150, price: 95, expiryDate: "2027-04-15", manufacturer: "Zydus" },
  { id: "M008", name: "Cetirizine 10mg", category: "Allergy", stock: 600, price: 25, expiryDate: "2028-01-10", manufacturer: "Mankind" },
  { id: "M009", name: "Pantoprazole 40mg", category: "Gastric", stock: 350, price: 12, expiryDate: "2027-07-08", manufacturer: "Alkem" },
  { id: "M010", name: "Clopidogrel 75mg", category: "Cardio", stock: 0, price: 120, expiryDate: "2027-05-25", manufacturer: "Torrent" },
  { id: "M011", name: "Glimepiride 2mg", category: "Diabetes", stock: 280, price: 15, expiryDate: "2027-10-18", manufacturer: "Glenmark" },
  { id: "M012", name: "Domperidone 10mg", category: "Gastric", stock: 400, price: 8, expiryDate: "2028-02-28", manufacturer: "Cipla" },
];

const PharmacyDashboard = () => {
  const [orders, setOrders] = useState<PrescriptionOrder[]>(initialOrders);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [search, setSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<PrescriptionOrder | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editMedicines, setEditMedicines] = useState<MedicineItem[]>([]);
  const [adminNote, setAdminNote] = useState("");
  const [deliveryPartner, setDeliveryPartner] = useState("");
  const [editInventoryItem, setEditInventoryItem] = useState<InventoryItem | null>(null);
  const [addInventoryOpen, setAddInventoryOpen] = useState(false);
  const [newInventory, setNewInventory] = useState<Omit<InventoryItem, "id">>({
    name: "", category: "", stock: 0, price: 0, expiryDate: "", manufacturer: "",
  });

  const filtered = orders.filter(o => {
    const matchesSearch = o.patientName.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredInventory = inventory.filter(i =>
    i.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
    i.category.toLowerCase().includes(inventorySearch.toLowerCase())
  );

  const openReview = (order: PrescriptionOrder) => {
    setSelectedOrder(order);
    setEditMedicines(order.medicines.map(m => ({ ...m })));
    setAdminNote(order.adminNote);
    setDeliveryPartner(order.deliveryPartner);
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
      ...o, status: "approved" as const, medicines: editMedicines, totalCost: total, adminNote,
    } : o));
    setReviewDialogOpen(false);
    toast.success(`Prescription ${selectedOrder.id} approved — ₹${total}`);
  };

  const handleReject = () => {
    if (!selectedOrder) return;
    if (!adminNote.trim()) { toast.error("Please add a reason for rejection"); return; }
    setOrders(orders.map(o => o.id === selectedOrder.id ? {
      ...o, status: "rejected" as const, adminNote,
    } : o));
    setReviewDialogOpen(false);
    toast.error(`Prescription ${selectedOrder.id} rejected`);
  };

  const handleDispatch = (id: string) => {
    setOrders(orders.map(o => o.id === id ? {
      ...o, status: "dispatched" as const,
      deliveryPartner: deliveryPartner || "Standard Delivery",
      estimatedDelivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString(),
    } : o));
    toast.success(`Order ${id} dispatched for delivery`);
    setReviewDialogOpen(false);
  };

  const handleMarkDelivered = (id: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: "delivered" as const } : o));
    toast.success(`Order ${id} marked as delivered`);
    setReviewDialogOpen(false);
  };

  const handleAddInventory = () => {
    if (!newInventory.name || newInventory.price <= 0) { toast.error("Fill name and price"); return; }
    setInventory([...inventory, { ...newInventory, id: `M${String(inventory.length + 1).padStart(3, "0")}` }]);
    setNewInventory({ name: "", category: "", stock: 0, price: 0, expiryDate: "", manufacturer: "" });
    setAddInventoryOpen(false);
    toast.success("Medicine added to inventory");
  };

  const handleUpdateInventory = () => {
    if (!editInventoryItem) return;
    setInventory(inventory.map(i => i.id === editInventoryItem.id ? editInventoryItem : i));
    setEditInventoryItem(null);
    toast.success("Inventory updated");
  };

  const handleDeleteInventory = (id: string) => {
    setInventory(inventory.filter(i => i.id !== id));
    toast.success("Medicine removed from inventory");
  };

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const approvedCount = orders.filter(o => o.status === "approved").length;
  const dispatchedCount = orders.filter(o => o.status === "dispatched").length;
  const deliveredCount = orders.filter(o => o.status === "delivered").length;
  const totalRevenue = orders.filter(o => ["approved", "dispatched", "delivered"].includes(o.status)).reduce((s, o) => s + o.totalCost, 0);
  const lowStockCount = inventory.filter(i => i.stock > 0 && i.stock < 50).length;
  const outOfStockCount = inventory.filter(i => i.stock === 0).length;

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary", approved: "default", dispatched: "outline", delivered: "default", rejected: "destructive",
    };
    return map[status] || "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Pending", value: pendingCount, icon: Clock, color: "text-accent" },
            { label: "Approved", value: approvedCount, icon: CheckCircle, color: "text-green-600" },
            { label: "Dispatched", value: dispatchedCount, icon: Truck, color: "text-primary" },
            { label: "Delivered", value: deliveredCount, icon: Package, color: "text-primary" },
            { label: "Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
            { label: "Low Stock", value: lowStockCount, icon: AlertCircle, color: "text-yellow-600" },
            { label: "Out of Stock", value: outOfStockCount, icon: XCircle, color: "text-destructive" },
          ].map((stat) => (
            <Card key={stat.label} className="glass-card border-border/40">
              <CardContent className="p-3 flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="prescriptions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="prescriptions">Prescription Orders</TabsTrigger>
            <TabsTrigger value="inventory">Medicine Inventory ({inventory.length})</TabsTrigger>
          </TabsList>

          {/* ============ PRESCRIPTION ORDERS TAB ============ */}
          <TabsContent value="prescriptions" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {["all", "pending", "approved", "dispatched", "delivered", "rejected"].map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                      statusFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

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
                        <TableHead>Delivery</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(order => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono font-medium text-primary">{order.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{order.patientName}</p>
                              <p className="text-xs text-muted-foreground">{order.phone}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{order.uploadedAt}</TableCell>
                          <TableCell>{order.medicines.length} items</TableCell>
                          <TableCell className="font-semibold">
                            {order.totalCost > 0 ? `₹${order.totalCost}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadge(order.status)}>{order.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {order.deliveryPartner || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openReview(order)}>
                                <Eye className="h-4 w-4 mr-1" /> Review
                              </Button>
                              {order.status === "approved" && (
                                <Button size="sm" onClick={() => handleDispatch(order.id)}>
                                  <Truck className="h-4 w-4 mr-1" /> Dispatch
                                </Button>
                              )}
                              {order.status === "dispatched" && (
                                <Button size="sm" variant="outline" onClick={() => handleMarkDelivered(order.id)}>
                                  <CheckCircle className="h-4 w-4 mr-1" /> Delivered
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No orders found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ INVENTORY TAB ============ */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search medicines..." value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} className="pl-9" />
              </div>
              <Button onClick={() => setAddInventoryOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Medicine
              </Button>
            </div>

            <Card className="glass-card border-border/40">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Price/Unit</TableHead>
                        <TableHead>Manufacturer</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">{item.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                          <TableCell>
                            <span className={`font-semibold ${item.stock === 0 ? "text-destructive" : item.stock < 50 ? "text-yellow-600" : "text-foreground"}`}>
                              {item.stock}
                            </span>
                            {item.stock === 0 && <Badge variant="destructive" className="ml-2 text-[10px]">Out</Badge>}
                            {item.stock > 0 && item.stock < 50 && <Badge variant="outline" className="ml-2 text-[10px] border-yellow-500 text-yellow-600">Low</Badge>}
                          </TableCell>
                          <TableCell>₹{item.price}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.manufacturer}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.expiryDate}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setEditInventoryItem({ ...item })}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteInventory(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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
        </Tabs>
      </div>

      {/* ============ REVIEW DIALOG ============ */}
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
              <Card className="bg-secondary/30 border-border/40">
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Patient</p>
                    <p className="font-semibold text-foreground">{selectedOrder.patientName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Phone</p>
                    <p className="text-sm text-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{selectedOrder.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Address</p>
                    <p className="text-sm text-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedOrder.address}</p>
                  </div>
                  {selectedOrder.deliveryPartner && (
                    <>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Delivery Partner</p>
                        <p className="text-sm text-foreground">{selectedOrder.deliveryPartner}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">ETA</p>
                        <p className="text-sm text-foreground">{selectedOrder.estimatedDelivery}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Prescription image uploaded by patient</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" /> Medicines
                </h3>
                {editMedicines.map((med, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border ${med.available ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleMedicineAvailability(idx)}
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${
                            med.available ? "border-green-500 bg-green-500" : "border-destructive bg-destructive"
                          }`}>
                          {med.available ? <CheckCircle className="h-3 w-3 text-primary-foreground" /> : <XCircle className="h-3 w-3 text-primary-foreground" />}
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
                        <Input type="number" placeholder="Price per unit" value={med.price || ""} onChange={e => updateMedicinePrice(idx, +e.target.value)}
                          className="h-8 w-32 text-sm" disabled={!["pending"].includes(selectedOrder.status)} />
                        {med.price > 0 && <span className="text-sm font-medium text-foreground">= ₹{med.price * med.quantity}</span>}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="font-semibold text-foreground">Total Cost</span>
                  <span className="text-xl font-bold text-primary">
                    ₹{editMedicines.filter(m => m.available).reduce((s, m) => s + m.price * m.quantity, 0)}
                  </span>
                </div>
              </div>

              {selectedOrder.status === "approved" && (
                <div className="space-y-2">
                  <Label>Delivery Partner</Label>
                  <Select value={deliveryPartner} onValueChange={setDeliveryPartner}>
                    <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard Delivery">Standard Delivery</SelectItem>
                      <SelectItem value="Dunzo">Dunzo</SelectItem>
                      <SelectItem value="Swiggy Instamart">Swiggy Instamart</SelectItem>
                      <SelectItem value="Self Pickup">Self Pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Note to Patient</Label>
                <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
                  placeholder="Add notes about availability, alternatives, rejection reason..." rows={3}
                  disabled={!["pending"].includes(selectedOrder.status)} />
              </div>

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
                <Button onClick={() => handleDispatch(selectedOrder.id)} className="w-full">
                  <Truck className="h-4 w-4 mr-2" /> Dispatch for Delivery
                </Button>
              )}
              {selectedOrder.status === "dispatched" && (
                <Button onClick={() => handleMarkDelivered(selectedOrder.id)} className="w-full">
                  <Package className="h-4 w-4 mr-2" /> Mark as Delivered
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ ADD INVENTORY DIALOG ============ */}
      <Dialog open={addInventoryOpen} onOpenChange={setAddInventoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Medicine to Inventory</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Medicine Name *</Label><Input value={newInventory.name} onChange={e => setNewInventory({ ...newInventory, name: e.target.value })} placeholder="e.g. Paracetamol 500mg" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label><Input value={newInventory.category} onChange={e => setNewInventory({ ...newInventory, category: e.target.value })} placeholder="e.g. Pain Relief" /></div>
              <div><Label>Manufacturer</Label><Input value={newInventory.manufacturer} onChange={e => setNewInventory({ ...newInventory, manufacturer: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Stock</Label><Input type="number" value={newInventory.stock} onChange={e => setNewInventory({ ...newInventory, stock: +e.target.value })} /></div>
              <div><Label>Price (₹)</Label><Input type="number" value={newInventory.price} onChange={e => setNewInventory({ ...newInventory, price: +e.target.value })} /></div>
              <div><Label>Expiry</Label><Input type="date" value={newInventory.expiryDate} onChange={e => setNewInventory({ ...newInventory, expiryDate: e.target.value })} /></div>
            </div>
            <Button onClick={handleAddInventory} className="w-full">Add to Inventory</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ EDIT INVENTORY DIALOG ============ */}
      <Dialog open={!!editInventoryItem} onOpenChange={() => setEditInventoryItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Medicine — {editInventoryItem?.id}</DialogTitle></DialogHeader>
          {editInventoryItem && (
            <div className="space-y-3 mt-2">
              <div><Label>Medicine Name</Label><Input value={editInventoryItem.name} onChange={e => setEditInventoryItem({ ...editInventoryItem, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={editInventoryItem.category} onChange={e => setEditInventoryItem({ ...editInventoryItem, category: e.target.value })} /></div>
                <div><Label>Manufacturer</Label><Input value={editInventoryItem.manufacturer} onChange={e => setEditInventoryItem({ ...editInventoryItem, manufacturer: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Stock</Label><Input type="number" value={editInventoryItem.stock} onChange={e => setEditInventoryItem({ ...editInventoryItem, stock: +e.target.value })} /></div>
                <div><Label>Price (₹)</Label><Input type="number" value={editInventoryItem.price} onChange={e => setEditInventoryItem({ ...editInventoryItem, price: +e.target.value })} /></div>
                <div><Label>Expiry</Label><Input type="date" value={editInventoryItem.expiryDate} onChange={e => setEditInventoryItem({ ...editInventoryItem, expiryDate: e.target.value })} /></div>
              </div>
              <Button onClick={handleUpdateInventory} className="w-full">Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PharmacyDashboard;
