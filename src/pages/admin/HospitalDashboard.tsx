import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { doctors as initialDoctors, timeSlots as initialSlots, Doctor, TimeSlot } from "@/data/mockData";
import { Calendar, Clock, Edit, Plus, Search, Stethoscope, Trash2, Users, Activity, CalendarDays } from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  status: "confirmed" | "completed" | "cancelled";
}

const mockAppointments: Appointment[] = [
  { id: "1", patientName: "Ramesh Kumar", doctorName: "Dr. Rajesh Kumar", date: "2026-03-28", time: "09:00 AM", status: "confirmed" },
  { id: "2", patientName: "Sita Devi", doctorName: "Dr. Priya Sharma", date: "2026-03-28", time: "10:30 AM", status: "confirmed" },
  { id: "3", patientName: "Vikram Singh", doctorName: "Dr. Anil Reddy", date: "2026-03-27", time: "02:00 PM", status: "completed" },
  { id: "4", patientName: "Lakshmi Bai", doctorName: "Dr. Sunitha Rao", date: "2026-03-27", time: "11:00 AM", status: "cancelled" },
  { id: "5", patientName: "Arjun Patel", doctorName: "Dr. Meena Kumari", date: "2026-03-28", time: "03:00 PM", status: "confirmed" },
];

const HospitalDashboard = () => {
  const [doctorsList, setDoctorsList] = useState<Doctor[]>(initialDoctors);
  const [slots, setSlots] = useState<TimeSlot[]>(initialSlots);
  const [appointments] = useState<Appointment[]>(mockAppointments);
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchAppointment, setSearchAppointment] = useState("");
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [newDoctor, setNewDoctor] = useState<Partial<Doctor>>({
    name: "", specialty: "", experience: 0, rating: 4.5, fee: 500, image: "👨‍⚕️", available: true,
  });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const filteredDoctors = doctorsList.filter(d =>
    d.name.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    d.specialty.toLowerCase().includes(searchDoctor.toLowerCase())
  );

  const filteredAppointments = appointments.filter(a =>
    a.patientName.toLowerCase().includes(searchAppointment.toLowerCase()) ||
    a.doctorName.toLowerCase().includes(searchAppointment.toLowerCase())
  );

  const handleAddDoctor = () => {
    if (!newDoctor.name || !newDoctor.specialty) {
      toast.error("Please fill in all required fields");
      return;
    }
    const doc: Doctor = {
      id: String(doctorsList.length + 1),
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

  const todayAppointments = appointments.filter(a => a.date === "2026-03-28");
  const confirmedCount = appointments.filter(a => a.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b border-border/40">
        <div className="container mx-auto flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">AAROKSHA</h1>
              <p className="text-xs text-muted-foreground">Hospital Dashboard</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">Admin Panel</Badge>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Doctors", value: doctorsList.length, icon: Users, color: "text-primary" },
            { label: "Today's OPs", value: todayAppointments.length, icon: CalendarDays, color: "text-accent" },
            { label: "Confirmed", value: confirmedCount, icon: Activity, color: "text-green-600" },
            { label: "Available Slots", value: slots.filter(s => s.available).length, icon: Clock, color: "text-primary" },
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

        {/* Main Tabs */}
        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="appointments">OP Appointments</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="slots">Time Slots</TabsTrigger>
          </TabsList>

          {/* Appointments Tab */}
          <TabsContent value="appointments">
            <Card className="glass-card border-border/40">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" /> OP Appointments
                  </CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search appointments..."
                      value={searchAppointment}
                      onChange={e => setSearchAppointment(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppointments.map(apt => (
                        <TableRow key={apt.id}>
                          <TableCell className="font-medium">{apt.patientName}</TableCell>
                          <TableCell>{apt.doctorName}</TableCell>
                          <TableCell>{apt.date}</TableCell>
                          <TableCell>{apt.time}</TableCell>
                          <TableCell>
                            <Badge variant={
                              apt.status === "confirmed" ? "default" :
                              apt.status === "completed" ? "secondary" : "destructive"
                            }>
                              {apt.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Doctors Tab */}
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
                      <Input
                        placeholder="Search..."
                        value={searchDoctor}
                        onChange={e => setSearchDoctor(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Doctor</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Doctor</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-2">
                          <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input value={newDoctor.name} onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })} placeholder="Dr. Full Name" />
                          </div>
                          <div className="space-y-2">
                            <Label>Specialty *</Label>
                            <Input value={newDoctor.specialty} onChange={e => setNewDoctor({ ...newDoctor, specialty: e.target.value })} placeholder="e.g. Cardiologist" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label>Experience (yrs)</Label>
                              <Input type="number" value={newDoctor.experience} onChange={e => setNewDoctor({ ...newDoctor, experience: +e.target.value })} />
                            </div>
                            <div className="space-y-2">
                              <Label>Fee (₹)</Label>
                              <Input type="number" value={newDoctor.fee} onChange={e => setNewDoctor({ ...newDoctor, fee: +e.target.value })} />
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
                        <TableHead>Exp</TableHead>
                        <TableHead>Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDoctors.map(doc => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{doc.image}</span>
                              {doc.name}
                            </div>
                          </TableCell>
                          <TableCell>{doc.specialty}</TableCell>
                          <TableCell>{doc.experience} yrs</TableCell>
                          <TableCell>₹{doc.fee}</TableCell>
                          <TableCell>
                            <Badge variant={doc.available ? "default" : "secondary"}>
                              {doc.available ? "Available" : "Unavailable"}
                            </Badge>
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Doctor</DialogTitle>
                </DialogHeader>
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
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Experience (yrs)</Label>
                        <Input type="number" value={editingDoctor.experience} onChange={e => setEditingDoctor({ ...editingDoctor, experience: +e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Fee (₹)</Label>
                        <Input type="number" value={editingDoctor.fee} onChange={e => setEditingDoctor({ ...editingDoctor, fee: +e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={editingDoctor.available} onCheckedChange={v => setEditingDoctor({ ...editingDoctor, available: v })} />
                      <Label>Available</Label>
                    </div>
                    <Button onClick={handleUpdateDoctor} className="w-full">Save Changes</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Time Slots Tab */}
          <TabsContent value="slots">
            <Card className="glass-card border-border/40">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Manage Time Slots
                </CardTitle>
                <CardDescription>Toggle slot availability for appointments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {slots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => toggleSlot(slot.id)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        slot.available
                          ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                          : "border-border bg-muted/50 opacity-60"
                      }`}
                    >
                      <Clock className={`h-5 w-5 mx-auto mb-1 ${slot.available ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="font-semibold text-foreground">{slot.time}</p>
                      <p className="text-xs mt-1">
                        {slot.available ? (
                          <span className="text-green-600">Available</span>
                        ) : (
                          <span className="text-muted-foreground">Blocked</span>
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default HospitalDashboard;
