import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { doctors as initialDoctors, timeSlots as initialSlots, Doctor, TimeSlot } from "@/data/mockData";
import {
  Calendar, Clock, Edit, Plus, Search, Stethoscope, Trash2, Users, Activity, CalendarDays,
  Eye, CheckCircle, XCircle, Phone, MapPin, IndianRupee, TrendingUp, Filter, Download,
  UserCheck, AlertTriangle, Star
} from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientAge: string;
  patientGender: string;
  doctorName: string;
  doctorId: string;
  date: string;
  time: string;
  status: "confirmed" | "completed" | "cancelled" | "no-show";
  fee: number;
  notes: string;
  bookedAt: string;
}

const mockAppointments: Appointment[] = [
  { id: "OP001", patientName: "Ramesh Kumar", patientPhone: "+91 98765 43210", patientAge: "45", patientGender: "Male", doctorName: "Dr. Rajesh Kumar", doctorId: "1", date: "2026-03-29", time: "09:00 AM", status: "confirmed", fee: 500, notes: "", bookedAt: "2026-03-28 08:30 AM" },
  { id: "OP002", patientName: "Sita Devi", patientPhone: "+91 87654 32109", patientAge: "38", patientGender: "Female", doctorName: "Dr. Priya Sharma", doctorId: "2", date: "2026-03-29", time: "10:30 AM", status: "confirmed", fee: 800, notes: "", bookedAt: "2026-03-28 09:15 AM" },
  { id: "OP003", patientName: "Vikram Singh", patientPhone: "+91 76543 21098", patientAge: "52", patientGender: "Male", doctorName: "Dr. Anil Reddy", doctorId: "3", date: "2026-03-28", time: "02:00 PM", status: "completed", fee: 700, notes: "Follow-up in 2 weeks", bookedAt: "2026-03-27 10:00 AM" },
  { id: "OP004", patientName: "Lakshmi Bai", patientPhone: "+91 65432 10987", patientAge: "60", patientGender: "Female", doctorName: "Dr. Sunitha Rao", doctorId: "4", date: "2026-03-28", time: "11:00 AM", status: "cancelled", fee: 600, notes: "Patient cancelled due to emergency", bookedAt: "2026-03-27 11:30 AM" },
  { id: "OP005", patientName: "Arjun Patel", patientPhone: "+91 54321 09876", patientAge: "28", patientGender: "Male", doctorName: "Dr. Meena Kumari", doctorId: "6", date: "2026-03-29", time: "03:00 PM", status: "confirmed", fee: 550, notes: "", bookedAt: "2026-03-28 02:00 PM" },
  { id: "OP006", patientName: "Kavitha Rao", patientPhone: "+91 43210 98765", patientAge: "35", patientGender: "Female", doctorName: "Dr. Kavitha Nair", doctorId: "8", date: "2026-03-28", time: "09:30 AM", status: "completed", fee: 750, notes: "Prescribed routine checkup tests", bookedAt: "2026-03-27 06:00 PM" },
  { id: "OP007", patientName: "Suresh Reddy", patientPhone: "+91 32109 87654", patientAge: "55", patientGender: "Male", doctorName: "Dr. Rajesh Kumar", doctorId: "1", date: "2026-03-29", time: "09:30 AM", status: "confirmed", fee: 500, notes: "", bookedAt: "2026-03-28 04:00 PM" },
  { id: "OP008", patientName: "Meena Kumari", patientPhone: "+91 21098 76543", patientAge: "42", patientGender: "Female", doctorName: "Dr. Srinivas Gupta", doctorId: "7", date: "2026-03-27", time: "04:00 PM", status: "no-show", fee: 650, notes: "Patient did not show up", bookedAt: "2026-03-26 03:00 PM" },
];

