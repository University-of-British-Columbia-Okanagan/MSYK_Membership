import { logger } from "~/logging/logger";

type BrivoEnv = {
  apiBaseUrl: string;
  authBaseUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  username: string | undefined;
  password: string | undefined;
  apiKey: string | undefined;
};

type BrivoToken = {
  access_token: string;
  expires_in: number;
};

export type BrivoPersonInput = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  brivoPersonId?: string | null;
};

type BrivoPersonApi = {
  id: string | number;
};

type BrivoPerson = {
  id: string;
};

class BrivoError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BrivoError";
    this.status = status;
  }
}

class BrivoClient {
  private env: BrivoEnv;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(env?: Partial<BrivoEnv>) {
    let apiBaseUrl =
      env?.apiBaseUrl ??
      process.env.BRIVO_BASE_URL ??
      "https://api.brivo.com/v1/api";
    apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    apiBaseUrl = apiBaseUrl.replace(/\/v1\/api$/, "");
    apiBaseUrl = apiBaseUrl.replace(/\/api\/v1$/, "");
    apiBaseUrl = apiBaseUrl.replace(/\/api$/, "");
    apiBaseUrl = apiBaseUrl.replace(/\/v1$/, "");
    apiBaseUrl = `${apiBaseUrl}/v1/api`;

    this.env = {
      apiBaseUrl,
      authBaseUrl: env?.authBaseUrl ?? process.env.BRIVO_AUTH_BASE_URL ?? "https://auth.brivo.com",
      clientId: env?.clientId ?? process.env.BRIVO_CLIENT_ID,
      clientSecret: env?.clientSecret ?? process.env.BRIVO_CLIENT_SECRET,
      username: env?.username ?? process.env.BRIVO_USERNAME,
      password: env?.password ?? process.env.BRIVO_PASSWORD,
      apiKey: env?.apiKey ?? process.env.BRIVO_API_KEY,
    };

    logger.debug("Brivo API base configured", {
      configuredBaseUrl: this.env.apiBaseUrl,
    });
  }

  isEnabled(): boolean {
    return Boolean(
      this.env.clientId &&
        this.env.clientSecret &&
        this.env.username &&
        this.env.password &&
        this.env.apiKey,
    );
  }

