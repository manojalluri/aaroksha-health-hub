export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  experience: number;
  rating: number;
  fee: number;
  image_url: string;
  available: boolean;
  hospital_id?: string;
  hospital_name?: string;
}

export const MOCK_DOCTORS: Doctor[] = [
  { id: "1", name: "Dr. Rajesh Kumar", specialty: "General Physician", experience: 15, rating: 4.8, fee: 500, image_url: "👨‍⚕️", available: true },
  { id: "2", name: "Dr. Priya Sharma", specialty: "Cardiologist", experience: 12, rating: 4.9, fee: 800, image_url: "👩‍⚕️", available: true },
  { id: "3", name: "Dr. Anil Reddy", specialty: "Orthopedic", experience: 20, rating: 4.7, fee: 700, image_url: "👨‍⚕️", available: true },
  { id: "4", name: "Dr. Sunitha Rao", specialty: "Dermatologist", experience: 8, rating: 4.6, fee: 600, image_url: "👩‍⚕️", available: true }
];

export const getLocalDoctors = (): Doctor[] => {
  try {
    const saved = localStorage.getItem("aaroksha_doctors");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error loading doctors", e);
  }
  return MOCK_DOCTORS;
};

export const saveLocalDoctors = (doctors: Doctor[]) => {
  localStorage.setItem("aaroksha_doctors", JSON.stringify(doctors));
  window.dispatchEvent(new Event("doctors_updated"));
};
