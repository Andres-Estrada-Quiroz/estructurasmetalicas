
import { useCallback, useEffect, useState } from "react";

// ==========================================
// CONFIGURACIÓN DE DOCUMENTOS
// ==========================================

const REGLAS_DOCUMENTO = {
  DNI: {
    maximo: 8,
    patron: /^[0-9]{8}$/,
    mensaje: "El DNI debe tener exactamente 8 números.",
  },

  RUC: {
    maximo: 11,
    patron: /^[0-9]{11}$/,
    mensaje: "El RUC debe tener exactamente 11 números.",
  },

  CE: {
    maximo: 12,
    patron: /^[A-Z0-9-]{1,12}$/,
    mensaje:
      "El carné de extranjería admite hasta 12 caracteres.",
  },

  PASAPORTE: {
    maximo: 12,
    patron: /^[A-Z0-9-]{1,12}$/,
    mensaje:
      "El pasaporte admite hasta 12 caracteres.",
  },
};

const FORMULARIO_VACIO = {
  tipoDocumento: "DNI",
  numeroDocumento: "",
  razonSocial: "",
  telefono: "",
  direccion: "",
  estado: true,
};

// ==========================================
// LIMPIEZA DE LOS CAMPOS
// ==========================================

function limpiarDocumento(tipo, valor) {
  const regla = REGLAS_DOCUMENTO[tipo];

  if (!regla) {
    return "";
  }

  if (tipo === "DNI" || tipo === "RUC") {
    return String(valor)
      .replace(/[^0-9]/g, "")
      .slice(0, regla.maximo);
  }

  return String(valor)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, regla.maximo);
}

function limpiarTelefono(valor) {
  return String(valor)
    .replace(/[^0-9]/g, "")
    .slice(0, 9);
}

// ==========================================
// RESPUESTAS DE LARAVEL
// ==========================================

