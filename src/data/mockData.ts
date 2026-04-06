export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  experience: number;
  rating: number;
  fee: number;
  image: string;
  available: boolean;
  hospitalId?: string;
  hospitalName?: string;
}

export interface Hospital {
  id: string;
  name: string;
  location: string;
  rating: number;
  image: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface LabTest {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  turnaround: string;
}

export interface CartItem {
  test: LabTest;
  quantity: number;
}

export interface PatientDetails {
  name: string;
  age: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
}

export const hospitals: Hospital[] = [
  { id: "h1", name: "Apollo Clinics", location: "Banjara Hills", rating: 4.8, image: "🏥" },
  { id: "h2", name: "Yashoda Hospitals", location: "Secunderabad", rating: 4.9, image: "🏥" },
  { id: "h3", name: "Care Hospitals", location: "Hi-Tech City", rating: 4.7, image: "🏥" },
  { id: "h4", name: "KIMS Hospital", location: "Kondapur", rating: 4.6, image: "🏥" },
];

export const doctors: Doctor[] = [
  { id: "1", name: "Dr. Rajesh Kumar", specialty: "General Physician", experience: 15, rating: 4.8, fee: 500, image: "👨‍⚕️", available: true, hospitalId: "h1", hospitalName: "Apollo Clinics" },
  { id: "2", name: "Dr. Priya Sharma", specialty: "Cardiologist", experience: 12, rating: 4.9, fee: 800, image: "👩‍⚕️", available: true, hospitalId: "h2", hospitalName: "Yashoda Hospitals" },
  { id: "3", name: "Dr. Anil Reddy", specialty: "Orthopedic", experience: 20, rating: 4.7, fee: 700, image: "👨‍⚕️", available: true, hospitalId: "h1", hospitalName: "Apollo Clinics" },
  { id: "4", name: "Dr. Sunitha Rao", specialty: "Dermatologist", experience: 8, rating: 4.6, fee: 600, image: "👩‍⚕️", available: true, hospitalId: "h3", hospitalName: "Care Hospitals" },
  { id: "5", name: "Dr. Venkat Rao", specialty: "Dentist", experience: 10, rating: 4.5, fee: 400, image: "👨‍⚕️", available: true, hospitalId: "h4", hospitalName: "KIMS Hospital" },
  { id: "6", name: "Dr. Meena Kumari", specialty: "Pediatrician", experience: 14, rating: 4.8, fee: 550, image: "👩‍⚕️", available: true, hospitalId: "h2", hospitalName: "Yashoda Hospitals" },
  { id: "7", name: "Dr. Srinivas Gupta", specialty: "ENT Specialist", experience: 18, rating: 4.7, fee: 650, image: "👨‍⚕️", available: true, hospitalId: "h3", hospitalName: "Care Hospitals" },
  { id: "8", name: "Dr. Kavitha Nair", specialty: "Gynecologist", experience: 16, rating: 4.9, fee: 750, image: "👩‍⚕️", available: true, hospitalId: "h4", hospitalName: "KIMS Hospital" },
];

export const timeSlots: TimeSlot[] = [
  { id: "1", time: "09:00 AM", available: true },
  { id: "2", time: "09:30 AM", available: true },
  { id: "3", time: "10:00 AM", available: false },
  { id: "4", time: "10:30 AM", available: true },
  { id: "5", time: "11:00 AM", available: true },
  { id: "6", time: "11:30 AM", available: false },
  { id: "7", time: "02:00 PM", available: true },
  { id: "8", time: "02:30 PM", available: true },
  { id: "9", time: "03:00 PM", available: true },
  { id: "10", time: "03:30 PM", available: false },
  { id: "11", time: "04:00 PM", available: true },
  { id: "12", time: "04:30 PM", available: true },
];

export const labTests: LabTest[] = [
  { id: "1", name: "Complete Blood Count (CBC)", description: "Measures red/white blood cells, hemoglobin, and platelets", price: 350, category: "Blood", turnaround: "6 hours" },
  { id: "2", name: "Thyroid Profile (T3, T4, TSH)", description: "Evaluates thyroid gland function", price: 650, category: "Hormone", turnaround: "12 hours" },
  { id: "3", name: "Lipid Profile", description: "Checks cholesterol and triglyceride levels", price: 500, category: "Blood", turnaround: "8 hours" },
  { id: "4", name: "Blood Sugar Fasting", description: "Measures glucose levels after fasting", price: 150, category: "Diabetes", turnaround: "4 hours" },
  { id: "5", name: "Liver Function Test (LFT)", description: "Evaluates liver enzyme levels", price: 600, category: "Organ", turnaround: "10 hours" },
  { id: "6", name: "Kidney Function Test (KFT)", description: "Checks kidney health markers", price: 550, category: "Organ", turnaround: "10 hours" },
  { id: "7", name: "Vitamin D Test", description: "Measures Vitamin D levels in blood", price: 800, category: "Vitamin", turnaround: "24 hours" },
  { id: "8", name: "HbA1c", description: "3-month average blood sugar level", price: 450, category: "Diabetes", turnaround: "6 hours" },
  { id: "9", name: "Full Body Checkup", description: "Comprehensive health screening package", price: 2500, category: "Package", turnaround: "48 hours" },
  { id: "10", name: "Urine Routine", description: "Checks for infections and kidney issues", price: 200, category: "Urine", turnaround: "4 hours" },
];
