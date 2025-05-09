import { useLoaderData, useFetcher, useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";

import  { updateEquipment, getEquipmentById } from "../../models/equipment.server";
import { getRoleUser } from "~/utils/session.server";

export async function action({ request }: { request: Request }) {
    const currentUserRole = await getRoleUser(request);
    if (currentUserRole?.roleName !== "Admin") {
      throw new Response("Access Denied", { status: 403 });
    }

    const form = await request.formData();
    const id = parseInt(form.get("equipmentId") as string);
    const name = form.get("name") as string;
    const description = form.get("description") as string;
    const availability = form.get("availability") === "on";
    const price = parseFloat(form.get("price") as string);

    try {
      await updateEquipment(id, {
        name,
        description,
        availability,
        price,
      });
  
      return { success: true };
    } catch (error) {
      console.error("Failed to update equipment:", error);
      return { success: false, error: "Failed to update equipment." };
    }
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const currentUserRole = await getRoleUser(request);
  const equipment = await getEquipmentById(parseInt(params.id));
  if (currentUserRole?.roleName !== "Admin") {
    throw new Response("Access Denied", { status: 409 });
  }
  if (!equipment) {
    throw new Response("Equipment not found", { status: 404 });
  }
  return { equipment, currentUserRole };
}

export default function EquipmentEdit() {
    const { equipment } = useLoaderData();
    const fetcher = useFetcher();
    const navigate = useNavigate();

    const [name, setName] = useState(equipment.name);
    const [description, setDescription] = useState(equipment.description);
    const [availability, setAvailability] = useState(equipment.availability);
    const [price, setPrice] = useState(equipment.price);

    useEffect(() => {
        if (fetcher.data?.success) {
          navigate(-1);
        }
      }, [fetcher.data]);
      
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setPopupMessage("🎉 Equipment booked successfully!");
      setShowPopup(true);
    } else if (fetcher.data?.error) {
      setPopupMessage(fetcher.data.error);
      setShowPopup(true);
    }
  }, [fetcher.data]);

  return (
    <div className="w-full p-10">
      {showPopup && (
        <div className="fixed top-4 right-4 p-4 bg-green-500 text-white rounded-lg shadow-lg">
          {popupMessage}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-10">Edit Equipment</h1>
      <fetcher.Form method="post" className="space-y-5">
        <div className="space-y-1 w-1/2">
          <Label htmlFor="name" className="pl-1 text-lg">Name</Label>
          <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1 w-1/2">
          <Label htmlFor="description" className="pl-1 text-lg">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1 w-1/2">
          <Label htmlFor="price" className="pl-1 text-lg">Price</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
          />
        </div>

        <div className="flex items-center space-x-4">
            <Label htmlFor="availability" className="pl-1 text-lg">Available</Label>
            <input
                type="checkbox"
                id="availability"
                name="availability"
                checked={availability}
                onChange={(e) => setAvailability(e.target.checked)}
                className="w-4 h-4 accent-yellow-500 "
            />
        </div>

        <input type="hidden" name="equipmentId" value={equipment.id} />

        <Separator />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" className="bg-yellow-500 text-white">
            Save Changes
          </Button>
        </div>
      </fetcher.Form>
    </div>
  );
}
