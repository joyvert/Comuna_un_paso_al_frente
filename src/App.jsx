import { useEffect, useMemo, useState, Fragment } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import AdminVoceros from "./AdminVoceros";
import ExcelHabitantesUpload from "./ExcelHabitantesUpload";
import AuthCard from "./AuthCard";
import Jornadas from "./Jornadas";
import Votaciones from "./Votaciones";
import CasosSociales from "./CasosSociales";
import FamiliaManagerModal from "./FamiliaManagerModal";
import { api } from "./api";
import AOS from "aos";
import "aos/dist/aos.css";
import {
  Building2,
  ChartColumnBig,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Home,
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
  HeartPulse,
  AlertCircle,
  X,
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

export const condicionesEspeciales = [
  "Ninguna",
  "Embarazo",
  "Discapacidad Motora",
  "Discapacidad Visual",
  "Discapacidad Auditiva",
  "Discapacidad Cognitiva",
  "Enfermedad Crónica",
  "Enfermedad Terminal",
  "Adulto Mayor Solo",
  "Desnutrición",
  "Otro"
];

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
  edad: "",
  calle: calles[0],
  jefe_familia_id: null,
  es_jefe_familia: true,
  requiere_ayuda: false,
  condicion_especial: "Ninguna",
};



function App() {
  // Búsqueda de habitantes locales
  const [habitanteSearch, setHabitanteSearch] = useState("");
  const [familyManagerJefe, setFamilyManagerJefe] = useState(null);

  const [slide, setSlide] = useState(0);
  const [activeConsejo, setActiveConsejo] = useState(getInitialActiveConsejo);
  const [moduleTab, setModuleTab] = useState("resumen");
  const [habitanteForm, setHabitanteForm] = useState(initialForm);
  const [editingHabitanteId, setEditingHabitanteId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [habitanteMsg, setHabitanteMsg] = useState({ type: "", text: "" });
  const [searchFilters, setSearchFilters] = useState({ min: "", max: "", calle: "Todas" });
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

    // Normalizar capitalización de las calles para evitar fallos de renderizado o filtros
    const normalizedHabitantes = (hab.habitantes || []).map((h) => {
      const call = (h.calle || "").trim();
      const matched = calles.find((c) => c.toLowerCase() === call.toLowerCase());
      return { ...h, calle: matched || call };
    });

    setDb((prev) => ({
      ...prev,
      [consejoNombre]: {
        habitantes: normalizedHabitantes,
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
    { key: "casos_sociales", label: "Casos Sociales", icon: HeartPulse },
    { key: "votaciones", label: "Votaciones", icon: Vote },
    ...(sessionUser?.isAdmin ? [{ key: "admin", label: "Administración", icon: UserCog }] : []),
  ];

  const habitantesActualesOriginal = db[activeConsejo]?.habitantes || [];
  const habitantesActuales = useMemo(() => {
    const jefes = [];
    const solteros = [];
    const depsMap = {};

    habitantesActualesOriginal.forEach(h => {
      if (h.es_jefe_familia) jefes.push(h);
      else if (h.jefe_familia_id) {
        if (!depsMap[h.jefe_familia_id]) depsMap[h.jefe_familia_id] = [];
        depsMap[h.jefe_familia_id].push(h);
      } else solteros.push(h);
    });

    const ordenados = [];
    jefes.forEach(j => {
      ordenados.push(j);
      if (depsMap[j.id]) {
        ordenados.push(...depsMap[j.id]);
        delete depsMap[j.id];
      }
    });

    ordenados.push(...solteros);
    Object.values(depsMap).forEach(arr => ordenados.push(...arr));

    return ordenados;
  }, [habitantesActualesOriginal]);



  const stats = useMemo(() => {
    if (sessionUser?.isAdmin) {
      const totalHabitantes = Object.values(db).reduce((a, c) => a + c.habitantes.length, 0);
      const totalFamilias = Object.values(db).reduce((a, c) => a + c.habitantes.filter(h => h.es_jefe_familia).length, 0);
      return { totalHabitantes, totalFamilias, voceroScope: false };
    }
    const slice = db[activeConsejo] || { habitantes: [], pagos: [] };
    return {
      totalHabitantes: slice.habitantes.length,
      totalFamilias: slice.habitantes.filter(h => h.es_jefe_familia).length,
      voceroScope: true,
    };
  }, [db, sessionUser?.isAdmin, activeConsejo]);

  const handleRegistrar = async (e) => {
    e.preventDefault();
    setHabitanteMsg({ type: "", text: "" });
    
    let edad = parseInt(habitanteForm.edad, 10);
    if (isNaN(edad)) {
      const habitanteOriginal = editingHabitanteId ? habitantesActuales.find(h => h.id === editingHabitanteId) : null;
      const edadFallback = habitanteOriginal ? (habitanteOriginal.edad || 0) : 0;
      edad = habitanteForm.nacimiento ? calcAge(habitanteForm.nacimiento) : edadFallback;
    }

    if (!habitanteForm.nombre || !habitanteForm.apellido || !habitanteForm.cedula) return;
    
    try {
      const payload = {
        nombre: habitanteForm.nombre,
        apellido: habitanteForm.apellido,
        cedula: habitanteForm.cedula,
        telefono: habitanteForm.telefono,
        edad,
        calle: habitanteCalleEfectiva,
        nacimiento: habitanteForm.nacimiento || null,
        requiere_ayuda: habitanteForm.requiere_ayuda || false,
        condicion_especial: habitanteForm.requiere_ayuda ? (habitanteForm.condicion_especial || "Otro") : "Ninguna",
      };

      if (editingHabitanteId) {
        await api.updateHabitante(editingHabitanteId, payload);
        setDb((prev) => ({
          ...prev,
          [activeConsejo]: {
            ...prev[activeConsejo],
            habitantes: prev[activeConsejo].habitantes.map((h) =>
              h.id === editingHabitanteId ? { ...h, ...payload } : h,
            ),
          },
        }));
        setHabitanteForm(initialForm);
        setEditingHabitanteId(null);
        setShowFormModal(false);
        setHabitanteMsg({ type: "success", text: "Datos actualizados correctamente." });
      } else {
        const resp = await api.createHabitante({
          consejoNombre: activeConsejo,
          ...payload
        });
        const nuevo = { 
          id: resp.id, 
          ...payload, 
          es_jefe_familia: false, 
          jefe_familia_id: null 
        };
        setDb((prev) => ({
          ...prev,
          [activeConsejo]: { ...prev[activeConsejo], habitantes: [nuevo, ...prev[activeConsejo].habitantes] },
        }));
        setHabitanteForm(initialForm);
        setShowFormModal(false);
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
      requiere_ayuda: h.requiere_ayuda || false,
      condicion_especial: h.condicion_especial || "Ninguna",
    });
    setEditingHabitanteId(h.id);
    setHabitanteMsg({ type: "", text: "" });
    setShowFormModal(true);
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



  const navItem = "rounded-xl px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/15";
  const inputClass = "w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20";

  if (!isAuthenticated) {
    return <AuthCard onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* SIDEBAR */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 shadow-2xl z-20 shrink-0 print:hidden">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white mb-6">
            <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
              <LayoutDashboard size={24} />
            </div>
            <span className="font-bold text-lg leading-tight tracking-wide">Comuna Un Paso<br/>Al Frente</span>
          </div>
          
          <button 
            type="button"
            onClick={() => setModuleTab("resumen")}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
              moduleTab === "resumen" 
                ? "bg-cyan-500/20 border-cyan-500/50 shadow-md" 
                : "bg-slate-800/50 border-slate-700/50 hover:bg-slate-800"
            }`}
          >
            <p className="text-xs text-slate-400 mb-1">Panel de Control</p>
            <p className="font-semibold text-white truncate">{activeConsejo}</p>
            {!sessionUser?.isAdmin && sessionUser?.calle && (
              <p className="text-sm text-cyan-400 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                Calle {sessionUser.calle}
              </p>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {panelTabs.map((tab) => {
            if (tab.key === "admin" && !sessionUser?.isAdmin) return null;
            const TabIcon = tab.icon;
            const isActive = moduleTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setModuleTab(tab.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <TabIcon size={18} className={isActive ? "text-cyan-400" : "text-slate-500"} /> 
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          {sessionUser && (
            <div className="mb-4 px-2">
              <p className="text-xs font-medium text-slate-500 mb-1">Conectado como</p>
              <p className="text-sm text-white truncate">
                {[sessionUser.nombre, sessionUser.apellido].filter(Boolean).join(" ")}
              </p>
              {sessionUser.isAdmin && <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] uppercase tracking-wider rounded font-bold">Admin</span>}
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors border border-transparent hover:border-red-500/20"
          >
            <LogOut size={16} /> Salir del sistema
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative print:overflow-visible print:h-auto">
        {/* Top Header / Selector de Consejo solo para Admin */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between z-10 shadow-sm shrink-0 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {moduleTab === "resumen" ? "Resumen" : (panelTabs.find(t => t.key === moduleTab)?.label || "Panel")}
            </h1>
            <p className="text-sm text-slate-500 mt-1">Gestionando información del consejo comunal</p>
          </div>

          {sessionUser?.isAdmin && (
            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
              <label className="text-sm font-semibold text-slate-600 pl-2">Consejo:</label>
              <select 
                value={activeConsejo}
                onChange={(e) => setActiveConsejo(e.target.value)}
                className="bg-white border-none text-slate-800 text-sm rounded-lg focus:ring-0 block p-2 cursor-pointer outline-none font-medium"
              >
                {consejos.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 print:p-0 print:bg-white print:overflow-visible flex flex-col">
          <div className="w-full flex-1 flex flex-col">
            
                        {moduleTab === "resumen" && (
              <div className="flex flex-col h-full flex-1 space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center gap-6">
                    <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl">
                      <Users size={32} />
                    </div>
                    <div>
                      <p className="text-base text-slate-500 font-medium">Total Habitantes</p>
                      <h4 className="text-4xl font-bold text-slate-800">{stats.totalHabitantes}</h4>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center gap-6">
                    <div className="p-5 bg-indigo-50 text-indigo-600 rounded-2xl">
                      <Home size={32} />
                    </div>
                    <div>
                      <p className="text-base text-slate-500 font-medium">Total Familias</p>
                      <h4 className="text-4xl font-bold text-slate-800">{stats.totalFamilias}</h4>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center gap-6">
                    <div className="p-5 bg-red-50 text-red-600 rounded-2xl">
                      <HeartPulse size={32} />
                    </div>
                    <div>
                      <p className="text-base text-slate-500 font-medium">Casos Sociales</p>
                      <h4 className="text-4xl font-bold text-slate-800">{habitantesActuales.filter(h => h.requiere_ayuda).length}</h4>
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 flex-1">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 shrink-0">Distribución por Edades</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Niños (0-12)', value: habitantesActuales.filter(h => h.edad <= 12).length },
                              { name: 'Adolescentes (13-17)', value: habitantesActuales.filter(h => h.edad > 12 && h.edad <= 17).length },
                              { name: 'Adultos (18-59)', value: habitantesActuales.filter(h => h.edad > 17 && h.edad <= 59).length },
                              { name: 'Tercera Edad (60+)', value: habitantesActuales.filter(h => h.edad >= 60).length },
                            ].filter(d => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            outerRadius={140}
                            fill="#8884d8"
                            dataKey="value"
                            label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            <Cell fill="#06b6d4" />
                            <Cell fill="#3b82f6" />
                            <Cell fill="#0f2847" />
                            <Cell fill="#64748b" />
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 shrink-0">Habitantes por Calle</h3>
                    <div className="flex-1 w-full min-h-[300px]">
                      <ResponsiveContainer>
                        <BarChart data={
                          calles.map(calle => ({
                            name: calle,
                            Habitantes: habitantesActuales.filter(h => h.calle === calle).length
                          })).filter(d => d.Habitantes > 0)
                        }>
                          <XAxis dataKey="name" fontSize={10} tick={{fill: '#64748b'}} />
                          <YAxis fontSize={12} tick={{fill: '#64748b'}} />
                          <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                          <Bar dataKey="Habitantes" radius={[4, 4, 0, 0]}>
                            {calles.map((entry, index) => {
                              const colors = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#84cc16'];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {moduleTab === "casos_sociales" && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <CasosSociales 
                  activeConsejo={activeConsejo}
                  db={db}
                  setDb={setDb}
                  sessionUser={sessionUser}
                  inputClass={inputClass}
                />
              </div>
            )}
            
            {moduleTab === "servicios" && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
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
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <Votaciones 
                  sessionUser={sessionUser}
                  inputClass={inputClass}
                  onMessage={setHabitanteMsg}
                  calles={calles}
                />
              </div>
            )}

            {moduleTab === "admin" && sessionUser?.isAdmin && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-3">
                {adminMsg.text && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-medium ${adminMsg.type === "error" ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                    {adminMsg.text}
                  </div>
                )}
                <AdminVoceros consejos={consejos} calles={calles} inputClass={inputClass} onMessage={setAdminMsg} />
              </div>
            )}

            {moduleTab === "habitantes" && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-4 mb-2">
                  <button 
                    onClick={() => { setHabitanteForm(initialForm); setEditingHabitanteId(null); setHabitanteMsg({ type: "", text: "" }); setShowFormModal(true); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
                  >
                    Registrar Nuevo Habitante
                  </button>
                  {sessionUser?.isAdmin && activeConsejo && (
                    <button 
                      onClick={() => setShowExcelUpload(!showExcelUpload)}
                      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-medium transition-colors"
                    >
                      {showExcelUpload ? "Ocultar Carga de Excel" : "Carga Masiva por Excel"}
                    </button>
                  )}
                </div>

                {/* Solo admin: carga masiva Excel después de seleccionar consejo. */}
                {sessionUser?.isAdmin && activeConsejo && showExcelUpload && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-in slide-in-from-top-2 duration-300">
                    <ExcelHabitantesUpload
                      consejo={activeConsejo}
                      calles={calles}
                      inputClass={inputClass}
                      onUpload={async (payload) => {
                        if (payload.mode === "bulk") {
                          try {
                            const res = await api.createHabitantesBulk({ consejoNombre: activeConsejo, familias: payload.familias });
                            if (res.ok) {
                              setHabitanteMsg({ type: "success", text: `¡Censo procesado! ${res.total} personas insertadas en ${activeConsejo}.` });
                              cargarDatosConsejo(activeConsejo);
                            } else {
                              setHabitanteMsg({ type: "error", text: res.message || "Error procesando el censo." });
                            }
                          } catch (err) {
                            setHabitanteMsg({ type: "error", text: `Error: ${err.message || "desconocido al enviar censo masivo."}` });
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
                            });
                            if (res.ok) ok++;
                            else fail++;
                          } catch (e) {
                            fail++;
                          }
                        }
                        cargarDatosConsejo(activeConsejo);
                        setHabitanteMsg({
                          type: fail === 0 ? "success" : "error",
                          text: `Carga simple finalizada: ${ok} registrados, ${fail} errores.`,
                        });
                      }}
                    />
                  </div>
                )}

                {/* Modal Formulario */}
                {showFormModal && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                        <h3 className="text-xl font-bold text-slate-800">
                          {editingHabitanteId ? "Actualizar Habitante" : "Registrar Nuevo Habitante"}
                        </h3>
                        <button type="button" onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-200 p-1 rounded-lg">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-6">
                        {habitanteMsg.text && (
                    <div className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium ${habitanteMsg.type === "error" ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                      {habitanteMsg.text}
                    </div>
                  )}

                  <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                    {editingHabitanteId ? "Actualizar Habitante" : "Registrar Nuevo Habitante"}
                  </h3>
                  
                  <form onSubmit={handleRegistrar} className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</label>
                      <input
                        className={inputClass}
                        placeholder="Ej. Juan"
                        value={habitanteForm.nombre}
                        onChange={(e) => setHabitanteForm((p) => ({ ...p, nombre: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Apellido</label>
                      <input
                        className={inputClass}
                        placeholder="Ej. Pérez"
                        value={habitanteForm.apellido}
                        onChange={(e) => setHabitanteForm((p) => ({ ...p, apellido: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Cédula</label>
                      <input
                        className={inputClass}
                        placeholder="Ej. 12345678"
                        value={habitanteForm.cedula}
                        onChange={(e) => setHabitanteForm((p) => ({ ...p, cedula: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Teléfono</label>
                      <input
                        className={inputClass}
                        placeholder="Ej. 04121234567"
                        value={habitanteForm.telefono}
                        onChange={(e) => setHabitanteForm((p) => ({ ...p, telefono: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Nacimiento</label>
                      <input
                        className={inputClass}
                        type="date"
                        value={habitanteForm.nacimiento || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHabitanteForm((p) => ({ ...p, nacimiento: val, edad: val ? calcAge(val) : p.edad }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Edad Estimada</label>
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        placeholder="Ej. 35"
                        value={habitanteForm.edad !== undefined ? habitanteForm.edad : ""}
                        onChange={(e) => setHabitanteForm((p) => ({ ...p, edad: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Calle</label>
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
                    
                    <div className="md:col-span-2 mt-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          id="requiereAyuda"
                          className="w-5 h-5 text-cyan-600 bg-white border-slate-300 rounded focus:ring-cyan-500 focus:ring-2 cursor-pointer"
                          checked={habitanteForm.requiere_ayuda || false}
                          onChange={(e) => setHabitanteForm((p) => ({ ...p, requiere_ayuda: e.target.checked, condicion_especial: e.target.checked ? "Embarazo" : "Ninguna" }))}
                        />
                        <label htmlFor="requiereAyuda" className="text-sm font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                          <HeartPulse size={18} className="text-red-500" />
                          ¿Requiere atención prioritaria o es un Caso Social?
                        </label>
                      </div>

                      {habitanteForm.requiere_ayuda && (
                        <div className="mt-3 pl-8">
                          <label className="mb-1.5 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Especificar Condición Especial</label>
                          <select
                            className={inputClass}
                            value={habitanteForm.condicion_especial || "Otro"}
                            onChange={(e) => setHabitanteForm((p) => ({ ...p, condicion_especial: e.target.value }))}
                          >
                            {condicionesEspeciales.filter(c => c !== "Ninguna").map((cond) => (
                              <option key={cond} value={cond}>{cond}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 flex gap-3 pt-2">
                      <button
                        type="submit"
                        className="flex-1 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-900/20"
                      >
                        {editingHabitanteId ? "Guardar Cambios" : "Registrar Habitante"}
                      </button>
                      {editingHabitanteId && (
                        <button
                          type="button"
                          onClick={() => {
                            setHabitanteForm(initialForm);
                            setEditingHabitanteId(null);
                            setHabitanteMsg({ type: "", text: "" });
                            setShowFormModal(false);
                          }}
                          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-semibold text-slate-800">
                      Directorio de Habitantes
                    </h3>
                    <div className="relative max-w-sm w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        className={`${inputClass} pl-10`}
                        placeholder="Buscar por nombre o cédula..."
                        value={habitanteSearch}
                        onChange={(e) => setHabitanteSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <TablaHabitantes
                    rows={habitantesActuales.filter(h => 
                      !habitanteSearch || 
                      `${h.nombre} ${h.apellido} ${h.cedula}`.toLowerCase().includes(habitanteSearch.toLowerCase())
                    )}
                    onEdit={handleEditHabitante}
                    onDelete={handleDeleteHabitante}
                    onManageFamily={sessionUser?.isAdmin ? setFamilyManagerJefe : undefined}
                    isSearching={!!habitanteSearch}
                    allRows={habitantesActuales}
                  />
                </div>

                {familyManagerJefe && (
                  <FamiliaManagerModal 
                    jefe={familyManagerJefe}
                    allHabitantes={habitantesActualesOriginal}
                    onClose={() => setFamilyManagerJefe(null)}
                    onSave={async (jefeId, deps) => {
                      try {
                        await api.saveGrupoFamiliar(jefeId, deps);
                        await cargarDatosConsejo(activeConsejo);
                        setFamilyManagerJefe(null);
                        setHabitanteMsg({ type: "success", text: "El grupo familiar se ha guardado exitosamente." });
                      } catch (e) {
                        setHabitanteMsg({ type: "error", text: "Error guardando la familia: " + e.message });
                      }
                    }}
                    onDisolve={async (jefeId) => {
                      try {
                        await api.disolverGrupoFamiliar(jefeId);
                        await cargarDatosConsejo(activeConsejo);
                        setFamilyManagerJefe(null);
                        setHabitanteMsg({ type: "success", text: "El grupo familiar se ha disuelto." });
                      } catch (e) {
                        setHabitanteMsg({ type: "error", text: "Error disolviendo: " + e.message });
                      }
                    }}
                  />
                )}
              </div>
            )}

            {moduleTab === "buscar" && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div className="flex items-center gap-2 mb-2 pb-4 border-b border-slate-100">
                  <div className="p-2 bg-cyan-50 rounded-lg text-cyan-600">
                    <Search size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Búsqueda Avanzada</h3>
                </div>
                
                <div className="grid gap-5 md:grid-cols-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Edad mínima</label>
                    <input
                      className={inputClass}
                      type="number"
                      placeholder="0"
                      value={searchFilters.min}
                      onChange={(e) => setSearchFilters((p) => ({ ...p, min: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Edad máxima</label>
                    <input
                      className={inputClass}
                      type="number"
                      placeholder="100"
                      value={searchFilters.max}
                      onChange={(e) => setSearchFilters((p) => ({ ...p, max: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 ml-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtrar por Calle</label>
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
                  isSearching={true}
                  allRows={habitantesActuales}
                />
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

function TablaHabitantes({ rows, onEdit, onDelete, onManageFamily, isSearching, allRows }) {
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Mapear hijos globalmente para evitar fallos si el filtro principal los recorta
  const childrenMap = useMemo(() => {
    const map = {};
    (allRows || []).forEach((r) => {
      if (r.jefe_familia_id) {
        if (!map[r.jefe_familia_id]) map[r.jefe_familia_id] = [];
        map[r.jefe_familia_id].push(r);
      }
    });
    return map;
  }, [allRows]);

  // Si no está buscando, filtramos para que las "Roots" sean solo jefes/solteros
  const displayRows = isSearching ? rows : rows.filter((r) => !r.jefe_familia_id);

  const renderActions = (r) => (
    <div className="flex justify-end gap-2">
      {onManageFamily && !r.jefe_familia_id && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onManageFamily(r); }}
          className={`rounded-lg p-1.5 transition ${
            r.es_jefe_familia
              ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
              : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
          }`}
          title={r.es_jefe_familia ? "Modificar Grupo Familiar" : "Convertir en Jefe de Familia"}
        >
          <Users size={16} />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(r); }}
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-blue-100 hover:text-blue-700"
          title="Editar"
        >
          <Pencil size={16} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(r); }}
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-red-100 hover:text-red-700"
          title="Eliminar"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

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
            {(onEdit || onDelete || onManageFamily) && (
              <th className="px-3 py-2 text-right">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {displayRows.length > 0 ? (
            displayRows.map((r, i) => {
              const children = childrenMap[r.id] || [];
              const hasChildren = children.length > 0;
              const isExpanded = expanded[r.id];
              const isDependentFromSearch = isSearching && r.jefe_familia_id;

              return (
                <Fragment key={r.id}>
                  {/* Fila Principal */}
                  <tr
                    onClick={() => {
                      if (!isSearching && (r.es_jefe_familia || hasChildren)) toggleExpand(r.id);
                    }}
                    className={`
                      ${isDependentFromSearch ? "bg-slate-50/70" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                      hover:bg-blue-50 transition-colors
                      ${!isSearching && (r.es_jefe_familia || hasChildren) ? "cursor-pointer" : ""}
                    `}
                  >
                    <td className={`px-3 py-2 ${isDependentFromSearch ? "pl-8" : ""}`}>
                      <div className="flex items-center gap-1.5">
                        {!isSearching && (r.es_jefe_familia || hasChildren) && (
                           <span className="text-slate-400">
                             {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                           </span>
                        )}
                        {isDependentFromSearch && (
                          <span className="text-slate-300 font-bold" title="Dependiente">↳</span>
                        )}
                        {r.es_jefe_familia && (
                          <Home size={16} className="text-[#0f2847] flex-shrink-0 mb-0.5" title="Jefe de Familia" />
                        )}
                        <span className={!isSearching && r.es_jefe_familia ? "font-bold text-[#0f2847]" : "font-medium text-slate-700"}>
                          {r.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.apellido}</td>
                    <td className="px-3 py-2">{r.cedula}</td>
                    <td className="px-3 py-2">{r.telefono}</td>
                    <td className="px-3 py-2">{r.edad}</td>
                    <td className="px-3 py-2">{r.calle}</td>
                    {(onEdit || onDelete || onManageFamily) && (
                      <td className="px-3 py-2 text-right">
                        {renderActions(r)}
                      </td>
                    )}
                  </tr>

                  {/* Filas Hijos (Solo si no estamos buscando modo lista y está expandido) */}
                  {!isSearching && isExpanded && children.map((child) => (
                    <tr key={child.id} className="bg-slate-50/90 hover:bg-slate-100 transition-colors border-l-4 border-l-blue-200">
                      <td className="px-3 py-2 pl-12 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                           <span className="text-slate-300 font-bold">↳</span>
                           {child.nombre}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-600">{child.apellido}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{child.cedula}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{child.telefono}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{child.edad}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{child.calle}</td>
                      {(onEdit || onDelete || onManageFamily) && (
                        <td className="px-3 py-2 text-right">
                          {renderActions(child)}
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              );
            })
          ) : (
            <tr>
              <td className="px-3 py-4 text-center text-sm text-slate-500" colSpan={(onEdit || onDelete || onManageFamily) ? 7 : 6}>
                Sin registros para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
