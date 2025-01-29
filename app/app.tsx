import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { Layout } from "./components/ui/layout"
import { HomePage } from "./pages/home"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "about",
        element: <div className="container mx-auto px-4 py-8">About Page</div>,
      },
      {
        path: "programming",
        element: <div className="container mx-auto px-4 py-8">Programming Page</div>,
      },
      {
        path: "spaces",
        element: <div className="container mx-auto px-4 py-8">Spaces & Services Page</div>,
      },
      {
        path: "get-involved",
        element: <div className="container mx-auto px-4 py-8">Get Involved Page</div>,
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
