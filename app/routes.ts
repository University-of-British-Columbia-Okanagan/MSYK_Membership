import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/register", "routes/authentication/register.tsx"),
  route("/login", "routes/authentication/login.tsx"),
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
  route("/dashboardlayout", "routes/dashboard/dashboardlayout.tsx"),
  route("/workshops", "routes/dashboard/workshops.tsx"),
  route("/workshopdetails", "routes/dashboard/workshopdetails.tsx")
] satisfies RouteConfig;
