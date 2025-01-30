import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./root";
import HomePage from "./routes/home";
import About from "./routes/about/about";
import Board from "./routes/about/board";
import Staff from "./routes/about/staff";
import Contact from "./routes/about/contact";
import Programming from "./routes/programming/programming";
import Spaces from "./routes/spaceandservices/spaces";
import GetInvolved from "./routes/getinvolved/getinvolved";
import WorkshopRegistration from "./routes/programming/workshopregistration";
import MakerMarket from "./routes/programming/makertomarket";
import MuralProject from "./routes/programming/muralproject";
import PastWorkshops from "./routes/programming/pastworkshops";
import Market2024 from "./routes/programming/makermarket2024";
import DontFakeIt from "./routes/programming/dontfakeit";
import EventCalendar from "./routes/programming/eventcalendar";
import RentalRates from "./routes/spaceandservices/SpaceRental";
import SpaceRental from "./routes/spaceandservices/SpaceRental";
import SpacesEquipment from "./routes/spaceandservices/SpacesEquipment";
import ResourceToolbox from "./routes/spaceandservices/resourcetoolbox";
import FabricationServices from "./routes/spaceandservices/fabricationservices";
import VolunteerPage from "./routes/getinvolved/volunteer";
import MembershipPage from "./routes/getinvolved/membership";
import JobOpportunities from "./routes/getinvolved/jobopportunities";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <About /> },
      { path: "board", element: <Board /> },
      { path: "staff", element: <Staff /> },
      { path: "contact", element: <Contact /> },
      { path: "programming", element: <Programming /> },
      { path: "spaces", element: <Spaces /> },
      { path: "get-involved", element: <GetInvolved /> },
      { path: "workshopregistration", element: <WorkshopRegistration /> },
      { path: "makertomarket", element: <MakerMarket /> },
      { path: "muralproject", element: <MuralProject /> },
      { path: "pastworkshops", element: <PastWorkshops /> },
      { path: "eventcalendar", element: <EventCalendar /> },
      { path: "dontfakeit", element: <DontFakeIt /> },
      { path: "makermarket2024", element: <Market2024 /> },
      { path: "SpaceRental", element: <SpaceRental /> },
      { path: "SpacesEquipment", element: <SpacesEquipment /> },
      { path: "resourcetoolbox", element: <ResourceToolbox /> },
      { path: "fabricationservices", element: <FabricationServices /> },
      { path: "volunteer", element: <VolunteerPage /> },
      { path: "membership", element: <MembershipPage /> },
      { path: "jobopportunities", element: <JobOpportunities /> },
    ],
  },
]);

if (typeof window !== "undefined") {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

export { router };
