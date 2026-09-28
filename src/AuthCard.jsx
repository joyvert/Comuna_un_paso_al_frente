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

function ParticleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles = [];
    const particleCount = Math.min(650, Math.floor((width * height) / 1800));

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.28;
        this.vy = (Math.random() - 0.5) * 0.28;
        this.radius = Math.random() * 1.6 + 0.6;
        this.alpha = Math.random() * 0.5 + 0.3;
        this.color = Math.random() > 0.5 ? "14, 165, 233" : "99, 102, 241"; // Sky blue or Indigo
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
        ctx.shadowBlur = 4;
        ctx.shadowColor = `rgba(${this.color}, 0.25)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 60) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const alpha = (1 - dist / 60) * 0.12;
            ctx.strokeStyle = `rgba(${particles[i].color}, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/40 pointer-events-none z-0"
    />
  );
}

function TextField({ icon: Icon, label, placeholder, value, onChange, type = "text" }) {
  return (
    <label className="block relative pt-4 mb-4">
      <span className="absolute top-0 left-0 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 border-b-2 border-slate-200 py-2 focus-within:border-cyan-600 transition-colors">
        <input
          className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 font-medium"
          placeholder={placeholder}
          value={value}
          type={type}
          onChange={onChange}
        />
        {Icon ? <Icon className="h-4 w-4 text-slate-400" aria-hidden /> : null}
      </div>
    </label>
  );
}

