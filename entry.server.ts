import { startMonthlyMembershipCheck } from "./app/models/membership.server";
import { startWorkshopOccurrenceStatusUpdate } from "./app/models/workshop.server";

console.log("Hello from entry.server.ts");
startMonthlyMembershipCheck();
startWorkshopOccurrenceStatusUpdate();
