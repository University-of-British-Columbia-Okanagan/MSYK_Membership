// import express from "express";
import { startMonthlyMembershipCheck} from "./app/models/membership.server";

// const app = express();
// const PORT = 3000;

console.log("hello from entry.server.ts");
startMonthlyMembershipCheck();
/*
    Probably will also want to add a function here
    that removes expired memberships (date is passed the nextPaymentDate and status is cancelled)
*/

// app.listen(PORT, () => {
//     console.log(`Express server is running on port ${PORT}`);
//   });