const HospitalDashboard = () => {
  const [doctorsList, setDoctorsList] = useState<Doctor[]>(initialDoctors);
  const [slots, setSlots] = useState<TimeSlot[]>(initialSlots);
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchAppointment, setSearchAppointment] = useState("");
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    name: "", specialty: "", experience: 0, rating: 4.5, fee: 500, image: "👨‍⚕️", available: true,
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(null);
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState("");

  const filteredDoctors = doctorsList.filter(d =>
    d.name.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    d.specialty.toLowerCase().includes(searchDoctor.toLowerCase())
  );

  const filteredAppointments = appointments.filter(a => {
    const matchesSearch = a.patientName.toLowerCase().includes(searchAppointment.toLowerCase()) ||
      a.doctorName.toLowerCase().includes(searchAppointment.toLowerCase()) ||
      a.id.toLowerCase().includes(searchAppointment.toLowerCase());
    const matchesDate = dateFilter === "all" || a.date === dateFilter;
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    const matchesDoctor = doctorFilter === "all" || a.doctorId === doctorFilter;
    return matchesSearch && matchesDate && matchesStatus && matchesDoctor;
  });

  const handleAddDoctor = () => {
    if (!newDoctor.name || !newDoctor.specialty) {
      toast.error("Please fill in all required fields");
      return;
    }
    const doc: Doctor = {
      id: String(Date.now()),
      name: newDoctor.name!,
      specialty: newDoctor.specialty!,
      experience: newDoctor.experience || 0,
      rating: newDoctor.rating || 4.5,
      fee: newDoctor.fee || 500,
      image: newDoctor.image || "👨‍⚕️",
      available: newDoctor.available ?? true,
    };
    setDoctorsList([...doctorsList, doc]);
    setNewDoctor({ name: "", specialty: "", experience: 0, rating: 4.5, fee: 500, image: "👨‍⚕️", available: true });
    setAddDialogOpen(false);
    toast.success("Doctor added successfully");
  };

  const handleUpdateDoctor = () => {
    if (!editingDoctor) return;
    setDoctorsList(doctorsList.map(d => d.id === editingDoctor.id ? editingDoctor : d));
    setEditDialogOpen(false);
    setEditingDoctor(null);
    toast.success("Doctor updated successfully");
  };

  const handleDeleteDoctor = (id: string) => {
    setDoctorsList(doctorsList.filter(d => d.id !== id));
    toast.success("Doctor removed");
  };

  const toggleSlot = (id: string) => {
    setSlots(slots.map(s => s.id === id ? { ...s, available: !s.available } : s));
    toast.success("Slot updated");
  };

  const handleAddSlot = () => {
    if (!newSlotTime) { toast.error("Enter a time"); return; }
    setSlots([...slots, { id: String(Date.now()), time: newSlotTime, available: true }]);
    setNewSlotTime("");
    setAddSlotOpen(false);
    toast.success("New slot added");
  };

  const handleDeleteSlot = (id: string) => {
    setSlots(slots.filter(s => s.id !== id));
    toast.success("Slot removed");
  };

  const updateAppointmentStatus = (id: string, status: Appointment["status"]) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status, notes: appointmentNotes || a.notes } : a));
    toast.success(`Appointment ${id} marked as ${status}`);
    setViewAppointment(null);
    setAppointmentNotes("");
  };

  const todayDate = "2026-03-29";
  const todayAppointments = appointments.filter(a => a.date === todayDate);
  const confirmedCount = appointments.filter(a => a.status === "confirmed").length;
  const completedCount = appointments.filter(a => a.status === "completed").length;
  const totalRevenue = appointments.filter(a => a.status === "completed").reduce((s, a) => s + a.fee, 0);
  const noShowCount = appointments.filter(a => a.status === "no-show").length;
  const uniqueDates = [...new Set(appointments.map(a => a.date))].sort();

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      confirmed: "default",
      completed: "secondary",
      cancelled: "destructive",
      "no-show": "outline",
    };
    return map[status] || "secondary";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass-card border-b border-border/40">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AAROKSHA</h1>
              <p className="text-xs text-muted-foreground">Hospital Admin Dashboard</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">Admin Panel</Badge>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Doctors", value: doctorsList.length, icon: Users, color: "text-primary" },
            { label: "Today's OPs", value: todayAppointments.length, icon: CalendarDays, color: "text-accent" },
            { label: "Confirmed", value: confirmedCount, icon: CheckCircle, color: "text-green-600" },
            { label: "Completed", value: completedCount, icon: UserCheck, color: "text-primary" },
            { label: "No Shows", value: noShowCount, icon: AlertTriangle, color: "text-destructive" },
            { label: "Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
          ].map((stat) => (
            <Card key={stat.label} className="glass-card border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="appointments">OP Appointments</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="slots">Time Slots</TabsTrigger>
          </TabsList>

          {/* ============ APPOINTMENTS TAB ============ */}
          <TabsContent value="appointments">
            <Card className="glass-card border-border/40">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" /> OP Appointments
                    </CardTitle>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search patient, doctor, ID..." value={searchAppointment} onChange={e => setSearchAppointment(e.target.value)} className="pl-9" />
                    </div>
                  </div>
                  {/* Filters */}
                  <div className="flex flex-wrap gap-2">
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <Filter className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Dates</SelectItem>
                        {uniqueDates.map(d => (
                          <SelectItem key={d} value={d}>{new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no-show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue placeholder="Doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Doctors</SelectItem>
                        {doctorsList.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(dateFilter !== "all" || statusFilter !== "all" || doctorFilter !== "all") && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDateFilter("all"); setStatusFilter("all"); setDoctorFilter("all"); }}>
                        <XCircle className="h-3 w-3 mr-1" /> Clear Filters
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OP ID</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.map(apt => (
                        <TableRow key={apt.id}>
                          <TableCell className="font-mono text-xs text-primary">{apt.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{apt.patientName}</p>
                              <p className="text-[10px] text-muted-foreground">{apt.patientAge}y / {apt.patientGender}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{apt.doctorName}</TableCell>
                          <TableCell className="text-xs">
                            <p className="text-foreground">{new Date(apt.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
                            <p className="text-muted-foreground">{apt.time}</p>
                          </TableCell>
                          <TableCell className="font-semibold">₹{apt.fee}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadge(apt.status)}>{apt.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setViewAppointment(apt); setAppointmentNotes(apt.notes); }}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                              {apt.status === "confirmed" && (
                                <>
                                  <Button size="sm" variant="default" onClick={() => updateAppointmentStatus(apt.id, "completed")}>
                                    <CheckCircle className="h-3 w-3 mr-1" /> Complete
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => updateAppointmentStatus(apt.id, "no-show")}>
                                    <AlertTriangle className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredAppointments.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No appointments found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 text-xs text-muted-foreground text-right">
                  Showing {filteredAppointments.length} of {appointments.length} appointments
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ DOCTORS TAB ============ */}
          <TabsContent value="doctors">
            <Card className="glass-card border-border/40">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" /> Manage Doctors
                  </CardTitle>
                  <div className="flex gap-2">
                    <div className="relative w-full sm:w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search..." value={searchDoctor} onChange={e => setSearchDoctor(e.target.value)} className="pl-9" />
                    </div>
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Doctor</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add New Doctor</DialogTitle></DialogHeader>
                        <div className="space-y-4 mt-2">
                          <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input value={newDoctor.name} onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })} placeholder="Dr. Full Name" />
                          </div>
                          <div className="space-y-2">
                            <Label>Specialty *</Label>
                            <Input value={newDoctor.specialty} onChange={e => setNewDoctor({ ...newDoctor, specialty: e.target.value })} placeholder="e.g. Cardiologist" />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label>Experience (yrs)</Label>
                              <Input type="number" value={newDoctor.experience} onChange={e => setNewDoctor({ ...newDoctor, experience: +e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Fee (₹)</Label>
                              <Input type="number" value={newDoctor.fee} onChange={e => setNewDoctor({ ...newDoctor, fee: +e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Rating</Label>
                              <Input type="number" step="0.1" min="1" max="5" value={newDoctor.rating} onChange={e => setNewDoctor({ ...newDoctor, rating: +e.target.value })} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Emoji Icon</Label>
                            <div className="flex gap-2">
                              {["👨‍⚕️", "👩‍⚕️"].map(emoji => (
                                <button key={emoji} onClick={() => setNewDoctor({ ...newDoctor, image: emoji })}
                                  className={`text-2xl p-2 rounded-lg border-2 transition ${newDoctor.image === emoji ? "border-primary bg-primary/10" : "border-border"}`}>
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                          <Button onClick={handleAddDoctor} className="w-full">Add Doctor</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Specialty</TableHead>
                        <TableHead>Experience</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Today's OPs</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDoctors.map(doc => {
                        const docAppointments = appointments.filter(a => a.doctorId === doc.id && a.date === todayDate && a.status === "confirmed").length;
                        return (
                          <TableRow key={doc.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{doc.image}</span>
                                {doc.name}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{doc.specialty}</Badge></TableCell>
                            <TableCell>{doc.experience} yrs</TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {doc.rating}
                              </span>
                            </TableCell>
                            <TableCell className="font-semibold">₹{doc.fee}</TableCell>
                            <TableCell>
                              <Badge variant={doc.available ? "default" : "secondary"}>
                                {doc.available ? "Available" : "Unavailable"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{docAppointments} patients</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setEditingDoctor({ ...doc }); setEditDialogOpen(true); }}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeleteDoctor(doc.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Doctor</DialogTitle></DialogHeader>
                {editingDoctor && (
                  <div className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input value={editingDoctor.name} onChange={e => setEditingDoctor({ ...editingDoctor, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Specialty</Label>
                      <Input value={editingDoctor.specialty} onChange={e => setEditingDoctor({ ...editingDoctor, specialty: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Experience (yrs)</Label>
                        <Input type="number" value={editingDoctor.experience} onChange={e => setEditingDoctor({ ...editingDoctor, experience: +e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fee (₹)</Label>
                        <Input type="number" value={editingDoctor.fee} onChange={e => setEditingDoctor({ ...editingDoctor, fee: +e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Rating</Label>
                        <Input type="number" step="0.1" min="1" max="5" value={editingDoctor.rating} onChange={e => setEditingDoctor({ ...editingDoctor, rating: +e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={editingDoctor.available} onCheckedChange={v => setEditingDoctor({ ...editingDoctor, available: v })} />
                      <Label>Available for Appointments</Label>
                    </div>
                    <Button onClick={handleUpdateDoctor} className="w-full">Save Changes</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============ TIME SLOTS TAB ============ */}
          <TabsContent value="slots">
            <Card className="glass-card border-border/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" /> Manage Time Slots
                    </CardTitle>
                    <CardDescription>Toggle availability or add/remove slots</CardDescription>
                  </div>
                  <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Slot</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add New Time Slot</DialogTitle></DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div className="space-y-2">
                          <Label>Time (e.g. 05:00 PM)</Label>
                          <Input value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} placeholder="e.g. 05:00 PM" />
                        </div>
                        <Button onClick={handleAddSlot} className="w-full">Add Slot</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {slots.map(slot => (
                    <div key={slot.id} className={`p-4 rounded-xl border-2 text-center transition-all relative group ${
                      slot.available ? "border-primary/30 bg-primary/5" : "border-border bg-muted/50 opacity-60"
                    }`}>
                      <button onClick={() => handleDeleteSlot(slot.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-destructive/10">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                      <button onClick={() => toggleSlot(slot.id)} className="w-full">
                        <Clock className={`h-5 w-5 mx-auto mb-1 ${slot.available ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="font-semibold text-foreground">{slot.time}</p>
                        <p className="text-xs mt-1">
                          {slot.available ? <span className="text-green-600">Available</span> : <span className="text-muted-foreground">Blocked</span>}
                        </p>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary/20 border border-primary/30" /> Available ({slots.filter(s => s.available).length})</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-muted border border-border" /> Blocked ({slots.filter(s => !s.available).length})</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ APPOINTMENT DETAIL DIALOG ============ */}
      <Dialog open={!!viewAppointment} onOpenChange={() => setViewAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Appointment {viewAppointment?.id}
            </DialogTitle>
          </DialogHeader>
          {viewAppointment && (
            <div className="space-y-4">
              <Card className="bg-secondary/30 border-border/40">
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Patient</p>
                    <p className="font-semibold text-foreground">{viewAppointment.patientName}</p>
                    <p className="text-xs text-muted-foreground">{viewAppointment.patientAge}y, {viewAppointment.patientGender}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Phone</p>
                    <p className="text-sm text-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {viewAppointment.patientPhone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Doctor</p>
                    <p className="text-sm font-medium text-foreground">{viewAppointment.doctorName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Schedule</p>
                    <p className="text-sm text-foreground">{new Date(viewAppointment.date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}, {viewAppointment.time}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Fee</p>
                    <p className="text-sm font-bold text-primary">₹{viewAppointment.fee}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                    <Badge variant={statusBadge(viewAppointment.status)}>{viewAppointment.status}</Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Booked At</p>
                    <p className="text-xs text-muted-foreground">{viewAppointment.bookedAt}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Doctor's Notes / Remarks</Label>
                <Textarea value={appointmentNotes} onChange={e => setAppointmentNotes(e.target.value)} placeholder="Add consultation notes, follow-up instructions..." rows={3} />
              </div>

              {viewAppointment.status === "confirmed" && (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => updateAppointmentStatus(viewAppointment.id, "completed")}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Mark Completed
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => updateAppointmentStatus(viewAppointment.id, "no-show")}>
                    <AlertTriangle className="h-4 w-4 mr-2" /> No Show
                  </Button>
                  <Button variant="destructive" onClick={() => updateAppointmentStatus(viewAppointment.id, "cancelled")}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {viewAppointment.status !== "confirmed" && viewAppointment.notes && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{viewAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HospitalDashboard;
