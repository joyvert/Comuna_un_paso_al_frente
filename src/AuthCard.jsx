import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { api } from "./api";
import { getLocalUser, updateLocalUserCredentials } from "./authLocal";

const STORAGE_SESSION_KEY = "comuna_session_v1";

const consejos = [
  "La Esperanza",
  "Pablo Bolívar",
  "Carlos Bello",
  "Corazón de mi Patria",
  "José Gregorio Hernández",
];
const calles = ["El Plan", "Los Portugueses", "Los Peñas", "La Acequia"];

// Preguntas de recuperación (ejemplos)
const preguntas1 = [
  "Nombre de tu primera mascota",
  "Ciudad de nacimiento",
  "Nombre de tu mejor amigo",
  "Nombre de tu escuela primaria",
];
const preguntas2 = [
  "Nombre de tu profesor favorito",
  "Lugar de vacaciones memorable",
  "Comida favorita",
  "Color favorito",
];

const normalizeId = (s) => String(s || "").trim().toLowerCase();

/** 429 por rate limit o bloqueo por intentos fallidos: no usar fallback local como error de credenciales */
function isRateLimitOrLockout(err) {
  return err?.status === 429 || err?.retryAfterSeconds != null;
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return bufferToHex(digest);
}

function randomSaltHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bufferToHex(bytes.buffer);
}

async function hashPasswordWithSalt(password, salt) {
  // Nota: demo local. En producción se debe usar un backend con bcrypt/argon2 + rate limiting.
  return sha256Hex(`${salt}::${password}`);
}

function passwordStrength(password) {
  const pw = String(password || "");
  const rules = [
    { label: "Mínimo 8 caracteres", ok: pw.length >= 8 },
    { label: "Número", ok: /\d/.test(pw) },
  ];
  const score = rules.reduce((acc, r) => acc + (r.ok ? 1 : 0), 0);
  const percent = (score / rules.length) * 100;
  const strength =
    score === 0 ? "Débil" : score === 1 ? "Media" : "Fuerte";

  return { rules, score, percent, strength };
}

function TextField({ icon: Icon, label, placeholder, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 shadow-sm">
        {Icon ? <Icon className="h-4 w-4 text-cyan-600" aria-hidden /> : null}
        <input
          className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
          placeholder={placeholder}
          value={value}
          type={type}
          onChange={onChange}
        />
      </div>
    </label>
  );
}

