import { redirect } from "react-router";
import type { Route } from "./+types/logout";

import { logout } from "~/utils/session.server";

export const action = async ({
  request,
}: Route.ActionArgs) => logout(request);

export const loader = async () => redirect("/");
