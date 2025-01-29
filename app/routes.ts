import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("/register", "routes/register.tsx"),
    route("/about", "routes/about.tsx"),
    route("/programming", "routes/programming.tsx"),
    route("/spaces", "routes/spaces.tsx"),
    route("/get-involved", "routes/getinvolved.tsx"),
] satisfies RouteConfig;