async function leerRespuesta(respuesta) {
  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta no válida (${respuesta.status}).`
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

// ==========================================
// COMPONENTE CLIENTES
// ==========================================

export default function Clientes() {
  const [clientes, setClientes] = useState([]);

  const [formulario, setFormulario] = useState(
    FORMULARIO_VACIO
  );

  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // ========================================
  // CARGAR CLIENTES DESDE POSTGRESQL
  // ========================================

  const cargarClientes = useCallback(async () => {
    setCargando(true);

    try {
      const respuesta = await fetch("/api/clientes", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const datos = await leerRespuesta(respuesta);

      setClientes(
        Array.isArray(datos.clientes)
          ? datos.clientes
          : []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarClientes();
  }, [cargarClientes]);

  // ========================================
  // MODIFICAR CAMPOS
  // ========================================

  function cambiarCampo(evento) {
    const { name, value, type, checked } =
      evento.target;

    setFormulario((anterior) => {
      // Cambiar tipo de documento
      if (name === "tipoDocumento") {
        return {
          ...anterior,
          tipoDocumento: value,
          numeroDocumento: "",
        };
      }

      // Documento: limpiar caracteres
      if (name === "numeroDocumento") {
        return {
          ...anterior,
          numeroDocumento: limpiarDocumento(
            anterior.tipoDocumento,
            value
          ),
        };
      }

      // Teléfono: solo números
      if (name === "telefono") {
        return {
          ...anterior,
          telefono: limpiarTelefono(value),
        };
      }

      return {
        ...anterior,
        [name]:
          type === "checkbox" ? checked : value,
      };
    });
  }

  // ========================================
  // VALIDAR FORMULARIO
  // ========================================

  function validarFormulario() {
    const regla =
      REGLAS_DOCUMENTO[formulario.tipoDocumento];

    if (!regla) {
      throw new Error(
        "Selecciona un tipo de documento válido."
      );
    }

    if (
      !regla.patron.test(
        formulario.numeroDocumento
      )
    ) {
      throw new Error(regla.mensaje);
    }

    if (
      formulario.telefono &&
      !/^[0-9]{1,9}$/.test(formulario.telefono)
    ) {
      throw new Error(
        "El teléfono debe contener solamente números y máximo 9 dígitos."
      );
    }

    if (formulario.razonSocial.length > 100) {
      throw new Error(
        "El nombre o razón social no puede superar 100 caracteres."
      );
    }

    if (formulario.direccion.length > 100) {
      throw new Error(
        "La dirección no puede superar 100 caracteres."
      );
    }
  }

  // ========================================
  // OBTENER TOKEN CSRF DE LARAVEL
  // ========================================

  async function obtenerCsrf() {
    const respuesta = await fetch(
      "/api/auth/csrf",
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const datos = await leerRespuesta(respuesta);

    return datos.csrf_token;
  }

  // ========================================
  // GUARDAR O ACTUALIZAR CLIENTE
  // ========================================

  async function guardarCliente(evento) {
    evento.preventDefault();

    setError("");
    setMensaje("");

    try {
      validarFormulario();
    } catch (err) {
      setError(err.message);
      return;
    }

    setGuardando(true);

    try {
      const token = await obtenerCsrf();

      const ruta =
        editando !== null
          ? `/api/clientes/${editando}`
          : "/api/clientes";

      const metodo =
        editando !== null ? "PUT" : "POST";

      const respuesta = await fetch(ruta, {
        method: metodo,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify({
          tipoDocumento:
            formulario.tipoDocumento,

          numeroDocumento:
            formulario.numeroDocumento.trim(),

          razonSocial:
            formulario.razonSocial.trim(),

          telefono:
            formulario.telefono.trim(),

          direccion:
            formulario.direccion.trim(),

          estado: Boolean(formulario.estado),
        }),
      });

      const datos = await leerRespuesta(respuesta);

      setMensaje(datos.mensaje);

      setFormulario(FORMULARIO_VACIO);
      setEditando(null);

      await cargarClientes();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // EDITAR CLIENTE
  // ========================================

  function editarCliente(cliente) {
    setFormulario({
      tipoDocumento: cliente.tipoDocumento,

      numeroDocumento:
        cliente.numeroDocumento || "",

      razonSocial:
        cliente.razonSocial || "",

      telefono:
        cliente.telefono || "",

      direccion:
        cliente.direccion || "",

      estado: Boolean(cliente.estado),
    });

    setEditando(cliente.idCliente);
    setMensaje("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ========================================
  // CANCELAR EDICIÓN
  // ========================================

  function cancelarEdicion() {
    setFormulario(FORMULARIO_VACIO);
    setEditando(null);
    setMensaje("");
    setError("");
  }

  // ========================================
  // DESACTIVAR CLIENTE
  // ========================================

  async function desactivarCliente(cliente) {
    const confirmado = window.confirm(
      `¿Deseas desactivar al cliente "${
        cliente.razonSocial ||
        cliente.numeroDocumento
      }"?`
    );

    if (!confirmado) {
      return;
    }

    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const token = await obtenerCsrf();

      const respuesta = await fetch(
        `/api/clientes/${cliente.idCliente}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-TOKEN": token,
          },
        }
      );

      const datos = await leerRespuesta(respuesta);

      setMensaje(datos.mensaje);

      if (editando === cliente.idCliente) {
        setFormulario(FORMULARIO_VACIO);
        setEditando(null);
      }

      await cargarClientes();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // FILTRAR CLIENTES
  // ========================================

  const clientesFiltrados = clientes.filter(
    (cliente) => {
      const texto = [
        cliente.tipoDocumento,
        cliente.numeroDocumento,
        cliente.razonSocial,
        cliente.telefono,
        cliente.direccion,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return texto.includes(
        busqueda.toLowerCase().trim()
      );
    }
  );

  const reglaActual =
    REGLAS_DOCUMENTO[formulario.tipoDocumento];

  const documentoCompleto =
    reglaActual.patron.test(
      formulario.numeroDocumento
    );

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">
        Gestión de clientes
      </h2>

      <p className="text-muted">
        Registra y administra clientes en PostgreSQL,
        con validación automática de documentos.
      </p>

      {/* MENSAJES */}

      {mensaje && (
        <div
          className="alert alert-success"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* ====================================
          FORMULARIO DE CLIENTES
      ==================================== */}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <h5 className="mb-3">
            {editando !== null
              ? "Editar cliente"
              : "Registrar cliente"}
          </h5>

          <form onSubmit={guardarCliente}>
            <div className="row g-3">

              {/* TIPO DE DOCUMENTO */}

              <div className="col-md-4">
                <label className="form-label">
                  Tipo de documento
                </label>

                <select
                  name="tipoDocumento"
                  className="form-select"
                  value={formulario.tipoDocumento}
                  onChange={cambiarCampo}
                  required
                >
                  <option value="DNI">
                    DNI
                  </option>

                  <option value="RUC">
                    RUC
                  </option>

                  <option value="CE">
                    Carné de extranjería
                  </option>

                  <option value="PASAPORTE">
                    Pasaporte
                  </option>
                </select>
              </div>

              {/* NÚMERO DE DOCUMENTO */}

              <div className="col-md-4">
                <label className="form-label">
                  Número de documento
                </label>

                <input
                  type="text"
                  name="numeroDocumento"
                  className="form-control"
                  value={
                    formulario.numeroDocumento
                  }
                  onChange={cambiarCampo}
                  maxLength={reglaActual.maximo}
                  inputMode={
                    ["DNI", "RUC"].includes(
                      formulario.tipoDocumento
                    )
                      ? "numeric"
                      : "text"
                  }
                  required
                />

                <div className="d-flex justify-content-between mt-1">
                  <small className="text-muted">
                    {formulario.tipoDocumento === "DNI"
                      ? "DNI: exactamente 8 números."
                      : formulario.tipoDocumento === "RUC"
                        ? "RUC: exactamente 11 números."
                        : reglaActual.mensaje}
                  </small>

                  <small className="text-muted">
                    {formulario.numeroDocumento.length}
                    /
                    {reglaActual.maximo}
                  </small>
                </div>

                {formulario.numeroDocumento.length > 0 && (
                  <small
                    className={
                      documentoCompleto
                        ? "text-success"
                        : "text-warning"
                    }
                  >
                    {documentoCompleto
                      ? "Formato correcto"
                      : "Documento incompleto"}
                  </small>
                )}
              </div>

              {/* TELÉFONO */}

              <div className="col-md-4">
                <label className="form-label">
                  Teléfono
                </label>

                <input
                  type="text"
                  name="telefono"
                  className="form-control"
                  value={formulario.telefono}
                  onChange={cambiarCampo}
                  inputMode="numeric"
                  maxLength={9}
                  pattern="[0-9]{0,9}"
                  placeholder="987654321"
                />

                <small className="text-muted">
                  Solo números. Máximo 9 dígitos.
                </small>
              </div>

              {/* NOMBRE O RAZÓN SOCIAL */}

              <div className="col-md-6">
                <label className="form-label">
                  Nombre o razón social
                </label>

                <input
                  type="text"
                  name="razonSocial"
                  className="form-control"
                  value={formulario.razonSocial}
                  onChange={cambiarCampo}
                  maxLength={100}
                  placeholder="Nombre completo o empresa"
                />
              </div>

              {/* DIRECCIÓN */}

              <div className="col-md-6">
                <label className="form-label">
                  Dirección
                </label>

                <input
                  type="text"
                  name="direccion"
                  className="form-control"
                  value={formulario.direccion}
                  onChange={cambiarCampo}
                  maxLength={100}
                  placeholder="Dirección del cliente"
                />
              </div>

              {/* ESTADO */}

              {editando !== null && (
                <div className="col-12">
                  <label className="form-check-label">
                    <input
                      type="checkbox"
                      name="estado"
                      className="form-check-input me-2"
                      checked={formulario.estado}
                      onChange={cambiarCampo}
                    />
                    Cliente activo
                  </label>
                </div>
              )}

            </div>

            {/* BOTONES DEL FORMULARIO */}

            <div className="d-flex flex-wrap gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  guardando || !documentoCompleto
                }
              >
                {guardando
                  ? "Guardando..."
                  : editando !== null
                    ? "Actualizar cliente"
                    : "Registrar cliente"}
              </button>

              {editando !== null && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={cancelarEdicion}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ====================================
          LISTADO DE CLIENTES
      ==================================== */}

      <div className="card border-0 shadow-sm">
        <div className="card-body">

          <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
            <h5 className="mb-0">
              Clientes registrados
            </h5>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={cargarClientes}
              disabled={cargando}
            >
              {cargando
                ? "Cargando..."
                : "Actualizar lista"}
            </button>
          </div>

          {/* BUSCADOR */}

          <input
            type="text"
            className="form-control mb-3"
            placeholder="Buscar por nombre, documento o teléfono"
            value={busqueda}
            onChange={(evento) =>
              setBusqueda(evento.target.value)
            }
          />

          {/* TABLA */}

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.idCliente}>

                    <td>
                      {cliente.tipoDocumento}{" "}
                      {cliente.numeroDocumento}
                    </td>

                    <td>
                      {cliente.razonSocial ||
                        "Sin nombre"}
                    </td>

                    <td>
                      {cliente.telefono || "—"}
                    </td>

                    <td>
                      {cliente.direccion || "—"}
                    </td>

                    <td>
                      <span
                        className={
                          cliente.estado
                            ? "badge bg-success"
                            : "badge bg-secondary"
                        }
                      >
                        {cliente.estado
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex gap-2">

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() =>
                            editarCliente(cliente)
                          }
                        >
                          Editar
                        </button>

                        {cliente.estado && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={guardando}
                            onClick={() =>
                              desactivarCliente(cliente)
                            }
                          >
                            Desactivar
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}

                {clientesFiltrados.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-muted py-4"
                    >
                      {cargando
                        ? "Cargando clientes..."
                        : "No hay clientes para mostrar."}
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
