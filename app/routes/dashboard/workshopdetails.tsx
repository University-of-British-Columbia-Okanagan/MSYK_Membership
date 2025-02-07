import { useParams } from "react-router-dom";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const workshops = [
  { id: "1", title: "Charcuterie Board Workshop", description: "Learn to create your own serving board.", price: "120", location: "Makerspace YK" },
  { id: "2", title: "3D Printing Workshop", description: "Introduction to 3D printing techniques.", price: "Free", location: "Makerspace YK" },
  { id: "3", title: "CNC Machining", description: "Advanced CNC machining skills.", price: "50", location: "Makerspace YK" }
];

export default function WorkshopDetails() {
  const { id } = useParams();
  const workshop = workshops.find((w) => w.id === id) || workshops[0]; 

  if (!workshop) return <p className="text-center text-red-500">Workshop not found!</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Full Booking Notice */}
      <div className="bg-gray-100 p-3 rounded-lg text-center text-gray-700">
        This service is fully booked.
      </div>

      {/* Workshop Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-2xl">{workshop.title}</CardTitle>
          <CardDescription>{workshop.description}</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Workshop Info Badges */}
          <div className="flex gap-2">
            <Badge variant="outline">Ended</Badge>
            <Badge variant="outline">${workshop.price}</Badge>
            <Badge variant="outline">{workshop.location}</Badge>
          </div>

          <Separator className="my-6" />

          {/* Service Description */}
          <h2 className="text-lg font-semibold">Service Description</h2>
          <p className="text-gray-600">{workshop.description}</p>

          <Separator className="my-6" />

          {/* Cancellation Policy */}
          <h2 className="text-lg font-semibold">Cancellation Policy</h2>
          <p className="text-gray-600">
            Can't make it? Email <a href="mailto:info@makerspaceyk.com" className="text-blue-500">info@makerspaceyk.com</a>.
            Full refunds are only available if canceled 48 hours in advance.
          </p>

          <Separator className="my-6" />

          {/* Contact Info */}
          <h2 className="text-lg font-semibold">Contact Details</h2>
          <p className="text-gray-600">5001 Forrest Drive Unit 101, Yellowknife, NT, Canada</p>

          {/* Back to Workshops Button */}
          <div className="mt-6 flex justify-end">
            <Button variant="outline" asChild>
              <Link to="/dashboardlayout/workshops">Back to Workshops</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
