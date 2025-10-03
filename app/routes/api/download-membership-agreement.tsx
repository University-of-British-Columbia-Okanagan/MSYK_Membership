import type { LoaderFunction } from "react-router-dom";
import { getUserId } from "~/utils/session.server";
import { db } from "~/utils/db.server";
import { decryptMembershipAgreement } from "~/models/membership.server";

export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const formId = parseInt(params.formId!);
    if (isNaN(formId)) {
      return new Response("Invalid form ID", { status: 400 });
    }

    // Get user's membership form
    const membershipForm = await db.userMembershipForm.findFirst({
      where: {
        id: formId,
        userId: parseInt(userId),
        status: { not: "inactive" },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        membershipPlan: true,
      },
    });

    if (!membershipForm || !membershipForm.agreementSignature) {
      return new Response("Membership agreement not found", { status: 404 });
    }

    // Decrypt the membership agreement
    let decryptedPdfBuffer;
    try {
      decryptedPdfBuffer = decryptMembershipAgreement(
        membershipForm.agreementSignature
      );
    } catch (decryptError) {
      console.error("API Route - Decryption failed:", decryptError);
      return new Response("Failed to decrypt membership agreement document", {
        status: 500,
      });
    }

    // Return the PDF as a downloadable file
    return new Response(decryptedPdfBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="membership-agreement-${membershipForm.user.firstName}-${membershipForm.user.lastName}.pdf"`,
        "Cache-Control": "no-cache",
        "Content-Length": decryptedPdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("API Route - Error downloading membership agreement:", error);
    return new Response("Error downloading membership agreement", {
      status: 500,
    });
  }
};
