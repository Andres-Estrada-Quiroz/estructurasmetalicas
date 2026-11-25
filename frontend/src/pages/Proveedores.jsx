
import { useCallback, useEffect, useState } from "react";

const PROVEEDOR_VACIO = {
  ruc: "",
  razonSocial: "",
  contacto: "",
  telefono: "",
  correo: "",
  direccion: "",
  estado: true,
};

const PRECIO_VACIO = {
  idProveedor: "",
  idMaterial: "",
  precioReferencia: "",
  estado: true,
};

async function leerRespuesta(respuesta) {
  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      `Respuesta inválida del servidor (${respuesta.status}).`
    );
  }

  if (!respuesta.ok) {
    const detalle = datos.errors
      ? Object.values(datos.errors).flat()[0]
      : null;

    throw new Error(
      detalle ||
      datos.mensaje ||
      datos.message ||
      `Error HTTP ${respuesta.status}`
    );
  }

  return datos;
}

async function obtenerCsrf() {
  const respuesta = await fetch("/api/auth/csrf", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  const datos = await leerRespuesta(respuesta);
  return datos.csrf_token;
}

async function enviarDatos(ruta, metodo, cuerpo = null) {
  const token = await obtenerCsrf();

  const opciones = {
    method: metodo,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": token,
    },
  };

  if (cuerpo !== null) {
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(ruta, opciones);
  return leerRespuesta(respuesta);
}

function moneda(valor) {
  if (valor === null || valor === undefined) {
    return "Sin precio";
  }

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(valor));
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [precios, setPrecios] = useState([]);

  const [formProveedor, setFormProveedor] =
    useState(PROVEEDOR_VACIO);

  const [formPrecio, setFormPrecio] =
    useState(PRECIO_VACIO);

  const [editandoProveedor, setEditandoProveedor] =
    useState(null);

  const [editandoPrecio, setEditandoPrecio] =
    useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // ========================================
  // CARGAR PROVEEDORES, MATERIALES Y PRECIOS
  // ========================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const respuestas = await Promise.all([
        fetch("/api/proveedores", {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch("/api/materiales", {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch("/api/proveedor-materiales", {
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      ]);

      const [
        datosProveedores,
        datosMateriales,
        datosPrecios,
      ] = await Promise.all(
        respuestas.map(leerRespuesta)
      );

      setProveedores(
        Array.isArray(datosProveedores.proveedores)
          ? datosProveedores.proveedores
          : []
      );

      setMateriales(
        Array.isArray(datosMateriales.materiales)
          ? datosMateriales.materiales
          : []
      );

      setPrecios(
        Array.isArray(datosPrecios.precios)
          ? datosPrecios.precios
          : []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ========================================
  // MODIFICAR DATOS DE PROVEEDOR
  // ========================================

  function cambiarProveedor(evento) {
    const { name, value, type, checked } =
      evento.target;

    let nuevoValor =
      type === "checkbox" ? checked : value;

    if (name === "ruc") {
      nuevoValor = value
        .replace(/\D/g, "")
        .slice(0, 11);
    }

    // TELEFONO: SOLO NUMEROS, MAXIMO 9

    if (name === "telefono") {
      nuevoValor = value
        .replace(/\D/g, "")
        .slice(0, 9);
    }

    setFormProveedor((anterior) => ({
      ...anterior,
      [name]: nuevoValor,
    }));
  }

  // ========================================
  // GUARDAR PROVEEDOR
  // ========================================

  async function guardarProveedor(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");

    if (!/^\d{11}$/.test(formProveedor.ruc)) {
      setError(
        "El RUC debe tener exactamente 11 números."
      );
      return;
    }

    if (!formProveedor.razonSocial.trim()) {
      setError(
        "Ingresa la razón social del proveedor."
      );
      return;
    }

    // Si se proporciona un teléfono,
    // se exige que tenga exactamente 9 dígitos.

    if (
      formProveedor.telefono !== "" &&
      !/^\d{9}$/.test(formProveedor.telefono)
    ) {
      setError(
        "El teléfono debe tener exactamente 9 números."
      );
      return;
    }

    setGuardando(true);

    try {
      const editando = editandoProveedor !== null;

      const ruta = editando
        ? `/api/proveedores/${editandoProveedor}`
        : "/api/proveedores";

      const datos = await enviarDatos(
        ruta,
        editando ? "PUT" : "POST",
        {
          ...formProveedor,
          ruc: formProveedor.ruc.trim(),
          razonSocial:
            formProveedor.razonSocial.trim(),
          contacto: formProveedor.contacto.trim(),
          telefono: formProveedor.telefono.trim(),
          correo: formProveedor.correo.trim(),
          direccion: formProveedor.direccion.trim(),
        }
      );

      setFormProveedor(PROVEEDOR_VACIO);
      setEditandoProveedor(null);

      await cargarDatos();
      setMensaje(datos.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function editarProveedor(proveedor) {
    setFormProveedor({
      ruc: proveedor.ruc || "",
      razonSocial: proveedor.razonSocial || "",
      contacto: proveedor.contacto || "",
      telefono: proveedor.telefono || "",
      correo: proveedor.correo || "",
      direccion: proveedor.direccion || "",
      estado: Boolean(proveedor.estado),
    });

    setEditandoProveedor(proveedor.idProveedor);
    setError("");
    setMensaje("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelarProveedor() {
    setFormProveedor(PROVEEDOR_VACIO);
    setEditandoProveedor(null);
    setError("");
    setMensaje("");
  }

  async function desactivarProveedor(proveedor) {
    const confirmado = window.confirm(
      `¿Desactivar al proveedor "${proveedor.razonSocial}"?`
    );

    if (!confirmado) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const datos = await enviarDatos(
        `/api/proveedores/${proveedor.idProveedor}`,
        "DELETE"
      );

      if (
        editandoProveedor === proveedor.idProveedor
      ) {
        cancelarProveedor();
      }

      await cargarDatos();
      setMensaje(datos.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // MODIFICAR PRECIOS
  // ========================================

  function cambiarPrecio(evento) {
    const { name, value, type, checked } =
      evento.target;

    setFormPrecio((anterior) => ({
      ...anterior,
      [name]:
        type === "checkbox" ? checked : value,
    }));
  }

  // ========================================
  // GUARDAR PRECIO
  // ========================================

  async function guardarPrecio(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");

    if (
      !formPrecio.idProveedor ||
      !formPrecio.idMaterial
    ) {
      setError(
        "Selecciona un proveedor y un material."
      );
      return;
    }

    if (
      formPrecio.precioReferencia.trim() === "" ||
      !/^\d+(\.\d{1,2})?$/.test(
        formPrecio.precioReferencia
      ) ||
      !Number.isFinite(
        Number(formPrecio.precioReferencia)
      ) ||
      Number(formPrecio.precioReferencia) < 0
    ) {
      setError(
        "Ingresa un precio válido de máximo dos decimales."
      );
      return;
    }

    setGuardando(true);

    try {
      const editando = editandoPrecio !== null;

      const ruta = editando
        ? `/api/proveedor-materiales/${editandoPrecio}`
        : "/api/proveedor-materiales";

      const datos = await enviarDatos(
        ruta,
        editando ? "PUT" : "POST",
        {
          idProveedor: Number(
            formPrecio.idProveedor
          ),
          idMaterial: Number(
            formPrecio.idMaterial
          ),
          precioReferencia: Number(
            formPrecio.precioReferencia
          ),
          estado: Boolean(formPrecio.estado),
        }
      );

      setFormPrecio(PRECIO_VACIO);
      setEditandoPrecio(null);

      await cargarDatos();
      setMensaje(datos.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function editarPrecio(precio) {
    setFormPrecio({
      idProveedor: String(precio.idProveedor),
      idMaterial: String(precio.idMaterial),
      precioReferencia: String(
        precio.precioReferencia
      ),
      estado: Boolean(precio.estado),
    });

    setEditandoPrecio(
      precio.idProveedorMaterial
    );
    setError("");
    setMensaje("");
  }

  function cancelarPrecio() {
    setFormPrecio(PRECIO_VACIO);
    setEditandoPrecio(null);
    setError("");
    setMensaje("");
  }

  async function desactivarPrecio(precio) {
    const confirmado = window.confirm(
      `¿Desactivar el precio de "${precio.material}" del proveedor "${precio.proveedor}"?`
    );

    if (!confirmado) return;

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const datos = await enviarDatos(
        `/api/proveedor-materiales/${precio.idProveedorMaterial}`,
        "DELETE"
      );

      if (
        editandoPrecio === precio.idProveedorMaterial
      ) {
        cancelarPrecio();
      }

      await cargarDatos();
      setMensaje(datos.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // FILTROS
  // ========================================

  const proveedoresActivos = proveedores.filter(
    (p) => Boolean(p.estado)
  );

  const materialesActivos = materiales.filter(
    (m) => Boolean(m.estado)
  );

  const proveedoresFiltrados = proveedores.filter(
    (p) =>
      [
        p.ruc,
        p.razonSocial,
        p.contacto,
        p.correo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(busqueda.toLowerCase())
  );

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">
        Proveedores y precios de materiales
      </h2>

      <p className="text-muted">
        Registra proveedores y administra los
        precios de referencia de sus materiales.
      </p>

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          className="alert alert-success"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {/* FORMULARIO PROVEEDOR */}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h5 className="mb-3">
            {editandoProveedor !== null
              ? "Editar proveedor"
              : "Registrar proveedor"}
          </h5>

          <form onSubmit={guardarProveedor}>
            <div className="row g-3">

              {/* RUC */}

              <div className="col-md-4">
                <label className="form-label">
                  RUC
                </label>

                <input
                  className="form-control"
                  type="text"
                  name="ruc"
                  inputMode="numeric"
                  maxLength={11}
                  pattern="[0-9]{11}"
                  value={formProveedor.ruc}
                  onChange={cambiarProveedor}
                  placeholder="11 números"
                  required
                />

                <small className="text-muted">
                  Exactamente 11 dígitos.
                </small>
              </div>

              {/* RAZÓN SOCIAL */}

              <div className="col-md-8">
                <label className="form-label">
                  Razón social
                </label>

                <input
                  className="form-control"
                  type="text"
                  name="razonSocial"
                  maxLength={100}
                  value={formProveedor.razonSocial}
                  onChange={cambiarProveedor}
                  required
                />
              </div>

              {/* CONTACTO */}

              <div className="col-md-6">
                <label className="form-label">
                  Contacto
                </label>

                <input
                  className="form-control"
                  type="text"
                  name="contacto"
                  maxLength={100}
                  value={formProveedor.contacto}
                  onChange={cambiarProveedor}
                />
              </div>

              {/* TELÉFONO CORREGIDO */}

              <div className="col-md-6">
                <label className="form-label">
                  Teléfono
                </label>

                <input
                  className="form-control"
                  type="text"
                  name="telefono"
                  inputMode="numeric"
                  maxLength={9}
                  pattern="[0-9]{9}"
                  value={formProveedor.telefono}
                  onChange={cambiarProveedor}
                  placeholder="987654321"
                />

                <small className="text-muted">
                  Solo números. Si se registra,
                  debe tener exactamente 9 dígitos.
                </small>
              </div>

              {/* CORREO */}

              <div className="col-md-6">
                <label className="form-label">
                  Correo
                </label>

                <input
                  className="form-control"
                  type="email"
                  name="correo"
                  maxLength={100}
                  value={formProveedor.correo}
                  onChange={cambiarProveedor}
                />
              </div>

              {/* DIRECCIÓN */}

              <div className="col-md-6">
                <label className="form-label">
                  Dirección
                </label>

                <input
                  className="form-control"
                  type="text"
                  name="direccion"
                  maxLength={150}
                  value={formProveedor.direccion}
                  onChange={cambiarProveedor}
                />
              </div>

              {/* ESTADO */}

              {editandoProveedor !== null && (
                <div className="col-12">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input me-2"
                      name="estado"
                      checked={formProveedor.estado}
                      onChange={cambiarProveedor}
                    />
                    Proveedor activo
                  </label>
                </div>
              )}

            </div>

            <div className="d-flex gap-2 mt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={guardando}
              >
                {guardando
                  ? "Guardando..."
                  : editandoProveedor !== null
                    ? "Actualizar proveedor"
                    : "Registrar proveedor"}
              </button>

              {editandoProveedor !== null && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelarProveedor}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* LISTADO DE PROVEEDORES */}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">
              Proveedores registrados
            </h5>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              disabled={cargando}
              onClick={cargarDatos}
            >
              Actualizar
            </button>
          </div>

          <input
            type="text"
            className="form-control mb-3"
            placeholder="Buscar por nombre o RUC"
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
          />

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>RUC</th>
                  <th>Razón social</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {proveedoresFiltrados.map((p) => (
                  <tr key={p.idProveedor}>
                    <td>{p.ruc}</td>
                    <td>{p.razonSocial}</td>
                    <td>{p.contacto || "—"}</td>
                    <td>{p.telefono || "—"}</td>
                    <td>
                      <span
                        className={
                          p.estado
                            ? "badge bg-success"
                            : "badge bg-secondary"
                        }
                      >
                        {p.estado
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={guardando}
                          onClick={() =>
                            editarProveedor(p)
                          }
                        >
                          Editar
                        </button>

                        {p.estado && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={guardando}
                            onClick={() =>
                              desactivarProveedor(p)
                            }
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {proveedoresFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-muted py-3"
                    >
                      No hay proveedores para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FORMULARIO DE PRECIOS */}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h5 className="mb-3">
            {editandoPrecio !== null
              ? "Editar precio de referencia"
              : "Registrar precio de material"}
          </h5>

          <form onSubmit={guardarPrecio}>
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">
                  Proveedor
                </label>

                <select
                  className="form-select"
                  name="idProveedor"
                  value={formPrecio.idProveedor}
                  onChange={cambiarPrecio}
                  required
                >
                  <option value="">
                    Selecciona un proveedor
                  </option>

                  {proveedores
                    .filter(
                      (p) =>
                        p.estado ||
                        String(p.idProveedor) ===
                          formPrecio.idProveedor
                    )
                    .map((p) => (
                      <option
                        key={p.idProveedor}
                        value={p.idProveedor}
                      >
                        {p.razonSocial}
                        {!p.estado
                          ? " (inactivo)"
                          : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">
                  Material
                </label>

                <select
                  className="form-select"
                  name="idMaterial"
                  value={formPrecio.idMaterial}
                  onChange={cambiarPrecio}
                  required
                >
                  <option value="">
                    Selecciona un material
                  </option>

                  {materiales
                    .filter(
                      (m) =>
                        m.estado ||
                        String(m.idMaterial) ===
                          formPrecio.idMaterial
                    )
                    .map((m) => (
                      <option
                        key={m.idMaterial}
                        value={m.idMaterial}
                      >
                        {m.nombre} ({m.unidadMedida})
                      </option>
                    ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">
                  Precio unitario (S/)
                </label>

                <input
                  className="form-control"
                  type="number"
                  name="precioReferencia"
                  min="0"
                  step="0.01"
                  value={formPrecio.precioReferencia}
                  onChange={cambiarPrecio}
                  required
                />
              </div>

              {editandoPrecio !== null && (
                <div className="col-12">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      className="form-check-input me-2"
                      name="estado"
                      checked={formPrecio.estado}
                      onChange={cambiarPrecio}
                    />
                    Precio activo
                  </label>
                </div>
              )}
            </div>

            <p className="text-muted small mt-2">
              El precio debe corresponder a la unidad
              registrada del material. Si compras por
              barra y calculas por metro, convierte
              primero el precio a soles por metro.
            </p>

            <div className="d-flex gap-2 mt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  guardando ||
                  proveedoresActivos.length === 0 ||
                  materialesActivos.length === 0
                }
              >
                {guardando
                  ? "Guardando..."
                  : editandoPrecio !== null
                    ? "Actualizar precio"
                    : "Registrar precio"}
              </button>

              {editandoPrecio !== null && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelarPrecio}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* LISTADO DE PRECIOS */}

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="mb-3">
            Precios de referencia registrados
          </h5>

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Material</th>
                  <th>Unidad</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {precios.map((p) => (
                  <tr key={p.idProveedorMaterial}>
                    <td>{p.proveedor}</td>
                    <td>{p.material}</td>
                    <td>{p.unidadMedida}</td>
                    <td>{moneda(p.precioReferencia)}</td>
                    <td>
                      <span
                        className={
                          p.estado
                            ? "badge bg-success"
                            : "badge bg-secondary"
                        }
                      >
                        {p.estado
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={guardando}
                          onClick={() =>
                            editarPrecio(p)
                          }
                        >
                          Editar
                        </button>

                        {p.estado && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={guardando}
                            onClick={() =>
                              desactivarPrecio(p)
                            }
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {precios.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-muted py-3"
                    >
                      No hay precios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
