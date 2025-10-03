import type { LoaderFunction } from "react-router-dom";
import { getUserId, decryptWaiver } from "~/utils/session.server";
import { db } from "~/utils/db.server";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get user's waiver signature
    const user = await db.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        waiverSignature: true,
      },
    });

    if (!user || !user.waiverSignature) {
      return new Response("Waiver not found", { status: 404 });
    }

    // Check if it's placeholder data
    if (user.waiverSignature.includes("Placeholder")) {
      return new Response("Waiver document unavailable", { status: 400 });
    }

    // Decrypt the waiver
    let decryptedPdfBuffer;
    try {
      decryptedPdfBuffer = decryptWaiver(user.waiverSignature);
    } catch (decryptError) {
      console.error("API Route - Decryption failed:", decryptError);
      return new Response("Failed to decrypt waiver document", { status: 500 });
    }

    // Return the PDF as a downloadable file
    return new Response(decryptedPdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="waiver-${user.firstName}-${user.lastName}.pdf"`,
        "Cache-Control": "no-cache",
        "Content-Length": decryptedPdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("API Route - Error downloading waiver:", error);
    return new Response("Error downloading waiver", { status: 500 });
  }
};
