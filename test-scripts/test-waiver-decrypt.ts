import { decryptWaiver } from "../app/utils/session.server";
import { db } from "../app/utils/db.server";
import * as fs from "fs";
import * as path from "path";

async function testWaiverDecryption() {
  try {
    // Get a user with a waiver signature from the database
    const user = await db.user.findFirst({
      where: {
        waiverSignature: {
          not: null,
        },
        // Exclude placeholder data from seed
        NOT: {
          waiverSignature: {
            contains: "Placeholder",
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        waiverSignature: true,
        email: true,
      },
    });

    if (!user || !user.waiverSignature) {
      console.log("❌ No user found with a real waiver signature");
      console.log(
        "💡 Please register a new user through the web form with an actual signature to test decryption"
      );
      return;
    }

    console.log(
      `Testing decryption for user: ${user.firstName} ${user.lastName} (${user.email})`
    );

    // Decrypt the waiver
    const decryptedPdfBuffer = decryptWaiver(user.waiverSignature);

    // Save the decrypted PDF to a file
    const outputPath = path.join(
      "",
      `waiver-${user.id}-${user.firstName}-${user.lastName}.pdf`
    );
    fs.writeFileSync(outputPath, decryptedPdfBuffer);

    console.log(`✓ Successfully decrypted and saved waiver to: ${outputPath}`);
    console.log(`✓ File size: ${decryptedPdfBuffer.length} bytes`);
    console.log(`✓ You can now open this PDF file to verify it contains:`);
    console.log(`  - The user's signature`);
    console.log(`  - Name: ${user.firstName} ${user.lastName}`);
    console.log(`  - Current date when signed`);
  } catch (error) {
    console.error("❌ Error testing waiver decryption:", error);
  } finally {
    // Close database connection
    await db.$disconnect();
  }
}

// Run the test
testWaiverDecryption();
