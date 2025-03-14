import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/register", "routes/authentication/register.tsx"),
  route("/login", "routes/authentication/login.tsx"),
  route("/logout", "routes/authentication/logout.tsx"),
  route("/about", "routes/about/about.tsx"),
  route("/board", "routes/about/board.tsx"),
  route("/staff", "routes/about/staff.tsx"),
  route("/contact", "routes/about/contact.tsx"),
  route("/programming", "routes/programming/programming.tsx"),
  route("/workshopregistration", "routes/programming/workshopregistration.tsx"),
  route("/eventcalendar", "routes/programming/eventcalendar.tsx"),
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
  route("/membership", "routes/getinvolved/membership.tsx"),
  route("/jobopportunities", "routes/getinvolved/jobopportunities.tsx"),
  route("/dashboard/admin", "routes/dashboard/admindashboardlayout.tsx"),
  route("/userdashboardlayout", "routes/dashboard/userdashboardlayout.tsx"),
  route("/dashboard/workshops", "routes/dashboard/workshops.tsx"),
  route("/dashboard/workshops/:id", "routes/dashboard/workshopdetails.tsx"),
  route("/addmembershipplan", "routes/getinvolved/addmembershipplan.tsx"),
  route(
    "/editmembershipplan/:planId",
    "routes/getinvolved/editmembershipplan.tsx"
  ),
  route("/addworkshop", "routes/dashboard/addworkshop.tsx"),
  route("/editworkshop/:workshopId", "routes/dashboard/editworkshop.tsx"),
  route("/dashboard/register/:id", "routes/dashboard/register.tsx"),
  route(
    "/dashboard/workshops/:id/edit/:occurrenceId",
    "routes/dashboard/editoccurrence.tsx"
  ),
  route(
    "dashboard/payment/:workshopId/:occurrenceId",
    "routes/dashboard/payment.tsx"
  ),
  route("dashboard/paymentprocess", "routes/dashboard/paymentprocess.tsx"),
  route("dashboard/payment/success", "routes/dashboard/paymentsuccess.tsx"),
  route(
    "/dashboard/equipmentbooking/:id",
    "routes/dashboard/equipmentbooking.tsx"
  ),
  route("/dashboard/equipments", "routes/dashboard/equipments.tsx"),
  route("/dashboard/myequipments", "routes/dashboard/myequipments.tsx"),
  route("/dashboard/equipments/:id", "routes/dashboard/equipmentdetails.tsx"),
  route("/dashboard/addequipment", "routes/dashboard/addequipment.tsx"),
  route("/dashboard/myworkshops", "routes/dashboard/myworkshops.tsx"),
  route("/dashboard/admin/workshop/users", "routes/dashboard/alluserworkshop.tsx"),
  route("/dashboard/admin/workshop/:workshopId/users", "routes/dashboard/userworkshop.tsx"),
  route("/dashboard/admin/users", "routes/dashboard/allusersregistered.tsx"),

] satisfies RouteConfig;
