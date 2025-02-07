import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
  } from "react-router-dom";
  import "./app.css";
  
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
          <div className="min-h-screen flex flex-col relative">
            {/* Main Content Area */}
            <Outlet />
          </div>
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    );
  }
  
  export default function Root() {
    return <Layout />;
  }
  