function PasswordField({ icon: Icon, label, placeholder, value, onChange, visible, onToggle }) {
  return (
    <label className="block relative pt-4 mb-4">
      <span className="absolute top-0 left-0 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-2 border-b-2 border-slate-200 py-2 focus-within:border-cyan-600 transition-colors">
        <input
          className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400 font-medium"
          placeholder={placeholder}
          value={value}
          type={visible ? "text" : "password"}
          onChange={onChange}
        />
        <button
          type="button"
          className="rounded-full p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
    <label className="block relative pt-4 mb-4">
      <span className="absolute top-0 left-0 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <select
        className="w-full border-b-2 border-slate-200 bg-transparent py-2 text-sm text-slate-800 font-medium outline-none focus:border-cyan-600 transition-colors appearance-none cursor-pointer"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-white text-slate-800">
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

  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem("comuna_remember_user")));
  const [loginForm, setLoginForm] = useState(() => ({
    usuario: localStorage.getItem("comuna_remember_user") || "",
    password: ""
  }));
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

      if (rememberMe) {
        localStorage.setItem("comuna_remember_user", loginForm.usuario.trim());
      } else {
        localStorage.removeItem("comuna_remember_user");
      }

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
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-100 text-slate-800 select-none font-sans relative overflow-hidden">
      
      {/* Dynamic Particle Canvas Background */}
      <ParticleBackground />

      {/* Centered Split Card */}
      <div className="relative z-10 w-full max-w-[1000px] bg-white border border-slate-200/90 rounded-3xl shadow-2xl shadow-slate-300/60 flex flex-col md:flex-row overflow-hidden min-h-[600px] max-h-[95vh]">
        
        {/* Left Side: Background Video */}
        <div 
          className="w-full md:w-1/2 min-h-[240px] md:min-h-0 relative flex flex-col justify-between p-6 sm:p-10 overflow-hidden"
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
            src="/cielo.mov"
          />
          {/* Soft contrast overlays over the left video side */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/60 via-slate-900/40 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-transparent to-transparent pointer-events-none z-10" />

          {/* Comuna logo/text at top-left of the image */}
          <div className="relative z-20 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md text-white shadow-xl border border-white/20">
              <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-wide text-white uppercase font-heading drop-shadow-md">
              Comuna un paso al frente
            </span>
          </div>

          {/* Bottom text inside the image */}
          {mode === "login" && allowRegisterUi && (
            <div className="relative z-20 mt-auto pt-6">
              <p className="text-sm text-white/90 font-medium max-w-xs mb-4 drop-shadow">
                ¿No tienes una cuenta? Regístrate para acceder a todas las funciones de nuestro servicio.
              </p>
              <button 
                onClick={() => {
                  setGlobalMessage({ type: "info", text: "" });
                  setMode("register");
                }}
                className="px-6 py-2.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-sm font-semibold border border-white/30 transition-all shadow-lg cursor-pointer"
              >
                Regístrate ahora
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Form Content (Light, crisp and elegant) */}
        <div className="w-full md:w-1/2 flex flex-col justify-center px-6 py-10 sm:px-10 md:px-12 bg-white overflow-y-auto">
          <div className="w-full max-w-sm mx-auto relative">
            {/* Título de Formulario */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2 text-center md:text-left font-heading tracking-tight">
              {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Regístrate" : "Recuperar cuenta"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 sm:mb-8 text-center md:text-left">
              {mode === "login" ? "Ingresa tus credenciales para acceder al panel." : mode === "register" ? "Completa los datos para crear tu cuenta de vocero." : "Sigue los pasos para restablecer tu contraseña."}
            </p>

            {globalMessage.text ? (
              <div
                className={`mb-6 rounded-xl px-4 py-3 text-xs sm:text-sm border-l-4 font-medium shadow-xs ${
                  isError ? "border-rose-500 bg-rose-50 text-rose-700" : 
                  isSuccess ? "border-emerald-500 bg-emerald-50 text-emerald-700" : 
                  "border-cyan-500 bg-cyan-50 text-cyan-700"
                }`}
              >
                {globalMessage.text}
              </div>
            ) : null}

            {/* Form Content Based on Mode */}
            <div className="transition-all duration-500 w-full relative">
              {mode === "recover" ? (
                <div className="animate-fade-in">
                  {recoverStep === 1 ? (
                    <form autoComplete="off" onSubmit={handleRecoveryStep1}>
                      <p className="text-xs sm:text-sm text-slate-500 mb-6 font-normal">Indica tu correo o cédula para cargar tus preguntas de seguridad.</p>
                      <TextField
                        icon={User}
                        label="Correo o Cédula"
                        placeholder="Ej. juan@example.com o V-12345678"
                        value={recoverUserId}
                        onChange={(e) => setRecoverUserId(e.target.value)}
                      />
                      <div className="mt-8 flex items-center gap-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-rose-500/25 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                        >
                          {loading ? "Buscando…" : "Continuar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setGlobalMessage({ type: "info", text: "" }); setMode("login"); }}
                          className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form autoComplete="off" onSubmit={handleRecoverySubmit}>
                      <p className="text-xs sm:text-sm text-slate-500 mb-6 font-normal">Responde y elige una contraseña nueva.</p>
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
                        label="Nueva contraseña"
                        placeholder="Mínimo 8 caracteres"
                        value={recoverPw}
                        onChange={(e) => setRecoverPw(e.target.value)}
                        visible={showRecoverPw}
                        onToggle={() => setShowRecoverPw((v) => !v)}
                      />
                      <PasswordField
                        label="Confirmar contraseña"
                        placeholder="Repite la contraseña"
                        value={recoverPw2}
                        onChange={(e) => setRecoverPw2(e.target.value)}
                        visible={showRecoverPw2}
                        onToggle={() => setShowRecoverPw2((v) => !v)}
                      />
                      
                      <div className="mt-8 flex items-center gap-4">
                        <button
                          type="submit"
                          disabled={loading || !canSubmitRecovery}
                          className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-rose-500/25 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                        >
                          {loading ? "Guardando…" : "Restablecer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetRecoveryView(); setMode("login"); }}
                          className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : mode === "register" ? (
                <form autoComplete="off" onSubmit={handleRegister} className="animate-fade-in pb-6">
                  <p className="text-xs sm:text-sm text-slate-500 mb-6 font-normal">
                    {regStatus.firstUserPending
                      ? "Eres el primer usuario: serás administrador del sistema."
                      : "Crea tu cuenta de vocero en el sistema."}
                  </p>
                  
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <TextField label="Nombre" placeholder="Tu nombre" value={registerForm.nombre} onChange={(e) => setRegisterForm((p) => ({ ...p, nombre: e.target.value }))} />
                    <TextField label="Apellido" placeholder="Tu apellido" value={registerForm.apellido} onChange={(e) => setRegisterForm((p) => ({ ...p, apellido: e.target.value }))} />
                    <SelectField label="Consejo Comunal" value={registerForm.vocero} onChange={(e) => setRegisterForm((p) => ({ ...p, vocero: e.target.value }))} options={consejos} />
                    <SelectField label="Calle" value={registerForm.calle} onChange={(e) => setRegisterForm((p) => ({ ...p, calle: e.target.value }))} options={calles} />
                  </div>
                  
                  <TextField label="Correo o Cédula" placeholder="Ej. juan@example.com" value={registerForm.usuario} onChange={(e) => setRegisterForm((p) => ({ ...p, usuario: e.target.value }))} type="text" />
                  
                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <PasswordField label="Contraseña" placeholder="Mín. 8 caracteres" value={registerForm.password} onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} visible={showPassReg} onToggle={() => setShowPassReg((v) => !v)} />
                    <PasswordField label="Confirmar" placeholder="Repetir" value={registerForm.password2} onChange={(e) => setRegisterForm((p) => ({ ...p, password2: e.target.value }))} visible={showPassReg2} onToggle={() => setShowPassReg2((v) => !v)} />
                  </div>

                  {registerForm.password2 && registerForm.password2 !== registerForm.password && (
                    <p className="text-xs text-rose-600 font-semibold mb-4">Las contraseñas no coinciden.</p>
                  )}

                  <div className="mt-4 mb-6 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Seguridad (Recuperación)</h3>
                    <div className="grid gap-x-4 sm:grid-cols-2">
                      <SelectField label="Pregunta 1" value={registerForm.pregunta1} onChange={(e) => setRegisterForm((p) => ({ ...p, pregunta1: e.target.value }))} options={preguntas1} />
                      <TextField label="Respuesta 1" placeholder="Tu respuesta" value={registerForm.respuesta1} onChange={(e) => setRegisterForm((p) => ({ ...p, respuesta1: e.target.value }))} />
                      <SelectField label="Pregunta 2" value={registerForm.pregunta2} onChange={(e) => setRegisterForm((p) => ({ ...p, pregunta2: e.target.value }))} options={preguntas2} />
                      <TextField label="Respuesta 2" placeholder="Tu respuesta" value={registerForm.respuesta2} onChange={(e) => setRegisterForm((p) => ({ ...p, respuesta2: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-8">
                    <button
                      type="submit"
                      disabled={loading || !canRegister}
                      className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-rose-500/25 transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "Creando…" : "Registrarme"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-800 transition shrink-0 cursor-pointer"
                    >
                      ¿Ya tienes cuenta?
                    </button>
                  </div>
                </form>
              ) : (
                <form autoComplete="off" onSubmit={handleLogin} className="animate-fade-in">
                  <TextField
                    icon={User}
                    label="Correo o Cédula"
                    placeholder="ej. V-12345678"
                    value={loginForm.usuario}
                    onChange={(e) => setLoginForm((p) => ({ ...p, usuario: e.target.value }))}
                  />
                  <PasswordField
                    label="Contraseña"
                    placeholder="Tu contraseña secreta"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    visible={showLoginPass}
                    onToggle={() => setShowLoginPass((v) => !v)}
                  />
                  
                  <div className="flex items-center mt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Recuérdame</span>
                    </label>
                  </div>

                  <div className="mt-10 flex items-center justify-between gap-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-36 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-lg shadow-rose-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "..." : "Entrar"}
                    </button>
                    
                    <div className="flex flex-col gap-1 items-end">
                      <button
                        type="button"
                        onClick={openRecovery}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                      {allowRegisterUi && (
                        <button
                          type="button"
                          onClick={() => { setGlobalMessage({ type: "info", text: "" }); setMode("register"); }}
                          className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition-colors cursor-pointer"
                        >
                          Crear una cuenta nueva
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
