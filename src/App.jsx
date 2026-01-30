import React, { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function apiFetch(path, { method = "GET", body, accessToken } = {}) {
  try {
    if (!API_BASE) {
      return {
        ok: false,
        status: 0,
        data: { error: "VITE_API_BASE_URL is missing (API_BASE is undefined)" },
      };
    }

    const headers = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err.message || "Fetch failed" },
    };
  }
}

// refresh helper
async function refreshAccessToken(refreshToken) {
  return apiFetch("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export default function App() {
  const [signup, setSignup] = useState({ name: "", email: "", password: "" });
  const [login, setLogin] = useState({ email: "", password: "" });

  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken") || ""
  );
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refreshToken") || ""
  );

  const [me, setMe] = useState(null);
  const [adminStats, setAdminStats] = useState(null);

  const [message, setMessage] = useState("");
  const [pw, setPw] = useState({ oldPassword: "", newPassword: "" });

  const isAuthed = useMemo(
    () => !!accessToken && !!refreshToken,
    [accessToken, refreshToken]
  );

  function saveTokens({ accessToken: at, refreshToken: rt }) {
    setAccessToken(at);
    setRefreshToken(rt);
    localStorage.setItem("accessToken", at);
    localStorage.setItem("refreshToken", rt);
  }

  function clearTokens() {
    setAccessToken("");
    setRefreshToken("");
    setMe(null);
    setAdminStats(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }

  async function handleSignup(e) {
    e.preventDefault();
    setMessage("Signing up...");

    const res = await apiFetch("/auth/signup", {
      method: "POST",
      body: signup,
    });

    if (!res.ok) {
      return setMessage(
        `Signup failed (${res.status}): ${res.data.error || "unknown"}`
      );
    }

    setMessage("Signup successful ✅ Now login.");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("Logging in...");

    const res = await apiFetch("/auth/login", {
      method: "POST",
      body: login,
    });

    if (!res.ok) {
      return setMessage(
        `Login failed (${res.status}): ${res.data.error || "unknown"}`
      );
    }

    saveTokens({
      accessToken: res.data.accessToken,
      refreshToken: res.data.refreshToken,
    });

    setMessage("Login successful ✅");
  }

  // calls /me; if 401, refresh once and retry
  async function loadMe() {
    setMessage("Loading /me ...");

    let res = await apiFetch("/me", { accessToken });

    if (res.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);

      if (!refreshed.ok) {
        clearTokens();
        return setMessage("Session expired. Please login again.");
      }

      const newAT = refreshed.data.accessToken;
      setAccessToken(newAT);
      localStorage.setItem("accessToken", newAT);

      res = await apiFetch("/me", { accessToken: newAT });
    }

    if (!res.ok) {
      return setMessage(
        `GET /me failed (${res.status}): ${res.data.error || "unknown"}`
      );
    }

    setMe(res.data.user);
    setMessage("Loaded /me ✅");
  }

  async function loadAdminStats() {
    setMessage("Loading /admin/stats ...");
    setAdminStats(null);

    let res = await apiFetch("/admin/stats", { accessToken });

    if (res.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);

      if (!refreshed.ok) {
        clearTokens();
        return setMessage("Session expired. Please login again.");
      }

      const newAT = refreshed.data.accessToken;
      setAccessToken(newAT);
      localStorage.setItem("accessToken", newAT);

      res = await apiFetch("/admin/stats", { accessToken: newAT });
    }

    if (!res.ok) {
      return setMessage(
        `GET /admin/stats failed (${res.status}): ${res.data.error || "unknown"}`
      );
    }

    setAdminStats(res.data);
    setMessage("Loaded admin stats ✅");
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage("Changing password...");

    let res = await apiFetch("/auth/password", {
      method: "PUT",
      body: pw,
      accessToken,
    });

    if (res.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);

      if (!refreshed.ok) {
        clearTokens();
        return setMessage("Session expired. Please login again.");
      }

      const newAT = refreshed.data.accessToken;
      setAccessToken(newAT);
      localStorage.setItem("accessToken", newAT);

      res = await apiFetch("/auth/password", {
        method: "PUT",
        body: pw,
        accessToken: newAT,
      });
    }

    if (!res.ok) {
      return setMessage(
        `Change password failed (${res.status}): ${res.data.error || "unknown"}`
      );
    }

    setPw({ oldPassword: "", newPassword: "" });
    setMessage("Password changed ✅ (now login with your new password)");
  }

  async function handleLogout() {
    setMessage("Logging out...");

    if (refreshToken) {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      });
    }

    clearTokens();
    setMessage("Logged out ✅");
  }

  return (
    <div
      style={{
        fontFamily: "system-ui",
        padding: 16,
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1>Backend Bootcamp Frontend</h1>
      <p>
        <b>API:</b> {API_BASE || "(missing VITE_API_BASE_URL)"}
      </p>

      <div
        style={{
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <b>Status:</b> {message || "—"}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>Signup</h2>
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="name"
                value={signup.name}
                onChange={(e) => setSignup({ ...signup, name: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="email"
                value={signup.email}
                onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="password"
                type="password"
                value={signup.password}
                onChange={(e) =>
                  setSignup({ ...signup, password: e.target.value })
                }
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <button type="submit" style={{ padding: "8px 12px" }}>
              Signup
            </button>
          </form>
        </section>

        <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="email"
                value={login.email}
                onChange={(e) => setLogin({ ...login, email: e.target.value })}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                placeholder="password"
                type="password"
                value={login.password}
                onChange={(e) =>
                  setLogin({ ...login, password: e.target.value })
                }
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <button type="submit" style={{ padding: "8px 12px" }}>
              Login
            </button>
          </form>

          <div style={{ marginTop: 12 }}>
            <button
              onClick={loadMe}
              disabled={!isAuthed}
              style={{ padding: "8px 12px", marginRight: 8 }}
            >
              Load /me
            </button>

            <button
              onClick={loadAdminStats}
              disabled={!isAuthed}
              style={{ padding: "8px 12px", marginRight: 8 }}
            >
              Load Admin Stats
            </button>

            <button
              onClick={handleLogout}
              disabled={!refreshToken}
              style={{ padding: "8px 12px" }}
            >
              Logout
            </button>
          </div>
        </section>
      </div>

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <h2>Current User (/me)</h2>
        {me ? (
          <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(me, null, 2)}
          </pre>
        ) : (
          <p>No user loaded yet.</p>
        )}
      </section>

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <h2>Admin Stats (/admin/stats)</h2>
        {adminStats ? (
          <pre style={{ background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(adminStats, null, 2)}
          </pre>
        ) : (
          <p>No admin stats loaded.</p>
        )}
      </section>

      <section style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <h2>Change Password</h2>
        <form onSubmit={handleChangePassword}>
          <div style={{ marginBottom: 8 }}>
            <input
              placeholder="oldPassword"
              type="password"
              value={pw.oldPassword}
              onChange={(e) => setPw({ ...pw, oldPassword: e.target.value })}
              style={{ width: "100%", padding: 8 }}
              disabled={!isAuthed}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              placeholder="newPassword (min 8 chars)"
              type="password"
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
              style={{ width: "100%", padding: 8 }}
              disabled={!isAuthed}
            />
          </div>
          <button type="submit" disabled={!isAuthed} style={{ padding: "8px 12px" }}>
            Update Password
          </button>
        </form>
      </section>

      <section style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
        <p>
          Notes: This demo stores tokens in <code>localStorage</code> for simplicity.
          In a real app you’d typically store refresh tokens in an{" "}
          <code>httpOnly</code> cookie.
        </p>
      </section>
    </div>
  );
}
