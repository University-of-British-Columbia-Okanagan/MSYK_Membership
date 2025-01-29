import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { User } from "lucide-react"
import type { Route } from "./+types/root"
import "./app.css"

//TODO: you need to move the layout to its own component, and theun update the routes.tsx file to use the layout component (see React Router 7 tutorial)
export function Layout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b">
            <div className="container mx-auto px-4 h-20 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <img
                  // src="https://sjc.microlink.io/IdAdpIVrlcu9ixE9XGhHVPGsb4BzTLyAaJWAz3_rsyXIflfd8gWMjnnBnPwtyDyC8ms_L5rNwP9_Qt9GCkB5qQ.jpeg"
                  src = "public\images\Makerspace Horizontal Text Logo Colour-01.avif"
                  alt="Makerspace YK"
                  className="h-12 w-auto"
                />
              </Link>
              <nav className="hidden md:flex items-center gap-8">
                <Link to="/about" className="text-gray-600 hover:text-gray-900 transition-colors">
                  About
                </Link>
                <Link to="/programming" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Programming
                </Link>
                <Link to="/spaces" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Spaces & Services
                </Link>
                <Link to="/get-involved" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Get Involved
                </Link>
              </nav>
              <Button variant="secondary" className="gap-2">
                <User className="h-4 w-4" />
                User Login
              </Button>
            </div>
          </header>
          <Outlet />
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Layout />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!"
  let details = "An unexpected error occurred."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error"
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}