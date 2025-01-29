import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./root";
import HomePage from "./routes/home";
import About from "./routes/about";
import Board from "./routes/board";
import Staff from "./routes/staff";
import Contact from "./routes/contact";
import Programming from "./routes/programming";
import Spaces from "./routes/spaces";
import GetInvolved from "./routes/getinvolved";
import WorkshopRegistration from "./routes/workshopregistration";
import MakerMarket from "./routes/makertomarket";
import MuralProject from "./routes/muralproject";
import PastWorkshops from "./routes/pastworkshops";
import Market2024 from "./routes/makermarket2024";
import DontFakeIt from "./routes/dontfakeit";
import EventCalendar from "./routes/eventcalendar";
import RentalRates from "./routes/SpaceRental";
import SpaceRental from "./routes/SpaceRental";

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
      { path: "pastworkshops", element: <PastWorkshops/> },
      { path: "eventcalendar", element: <EventCalendar/> },
      { path: "dontfakeit", element: <DontFakeIt/> },
      { path: "makermarket2024", element: <Market2024/> },
      {path: "SpaceRental", element: <SpaceRental />},
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