function PasswordField({ icon: Icon, label, placeholder, value, onChange, visible, onToggle }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 shadow-sm">
        {Icon ? <Icon className="h-4 w-4 text-cyan-600" aria-hidden /> : null}
        <input
          className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
          placeholder={placeholder}
          value={value}
          type={visible ? "text" : "password"}
          onChange={onChange}
        />
        <button
          type="button"
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={onToggle}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 shadow-sm text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#143c6e]/15"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function AuthCard({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "recover"
  const [loading, setLoading] = useState(false);
  const [regStatus, setRegStatus] = useState({ loading: true, open: false, firstUserPending: false, error: null });
  const allowRegisterUi = !regStatus.loading && regStatus.open;
  const [globalMessage, setGlobalMessage] = useState({ type: "info", text: "" });
  const [panelHeight, setPanelHeight] = useState(0);
  const loginPanelRef = useRef(null);
  const registerPanelRef = useRef(null);
  const recoveryPanelRef = useRef(null);

  /** Recuperación de contraseña (preguntas de seguridad) */
  const [recoverStep, setRecoverStep] = useState(1);
  const [recoverUserId, setRecoverUserId] = useState("");
  const [recoveryMeta, setRecoveryMeta] = useState(null);
  const [recoverA1, setRecoverA1] = useState("");
  const [recoverA2, setRecoverA2] = useState("");
  const [recoverPw, setRecoverPw] = useState("");
  const [recoverPw2, setRecoverPw2] = useState("");
  const [showRecoverPw, setShowRecoverPw] = useState(false);
  const [showRecoverPw2, setShowRecoverPw2] = useState(false);

  const [loginForm, setLoginForm] = useState({ usuario: "", password: "" });
  const [showLoginPass, setShowLoginPass] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    nombre: "",
    apellido: "",
    vocero: consejos[0],
    calle: calles[0],
    usuario: "",
    password: "",
    password2: "",
    pregunta1: preguntas1[0],
    respuesta1: "",
    pregunta2: preguntas2[0],
    respuesta2: "",
  });
  const [showPassReg, setShowPassReg] = useState(false);
  const [showPassReg2, setShowPassReg2] = useState(false);

  useEffect(() => {
    api
      .getRegistrationOpen()
      .then((d) =>
        setRegStatus({
          loading: false,
          open: Boolean(d.open),
          firstUserPending: Boolean(d.firstUserPending),
          error: null,
        }),
      )
      .catch((err) => {
        console.warn("[AuthCard] No se pudo comprobar registro:", err?.message);
        setRegStatus({ loading: false, open: false, firstUserPending: false, error: err?.message || "Error de conexión" });
      });
  }, []);

  const strength = useMemo(
    () => passwordStrength(registerForm.password),
    [registerForm.password],
  );

  const canRegister = useMemo(() => {
    const pwOk = strength.rules.every((r) => r.ok);
    const match = registerForm.password === registerForm.password2 && registerForm.password2.length > 0;
    const required =
      registerForm.nombre.trim() &&
      registerForm.apellido.trim() &&
      registerForm.usuario.trim() &&
      registerForm.respuesta1.trim() &&
      registerForm.respuesta2.trim();
    return Boolean(required && pwOk && match);
  }, [registerForm, strength]);

  const slideStyle = useMemo(() => {
    if (mode === "login") return { transform: "translateX(0%) rotateY(0deg)" };
    if (mode === "register") return { transform: "translateX(-50%) rotateY(8deg)" };
    return { transform: "translateX(0%) rotateY(0deg)" };
  }, [mode]);

  const strengthRecover = useMemo(() => passwordStrength(recoverPw), [recoverPw]);

  const canSubmitRecovery = useMemo(() => {
    const sr = passwordStrength(recoverPw);
    const pwOk = sr.rules.every((r) => r.ok);
    const match = recoverPw === recoverPw2 && recoverPw2.length > 0;
    return Boolean(
      recoveryMeta && recoverA1.trim() && recoverA2.trim() && pwOk && match,
    );
  }, [recoveryMeta, recoverA1, recoverA2, recoverPw, recoverPw2]);

  function resetRecoveryView() {
    setGlobalMessage({ type: "info", text: "" });
    setRecoverStep(1);
    setRecoverUserId("");
    setRecoveryMeta(null);
    setRecoverA1("");
    setRecoverA2("");
    setRecoverPw("");
    setRecoverPw2("");
  }

  function openRecovery() {
    setGlobalMessage({ type: "info", text: "" });
    setRecoverStep(1);
    setRecoveryMeta(null);
    setRecoverA1("");
    setRecoverA2("");
    setRecoverPw("");
    setRecoverPw2("");
    setRecoverUserId(loginForm.usuario.trim());
    setMode("recover");
  }

  useEffect(() => {
    const measure = () => {
      let el = null;
      if (mode === "recover") el = recoveryPanelRef.current;
      else if (mode === "login") el = loginPanelRef.current;
      else if (mode === "register" && allowRegisterUi) el = registerPanelRef.current;
      else el = loginPanelRef.current;
      if (!el) return;
      setPanelHeight(el.scrollHeight);
    };

    const t = window.setTimeout(measure, 0);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [mode, loading, globalMessage.text, recoverStep, recoveryMeta, allowRegisterUi]);

  async function handleLogin(e) {
    e.preventDefault();
    setGlobalMessage({ type: "info", text: "" });
    setLoading(true);
    try {
      if (!loginForm.usuario.trim() || !loginForm.password.trim()) {
        setGlobalMessage({ type: "error", text: "Completa usuario y contraseña." });
        return;
      }

      const userId = normalizeId(loginForm.usuario);
      let salt = "";

      try {
        const saltRes = await api.getSalt(userId);
        salt = saltRes.salt;
      } catch (err) {
        if (isRateLimitOrLockout(err)) {
          setGlobalMessage({
            type: "error",
            text: err?.message || "Demasiadas consultas. Espera unos minutos e inténtalo de nuevo.",
          });
          return;
        }
        setGlobalMessage({
          type: "error",
          text:
            "No se encontró la cuenta o el servidor no responde. Si eres vocero, pide al administrador que cree tu usuario.",
        });
        return;
      }

      const hash = await hashPasswordWithSalt(loginForm.password, salt);
      let sessionUserId = userId;
      let userData = null;
      let accessToken = null;

      try {
        let login;
        try {
          login = await api.login({ userId, passwordHash: hash });
        } catch (e) {
          // Fallback para contraseñas reseteadas por Firebase Console o Email (Texto plano)
          login = await api.login({ userId, passwordHash: loginForm.password });
        }
        
        sessionUserId = login?.userId || login?.user?.user_id || userId;
        // api.login ahora devuelve datos en la raíz, no en .user
        userData = login?.user || login;
        accessToken = login?.accessToken ?? null;
      } catch (err) {
        if (isRateLimitOrLockout(err)) {
          setGlobalMessage({
            type: "error",
            text: err?.message || "Demasiados intentos. Espera antes de volver a intentar.",
          });
          return;
        }
        setGlobalMessage({ type: "error", text: err?.message || "Usuario o contraseña incorrectos." });
        return;
      }

      if (!accessToken || !userData) {
        setGlobalMessage({
          type: "error",
          text: "Error de sesión. Intenta de nuevo o contacta al administrador.",
        });
        return;
      }

      const session = {
        token:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        userId: sessionUserId,
        at: Date.now(),
        accessToken,
        nombre: userData.nombre,
        apellido: userData.apellido,
        vocero: userData.vocero,
        calle: userData.calle,
        isAdmin: Boolean(userData.isAdmin || userData.is_admin),
      };
      sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
      setGlobalMessage({ type: "success", text: "¡Inicio de sesión exitoso!" });
      onAuthSuccess?.();
    } catch (err) {
      setGlobalMessage({ type: "error", text: err?.message || "Error al iniciar sesión." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setGlobalMessage({ type: "info", text: "" });
    setLoading(true);
    try {
      if (!canRegister) {
        setGlobalMessage({
          type: "error",
          text: "Revisa los campos obligatorios y la fuerza de la contraseña.",
        });
        return;
      }

      const userId = normalizeId(registerForm.usuario);
      if (!userId) {
        setGlobalMessage({ type: "error", text: "Ingresa un correo o cédula válido." });
        return;
      }

      const salt = randomSaltHex();
      const passwordHash = await hashPasswordWithSalt(registerForm.password, salt);
      const answer1Hash = await sha256Hex(`${salt}::q1::${normalizeId(registerForm.respuesta1)}`);
      const answer2Hash = await sha256Hex(`${salt}::q2::${normalizeId(registerForm.respuesta2)}`);

      const payload = {
        userId,
        nombre: registerForm.nombre.trim(),
        apellido: registerForm.apellido.trim(),
        vocero: registerForm.vocero,
        calle: registerForm.calle,
        salt,
        passwordHash,
        pregunta1: registerForm.pregunta1,
        pregunta2: registerForm.pregunta2,
        respuesta1Hash: answer1Hash,
        respuesta2Hash: answer2Hash,
      };

      try {
        const data = await api.register(payload);
        setGlobalMessage({
          type: "success",
          text: data.message || "Cuenta creada. Ya puedes iniciar sesión.",
        });
        api.getRegistrationOpen().then((d) =>
          setRegStatus({
            loading: false,
            open: Boolean(d.open),
            firstUserPending: Boolean(d.firstUserPending),
          }),
        );
      } catch (err) {
        if (isRateLimitOrLockout(err)) {
          setGlobalMessage({
            type: "error",
            text: err?.message || "Límite de registros alcanzado. Intenta más tarde.",
          });
          return;
        }
        setGlobalMessage({
          type: "error",
          text: err?.message || "No se pudo registrar. Comprueba la API y que tengas permiso para registrarte.",
        });
        return;
      }

      setTimeout(() => {
        setGlobalMessage({ type: "info", text: "" });
        setMode("login");
        setRegisterForm((p) => ({
          ...p,
          password: "",
          password2: "",
          respuesta1: "",
          respuesta2: "",
        }));
      }, 900);
    } catch (err) {
      setGlobalMessage({ type: "error", text: err?.message || "No se pudo completar el registro." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoveryStep1(e) {
    e.preventDefault();
    setGlobalMessage({ type: "info", text: "" });
    const userId = normalizeId(recoverUserId);
    if (!userId) {
      setGlobalMessage({ type: "error", text: "Ingresa tu correo o cédula." });
      return;
    }
    setLoading(true);
    try {
      try {
        const data = await api.getRecoveryQuestions(userId);
        setRecoveryMeta({
          pregunta1: data.pregunta1,
          pregunta2: data.pregunta2,
          salt: data.salt,
        });
      } catch (err) {
        if (isRateLimitOrLockout(err)) {
          setGlobalMessage({
            type: "error",
            text: err?.message || "Demasiadas consultas. Espera unos minutos.",
          });
          return;
        }
        const local = getLocalUser(userId);
        if (!local?.pregunta1 || !local?.salt) {
          setGlobalMessage({
            type: "error",
            text: "No encontramos esa cuenta o no hay preguntas guardadas. Prueba con el servidor activo o una cuenta registrada en este navegador.",
          });
          return;
        }
        setRecoveryMeta({
          pregunta1: local.pregunta1,
          pregunta2: local.pregunta2,
          salt: local.salt,
        });
      }
      setRecoverStep(2);
    } catch (err) {
      setGlobalMessage({ type: "error", text: err?.message || "No se pudieron cargar las preguntas." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoverySubmit(e) {
    e.preventDefault();
    setGlobalMessage({ type: "info", text: "" });
    if (!canSubmitRecovery || !recoveryMeta) {
      setGlobalMessage({
        type: "error",
        text: "Completa las respuestas y una contraseña nueva válida.",
      });
      return;
    }
    const userId = normalizeId(recoverUserId);
    const a1h = await sha256Hex(`${recoveryMeta.salt}::q1::${normalizeId(recoverA1)}`);
    const a2h = await sha256Hex(`${recoveryMeta.salt}::q2::${normalizeId(recoverA2)}`);
    const newSalt = randomSaltHex();
    const newPasswordHash = await hashPasswordWithSalt(recoverPw, newSalt);

    setLoading(true);
    try {
      try {
        await api.resetPassword({
          userId,
          respuesta1Hash: a1h,
          respuesta2Hash: a2h,
          newSalt,
          newPasswordHash,
        });
      } catch (apiErr) {
        if (isRateLimitOrLockout(apiErr)) {
          setGlobalMessage({
            type: "error",
            text: apiErr?.message || "Demasiados intentos. Espera antes de volver a intentar.",
          });
          return;
        }
        const local = getLocalUser(userId);
        if (
          !local ||
          local.respuesta1Hash !== a1h ||
          local.respuesta2Hash !== a2h
        ) {
          setGlobalMessage({
            type: "error",
            text: apiErr?.message || "Las respuestas no coinciden o no se pudo contactar al servidor.",
          });
          return;
        }
        updateLocalUserCredentials(userId, { salt: newSalt, passwordHash: newPasswordHash });
      }

      setGlobalMessage({
        type: "success",
        text: "Contraseña actualizada. Ya puedes iniciar sesión.",
      });
      setTimeout(() => {
        setGlobalMessage({ type: "info", text: "" });
        resetRecoveryView();
        setMode("login");
        setLoginForm((p) => ({ ...p, usuario: recoverUserId.trim(), password: "" }));
      }, 1200);
    } catch (err) {
      setGlobalMessage({ type: "error", text: err?.message || "No se pudo restablecer la contraseña." });
    } finally {
      setLoading(false);
    }
  }

  const isError = globalMessage.type === "error";
  const isSuccess = globalMessage.type === "success";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] px-4 relative overflow-hidden">
      {/* Background Image with Dark Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center pointer-events-none transition-all duration-1000"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1920&q=80')`,
        }}
      />
      <div className="absolute inset-0 bg-[#090d16]/80 backdrop-blur-sm pointer-events-none" />

      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#1e3a8a]/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-[#06b6d4]/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="relative w-full max-w-2xl z-10 animate-fade-in-up">
        <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-4 sm:p-6 md:p-10 shadow-2xl border border-white/40">
          <div className="mb-4 sm:mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/10 text-cyan-600 shadow-sm">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 font-heading">Comuna un paso al frente</p>
                <p className="text-xs text-slate-500">Acceso seguro para el equipo</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Validación en cliente + preparación para servidor
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 [perspective:1200px]">
            {/* Overlay para sensación de flip */}
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300">
              <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-slate-900/10 blur-2xl" />
            </div>

            <div
              className="relative transition-[height] duration-500 ease-in-out"
              style={{ height: panelHeight || undefined }}
            >
              {mode === "recover" ? (
                <div ref={recoveryPanelRef} className="p-4 sm:p-6 md:p-10">
                  <div className="mb-4 sm:mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 shadow-sm">
                        <KeyRound className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <h2 className="text-xl sm:text-2xl font-bold text-cyan-600">Recuperar contraseña</h2>
                        <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-600">
                          {recoverStep === 1
                            ? "Indica tu correo o cédula para cargar tus preguntas de seguridad."
                            : "Responde como al registrarte y elige una contraseña nueva."}
                        </p>
                      </div>
                    </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                        onClick={() => {
                          setGlobalMessage({ type: "info", text: "" });
                          setMode("login");
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        Volver al login
                      </button>
                  </div>

                  {globalMessage.text ? (
                    <div
                      className={[
                        "mb-5 rounded-xl border px-4 py-3 text-sm",
                        isError ? "border-red-200 bg-red-50 text-red-700" : "",
                        isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "",
                        !isError && !isSuccess ? "border-slate-200 bg-slate-50 text-slate-700" : "",
                      ].join(" ")}
                    >
                      {globalMessage.text}
                    </div>
                  ) : null}

                  {recoverStep === 1 ? (
                    <form className="space-y-5" autoComplete="off" onSubmit={handleRecoveryStep1}>
                      <TextField
                        icon={Mail}
                        label="Correo electrónico o Cédula"
                        placeholder="El mismo que usas para iniciar sesión"
                        value={recoverUserId}
                        onChange={(e) => setRecoverUserId(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {loading ? "Buscando…" : "Continuar"}
                      </button>
                    </form>
                  ) : (
                    <form className="space-y-5" autoComplete="off" onSubmit={handleRecoverySubmit}>
                      <TextField
                        label={recoveryMeta?.pregunta1 || "Pregunta 1"}
                        placeholder="Tu respuesta"
                        value={recoverA1}
                        onChange={(e) => setRecoverA1(e.target.value)}
                      />
                      <TextField
                        label={recoveryMeta?.pregunta2 || "Pregunta 2"}
                        placeholder="Tu respuesta"
                        value={recoverA2}
                        onChange={(e) => setRecoverA2(e.target.value)}
                      />
                      <PasswordField
                        icon={Lock}
                        label="Nueva contraseña"
                        placeholder="Mínimo 8 caracteres y 1 número"
                        value={recoverPw}
                        onChange={(e) => setRecoverPw(e.target.value)}
                        visible={showRecoverPw}
                        onToggle={() => setShowRecoverPw((v) => !v)}
                      />
                      <PasswordField
                        icon={Lock}
                        label="Confirmar nueva contraseña"
                        placeholder="Repite la contraseña"
                        value={recoverPw2}
                        onChange={(e) => setRecoverPw2(e.target.value)}
                        visible={showRecoverPw2}
                        onToggle={() => setShowRecoverPw2((v) => !v)}
                      />

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-600">Fuerza de contraseña</p>
                          <p className="text-xs font-semibold text-cyan-600">{strengthRecover.strength}</p>
                        </div>
                        <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                          <div
                            className="h-2.5 rounded-full bg-slate-900"
                            style={{ width: `${strengthRecover.percent}%` }}
                            aria-hidden
                          />
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {strengthRecover.rules.map((r) => (
                            <div key={r.label} className="flex items-center gap-2 text-xs text-slate-600">
                              <span
                                className={[
                                  "inline-flex h-2 w-2 rounded-full",
                                  r.ok ? "bg-emerald-500" : "bg-slate-300",
                                ].join(" ")}
                                aria-hidden
                              />
                              {r.label}
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !canSubmitRecovery}
                        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {loading ? "Guardando…" : "Restablecer contraseña"}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
              <div
                className={`flex items-start transition-transform duration-700 ease-out [transform-style:preserve-3d] ${
                  allowRegisterUi ? "w-[200%]" : "w-full"
                }`}
                style={allowRegisterUi ? slideStyle : undefined}
              >
              {/* Login */}
              <div
                ref={loginPanelRef}
                className={`p-4 sm:p-6 md:p-10 ${allowRegisterUi ? "w-1/2" : "w-full"}`}
              >
                <form
                  className="space-y-4 sm:space-y-5"
                  autoComplete="off"
                  onSubmit={handleLogin}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-cyan-600">Inicio de Sesión</h2>
                      <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-600">Accede con tu correo o cédula.</p>
                    </div>
                    {allowRegisterUi ? (
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 self-start sm:self-auto"
                        onClick={() => {
                          setGlobalMessage({ type: "info", text: "" });
                          setMode("register");
                        }}
                      >
                        Registrarte
                      </button>
                    ) : (
                      <p className="max-w-[220px] text-left sm:text-right text-[10px] sm:text-xs text-slate-500 leading-normal">
                        {regStatus.loading
                          ? "Comprobando registro…"
                          : regStatus.error
                            ? "No se pudo conectar con la API. Comprueba que esté en http://localhost:4000"
                            : "Las cuentas de vocero las crea el administrador desde el panel."}
                      </p>
                    )}
                  </div>

                  <TextField
                    icon={Mail}
                    label="Correo electrónico o Cédula"
                    placeholder="Ej. juan@example.com o V-12345678"
                    value={loginForm.usuario}
                    onChange={(e) => setLoginForm((p) => ({ ...p, usuario: e.target.value }))}
                    type="text"
                  />

                  <PasswordField
                    icon={Lock}
                    label="Contraseña"
                    placeholder="Tu contraseña"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    visible={showLoginPass}
                    onToggle={() => setShowLoginPass((v) => !v)}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button type="button" className="text-cyan-600 font-medium hover:underline" onClick={openRecovery}>
                      Olvidé mi contraseña
                    </button>
                    {allowRegisterUi ? (
                      <button
                        type="button"
                        className="text-cyan-600 font-medium hover:underline"
                        onClick={() => {
                          setGlobalMessage({ type: "info", text: "" });
                          setMode("register");
                        }}
                      >
                        ¿No tienes cuenta? Regístrate aquí
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "Validando…" : "Iniciar Sesión"}
                  </button>

                  {globalMessage.text ? (
                    <div
                      className={[
                        "rounded-xl border px-4 py-3 text-sm",
                        isError ? "border-red-200 bg-red-50 text-red-700" : "",
                        isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "",
                        !isError && !isSuccess ? "border-slate-200 bg-slate-50 text-slate-700" : "",
                      ].join(" ")}
                    >
                      {globalMessage.text}
                    </div>
                  ) : null}
                </form>
              </div>

              {/* Registro: primer usuario en BD o ALLOW_PUBLIC_REGISTER en API */}
              {allowRegisterUi ? (
              <div ref={registerPanelRef} className="w-1/2 p-4 sm:p-6 md:p-10">
                <form
                  className="space-y-4 sm:space-y-5"
                  autoComplete="off"
                  onSubmit={handleRegister}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-cyan-600">Registro</h2>
                      <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-600">
                        {regStatus.firstUserPending
                          ? "Eres el primer usuario: esta cuenta será administrador del sistema."
                          : "Crea una cuenta de vocero (solo un administrador autorizado puede abrir el registro público)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 self-start sm:self-auto shrink-0"
                      onClick={() => setMode("login")}
                    >
                      Ya tengo cuenta
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      icon={User}
                      label="Nombre"
                      placeholder="Nombre"
                      value={registerForm.nombre}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, nombre: e.target.value }))}
                    />
                    <TextField
                      icon={User}
                      label="Apellido"
                      placeholder="Apellido"
                      value={registerForm.apellido}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, apellido: e.target.value }))}
                    />
                    <SelectField
                      label="Vocero del Consejo Comunal"
                      value={registerForm.vocero}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, vocero: e.target.value }))}
                      options={consejos}
                    />
                    <SelectField
                      label="Calle"
                      value={registerForm.calle}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, calle: e.target.value }))}
                      options={calles}
                    />
                    <TextField
                      icon={Mail}
                      label="Correo electrónico o Cédula"
                      placeholder="Ej. juan@example.com o V-12345678"
                      value={registerForm.usuario}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, usuario: e.target.value }))}
                      type="text"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <PasswordField
                      icon={Lock}
                      label="Contraseña"
                      placeholder="Mínimo 10 caracteres"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
                      visible={showPassReg}
                      onToggle={() => setShowPassReg((v) => !v)}
                    />
                    <PasswordField
                      icon={Lock}
                      label="Confirmar Contraseña"
                      placeholder="Repite la contraseña"
                      value={registerForm.password2}
                      onChange={(e) => setRegisterForm((p) => ({ ...p, password2: e.target.value }))}
                      visible={showPassReg2}
                      onToggle={() => setShowPassReg2((v) => !v)}
                    />
                  </div>

                  {/* Fuerza de contraseña */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-600">Fuerza de contraseña</p>
                      <p className="text-xs font-semibold text-cyan-600">{strength.strength}</p>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                      <div
                        className="h-2.5 rounded-full bg-slate-900"
                        style={{ width: `${strength.percent}%` }}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {strength.rules.map((r) => (
                        <div key={r.label} className="flex items-center gap-2 text-xs text-slate-600">
                          <span
                            className={[
                              "inline-flex h-2 w-2 rounded-full",
                              r.ok ? "bg-emerald-500" : "bg-slate-300",
                            ].join(" ")}
                            aria-hidden
                          />
                          {r.label}
                        </div>
                      ))}
                    </div>
                    {registerForm.password2 && registerForm.password2 !== registerForm.password ? (
                      <p className="mt-2 text-xs font-medium text-red-700">
                        Las contraseñas no coinciden.
                      </p>
                    ) : null}
                  </div>

                  {/* Seguridad */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-cyan-600">
                      Preguntas de Seguridad (para recuperación de cuenta)
                    </h3>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <SelectField
                          label="Pregunta 1"
                          value={registerForm.pregunta1}
                          onChange={(e) => setRegisterForm((p) => ({ ...p, pregunta1: e.target.value }))}
                          options={preguntas1}
                        />
                        <TextField
                          label="Respuesta 1"
                          placeholder="Escribe tu respuesta"
                          value={registerForm.respuesta1}
                          onChange={(e) => setRegisterForm((p) => ({ ...p, respuesta1: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <SelectField
                          label="Pregunta 2"
                          value={registerForm.pregunta2}
                          onChange={(e) => setRegisterForm((p) => ({ ...p, pregunta2: e.target.value }))}
                          options={preguntas2}
                        />
                        <TextField
                          label="Respuesta 2"
                          placeholder="Escribe tu respuesta"
                          value={registerForm.respuesta2}
                          onChange={(e) => setRegisterForm((p) => ({ ...p, respuesta2: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !canRegister}
                    className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {loading ? "Creando cuenta…" : "Crear Cuenta"}
                  </button>

                  <div className="flex justify-center text-xs">
                    <button
                      type="button"
                      className="text-cyan-600 font-medium hover:underline"
                      onClick={() => setMode("login")}
                    >
                      Ya tengo cuenta, Iniciar Sesión
                    </button>
                  </div>

                  {globalMessage.text ? (
                    <div
                      className={[
                        "rounded-xl border px-4 py-3 text-sm",
                        isError ? "border-red-200 bg-red-50 text-red-700" : "",
                        isSuccess ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "",
                        !isError && !isSuccess ? "border-slate-200 bg-slate-50 text-slate-700" : "",
                      ].join(" ")}
                    >
                      {globalMessage.text}
                    </div>
                  ) : null}
                </form>
              </div>
              ) : null}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
