import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Search, Filter } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { doctors } from "@/data/mockData";
import { Input } from "@/components/ui/input";

const DoctorsPage = () => {
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const navigate = useNavigate();

  const specialties = ["All", ...new Set(doctors.map((d) => d.specialty))];
  const filtered = doctors.filter(
    (d) =>
      (selectedSpecialty === "All" || d.specialty === selectedSpecialty) &&
      d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
          Find & Book Doctors
        </h1>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search doctors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {specialties.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSpecialty(s)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedSpecialty === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-primary/10"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((doctor) => (
            <div
              key={doctor.id}
              className="glass-card rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="text-5xl mb-4 text-center">{doctor.image}</div>
              <h3 className="text-lg font-bold text-foreground text-center">
                {doctor.name}
              </h3>
              <p className="text-sm text-primary font-medium text-center mb-2">
                {doctor.specialty}
              </p>
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                <Star className="h-4 w-4 text-accent fill-accent" />
                {doctor.rating} · {doctor.experience} yrs exp
              </div>
              <p className="text-center text-lg font-bold text-foreground mb-4">
                ₹{doctor.fee}
              </p>
              <button
                onClick={() => navigate(`/book-appointment/${doctor.id}`)}
                className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                Book Appointment
              </button>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DoctorsPage;
