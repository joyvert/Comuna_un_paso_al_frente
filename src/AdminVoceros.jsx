import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, RefreshCw, UserPlus, Trash2 } from "lucide-react";
import { api } from "./api";

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

function normalizeId(s) {
  return String(s || "").trim().toLowerCase();
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSaltHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPasswordWithSalt(password, salt) {
  return sha256Hex(`${salt}::${password}`);
}

function passwordStrength(password) {
  const pw = String(password || "");
  const rules = [
    { label: "Mínimo 8 caracteres", ok: pw.length >= 8 },
    { label: "Número", ok: /\d/.test(pw) },
  ];
  return rules.every((r) => r.ok);
}

export default function AdminVoceros({ consejos, calles, inputClass, onMessage }) {
  const [voceros, setVoceros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    usuario: "",
    telefono: "",
    vocero: consejos[0],
    calle: calles[0],
    password: "",
    password2: "",
    pregunta1: preguntas1[0],
    respuesta1: "",
    pregunta2: preguntas2[0],
    respuesta2: "",
  });

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "", apellido: "", telefono: "", vocero: "", calle: "" });

  const [resetUser, setResetUser] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetPw2, setResetPw2] = useState("");

  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  async function handleDeleteVocero() {
    if (!deleteConfirmUser) return;
    const v = deleteConfirmUser;
    setDeleteConfirmUser(null);
    onMessage?.({ type: "", text: "" });
    try {
      await api.deleteVocero(v.user_id);
      onMessage?.({ type: "success", text: `Vocero ${v.nombre} ${v.apellido} eliminado con éxito.` });
      await load();
    } catch (err) {
      onMessage?.({ type: "error", text: err?.message || "Error al eliminar vocero." });
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listVoceros();
      setVoceros(data.voceros || []);
    } catch (e) {
      onMessage?.({ type: "error", text: e?.message || "No se pudo cargar la lista." });
    } finally {
      setLoading(false);
    }
  }, [onMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const canCreate = useMemo(() => {
    const pwOk = passwordStrength(form.password);
    return (
      form.nombre.trim() &&
      form.apellido.trim() &&
      form.usuario.trim() &&
      form.respuesta1.trim() &&
      form.respuesta2.trim() &&
      pwOk &&
      form.password === form.password2
    );
  }, [form]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    onMessage?.({ type: "", text: "" });
    try {
      const userId = normalizeId(form.usuario);
      const salt = randomSaltHex();
      const passwordHash = await hashPasswordWithSalt(form.password, salt);
      const answer1Hash = await sha256Hex(`${salt}::q1::${normalizeId(form.respuesta1)}`);
      const answer2Hash = await sha256Hex(`${salt}::q2::${normalizeId(form.respuesta2)}`);
      await api.createVocero({
        userId,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        vocero: form.vocero,
        calle: form.calle,
        salt,
        passwordHash,
        pregunta1: form.pregunta1,
        pregunta2: form.pregunta2,
        respuesta1Hash: answer1Hash,
        respuesta2Hash: answer2Hash,
      });
      onMessage?.({ type: "success", text: "Vocero creado correctamente." });
      setForm({
        nombre: "",
        apellido: "",
        usuario: "",
        vocero: consejos[0],
        calle: calles[0],
        password: "",
        password2: "",
        pregunta1: preguntas1[0],
        respuesta1: "",
        pregunta2: preguntas2[0],
        respuesta2: "",
      });
      await load();
    } catch (err) {
      onMessage?.({ type: "error", text: err?.message || "Error al crear vocero." });
    } finally {
      setCreating(false);
    }
  }

  function openEdit(v) {
    if (v.is_admin) {
      onMessage?.({ type: "error", text: "Edita administradores solo desde la base de datos." });
      return;
    }
    setEditUser(v);
    setEditForm({
      nombre: v.nombre,
      apellido: v.apellido,
      telefono: v.telefono || "",
      vocero: v.vocero,
      calle: v.calle,
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editUser) return;
    try {
      await api.updateVocero(editUser.user_id, editForm);
      onMessage?.({ type: "success", text: "Datos del vocero actualizados." });
      setEditUser(null);
      await load();
    } catch (err) {
      onMessage?.({ type: "error", text: err?.message || "Error al actualizar." });
    }
  }

  async function saveReset(e) {
    e.preventDefault();
    if (!resetUser) return;
    if (!passwordStrength(resetPw) || resetPw !== resetPw2) {
      onMessage?.({ type: "error", text: "Contraseña no válida o no coincide." });
      return;
    }
    try {
      const salt = randomSaltHex();
      const passwordHash = await hashPasswordWithSalt(resetPw, salt);
      await api.adminResetVoceroPassword(resetUser.user_id, { newSalt: salt, newPasswordHash: passwordHash });
      onMessage?.({ type: "success", text: "Contraseña restablecida. Comunícale al vocero su nueva clave." });
      setResetUser(null);
      setResetPw("");
      setResetPw2("");
    } catch (err) {
      onMessage?.({ type: "error", text: err?.message || "Error al restablecer." });
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h4 className="mb-4 flex items-center gap-2 font-semibold text-[#0f2847]">
          <UserPlus className="h-5 w-5" /> Crear cuenta de vocero
        </h4>
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Nombre</label>
            <input
              className={inputClass}
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Apellido</label>
            <input
              className={inputClass}
              placeholder="Apellido"
              value={form.apellido}
              onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Teléfono (opcional)</label>
            <input
              className={inputClass}
              placeholder="Teléfono (opcional)"
              value={form.telefono}
              onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Usuario (correo o cédula)</label>
            <input
              className={inputClass}
              placeholder="Usuario (correo o cédula)"
              value={form.usuario}
              onChange={(e) => setForm((p) => ({ ...p, usuario: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Consejo Comunal</label>
            <select
              className={inputClass}
              value={form.vocero}
              onChange={(e) => {
                const newVal = e.target.value;
                setForm((p) => ({ 
                  ...p, 
                  vocero: newVal,
                  calle: newVal === "La Esperanza" && !calles.includes(p.calle) ? calles[0] : (newVal !== "La Esperanza" ? "" : p.calle)
                }));
              }}
            >
              {consejos.map((c) => (
                <option key={c} value={c}>
                  Consejo: {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Calle</label>
            {form.vocero === "La Esperanza" ? (
              <select
                className={inputClass}
                value={form.calle}
                onChange={(e) => setForm((p) => ({ ...p, calle: e.target.value }))}
              >
                {calles.map((c) => (
                  <option key={c} value={c}>
                    Calle: {c}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputClass}
                placeholder="Escribe el nombre de la calle"
                value={form.calle}
                onChange={(e) => setForm((p) => ({ ...p, calle: e.target.value }))}
              />
            )}
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Contraseña inicial</label>
            <input
              className={inputClass}
              type="password"
              placeholder="Mínimo 8 caracteres y 1 número"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Confirmar contraseña</label>
            <input
              className={inputClass}
              type="password"
              placeholder="Confirmar contraseña"
              value={form.password2}
              onChange={(e) => setForm((p) => ({ ...p, password2: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Pregunta de seguridad 1</label>
            <select
              className={inputClass}
              value={form.pregunta1}
              onChange={(e) => setForm((p) => ({ ...p, pregunta1: e.target.value }))}
            >
              {preguntas1.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Respuesta 1</label>
            <input
              className={inputClass}
              placeholder="Respuesta 1"
              value={form.respuesta1}
              onChange={(e) => setForm((p) => ({ ...p, respuesta1: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Pregunta de seguridad 2</label>
            <select
              className={inputClass}
              value={form.pregunta2}
              onChange={(e) => setForm((p) => ({ ...p, pregunta2: e.target.value }))}
            >
              {preguntas2.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-semibold text-slate-700">Respuesta 2</label>
            <input
              className={inputClass}
              placeholder="Respuesta 2"
              value={form.respuesta2}
              onChange={(e) => setForm((p) => ({ ...p, respuesta2: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={creating || !canCreate}
            className="rounded-xl bg-[#0f2847] px-4 py-2 font-medium text-white hover:bg-[#12345f] disabled:opacity-50 md:col-span-2"
          >
            {creating ? "Creando…" : "Crear vocero"}
          </button>
        </form>
      </div>

      <div>
        <h4 className="mb-4 font-semibold text-[#0f2847]">Voceros registrados</h4>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-200">
                <tr>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Consejo</th>
                  <th className="px-3 py-2">Calle</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {voceros.map((v) => (
                  <tr key={v.user_id} className="border-b border-slate-100">
                    <td className="px-3 py-2">{v.user_id}</td>
                    <td className="px-3 py-2">
                      {v.nombre} {v.apellido}
                    </td>
                    <td className="px-3 py-2">{v.telefono || "-"}</td>
                    <td className="px-3 py-2">{v.vocero}</td>
                    <td className="px-3 py-2">{v.calle}</td>
                    <td className="px-3 py-2">{v.is_admin ? "Administrador" : "Vocero"}</td>
                    <td className="px-3 py-2 text-right">
                      {!v.is_admin && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-blue-100"
                            title="Editar consejo / calle"
                            onClick={() => openEdit(v)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-amber-100"
                            title="Restablecer contraseña"
                            onClick={() => {
                              setResetUser(v);
                              setResetPw("");
                              setResetPw2("");
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-red-100 hover:text-red-600"
                            title="Eliminar vocero"
                            onClick={() => {
                              setDeleteConfirmUser(v);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h5 className="mb-4 font-semibold text-[#0f2847]">Editar vocero</h5>
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-semibold text-slate-700">Nombre</label>
                <input
                  className={inputClass}
                  value={editForm.nombre}
                  onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-semibold text-slate-700">Apellido</label>
                <input
                  className={inputClass}
                  value={editForm.apellido}
                  onChange={(e) => setEditForm((p) => ({ ...p, apellido: e.target.value }))}
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-semibold text-slate-700">Teléfono (opcional)</label>
                <input
                  className={inputClass}
                  placeholder="Teléfono (opcional)"
                  value={editForm.telefono}
                  onChange={(e) => setEditForm((p) => ({ ...p, telefono: e.target.value }))}
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-semibold text-slate-700">Vocero del Consejo Comunal</label>
                <select
                  className={inputClass}
                  value={editForm.vocero}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setEditForm((p) => ({ 
                      ...p, 
                      vocero: newVal,
                      calle: newVal === "La Esperanza" && !calles.includes(p.calle) ? calles[0] : (newVal !== "La Esperanza" ? "" : p.calle)
                    }));
                  }}
                >
                  {consejos.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-semibold text-slate-700">Calle</label>
                {editForm.vocero === "La Esperanza" ? (
                  <select
                    className={inputClass}
                    value={editForm.calle}
                    onChange={(e) => setEditForm((p) => ({ ...p, calle: e.target.value }))}
                  >
                    {calles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    placeholder="Escribe el nombre de la calle"
                    value={editForm.calle}
                    onChange={(e) => setEditForm((p) => ({ ...p, calle: e.target.value }))}
                  />
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="rounded-xl bg-[#0f2847] px-4 py-2 text-sm text-white">
                  Guardar
                </button>
                <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setEditUser(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h5 className="mb-2 flex items-center gap-2 font-semibold text-[#0f2847]">
              <RefreshCw className="h-4 w-4" /> Nueva contraseña para {resetUser.user_id}
            </h5>
            <p className="mb-4 text-xs text-slate-500">
              Mínimo 8 caracteres y 1 número.
            </p>
            <form onSubmit={saveReset} className="space-y-3">
              <input
                className={inputClass}
                type="password"
                placeholder="Nueva contraseña"
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
              />
              <input
                className={inputClass}
                type="password"
                placeholder="Confirmar"
                value={resetPw2}
                onChange={(e) => setResetPw2(e.target.value)}
              />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white">
                  Restablecer
                </button>
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm"
                  onClick={() => setResetUser(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 text-center animate-scale-in">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Vocero?</h3>
            <p className="text-slate-500 mb-8 text-sm">
              Estás a punto de eliminar la cuenta del vocero <span className="font-semibold text-slate-700">{deleteConfirmUser.nombre} {deleteConfirmUser.apellido}</span> ({deleteConfirmUser.user_id}). Se borrará de Firestore y de la autenticación de Firebase.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-6 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteVocero}
                className="px-6 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition shadow-sm"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
