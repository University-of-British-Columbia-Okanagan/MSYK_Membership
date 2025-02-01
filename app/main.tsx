import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout"; // Now using layouts
import DashboardLayout from "./routes/dashboard/dashboardlayout";
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
import SpaceRental from "./routes/spaceandservices/SpaceRental";
import SpacesEquipment from "./routes/spaceandservices/SpacesEquipment";
import ResourceToolbox from "./routes/spaceandservices/resourcetoolbox";
import FabricationServices from "./routes/spaceandservices/fabricationservices";
import VolunteerPage from "./routes/getinvolved/volunteer";
import MembershipPage from "./routes/getinvolved/membership";
import JobOpportunities from "./routes/getinvolved/jobopportunities";
import Workshops from "./routes/dashboard/workshops";
import Events from "./routes/dashboard/events";
import Membership from "./routes/dashboard/memberships";

const App = () => (
  <Router>
    <Routes>
      {/* Pages using MainLayout (Navigation Bar) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="about" element={<About />} />
        <Route path="board" element={<Board />} />
        <Route path="staff" element={<Staff />} />
        <Route path="contact" element={<Contact />} />
        <Route path="programming" element={<Programming />} />
        <Route path="spaces" element={<Spaces />} />
        <Route path="get-involved" element={<GetInvolved />} />
        <Route path="workshopregistration" element={<WorkshopRegistration />} />
        <Route path="makertomarket" element={<MakerMarket />} />
        <Route path="muralproject" element={<MuralProject />} />
        <Route path="pastworkshops" element={<PastWorkshops />} />
        <Route path="eventcalendar" element={<EventCalendar />} />
        <Route path="dontfakeit" element={<DontFakeIt />} />
        <Route path="makermarket2024" element={<Market2024 />} />
        <Route path="SpaceRental" element={<SpaceRental />} />
        <Route path="SpacesEquipment" element={<SpacesEquipment />} />
        <Route path="resourcetoolbox" element={<ResourceToolbox />} />
        <Route path="fabricationservices" element={<FabricationServices />} />
        <Route path="volunteer" element={<VolunteerPage />} />
        <Route path="membership" element={<MembershipPage />} />
        <Route path="jobopportunities" element={<JobOpportunities />} />
      </Route>

      {/* Dashboard Routes using DashboardLayout (Sidebar Only) */}
      <Route path="dashboard" element={<DashboardLayout />}>
        <Route path="workshops" element={<Workshops />} />
        <Route path="events" element={<Events />} />
        <Route path="membership" element={<Membership />} />
      </Route>
    </Routes>
  </Router>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
