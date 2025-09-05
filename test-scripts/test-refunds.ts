import { PrismaClient } from "@prisma/client";
import { Stripe } from "stripe";
import { refundWorkshopRegistration, refundEquipmentBooking, refundMembershipSubscription } from "../app/models/payment.server";

const db = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

// Real Stripe refund functions (no DB changes)
async function processWorkshopRefund(userId: number, workshopId: number, occurrenceId?: number) {
  const registrations = await db.userWorkshop.findMany({
    where: {
      userId,
      workshopId,
      ...(occurrenceId ? { occurrenceId } : {}),
      paymentIntentId: { not: null },
    },
  });

  if (registrations.length === 0) {
    throw new Error("No paid registration found for refund");
  }

  const paymentIntentId = registrations[0].paymentIntentId!;
  
  // REAL STRIPE REFUND - NO DB CHANGES
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    metadata: {
      userId: userId.toString(),
      workshopId: workshopId.toString(),
      ...(occurrenceId ? { occurrenceId: occurrenceId.toString() } : {}),
      test_mode: "true", // Mark as test
    },
  });

  return {
    success: refund.status === "succeeded",
    refundId: refund.id,
    amount: refund.amount / 100,
    status: refund.status,
    paymentIntentId,
    registrationsFound: registrations.length,
  };
}

async function processEquipmentRefund(paymentIntentId: string, bookings: any[]) {
  if (bookings.length === 0) {
    throw new Error("No bookings found for refund");
  }

  // Verify all bookings have the same payment intent ID
  const differentPaymentIntents = bookings.filter(
    (booking) => booking.paymentIntentId !== paymentIntentId
  );
  
  if (differentPaymentIntents.length > 0) {
    throw new Error("Cannot refund bookings from different payments together");
  }

  // REAL STRIPE REFUND - NO DB CHANGES
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    metadata: {
      userId: bookings[0].userId.toString(),
      bookingIds: bookings.map((b) => b.id.toString()).join(","),
      equipmentIds: [...new Set(bookings.map(b => b.equipmentId.toString()))].join(","),
      test_mode: "true", // Mark as test
    },
  });

  return {
    success: refund.status === "succeeded",
    refundId: refund.id,
    amount: refund.amount / 100,
    status: refund.status,
    bookingsFound: bookings.length,
    slotsFound: bookings.length,
    paymentIntentId,
  };
}

async function processMembershipRefund(userId: number, membershipId: number) {
  const membership = await db.userMembership.findUnique({
    where: { id: membershipId },
    include: { membershipPlan: true },
  });

  if (!membership || !membership.paymentIntentId) {
    throw new Error("No paid membership found for refund");
  }

  // REAL STRIPE REFUND - NO DB CHANGES
  const refund = await stripe.refunds.create({
    payment_intent: membership.paymentIntentId,
    metadata: {
      userId: userId.toString(),
      membershipId: membershipId.toString(),
      membershipPlanId: membership.membershipPlanId.toString(),
      refundType: "membership_cancellation",
      test_mode: "true", // Mark as test
    },
  });

  return {
    success: refund.status === "succeeded",
    refundId: refund.id,
    amount: refund.amount / 100,
    status: refund.status,
    membershipPlan: membership.membershipPlan.title,
    paymentIntentId: membership.paymentIntentId,
  };
}

