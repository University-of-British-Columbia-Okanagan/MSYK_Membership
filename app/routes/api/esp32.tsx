import { json, type LoaderFunction, type ActionFunction } from "@remix-run/node";
import { checkAccess, updateCertifications, getAccessLogs } from "~/utils/esp32.server";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.has("logs")) {
    const limit = Number(url.searchParams.get("limit") || 50);
    const logs = await getAccessLogs(limit);
    return json({ success: true, logs });
  }
  
  const pin = url.searchParams.get("pin");
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return json({ success: false, error: "PIN must be exactly 4 digits" });
  }

  const user = await checkAccess(pin);
  if (!user) {
    return json({ success: false, error: "Invalid PIN - Access Denied" });
  }

  return json({
    success: true,
    user_id: user.id,
    certifications: {
      equipment_certified: user.equipmentCertified,
      mill_certified: user.millCertified,
      cnc_certified: user.cncCertified,
      welder_certified: user.welderCertified,
    },
  });
};

export const action: ActionFunction = async ({ request, params }) => {
  const userId = params.id;
  if (!userId) {
    return json({ success: false, error: "Missing user ID" }, { status: 400 });
  }

  const data = await request.json();
  try {
    const updated = await updateCertifications(userId, data);
    return json({ success: true, message: `Certifications updated for ${updated.id}` });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, { status: 500 });
  }
};
