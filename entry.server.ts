import { startMonthlyMembershipCheck } from "./app/models/membership.server";
import { startWorkshopOccurrenceStatusUpdate } from "./app/models/workshop.server";
import { startRoleLevelSyncCron } from "./app/models/user.server";

console.log("Hello from entry.server.ts");
startMonthlyMembershipCheck();
startWorkshopOccurrenceStatusUpdate();
startRoleLevelSyncCron();