async function testRefunds() {
  console.log("🧪 Starting refund tests...\n");

  try {
    // Test 1: Workshop Refunds
    console.log("🎓 Testing Workshop Refunds");
    console.log("================================");
    
    const recentWorkshops = await db.userWorkshop.findMany({
      where: {
        paymentIntentId: { not: null },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        workshop: { select: { name: true } },
        occurrence: { select: { startDate: true } },
      },
      orderBy: { date: 'desc' },
      take: 2,
    });

    console.log(`Found ${recentWorkshops.length} recent paid workshop registrations`);

    for (const workshop of recentWorkshops) {
      console.log(`\n📝 Workshop: ${workshop.workshop.name}`);
      console.log(`   User: ${workshop.user.firstName} ${workshop.user.lastName} (${workshop.user.email})`);
      console.log(`   Payment Intent ID: ${workshop.paymentIntentId}`);
      console.log(`   Registration Date: ${workshop.date.toISOString()}`);
      
      try {
        const refundResult = await refundWorkshopRegistration(
          workshop.userId,
          workshop.workshopId,
          workshop.occurrenceId
        );
        
        if (refundResult.success) {
          console.log(`   ✅ REFUND SUCCESS: $${refundResult.amount} (Refund ID: ${refundResult.refundId})`);
        } else {
          console.log(`   ❌ REFUND FAILED: Status ${refundResult.status}`);
        }
      } catch (error) {
        console.log(`   ❌ REFUND ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test 2: Equipment Refunds
    console.log("\n\n🔧 Testing Equipment Refunds");
    console.log("===============================");
    
    // Get unique payment intent IDs from recent equipment bookings
    const uniquePaymentIntents = await db.equipmentBooking.findMany({
      where: {
        paymentIntentId: { not: null },
        bookedFor: "user", // Only individual user bookings
      },
      select: {
        paymentIntentId: true,
        userId: true,
      },
      distinct: ['paymentIntentId'],
      orderBy: { id: 'desc' },
      take: 2,
    });

    console.log(`Found ${uniquePaymentIntents.length} unique payment intents for equipment bookings`);

    for (const intent of uniquePaymentIntents) {
      if (!intent.paymentIntentId) continue;

      // Get all bookings for this payment intent
      const allBookingsForIntent = await db.equipmentBooking.findMany({
        where: {
          paymentIntentId: intent.paymentIntentId,
          bookedFor: "user",
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          equipment: { select: { name: true } },
          slot: { select: { startTime: true, endTime: true } },
        },
        orderBy: { slot: { startTime: 'asc' } },
      });

      const user = allBookingsForIntent[0]?.user;
      const equipmentNames = [...new Set(allBookingsForIntent.map(b => b.equipment.name))];
      
      console.log(`\n🔧 Equipment Payment: ${equipmentNames.join(', ')}`);
      console.log(`   User: ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`   Payment Intent ID: ${intent.paymentIntentId}`);
      console.log(`   Total Slots in this Payment: ${allBookingsForIntent.length}`);
      
      // Show all slots in this payment
      console.log(`   Slots:`);
      for (const booking of allBookingsForIntent) {
        console.log(`     • ${booking.equipment.name}: ${booking.slot.startTime.toISOString()} - ${booking.slot.endTime.toISOString()}`);
      }
      
      try {
        // Refund all bookings from this payment intent (don't specify equipment or slot IDs)
        const refundResult = await refundEquipmentBooking(intent.userId);
        
        if (refundResult.success) {
          console.log(`   ✅ REFUND SUCCESS: ${refundResult.amount} (Refund ID: ${refundResult.refundId})`);
          console.log(`   📊 Bookings Refunded: ${refundResult.bookingsRefunded}, Slots Freed: ${refundResult.slotsFreed}`);
        } else {
          console.log(`   ❌ REFUND FAILED: Status ${refundResult.status}`);
        }
      } catch (error) {
        console.log(`   ❌ REFUND ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Test 3: Membership Refunds
    console.log("\n\n💳 Testing Membership Refunds");
    console.log("===============================");
    
    const recentMembership = await db.userMembership.findFirst({
      where: {
        paymentIntentId: { not: null },
        status: { in: ["active", "ending"] },
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, roleLevel: true } },
        membershipPlan: { select: { title: true, price: true } },
      },
      orderBy: { date: 'desc' },
    });

    if (recentMembership) {
      console.log(`\n💳 Membership: ${recentMembership.membershipPlan.title}`);
      console.log(`   User: ${recentMembership.user.firstName} ${recentMembership.user.lastName} (${recentMembership.user.email})`);
      console.log(`   Payment Intent ID: ${recentMembership.paymentIntentId}`);
      console.log(`   Membership Date: ${recentMembership.date.toISOString()}`);
      console.log(`   Next Payment: ${recentMembership.nextPaymentDate.toISOString()}`);
      console.log(`   Current Role Level: ${recentMembership.user.roleLevel}`);
      
      try {
        const refundResult = await refundMembershipSubscription(
          recentMembership.userId,
          recentMembership.id
        );
        
        if (refundResult.success) {
          console.log(`   ✅ REFUND SUCCESS: $${refundResult.amount} (Refund ID: ${refundResult.refundId})`);
          console.log(`   📋 Membership Plan: ${refundResult.membershipPlan}`);
          console.log(`   🚫 Membership Cancelled: ${refundResult.membershipCancelled}`);
          
          // Check updated user role level
          const updatedUser = await db.user.findUnique({
            where: { id: recentMembership.userId },
            select: { roleLevel: true },
          });
          console.log(`   👤 Updated Role Level: ${updatedUser?.roleLevel}`);
        } else {
          console.log(`   ❌ REFUND FAILED: Status ${refundResult.status}`);
        }
      } catch (error) {
        console.log(`   ❌ REFUND ERROR: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.log("\n❌ No recent paid memberships found for testing");
    }

    console.log("\n🎉 Refund tests completed!");

  } catch (error) {
    console.error("💥 Test script error:", error instanceof Error ? error.message : String(error));
  } finally {
    await db.$disconnect();
  }
}

// Helper function to display summary
async function displayTestSummary() {
  console.log("\n📊 TEST SUMMARY");
  console.log("================");
  
  // Count records with payment intent IDs
  const workshopCount = await db.userWorkshop.count({
    where: { paymentIntentId: { not: null } }
  });
  
  const equipmentCount = await db.equipmentBooking.count({
    where: { 
      paymentIntentId: { not: null },
      bookedFor: "user"
    }
  });
  
  const membershipCount = await db.userMembership.count({
    where: { 
      paymentIntentId: { not: null },
      status: { in: ["active", "ending", "cancelled"] }
    }
  });
  
  console.log(`📚 Total paid workshop registrations: ${workshopCount}`);
  console.log(`🔧 Total paid equipment bookings: ${equipmentCount}`);
  console.log(`💳 Total paid memberships: ${membershipCount}`);
}

// Run the tests
async function main() {
  console.log("🚀 MYSK Refund System Test Script - REAL STRIPE REFUNDS (NO DB CHANGES)");
  console.log("=======================================================================\n");
  
  console.log("⚠️  CRITICAL WARNING:");
  console.log("   • This will process REAL refunds in your Stripe account");
  console.log("   • Money will actually be refunded to customers");
  console.log("   • Database records will NOT be cleaned up");
  console.log("   • Make sure you're ready for real refund transactions!\n");

  await displayTestSummary();
  await testRefunds();
}

main().catch(console.error);