  private async getAccessToken(): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error("Brivo credentials are not configured");
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now + 5_000) {
      return this.cachedToken.value;
    }

    try {
      const tokenUrl = `${this.env.authBaseUrl}/oauth/token`;
      const basicAuth = Buffer.from(
        `${this.env.clientId}:${this.env.clientSecret}`,
      ).toString("base64");

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "password",
          username: this.env.username ?? "",
          password: this.env.password ?? "",
        }).toString(),
      });

      if (!response.ok) {
        const body = await response.text();
        let errorMessage = `Failed to fetch Brivo token (${response.status})`;
        if (response.status === 403 && body.includes("Developer Inactive")) {
          errorMessage = "Brivo developer account is inactive. Please activate your account in the Brivo developer portal.";
        } else if (body) {
          errorMessage += `: ${body.substring(0, 200)}`;
        }

        logger.error("Brivo OAuth token request failed", {
          url: tokenUrl,
          status: response.status,
          statusText: response.statusText,
          body: body.substring(0, 500),
          hasClientId: !!this.env.clientId,
          hasClientSecret: !!this.env.clientSecret,
          hasUsername: !!this.env.username,
          hasPassword: !!this.env.password,
          hasApiKey: !!this.env.apiKey,
        });
        throw new BrivoError(errorMessage, response.status);
      }

      const data = (await response.json()) as BrivoToken;
      logger.info("Brivo OAuth token obtained successfully", {
        expiresIn: data.expires_in,
      });
      this.cachedToken = {
        value: data.access_token,
        expiresAt: now + data.expires_in * 1000,
      };
      return data.access_token;
    } catch (error) {
      if (error instanceof BrivoError) {
        throw error;
      }
      logger.error("Brivo OAuth token network error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BrivoError(
        `Brivo OAuth network error: ${error instanceof Error ? error.message : String(error)}`,
        0,
      );
    }
  }

  private async request<T>(
    path: string,
    init: RequestInit & { retryAuth?: boolean } = {},
  ): Promise<T> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (this.env.apiKey) {
      headers.set("api-key", this.env.apiKey);
    }
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");

    const url = `${this.env.apiBaseUrl}${path}`;

    logger.debug("Brivo API request", {
      url,
      method: init.method || "GET",
    });

    try {
      const response = await fetch(url, {
        ...init,
        headers,
      });

      if (response.status === 401 && !init.retryAuth) {
        this.cachedToken = null;
        return this.request<T>(path, { ...init, retryAuth: true });
      }

      if (!response.ok) {
        const payload = await response.text();
        const errorMeta: Record<string, unknown> = {
          url,
          path,
          baseUrl: this.env.apiBaseUrl,
          method: init.method || "GET",
          status: response.status,
          statusText: response.statusText,
          payload,
          hasApiKey: !!this.env.apiKey,
        };
        if (response.status === 596) {
          errorMeta["note"] =
            "Brivo returned 596 Service Not Found – confirm account region and endpoint path (/v1/api).";
        }
        logger.error("Brivo API request failed", errorMeta);
        throw new BrivoError(
          `Brivo request failed (${response.status} ${response.statusText}): ${payload}`,
          response.status,
        );
      }

      if (response.status === 204) {
        return null as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BrivoError) {
        throw error;
      }
      logger.error("Brivo API network error", {
        url,
        path,
        baseUrl: this.env.apiBaseUrl,
        method: init.method || "GET",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BrivoError(
        `Brivo network error: ${error instanceof Error ? error.message : String(error)}`,
        596,
      );
    }
  }

  private normalizePerson(person: BrivoPersonApi | null | undefined): BrivoPerson | null {
    if (!person) {
      return null;
    }
    return {
      id: typeof person.id === "string" ? person.id : String(person.id),
    };
  }

  private async findPersonByEmail(email: string): Promise<BrivoPerson | null> {
    try {
      const search = new URLSearchParams({
        pageSize: "1",
        filter: `emails.address__eq:${email}`,
      });
      const result = await this.request<{ data: BrivoPersonApi[] }>(
        `/users?${search.toString()}`,
        { method: "GET" },
      );
      return this.normalizePerson(result?.data?.[0]);
    } catch (error) {
      logger.warn("Unable to search Brivo person by email", {
        email,
        error,
      });
      return null;
    }
  }

  async ensurePerson(user: BrivoPersonInput): Promise<BrivoPerson> {
    if (!this.isEnabled()) {
      throw new Error("Brivo is not configured");
    }

    const payload = {
      firstName: user.firstName,
      lastName: user.lastName,
      emails: [{ address: user.email, type: "Work" }],
      phoneNumbers: user.phone ? [{ number: user.phone, type: "Mobile" }] : undefined,
    };

    const existingPersonId =
      user.brivoPersonId ?? (await this.findPersonByEmail(user.email))?.id;
    const normalizedExistingId =
      existingPersonId !== undefined && existingPersonId !== null
        ? String(existingPersonId)
        : null;

    if (normalizedExistingId) {
      await this.request(`/users/${normalizedExistingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return { id: normalizedExistingId };
    }

    const created = await this.request<BrivoPersonApi>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const normalized = this.normalizePerson(created);
    if (!normalized) {
      throw new BrivoError("Brivo did not return a person id", 500);
    }
    return normalized;
  }

  async assignGroups(personId: string, groupIds: string[]): Promise<void> {
    // WARNING: This performs a full sync - user will be removed from groups NOT in groupIds
    if (!this.isEnabled()) return;

    const desired = new Set(groupIds);

    const current = await this.request<{ data: { id: string }[] }>(
      `/users/${personId}/groups`,
      { method: "GET" },
    );
    const currentIds = new Set((current?.data ?? []).map((g) => g.id));

    const toAdd = groupIds.filter((id) => !currentIds.has(id));
    const toRemove = Array.from(currentIds).filter(
      (id) => !desired.has(id),
    );

    for (const groupId of toAdd) {
      await this.request(`/groups/${groupId}/users/${personId}`, {
        method: "PUT",
      });
    }

    for (const groupId of toRemove) {
      await this.request(`/groups/${groupId}/users/${personId}`, {
        method: "DELETE",
      });
    }
  }
  async revokeFromGroups(personId: string, groupIds: string[]): Promise<void> {
    if (!this.isEnabled() || groupIds.length === 0) return;

    for (const groupId of groupIds) {
      try {
        await this.request(`/groups/${groupId}/users/${personId}`, {
          method: "DELETE",
        });
      } catch (error) {
        logger.warn("Failed to revoke Brivo group membership", {
          personId,
          groupId,
          error,
        });
      }
    }
  }

  async ensureMobilePass(personId: string, email: string): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error("Brivo is not configured");
    }

    const listRes = await this.request<{ data: DigitalInvitation[] }>(
      `/users/${personId}/credentials/digital-invitations?filter=status__eq:pending`,
      { method: "GET" },
    );

    const pending = listRes?.data?.find((inv) => inv.status === "PENDING");
    if (pending) {
      return String(pending.credentialId);
    }

    const redeemedRes = await this.request<{ data: DigitalInvitation[] }>(
      `/users/${personId}/credentials/digital-invitations?filter=status__eq:redeemed`,
      { method: "GET" },
    );
    const redeemed = redeemedRes?.data?.find((inv) => inv.status === "REDEEMED");
    if (redeemed) {
      return String(redeemed.credentialId);
    }

    const created = await this.request<DigitalInvitation>(
      `/users/${personId}/credentials/digital-invitations?sendInvitationEmail=true&language=en`,
      {
        method: "POST",
        body: JSON.stringify({ referenceId: email }),
      },
    );

    if (!created?.credentialId) {
      throw new BrivoError("Brivo did not return a credentialId for mobile pass", 500);
    }

    return String(created.credentialId);
  }

  async revokeMobilePass(personId: string): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      await this.request(
        `/users/${personId}/credentials/digital-invitations`,
        { method: "DELETE" },
      );
    } catch (error) {
      logger.warn("Failed to cancel Brivo mobile pass invitation", {
        personId,
        error,
      });
    }
  }
}

type DigitalInvitation = {
  id: number;
  referenceId: string;
  credentialId: number;
  accessCode: string;
  created: string;
  expiration: string;
  status: "PENDING" | "REDEEMED" | "EXPIRED" | "CANCELLED";
  nfcEnabled: boolean;
};

export const brivoClient = new BrivoClient();


