import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("/home", "routes/home.tsx"),
  route("/register", "routes/authentication/register.tsx"),
  route("/login", "routes/authentication/login.tsx"),
  route("/logout", "routes/authentication/logout.tsx"),
  route("/passwordReset", "routes/authentication/passwordReset.tsx"),
  route("/about", "routes/about/about.tsx"),
  route("/board", "routes/about/board.tsx"),
  route("/staff", "routes/about/staff.tsx"),
  route("/contact", "routes/about/contact.tsx"),
  route("/programming", "routes/programming/programming.tsx"),
  route("/workshopregistration", "routes/programming/workshopregistration.tsx"),
  route("/dashboard/events", "routes/dashboard/events.tsx"),
  route("/makertomarket", "routes/programming/makertomarket.tsx"),
  route("/muralproject", "routes/programming/muralproject.tsx"),
  route("/dontfakeit", "routes/programming/dontfakeit.tsx"),
  route("/makermarket2024", "routes/programming/makermarket2024.tsx"),
  route("/pastworkshops", "routes/programming/pastworkshops.tsx"),
  route("/spaces", "routes/spaceandservices/spaces.tsx"),
  route("/get-involved", "routes/getinvolved/getinvolved.tsx"),
  route("/SpaceRental", "routes/spaceandservices/SpaceRental.tsx"),
  route("/SpacesEquipment", "routes/spaceandservices/SpacesEquipment.tsx"),
  route("/resourcetoolbox", "routes/spaceandservices/resourcetoolbox.tsx"),
  route(
    "/fabricationservices",
    "routes/spaceandservices/fabricationservices.tsx"
  ),
  route("/volunteer", "routes/getinvolved/volunteer.tsx"),
  route("/dashboard/memberships", "routes/dashboard/memberships.tsx"),
  route("/jobopportunities", "routes/getinvolved/jobopportunities.tsx"),
  route("/dashboard/admin", "routes/dashboard/admindashboardlayout.tsx"),
  route("/dashboard/user", "routes/dashboard/userdashboardlayout.tsx"),
  route("/dashboard/workshops", "routes/dashboard/workshops.tsx"),
  route("/dashboard/workshops/:id", "routes/dashboard/workshopdetails.tsx"),
  route(
    "/dashboard/workshops/pricevariations/:workshopId",
    "routes/dashboard/workshoppricingvariation.tsx"
  ),
  route("/addmembershipplan", "routes/getinvolved/addmembershipplan.tsx"),
  route(
    "/editmembershipplan/:planId",
    "routes/getinvolved/editmembershipplan.tsx"
  ),
  route("/dashboard/addworkshop", "routes/dashboard/addworkshop.tsx"),
  route(
    "/dashboard/editworkshop/:workshopId",
    "routes/dashboard/editworkshop.tsx"
  ),
  route("/dashboard/register/:id", "routes/api/register.tsx"),
  route(
    "/dashboard/workshops/offer/:id",
    "routes/dashboard/workshopofferagain.tsx"
  ),
  route(
    "dashboard/payment/:workshopId/connect/:connectId",
    "routes/dashboard/payment.tsx",
    { id: "dashboard/payment/multiDayWorkshop" }
  ),
  route(
    "dashboard/payment/:workshopId/connect/:connectId/:variationId",
    "routes/dashboard/payment.tsx",
    { id: "dashboard/payment/multiDayWorkshopWithVariation" }
  ),
  route(
    "dashboard/payment/:workshopId/:occurrenceId",
    "routes/dashboard/payment.tsx",
    { id: "dashboard/payment/singleWorkshop" }
  ),
  route(
    "dashboard/payment/:workshopId/:occurrenceId/:variationId",
    "routes/dashboard/payment.tsx",
    { id: "dashboard/payment/workshopWithVariation" }
  ),
  route("dashboard/payment/:membershipPlanId", "routes/dashboard/payment.tsx", {
    id: "dashboard/payment/membership",
  }),
  route(
    "/dashboard/memberships/:membershipId",
    "routes/dashboard/membershipdetails.tsx"
  ),
  route("dashboard/paymentprocess", "routes/api/paymentprocess.tsx"),
  route("dashboard/payment/success", "routes/dashboard/paymentsuccess.tsx"),
  route("dashboard/payment/downgrade", "routes/api/paymentdowngrade.tsx"),
  route("dashboard/payment/resubscribe", "routes/api/paymentresubscribe.tsx"),
  route(
    "/dashboard/equipmentbooking/:id",
    "routes/dashboard/equipmentbooking.tsx"
  ),
  route("/dashboard/equipments", "routes/dashboard/equipments.tsx"),
  route("/dashboard/equipment/edit/:id", "routes/dashboard/equipmentsedit.tsx"),
  route("/dashboard/equipment/delete/:id", "routes/api/equipmentsdelete.tsx"),
  route("/dashboard/myequipments", "routes/dashboard/myequipments.tsx"),
  route("/dashboard/equipments/:id", "routes/dashboard/equipmentdetails.tsx"),
  route("/dashboard/addequipment", "routes/dashboard/addequipment.tsx"),
  route("/dashboard/myworkshops", "routes/dashboard/myworkshops.tsx"),
  route(
    "/dashboard/admin/workshop/users",
    "routes/dashboard/alluserworkshop.tsx"
  ),
  route(
    "/dashboard/admin/workshop/:workshopId/users",
    "routes/dashboard/userworkshop.tsx"
  ),
  route("/dashboard/admin/users", "routes/dashboard/allusersregistered.tsx"),
  route(
    "/dashboard/allequipmentbooking",
    "routes/dashboard/allequipmentbooking.tsx"
  ),
  route("/dashboard/profile", "routes/dashboard/profile.tsx"),
  route(
    "/user/profile/paymentinformation",
    "routes/dashboard/paymentinformation.tsx"
  ),
  route("/dashboard/admin/settings", "routes/dashboard/adminsettings.tsx"),
  route("/dashboard/admin/reports", "routes/dashboard/adminreports.tsx"),
  route("/dashboard/report", "routes/dashboard/issue.tsx"),
  route("/dashboard/logs", "routes/dashboard/serverlogs.tsx"),
  route("/dashboard/equipments/book-slot", "routes/api/bookequipmentslot.tsx"),
  route("/dashboard/profile/download-waiver", "routes/api/download-waiver.tsx"),
  route(
    "/dashboard/profile/download-membership-agreement/:formId",
    "routes/api/download-membership-agreement.tsx"
  ),
  route(
    "/api/google-calendar/connect",
    "routes/api/google-calendar.connect.tsx"
  ),
  route(
    "/api/google-calendar/callback",
    "routes/api/google-calendar.callback.tsx"
  ),
  route(
    "/api/google-calendar/disconnect",
    "routes/api/google-calendar.disconnect.tsx"
  ),
  route("/dashboard", "routes/dashboard/dashboardlayout.tsx"),
  route("/dashboard/volunteer", "routes/dashboard/volunteer.tsx"),
] satisfies RouteConfig;
