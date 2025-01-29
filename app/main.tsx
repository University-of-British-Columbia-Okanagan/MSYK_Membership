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

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // Main layout containing Navbar and Outlet
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <About /> }, // About is now independent
      { path: "board", element: <Board /> }, // Not nested inside /about
      { path: "staff", element: <Staff /> }, // Not nested inside /about
      { path: "contact", element: <Contact /> }, // Not nested inside /about
      { path: "programming", element: <Programming /> },
      { path: "spaces", element: <Spaces /> },
      { path: "get-involved", element: <GetInvolved /> },
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
