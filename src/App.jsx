import { useEffect, useMemo, useState } from "react";
import AdminVoceros from "./AdminVoceros";
import ExcelHabitantesUpload from "./ExcelHabitantesUpload";
import AuthCard from "./AuthCard";
import Jornadas from "./Jornadas";
import Votaciones from "./Votaciones";
import { api } from "./api";
import AOS from "aos";
import "aos/dist/aos.css";
import {
  Building2,
  ChartColumnBig,
  CheckSquare,
  CircleDollarSign,
  Droplets,
  LayoutDashboard,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  Users,
  UtensilsCrossed,
  Vote,
} from "lucide-react";

/** Formatea dígitos como monto tipo 1.234,56 (últimos 2 = decimales) */
function formatMonto(val) {
  if (!val) return "0,00";
  let v = String(val).replace(/[^0-9]/g, "");
  const entera = v.slice(0, Math.max(0, v.length - 2)) || "0";
  const decimal = v.slice(-2).padStart(2, "0");
  const entNorm = entera.replace(/^0+/, "") || "0";
  const entFmt = entNorm.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${entFmt},${decimal}`;
}

/** Convierte el string de dígitos del input a número decimal (coherente con formatMonto) */
function parseMontoFromDigits(val) {
  const d = String(val || "").replace(/\D/g, "");
  if (!d) return 0;
  const entera = d.slice(0, Math.max(0, d.length - 2)) || "0";
  const dec = d.slice(-2).padStart(2, "0");
  return Number(`${entera}.${dec}`);
}

const consejos = [
  "La Esperanza",
  "Pablo Bolívar",
  "Carlos Bello",
  "Corazón de mi Patria",
  "José Gregorio Hernández",
];

const calles = ["Calle principal La Esperanza", "Calle la fe integral", "Los Portugueses", "Los Peñas", "La Acequia"];

function getInitialActiveConsejo() {
  try {
    const s = JSON.parse(sessionStorage.getItem("comuna_session_v1") || "{}");
    if (!s.isAdmin && s.vocero && consejos.includes(s.vocero)) return s.vocero;
  } catch {
    /* noop */
  }
  return consejos[0];
}

const heroSlides = [
  {
    title: "Gestión Comunal Inteligente",
    text: "Controla habitantes, servicios y recaudación en un solo ecosistema profesional.",
    image:
      "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1800&q=80",
  },
  {
    title: "Decisiones con Datos Reales",
    text: "Paneles por consejo comunal con filtros rápidos y actualización en tiempo real.",
    image:
      "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?auto=format&fit=crop&w=1800&q=80",
  },
  {
    title: "Experiencia Clara y Moderna",
    text: "Interfaz limpia, responsiva y enfocada en la productividad de la comunidad.",
    image:
      "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1800&q=80",
  },
];

const calcAge = (birthDate) => {
  if (!birthDate) return "";
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age < 0 ? "" : age;
};

const initialForm = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  nacimiento: "",
  calle: calles[0],
};

const initialServicios = {
  gas: {
    query: "",
    habitante: null,
    monto: "",
    roscaCantidad: 0,
    presionCantidad: 0,
    verificado: false,
  },
  proteinas: { query: "", habitante: null, monto: "", combos: 1, verificado: false },
};

function App() {
  // Búsqueda de habitantes locales
  const [habitanteSearch, setHabitanteSearch] = useState("");
  // Estado para edición de pagos
  const [editPago, setEditPago] = useState(null);
  const [editPagoForm, setEditPagoForm] = useState({ habitante: '', cedula: '', detalle: '', monto: '' });

  // Abrir modal de edición
  function openEditPago(pago) {
    setEditPago(pago);
    setEditPagoForm({
      habitante: pago.habitante,
      cedula: pago.cedula,
      detalle: pago.detalle,
      monto: pago.monto,
    });
  }

  // Guardar cambios de edición
  async function saveEditPago(e) {
    e.preventDefault();
    if (!editPago) return;
    try {
      await api.updatePago(editPago.id, {
        habitante: editPagoForm.habitante,
        cedula: editPagoForm.cedula,
        detalle: editPagoForm.detalle,
        monto: editPagoForm.monto,
      });
      setDb((prev) => ({
        ...prev,
        [activeConsejo]: {
          ...prev[activeConsejo],
          pagos: prev[activeConsejo].pagos.map((p) =>
            p.id === editPago.id
              ? { ...p, ...editPagoForm, monto: Number(editPagoForm.monto) }
              : p
          ),
        },
      }));
      setEditPago(null);
      setHabitanteMsg({ type: 'success', text: 'Pago actualizado correctamente.' });
    } catch (err) {
      setHabitanteMsg({ type: 'error', text: err?.message || 'Error al actualizar pago.' });
    }
  }

  function closeEditPago() {
    setEditPago(null);
  }

    // Eliminar pago (solo frontend, requiere endpoint backend para persistir)
    async function handleDeletePago(id, tipo) {
      if (!window.confirm("¿Eliminar este pago?")) return;
      try {
        await api.deletePago(id);
        setDb((prev) => ({
          ...prev,
          [activeConsejo]: {
            ...prev[activeConsejo],
            pagos: prev[activeConsejo].pagos.filter((p) => p.id !== id),
          },
        }));
        setHabitanteMsg({ type: "success", text: "Pago eliminado correctamente." });
      } catch (err) {
        setHabitanteMsg({ type: "error", text: err?.message || "Error al eliminar pago." });
      }
    }
  const [slide, setSlide] = useState(0);
  const [activeConsejo, setActiveConsejo] = useState(getInitialActiveConsejo);
  const [moduleTab, setModuleTab] = useState("habitantes");
  const [serviceTab, setServiceTab] = useState("gas");
  const [habitanteForm, setHabitanteForm] = useState(initialForm);
  const [editingHabitanteId, setEditingHabitanteId] = useState(null);
  const [habitanteMsg, setHabitanteMsg] = useState({ type: "", text: "" });
  const [searchFilters, setSearchFilters] = useState({ min: "", max: "", calle: "Todas" });
  const [serviciosForm, setServiciosForm] = useState(initialServicios);
  const [db, setDb] = useState(() =>
    consejos.reduce((acc, consejo) => {
      acc[consejo] = { habitantes: [], pagos: [] };
      return acc;
    }, {}),
  );

  // Estado y lógica de autenticación (persistencia local para demo SPA)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem("comuna_session_v1"));
    } catch {
      return false;
    }
  });
  const emptyDb = () =>
    consejos.reduce((acc, consejo) => {
      acc[consejo] = { habitantes: [], pagos: [] };
      return acc;
    }, {});

  const handleAuthSuccess = () => {
    setDb(emptyDb());
    try {
      const s = JSON.parse(sessionStorage.getItem("comuna_session_v1") || "{}");
      if (!s.isAdmin && s.vocero && consejos.includes(s.vocero)) {
        setActiveConsejo(s.vocero);
      }
    } catch {
      /* noop */
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem("comuna_session_v1");
    } catch {
      /* noop */
    }
    setDb(emptyDb());
    setIsAuthenticated(false);
    setModuleTab("habitantes");
  };

  const sessionUser = useMemo(() => {
    if (!isAuthenticated) return null;
    try {
      const s = JSON.parse(sessionStorage.getItem("comuna_session_v1") || "{}");
      return s.nombre && s.apellido
        ? {
            nombre: s.nombre,
            apellido: s.apellido,
            vocero: s.vocero,
            calle: s.calle,
            isAdmin: Boolean(s.isAdmin),
          }
        : null;
    } catch {
      return null;
    }
  }, [isAuthenticated]);

  const [adminMsg, setAdminMsg] = useState({ type: "", text: "" });

  const cargarDatosConsejo = async (consejoNombre) => {
    const [hab, pag] = await Promise.all([
      api.getHabitantes(consejoNombre),
      api.getPagos(consejoNombre),
    ]);
    setDb((prev) => ({
      ...prev,
      [consejoNombre]: {
        habitantes: hab.habitantes || [],
        pagos: (pag.pagos || []).map((p) => ({
          ...p,
          monto: Number(p.monto),
          fecha: new Date(p.fecha).toLocaleString(),
        })),
      },
    }));
  };

  useEffect(() => {
    AOS.init({ duration: 800, once: true, easing: "ease-out-cubic" });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    cargarDatosConsejo(activeConsejo).catch(() => {});
  }, [isAuthenticated, activeConsejo]);

  useEffect(() => {
    if (!habitanteMsg.text) return;
    const t = setTimeout(() => setHabitanteMsg({ type: "", text: "" }), 2000);
    return () => clearTimeout(t);
  }, [habitanteMsg.text]);

  useEffect(() => {
    if (!adminMsg.text) return;
    const t = setTimeout(() => setAdminMsg({ type: "", text: "" }), 2500);
    return () => clearTimeout(t);
  }, [adminMsg.text]);

  const habitanteCalleEfectiva = useMemo(
    () =>
      sessionUser && !sessionUser.isAdmin && sessionUser.calle ? sessionUser.calle : habitanteForm.calle,
    [sessionUser, habitanteForm.calle],
  );

  const panelTabs = [
    { key: "habitantes", label: "Habitantes", icon: Users },
    { key: "buscar", label: "Buscar Habitantes", icon: Search },
    { key: "servicios", label: "Servicios", icon: CheckSquare },
    { key: "votaciones", label: "Votaciones", icon: Vote },
    ...(sessionUser?.isAdmin ? [{ key: "admin", label: "Administración", icon: UserCog }] : []),
  ];

  const habitantesActuales = db[activeConsejo].habitantes;
  const pagosGas = [...db[activeConsejo].pagos].filter((p) => p.servicio === "Gas").reverse().slice(0, 8);
  const pagosProteinas = [...db[activeConsejo].pagos].filter((p) => p.servicio === "Proteínas").reverse().slice(0, 8);

  const stats = useMemo(() => {
    if (sessionUser?.isAdmin) {
      const totalHabitantes = Object.values(db).reduce((a, c) => a + c.habitantes.length, 0);
      const totalPagos = Object.values(db).reduce((a, c) => a + c.pagos.length, 0);
      return { totalHabitantes, totalPagos, voceroScope: false };
    }
    const slice = db[activeConsejo] || { habitantes: [], pagos: [] };
    return {
      totalHabitantes: slice.habitantes.length,
      totalPagos: slice.pagos.length,
      voceroScope: true,
    };
  }, [db, sessionUser?.isAdmin, activeConsejo]);

  const handleRegistrar = async (e) => {
    e.preventDefault();
    setHabitanteMsg({ type: "", text: "" });
    const edad = calcAge(habitanteForm.nacimiento);
    if (!edad || !habitanteForm.nombre || !habitanteForm.apellido || !habitanteForm.cedula) return;
    try {
      if (editingHabitanteId) {
        const resp = await api.updateHabitante(editingHabitanteId, {
          nombre: habitanteForm.nombre,
          apellido: habitanteForm.apellido,
          cedula: habitanteForm.cedula,
          telefono: habitanteForm.telefono,
          edad,
          calle: habitanteCalleEfectiva,
          nacimiento: habitanteForm.nacimiento || null,
        });
        const actualizado = resp.habitante;
        setDb((prev) => ({
          ...prev,
          [activeConsejo]: {
            ...prev[activeConsejo],
            habitantes: prev[activeConsejo].habitantes.map((h) =>
              h.id === actualizado.id ? actualizado : h,
            ),
          },
        }));
        setHabitanteForm(initialForm);
        setEditingHabitanteId(null);
        setHabitanteMsg({ type: "success", text: "Datos actualizados correctamente." });
      } else {
        const resp = await api.createHabitante({
          consejoNombre: activeConsejo,
          nombre: habitanteForm.nombre,
          apellido: habitanteForm.apellido,
          cedula: habitanteForm.cedula,
          telefono: habitanteForm.telefono,
          edad,
          calle: habitanteCalleEfectiva,
          nacimiento: habitanteForm.nacimiento || null,
        });
        const nuevo = resp.habitante;
        setDb((prev) => ({
          ...prev,
          [activeConsejo]: { ...prev[activeConsejo], habitantes: [nuevo, ...prev[activeConsejo].habitantes] },
        }));
        setHabitanteForm(initialForm);
        setHabitanteMsg({ type: "success", text: "Habitante registrado correctamente." });
      }
    } catch (err) {
      setHabitanteMsg({ type: "error", text: err?.message || "Error al guardar." });
    }
  };

  const handleEditHabitante = (h) => {
    setHabitanteForm({
      nombre: h.nombre,
      apellido: h.apellido,
      cedula: h.cedula,
      telefono: h.telefono || "",
      nacimiento: h.nacimiento ? h.nacimiento.slice(0, 10) : "",
      calle: h.calle || calles[0],
    });
    setEditingHabitanteId(h.id);
    setHabitanteMsg({ type: "", text: "" });
    setModuleTab("habitantes");
  };

  const handleDeleteHabitante = async (h) => {
    if (!window.confirm(`¿Eliminar a ${h.nombre} ${h.apellido} (${h.cedula})?`)) return;
    setHabitanteMsg({ type: "", text: "" });
    try {
      await api.deleteHabitante(h.id);
      setDb((prev) => ({
        ...prev,
        [activeConsejo]: {
          ...prev[activeConsejo],
          habitantes: prev[activeConsejo].habitantes.filter((x) => x.id !== h.id),
        },
      }));
      setHabitanteMsg({ type: "success", text: "Habitante eliminado." });
      if (editingHabitanteId === h.id) {
        setHabitanteForm(initialForm);
        setEditingHabitanteId(null);
      }
    } catch (err) {
      setHabitanteMsg({ type: "error", text: err?.message || "Error al eliminar." });
    }
  };

  const habitantesFiltrados = useMemo(() => {
    return habitantesActuales.filter((h) => {
      const byStreet = searchFilters.calle === "Todas" || h.calle === searchFilters.calle;
      const min = searchFilters.min === "" ? -Infinity : Number(searchFilters.min);
      const max = searchFilters.max === "" ? Infinity : Number(searchFilters.max);
      const byAge = Number(h.edad) >= min && Number(h.edad) <= max;
      return byStreet && byAge;
    });
  }, [habitantesActuales, searchFilters]);

  const buscarHabitanteServicio = (kind) => {
    const query = serviciosForm[kind].query.trim().toLowerCase();
    const habitante = habitantesActuales.find(
      (h) => h.nombre.toLowerCase().includes(query) || h.cedula.toLowerCase().includes(query),
    );
    setServiciosForm((prev) => ({ ...prev, [kind]: { ...prev[kind], habitante: habitante || null } }));
  };

  const registrarPago = async (kind) => {
    const data = serviciosForm[kind];
    if (!data.habitante || !data.verificado) return;
    const montoNum = parseMontoFromDigits(data.monto);
    if (montoNum <= 0) return;
    if (kind === "gas" && Number(data.roscaCantidad) + Number(data.presionCantidad) <= 0) return;
    const detalle =
      kind === "gas"
        ? `Rosca x${Number(data.roscaCantidad) || 0}, Presión x${Number(data.presionCantidad) || 0}`
        : `Combos x${data.combos}`;

    const servicio = kind === "gas" ? "Gas" : "Proteínas";
    const resp = await api.createPago({
      consejoNombre: activeConsejo,
      habitanteId: data.habitante.id,
      servicio,
      detalle,
      monto: montoNum,
    });
    const pago = {
      ...resp.pago,
      servicio,
      habitante: `${data.habitante.nombre} ${data.habitante.apellido}`,
      cedula: data.habitante.cedula,
      monto: Number(resp.pago.monto),
      fecha: new Date(resp.pago.fecha).toLocaleString(),
    };

    setDb((prev) => ({
      ...prev,
      [activeConsejo]: {
        ...prev[activeConsejo],
        pagos: [...prev[activeConsejo].pagos, pago],
      },
    }));
    setServiciosForm((prev) => ({
      ...prev,
      [kind]: { ...initialServicios[kind], query: data.query },
    }));
  };

  const navItem = "rounded-xl px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/15";
  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-blue-700";

  if (!isAuthenticated) {
    return <AuthCard onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0f2847]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-2 text-white">
            <LayoutDashboard size={20} />
            <span className="font-semibold">Comuna un paso al frente</span>
        </div>
          <div className="flex items-center gap-2">
            <div className="hidden gap-2 md:flex">
              <a href="#inicio" className={navItem}>
                Inicio
              </a>
              <a href="#info" className={navItem}>
                Misión y Visión
              </a>
              <a href="#dashboard" className={navItem}>
                Dashboard
              </a>
        </div>
        <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
              <LogOut className="h-4 w-4" aria-hidden />
              Salir
        </button>
          </div>
        </nav>
      </header>

      <section id="inicio" className="relative h-screen pt-16">
        {heroSlides.map((item, idx) => (
          <div
            key={item.title}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              idx === slide ? "opacity-100" : "opacity-0"
            }`}
            style={{
              backgroundImage: `linear-gradient(rgba(15, 40, 71, 0.7), rgba(15, 40, 71, 0.65)), url(${item.image})`,
            }}
          />
        ))}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-6">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl font-bold leading-tight md:text-6xl">{heroSlides[slide].title}</h1>
            <p className="mt-5 text-base text-slate-100 md:text-xl">{heroSlides[slide].text}</p>
          </div>
        </div>
      </section>

      <section id="info" className="mx-auto max-w-7xl px-4 py-20 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <article data-aos="fade-up" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-2 text-xl font-semibold text-[#0f2847]">Misión</h3>
            <p>Fortalecer la organización comunitaria con una gestión digital transparente y eficiente.</p>
          </article>
          <article
            data-aos="fade-up"
            data-aos-delay="120"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-2 text-xl font-semibold text-[#0f2847]">Visión</h3>
            <p>Consolidar una comuna moderna, conectada y orientada a resultados medibles.</p>
          </article>
          <article
            data-aos="fade-up"
            data-aos-delay="240"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="mb-2 text-xl font-semibold text-[#0f2847]">Estadísticas</h3>
            {stats.voceroScope && (
              <p className="mb-2 text-xs text-slate-500">Solo tu calle en el consejo actual.</p>
            )}
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Users size={16} /> Habitantes registrados: <strong>{stats.totalHabitantes}</strong>
              </p>
              <p className="flex items-center gap-2">
                <CircleDollarSign size={16} /> Pagos registrados: <strong>{stats.totalPagos}</strong>
              </p>
              <p className="flex items-center gap-2">
                <Building2 size={16} /> Consejos activos:{" "}
                <strong>{stats.voceroScope ? 1 : consejos.length}</strong>
              </p>
            </div>
          </article>
        </div>
      </section>

      <main id="dashboard" className="mx-auto max-w-7xl space-y-6 px-4 pb-16 md:px-8">
        <section className="rounded-2xl bg-[#0f2847] p-5 text-white shadow-lg">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <ChartColumnBig size={20} />{" "}
            {sessionUser?.isAdmin ? "Selector de Consejos" : "Tu consejo comunal"}
          </h2>
          {sessionUser?.isAdmin ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {consejos.map((consejo) => (
                <button
                  key={consejo}
                  type="button"
                  onClick={() => setActiveConsejo(consejo)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                    activeConsejo === consejo ? "border-white bg-white/20" : "border-white/20 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {consejo}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
              Gestionas únicamente el consejo <strong>{sessionUser?.vocero || activeConsejo}</strong> y la calle{" "}
              <strong>{sessionUser?.calle}</strong>. Los datos mostrados son solo de habitantes de tu calle.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md md:p-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-[#0f2847]">
              <LayoutDashboard size={18} /> Panel de Control — {activeConsejo}
              {!sessionUser?.isAdmin && sessionUser?.calle && (
                <span className="text-sm font-normal text-slate-500">(calle {sessionUser.calle})</span>
              )}
            </h3>
            {sessionUser && (
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-right text-sm text-slate-700">
                <span className="font-medium">Vocero:</span>{" "}
                {[sessionUser.nombre, sessionUser.apellido].filter(Boolean).join(" ")}
                {sessionUser.vocero && ` / ${sessionUser.vocero}`}
                {sessionUser.calle && ` · Calle: ${sessionUser.calle}`}
              </div>
            )}
          </div>
          <div className="mb-8 flex flex-wrap gap-4">
            {panelTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModuleTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${
                    moduleTab === tab.key ? "bg-[#0f2847] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <TabIcon size={16} /> {tab.label}
                </button>
              );
            })}
          </div>

          {moduleTab === "servicios" && (
            <div className="mb-8">
              <Jornadas 
                sessionUser={sessionUser}
                activeConsejo={activeConsejo}
                db={db}
                setDb={setDb}
                inputClass={inputClass}
              />
            </div>
          )}

          {moduleTab === "votaciones" && (
            <div className="mb-8">
              <Votaciones 
                sessionUser={sessionUser}
                inputClass={inputClass}
                onMessage={setHabitanteMsg}
              />
            </div>
          )}

          {moduleTab === "admin" && sessionUser?.isAdmin && (
            <div className="mb-8 space-y-3">
              {adminMsg.text && (
                <div
                  className={`rounded-xl px-4 py-2 text-sm ${
                    adminMsg.type === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {adminMsg.text}
                </div>
              )}
              <AdminVoceros consejos={consejos} calles={calles} inputClass={inputClass} onMessage={setAdminMsg} />
            </div>
          )}

          {moduleTab === "habitantes" && (
            <div className="space-y-8">
              {/* Solo admin: carga masiva Excel después de seleccionar consejo. Oculto para La Esperanza. */}
              {sessionUser?.isAdmin && activeConsejo && !activeConsejo.toLowerCase().includes("esperanza") && (
                <ExcelHabitantesUpload
                  consejo={activeConsejo}
                  calles={calles}
                  inputClass={inputClass}
                  onUpload={async (payload) => {
                    if (payload.mode === "bulk") {
                      try {
                        const res = await api.createHabitantesBulk({ consejoNombre: activeConsejo, familias: payload.familias }, sessionUser.token);
                        if (res.ok) {
                          setHabitanteMsg({ type: "success", text: `¡Censo procesado! ${res.total} personas insertadas en ${activeConsejo}.` });
                          getHabitantes();
                        } else {
                          setHabitanteMsg({ type: "error", text: res.message || "Error procesando el censo." });
                        }
                      } catch (err) {
                        setHabitanteMsg({ type: "error", text: "Error en el servidor al enviar el censo masivo." });
                      }
                      return;
                    }

                    // Lógica para modo Simple (Array)
                    let ok = 0, fail = 0;
                    for (const h of payload) {
                      try {
                        const res = await api.createHabitante({
                          consejoNombre: activeConsejo,
                          ...h,
                          edad: h.nacimiento ? calcAge(h.nacimiento) : undefined,
                        }, sessionUser.token);
                        if (res.ok) ok++;
                        else fail++;
                      } catch (e) {
                        fail++;
                      }
                    }
                    getHabitantes();
                    setHabitanteMsg({
                      type: fail === 0 ? "success" : "error",
                      text: `Carga simple finalizada: ${ok} registrados, ${fail} errores (DNI duplicados o falla de red).`,
                    });
                  }}
                />
              )}
              {habitanteMsg.text && (
                <div
                  className={`rounded-xl px-4 py-2 text-sm ${
                    habitanteMsg.type === "error"
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {habitanteMsg.text}
                </div>
              )}
              <form onSubmit={handleRegistrar} className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Nombre</label>
                  <input
                    className={inputClass}
                    placeholder="Ej. Juan"
                    value={habitanteForm.nombre}
                    onChange={(e) => setHabitanteForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Apellido</label>
                  <input
                    className={inputClass}
                    placeholder="Ej. Pérez"
                    value={habitanteForm.apellido}
                    onChange={(e) => setHabitanteForm((p) => ({ ...p, apellido: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Cédula</label>
                  <input
                    className={inputClass}
                    placeholder="Ej. 12345678"
                    value={habitanteForm.cedula}
                    onChange={(e) => setHabitanteForm((p) => ({ ...p, cedula: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Teléfono</label>
                  <input
                    className={inputClass}
                    placeholder="Ej. 04121234567"
                    value={habitanteForm.telefono}
                    onChange={(e) => setHabitanteForm((p) => ({ ...p, telefono: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Fecha de Nacimiento</label>
                  <input
                    className={inputClass}
                    type="date"
                    value={habitanteForm.nacimiento}
                    onChange={(e) => setHabitanteForm((p) => ({ ...p, nacimiento: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Edad Estimada</label>
                  <input
                    className={`${inputClass} bg-slate-100`}
                    readOnly
                    value={calcAge(habitanteForm.nacimiento) === "" ? "Edad" : `${calcAge(habitanteForm.nacimiento)} años`}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Calle</label>
                  <select
                    className={inputClass}
                    value={habitanteCalleEfectiva}
                    disabled={Boolean(sessionUser && !sessionUser.isAdmin)}
                    onChange={(e) => setHabitanteForm((p) => ({ ...p, calle: e.target.value }))}
                  >
                    {calles.map((calle) => (
                      <option key={calle}>{calle}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 items-end h-[68px]">
                  <button
                    type="submit"
                    className="w-full flex-1 rounded-xl bg-[#0f2847] px-4 py-2 font-medium text-white hover:bg-[#12345f] h-[42px] transition-colors shadow-sm"
                  >
                    {editingHabitanteId ? "Actualizar" : "Registrar"}
                  </button>
                  {editingHabitanteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setHabitanteForm(initialForm);
                        setEditingHabitanteId(null);
                        setHabitanteMsg({ type: "", text: "" });
                      }}
                      className="w-full flex-1 rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100 h-[42px] transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
              <div className="mb-2 mt-6">
                <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">
                  <Search className="inline-block mr-2 text-slate-400" size={16} />
                  Buscar en padrón de Habitantes
                </label>
                <input
                  className={inputClass}
                  placeholder="Escriba nombre, apellido o cédula..."
                  value={habitanteSearch}
                  onChange={(e) => setHabitanteSearch(e.target.value)}
                />
              </div>
              <TablaHabitantes
                rows={habitantesActuales.filter(h => 
                  !habitanteSearch || 
                  `${h.nombre} ${h.apellido} ${h.cedula}`.toLowerCase().includes(habitanteSearch.toLowerCase())
                )}
                onEdit={handleEditHabitante}
                onDelete={handleDeleteHabitante}
              />
            </div>
          )}

          {moduleTab === "buscar" && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Edad mínima</label>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="0"
                    value={searchFilters.min}
                    onChange={(e) => setSearchFilters((p) => ({ ...p, min: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Edad máxima</label>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="100"
                    value={searchFilters.max}
                    onChange={(e) => setSearchFilters((p) => ({ ...p, max: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 ml-1 block text-xs font-medium text-slate-500">Filtrar por Calle</label>
                  <select
                    className={inputClass}
                    value={searchFilters.calle}
                    onChange={(e) => setSearchFilters((p) => ({ ...p, calle: e.target.value }))}
                  >
                    <option>Todas</option>
                    {calles.map((calle) => (
                      <option key={calle}>{calle}</option>
                    ))}
                  </select>
                </div>
              </div>
              <TablaHabitantes
                rows={habitantesFiltrados}
                onEdit={handleEditHabitante}
                onDelete={handleDeleteHabitante}
              />
            </div>
          )}

          {moduleTab === "legacy_servicios" && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setServiceTab("gas")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${
                    serviceTab === "gas" ? "bg-[#0f2847] text-white" : "bg-slate-100"
                  }`}
                >
                  <Droplets size={16} /> Gas
                </button>
                <button
                  type="button"
                  onClick={() => setServiceTab("proteinas")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${
                    serviceTab === "proteinas" ? "bg-[#0f2847] text-white" : "bg-slate-100"
                  }`}
                >
                  <UtensilsCrossed size={16} /> Proteínas
                </button>
              </div>

              {serviceTab === "gas" && (
                <>
                  <FormularioPagoGas
                    data={serviciosForm.gas}
                    setData={(changes) => setServiciosForm((p) => ({ ...p, gas: { ...p.gas, ...changes } }))}
                    onSearch={() => buscarHabitanteServicio("gas")}
                    onSubmit={() => registrarPago("gas")}
                  />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-[#0f2847]">Pagos de Gas</h4>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                        Total Gas: Bs {pagosGas.reduce((acc, p) => acc + Number(p.monto), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full overflow-hidden rounded-xl">
                        <thead className="bg-slate-200 text-left text-sm">
                          <tr>
                            <th className="px-3 py-2">Habitante</th>
                            <th className="px-3 py-2">Cédula</th>
                            <th className="px-3 py-2">Detalle</th>
                            <th className="px-3 py-2">Monto (Bs)</th>
                            <th className="px-3 py-2">Fecha</th>
                            <th className="px-3 py-2 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagosGas.length > 0 ? (
                            pagosGas.map((p, i) => (
                              <tr
                                key={p.id}
                                className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50`}
                              >
                                <td className="px-3 py-2">{p.habitante}</td>
                                <td className="px-3 py-2">{p.cedula}</td>
                                <td className="px-3 py-2">{p.detalle}</td>
                                <td className="px-3 py-2">{Number(p.monto).toFixed(2)}</td>
                                <td className="px-3 py-2">{p.fecha}</td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      className="rounded-lg p-1.5 text-slate-600 hover:bg-blue-100"
                                      title="Editar"
                                      onClick={() => openEditPago(p)}
                                    >
                                      <Pencil size={16} />
                                    </button>
                                      {/* Modal de edición de pago */}
                                      {editPago && (
                                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
                                          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                                            <h5 className="mb-4 font-semibold text-[#0f2847]">Editar pago</h5>
                                            <form onSubmit={saveEditPago} className="space-y-3">
                                              <div className="flex flex-col">
                                                <label className="mb-1 text-xs font-semibold text-slate-700">Habitante</label>
                                                <input
                                                  className={payField}
                                                  value={editPagoForm.habitante}
                                                  onChange={e => setEditPagoForm(f => ({ ...f, habitante: e.target.value }))}
                                                  required
                                                />
                                              </div>
                                              <div className="flex flex-col">
                                                <label className="mb-1 text-xs font-semibold text-slate-700">Cédula</label>
                                                <input
                                                  className={payField}
                                                  value={editPagoForm.cedula}
                                                  onChange={e => setEditPagoForm(f => ({ ...f, cedula: e.target.value }))}
                                                  required
                                                />
                                              </div>
                                              <div className="flex flex-col">
                                                <label className="mb-1 text-xs font-semibold text-slate-700">Detalle</label>
                                                <input
                                                  className={payField}
                                                  value={editPagoForm.detalle}
                                                  onChange={e => setEditPagoForm(f => ({ ...f, detalle: e.target.value }))}
                                                  required
                                                />
                                              </div>
                                              <div className="flex flex-col">
                                                <label className="mb-1 text-xs font-semibold text-slate-700">Monto (Bs)</label>
                                                <input
                                                  className={payField}
                                                  type="number"
                                                  min="0"
                                                  value={editPagoForm.monto}
                                                  onChange={e => setEditPagoForm(f => ({ ...f, monto: e.target.value }))}
                                                  required
                                                />
                                              </div>
                                              <div className="flex gap-2 justify-end mt-4">
                                                <button
                                                  type="button"
                                                  className="rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
                                                  onClick={closeEditPago}
                                                >
                                                  Cancelar
                                                </button>
                                                <button
                                                  type="submit"
                                                  className="rounded-xl bg-[#0f2847] px-4 py-2 font-medium text-white hover:bg-[#12345f]"
                                                >
                                                  Guardar cambios
                                                </button>
                                              </div>
                                            </form>
                                          </div>
                                        </div>
                                      )}
                                    <button
                                      type="button"
                                      className="rounded-lg p-1.5 text-slate-600 hover:bg-red-100"
                                      title="Eliminar"
                                      onClick={() => handleDeletePago(p.id, "gas")}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-3 py-4 text-sm text-slate-500" colSpan={6}>
                                Sin pagos registrados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {serviceTab === "proteinas" && (
                <>
                  <FormularioPagoProteinas
                    data={serviciosForm.proteinas}
                    setData={(changes) =>
                      setServiciosForm((p) => ({ ...p, proteinas: { ...p.proteinas, ...changes } }))
                    }
                    onSearch={() => buscarHabitanteServicio("proteinas")}
                    onSubmit={() => registrarPago("proteinas")}
                  />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-[#0f2847]">Pagos de Proteínas</h4>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                        Total Proteínas: Bs {pagosProteinas.reduce((acc, p) => acc + Number(p.monto), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full overflow-hidden rounded-xl">
                        <thead className="bg-slate-200 text-left text-sm">
                          <tr>
                            <th className="px-3 py-2">Habitante</th>
                            <th className="px-3 py-2">Cédula</th>
                            <th className="px-3 py-2">Detalle</th>
                            <th className="px-3 py-2">Monto (Bs)</th>
                            <th className="px-3 py-2">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagosProteinas.length > 0 ? (
                            pagosProteinas.map((p, i) => (
                              <tr
                                key={p.id}
                                className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50`}
                              >
                                <td className="px-3 py-2">{p.habitante}</td>
                                <td className="px-3 py-2">{p.cedula}</td>
                                <td className="px-3 py-2">{p.detalle}</td>
                                <td className="px-3 py-2">{Number(p.monto).toFixed(2)}</td>
                                <td className="px-3 py-2">{p.fecha}</td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      type="button"
                                      className="rounded-lg p-1.5 text-slate-600 hover:bg-blue-100"
                                      title="Editar (próximamente)"
                                      disabled
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-lg p-1.5 text-slate-600 hover:bg-red-100"
                                      title="Eliminar"
                                      onClick={() => handleDeletePago(p.id, "proteinas")}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="px-3 py-4 text-sm text-slate-500" colSpan={6}>
                                Sin pagos registrados.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const payField =
  "box-border h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#143c6e] focus:ring-2 focus:ring-[#143c6e]/15";
const payFieldMonto =
  "box-border h-10 w-full rounded-md border border-amber-500/40 bg-amber-50/40 px-3 pr-12 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-amber-500/15 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20";
const payLabel = "mb-1 block text-xs font-medium text-slate-600";
const payBtnSearch =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-200";
const payBtnConfirm =
  "inline-flex h-10 max-w-[220px] items-center justify-center rounded-md bg-[#143c6e] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2847] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500";

function HabitanteCard({ habitante }) {
  if (!habitante) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center shadow-sm">
        <User className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden />
        <p className="text-sm text-slate-500">
          Busque por nombre o cédula para vincular este pago a un habitante registrado.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Habitante seleccionado</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#143c6e]/10 text-[#143c6e]">
            <User className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">
              {habitante.nombre} {habitante.apellido}
            </p>
            <p className="text-xs text-slate-500">Cédula {habitante.cedula}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-1.5 text-sm text-slate-600 sm:mt-0 sm:text-right">
          <span className="inline-flex items-center gap-1.5 sm:justify-end">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {habitante.calle}
          </span>
          {habitante.telefono ? (
            <span className="inline-flex items-center gap-1.5 sm:justify-end">
              <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              {habitante.telefono}
            </span>
          ) : null}
          <span className="text-xs text-slate-500">
            Edad: {habitante.edad != null && habitante.edad !== "" ? `${habitante.edad} años` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function TablaHabitantes({ rows, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-200 rounded-xl relative shadow-sm">
      <table className="min-w-full">
        <thead className="bg-slate-200 text-left text-sm sticky top-0 z-10 shadow-sm">
          <tr>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Apellido</th>
            <th className="px-3 py-2">Cédula</th>
            <th className="px-3 py-2">Teléfono</th>
            <th className="px-3 py-2">Edad</th>
            <th className="px-3 py-2">Calle</th>
            {(onEdit || onDelete) && (
              <th className="px-3 py-2 text-right">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((r, i) => (
              <tr key={r.id} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {r.es_jefe_familia && <span title="Jefe de Familia">🏠</span>}
                    {r.nombre}
                  </div>
                </td>
                <td className="px-3 py-2">{r.apellido}</td>
                <td className="px-3 py-2">{r.cedula}</td>
                <td className="px-3 py-2">{r.telefono}</td>
                <td className="px-3 py-2">{r.edad}</td>
                <td className="px-3 py-2">{r.calle}</td>
                {(onEdit || onDelete) && (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(r)}
                          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(r)}
                          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-red-100 hover:text-red-700"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-4 text-sm text-slate-500" colSpan={(onEdit || onDelete) ? 7 : 6}>
                Sin registros para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FormularioPagoGas({ data, setData, onSearch, onSubmit }) {
  const rosca = Number(data.roscaCantidad) || 0;
  const presion = Number(data.presionCantidad) || 0;
  const montoOk = parseMontoFromDigits(data.monto) > 0;
  const canConfirm = Boolean(data.habitante && data.verificado && montoOk && rosca + presion > 0);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        {/* Fila 1 — Buscador */}
        <div>
          <label htmlFor="gas-buscar" className={payLabel}>
            Nombre o cédula
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="gas-buscar"
              className={`${payField} min-w-0 flex-1`}
              placeholder="Ej. María o V-12345678"
              value={data.query}
              onChange={(e) => setData({ query: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSearch())}
            />
            <button type="button" className={payBtnSearch} onClick={onSearch}>
              <Search className="h-4 w-4" aria-hidden />
              Buscar
            </button>
          </div>
        </div>

        {/* Fila 2 — Habitante (card o vacío) */}
        <HabitanteCard habitante={data.habitante} />

        {/* Fila 3 — Detalles del pedido */}
        <div className="rounded-md border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-[#0f2847]">Detalles del pedido</h4>
          <p className="mb-3 text-xs text-slate-500">Indique cuántas bombonas de cada tipo entrega o recoge el habitante.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="gas-rosca" className={payLabel}>
                Bombonas tipo Rosca
              </label>
              <input
                id="gas-rosca"
                className={payField}
                type="number"
                min={0}
                value={data.roscaCantidad === 0 ? "" : data.roscaCantidad}
                onChange={(e) => setData({ roscaCantidad: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="gas-presion" className={payLabel}>
                Bombonas tipo Presión
              </label>
              <input
                id="gas-presion"
                className={payField}
                type="number"
                min={0}
                value={data.presionCantidad === 0 ? "" : data.presionCantidad}
                onChange={(e) => setData({ presionCantidad: e.target.value === "" ? 0 : Number(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Fila 4 — Monto, verificación, acción (checkbox alineado al input, no al bloque con ayuda) */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 basis-full sm:min-w-[200px] sm:flex-1 sm:basis-0 lg:max-w-md">
            <label htmlFor="gas-monto" className={payLabel}>
              Monto a pagar (Bs)
            </label>
            <div className="relative mt-1">
              <input
                id="gas-monto"
                className={payFieldMonto}
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={formatMonto(data.monto)}
                onChange={(e) => setData({ monto: e.target.value.replace(/\D/g, "") })}
                aria-describedby="gas-monto-hint"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#143c6e]">
                Bs
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-end">
            <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#143c6e] focus:ring-[#143c6e]"
                checked={data.verificado}
                onChange={(e) => setData({ verificado: e.target.checked })}
              />
              <span className="font-medium text-slate-600">Pago verificado</span>
            </label>
          </div>
          <div className="flex shrink-0 items-end lg:ms-auto">
            <button type="button" className={payBtnConfirm} disabled={!canConfirm} onClick={onSubmit}>
              Confirmar pago
            </button>
          </div>
          <p id="gas-monto-hint" className="w-full basis-full text-xs text-slate-500">
            Monto total del pedido de gas.
          </p>
        </div>
      </div>
    </div>
  );
}

function FormularioPagoProteinas({ data, setData, onSearch, onSubmit }) {
  const montoOk = parseMontoFromDigits(data.monto) > 0;
  const combosOk = Number(data.combos) >= 1;
  const canConfirm = Boolean(data.habitante && data.verificado && montoOk && combosOk);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="prot-buscar" className={payLabel}>
            Nombre o cédula
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="prot-buscar"
              className={`${payField} min-w-0 flex-1`}
              placeholder="Ej. Juan o E-87654321"
              value={data.query}
              onChange={(e) => setData({ query: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onSearch())}
            />
            <button type="button" className={payBtnSearch} onClick={onSearch}>
              <Search className="h-4 w-4" aria-hidden />
              Buscar
            </button>
          </div>
        </div>

        <HabitanteCard habitante={data.habitante} />

        <div className="rounded-md border border-slate-100 bg-slate-50/50 p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-[#0f2847]">Detalles del pedido</h4>
          <div>
            <label htmlFor="prot-combos" className={payLabel}>
              Cantidad de combos
            </label>
            <input
              id="prot-combos"
              className={`${payField} mt-1 max-w-xs`}
              type="number"
              min={1}
              value={data.combos}
              onChange={(e) => setData({ combos: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1 basis-full sm:min-w-[200px] sm:flex-1 sm:basis-0 lg:max-w-md">
            <label htmlFor="prot-monto" className={payLabel}>
              Monto a pagar (Bs)
            </label>
            <div className="relative mt-1">
              <input
                id="prot-monto"
                className={payFieldMonto}
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={formatMonto(data.monto)}
                onChange={(e) => setData({ monto: e.target.value.replace(/\D/g, "") })}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#143c6e]">
                Bs
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-end">
            <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[#143c6e] focus:ring-[#143c6e]"
                checked={data.verificado}
                onChange={(e) => setData({ verificado: e.target.checked })}
              />
              <span className="font-medium text-slate-600">Pago verificado</span>
            </label>
          </div>
          <div className="flex shrink-0 items-end lg:ms-auto">
            <button type="button" className={payBtnConfirm} disabled={!canConfirm} onClick={onSubmit}>
              Confirmar pago
            </button>
          </div>
          <p className="w-full basis-full text-xs text-slate-500">Monto total por combos de proteínas.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
