import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/register", "routes/register.tsx"),
  route("/about", "routes/about.tsx"),
  route("/board", "routes/board.tsx"),
  route("/staff", "routes/staff.tsx"),
  route("/contact", "routes/contact.tsx"),
  route("/programming", "routes/programming.tsx"),
  route("/workshopregistration", "routes/workshopregistration.tsx"),
  route("/eventcalendar", "routes/eventcalendar.tsx"),
  route("/makertomarket", "routes/makertomarket.tsx"),
  route("/muralproject", "routes/muralproject.tsx"),
  route("/dontfakeit", "routes/dontfakeit.tsx"),
  route("/makermarket2024", "routes/makermarket2024.tsx"),
  route("/pastworkshops", "routes/pastworkshops.tsx"),
  route("/spaces", "routes/spaces.tsx"),
  route("/get-involved", "routes/getinvolved.tsx"),
  route("/SpaceRental", "routes/SpaceRental.tsx"),
  route("/SpacesEquipment", "routes/SpacesEquipment.tsx"),
  route("/resourcetoolbox", "routes/resourcetoolbox.tsx"),
  route("/fabricationservices", "routes/fabricationservices.tsx"),
  route("/volunteer", "routes/volunteer.tsx"),
  route("/membership", "routes/membership.tsx"),
  route("/jobopportunities", "routes/jobopportunities.tsx"),
] satisfies RouteConfig;
