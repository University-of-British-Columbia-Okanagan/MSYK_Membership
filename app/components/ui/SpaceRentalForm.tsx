import { useState } from "react";

export default function SpaceRentalForm() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    businessName: "",
    businessCategory: "",
    eventDescription: "",
    eventDate: "",
    dateRange: "",
    participants: "",
    timeSlot: "",
    liquorLicense: "No",
    additionalInfo: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/spacerental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccessMessage("Your request has been submitted! We'll get back to you soon.");
        setFormData({
          fullName: "",
          email: "",
          phone: "",
          businessName: "",
          businessCategory: "",
          eventDescription: "",
          eventDate: "",
          dateRange: "",
          participants: "",
          timeSlot: "",
          liquorLicense: "No",
          additionalInfo: "",
        });
      } else {
        console.error("Submission failed");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <h2 className="text-center text-2xl font-bold mb-6">Space Rental Request</h2>

      {successMessage && <p className="text-green-600 text-center mb-4">{successMessage}</p>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg">
        {/* Full Name */}
        <div>
          <label className="block font-medium">Full Name</label>
          <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        {/* Email & Phone */}
        <div className="mt-4">
          <label className="block font-medium">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>
        
        <div className="mt-4">
          <label className="block font-medium">Phone Number</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        {/* Business Name & Category */}
        <div className="mt-4">
          <label className="block font-medium">Business Name</label>
          <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        <div className="mt-4">
          <label className="block font-medium">Business Category</label>
          <input type="text" name="businessCategory" value={formData.businessCategory} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        {/* Event Details */}
        <div className="mt-4">
          <label className="block font-medium">Event Description</label>
          <textarea name="eventDescription" value={formData.eventDescription} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded"></textarea>
        </div>

        <div className="mt-4">
          <label className="block font-medium">Event Date</label>
          <input type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        <div className="mt-4">
          <label className="block font-medium">Date Range (if applicable)</label>
          <input type="text" name="dateRange" value={formData.dateRange} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded" />
        </div>

        <div className="mt-4">
          <label className="block font-medium">Number of Expected Participants</label>
          <input type="number" name="participants" value={formData.participants} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        <div className="mt-4">
          <label className="block font-medium">Preferred Time Slot</label>
          <input type="text" name="timeSlot" value={formData.timeSlot} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded" />
        </div>

        {/* Liquor License */}
        <div className="mt-4">
          <label className="block font-medium">Do you have a liquor license?</label>
          <select name="liquorLicense" value={formData.liquorLicense} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        {/* Additional Information */}
        <div className="mt-4">
          <label className="block font-medium">Anything else we should know?</label>
          <textarea name="additionalInfo" value={formData.additionalInfo} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded"></textarea>
        </div>

        {/* Submit Button */}
        <button type="submit" disabled={isSubmitting} className="mt-6 w-full bg-orange-500 text-white p-3 rounded-md hover:bg-orange-600 transition">
          {isSubmitting ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
