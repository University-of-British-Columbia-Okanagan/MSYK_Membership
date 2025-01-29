import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, HydratedRouter } from "react-router-dom";
import App from "./root";
import Index from "./routes/_index";
import About from "./routes/about";
import Programming from "./routes/programming";
import Spaces from "./routes/spaces";
import GetInvolved from "./routes/getinvolved";
import HomePage from "./pages/home";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <About /> },
      { path: "programming", element: <Programming /> },
      { path: "spaces", element: <Spaces /> },
      { path: "get-involved", element: <GetInvolved /> },
    ],
  },
]);

if (typeof window !== "undefined") {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      {/* HydratedRouter wraps the RouterProvider */}
      <HydratedRouter router={router} />
    </React.StrictMode>
  );
}

export { router };
