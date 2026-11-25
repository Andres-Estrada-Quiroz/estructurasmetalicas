
import { useEffect, useState } from "react";
import Clientes from "./pages/Clientes";
import Almacen from "./pages/Almacen";
import Modelos from "./pages/Modelos";
import MedidasAutomaticas from "./pages/MedidasAutomaticas";
import Cotizaciones from "./pages/Cotizaciones";
import Proveedores from "./pages/Proveedores";
import CambiarContrasenaModal from "./CambiarContrasenaModal";
import "./App.css";

// ==========================================
// SISTEMA WEB CORPORACIÓN ORTEGA
// APP.JSX COMPLETO
// ==========================================

// ==========================================
// MÓDULOS DEL MENÚ
// ==========================================

const modulos = [
  "Dashboard",
  "Clientes",
  "Almacén",
  "Modelos de estructuras",
  "Medidas Automáticas",
  "Cotizaciones",
  "Proveedores",
  "Pedidos",
  "Artículos",
  "Producción",
  "Compras",
  "Entregas",
  "Pagos",
  "Reportes",
  "Clientes (local)",
];

// ==========================================
// MÓDULOS IMPLEMENTADOS
// ==========================================

const modulosImplementados = [
  "Dashboard",
  "Clientes",
  "Almacén",
  "Modelos de estructuras",
  "Medidas Automáticas",
  "Cotizaciones",
  "Proveedores",
  "Clientes (local)",
];

// ==========================================
// FORMULARIO DE CLIENTES LOCALES
// ==========================================

const formularioInicial = {
  nombres: "",
  apellidos: "",
  telefono: "",
  correo: "",
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

function App({
  onCerrarSesion,
  cerrandoSesion = false,
  errorSesion = "",
}) {
  const [pagina, setPagina] = useState("Dashboard");

  // ========================================
  // CAMBIAR CONTRASEÑA
  // ========================================

  const [
    mostrarCambioContrasena,
    setMostrarCambioContrasena,
  ] = useState(false);

  const [
    avisoContrasena,
    setAvisoContrasena,
  ] = useState("");

  useEffect(() => {
    if (!avisoContrasena) return;

    const temporizador = setTimeout(() => {
      setAvisoContrasena("");
    }, 3000);

    return () => {
      clearTimeout(temporizador);
    };
  }, [avisoContrasena]);

  // ========================================
  // CLIENTES DEL SISTEMA ANTERIOR
  // ========================================

  const [
    clientesLocales,
    setClientesLocales,
  ] = useState(() => {
    try {
      const guardados = localStorage.getItem(
        "ortega_clientes"
      );

      const datos = guardados
        ? JSON.parse(guardados)
        : [];

      return Array.isArray(datos)
        ? datos
        : [];
    } catch {
      return [];
    }
  });

  const [
    formularioLocal,
    setFormularioLocal,
  ] = useState(formularioInicial);

  const [
    editandoLocal,
    setEditandoLocal,
  ] = useState(null);

  // ========================================
  // DATOS DEL DASHBOARD
  // ========================================

  const [
    totalClientes,
    setTotalClientes,
  ] = useState(null);

  // ========================================
  // GUARDAR CLIENTES LOCALES
  // ========================================

  useEffect(() => {
    localStorage.setItem(
      "ortega_clientes",
      JSON.stringify(clientesLocales)
    );
  }, [clientesLocales]);

  // ========================================
  // CONSULTAR CLIENTES DEL DASHBOARD
  // ========================================

  useEffect(() => {
    if (pagina !== "Dashboard") {
      return;
    }

    let activo = true;

    async function contarClientes() {
      try {
        const respuesta = await fetch(
          "/api/clientes",
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!respuesta.ok) {
          throw new Error(
            "No se pudo consultar clientes."
          );
        }

        const datos = await respuesta.json();

        if (activo) {
          setTotalClientes(
            Array.isArray(datos.clientes)
              ? datos.clientes.length
              : null
          );
        }
      } catch {
        if (activo) {
          setTotalClientes(null);
        }
      }
    }

    contarClientes();

    return () => {
      activo = false;
    };
  }, [pagina]);

  // ========================================
  // FUNCIONES DE CLIENTES LOCALES
  // ========================================

  function cambiarCampoLocal(evento) {
    const { name, value } = evento.target;

    setFormularioLocal((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  function guardarClienteLocal(evento) {
    evento.preventDefault();

    if (!formularioLocal.nombres.trim()) {
      alert(
        "Ingresa el nombre del cliente."
      );

      return;
    }

    if (editandoLocal !== null) {
      setClientesLocales((anterior) =>
        anterior.map((cliente) =>
          cliente.id === editandoLocal
            ? {
                ...cliente,
                ...formularioLocal,
              }
            : cliente
        )
      );
    } else {
      const nuevoCliente = {
        id: crypto.randomUUID(),
        ...formularioLocal,
      };

      setClientesLocales((anterior) => [
        ...anterior,
        nuevoCliente,
      ]);
    }

    setFormularioLocal(formularioInicial);
    setEditandoLocal(null);
  }

  function editarClienteLocal(cliente) {
    setFormularioLocal({
      nombres: cliente.nombres || "",
      apellidos: cliente.apellidos || "",
      telefono: cliente.telefono || "",
      correo: cliente.correo || "",
    });

    setEditandoLocal(cliente.id);
  }

  function eliminarClienteLocal(id) {
    if (
      !window.confirm(
        "¿Eliminar este cliente del almacenamiento local?"
      )
    ) {
      return;
    }

    setClientesLocales((anterior) =>
      anterior.filter(
        (cliente) => cliente.id !== id
      )
    );

    if (editandoLocal === id) {
      setEditandoLocal(null);
      setFormularioLocal(formularioInicial);
    }
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <div className="app-layout">

      {/* ==================================
          VENTANA CAMBIAR CONTRASEÑA
      ================================== */}

      <CambiarContrasenaModal
        abierto={mostrarCambioContrasena}
        alCerrar={() =>
          setMostrarCambioContrasena(false)
        }
        alGuardar={() => {
          setMostrarCambioContrasena(false);

          setAvisoContrasena(
            "Contraseña actualizada correctamente."
          );
        }}
      />

      {/* ==================================
          NOTIFICACIÓN EMERGENTE
      ================================== */}

      {avisoContrasena && (
        <div
          className="position-fixed top-0 end-0 m-4 alert alert-success shadow d-flex align-items-center gap-2"
          role="status"
          aria-live="polite"
          style={{
            zIndex: 2000,
            maxWidth: "390px",
          }}
        >
          <span aria-hidden="true">
            ✓
          </span>

          <span>
            {avisoContrasena}
          </span>

          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar notificación"
            onClick={() =>
              setAvisoContrasena("")
            }
          />
        </div>
      )}

      {/* ==================================
          MENÚ LATERAL
      ================================== */}

      <aside className="sidebar">

        <div className="sidebar-brand">
          <h5 className="fw-bold mb-1">
            CORPORACIÓN ORTEGA
          </h5>

          <small>
            Sistema de Gestión
          </small>
        </div>

        <nav className="mt-4">
          {modulos.map((modulo) => (
            <button
              key={modulo}
              type="button"
              className={
                "sidebar-link " +
                (
                  pagina === modulo
                    ? "activo"
                    : ""
                )
              }
              onClick={() =>
                setPagina(modulo)
              }
            >
              {modulo}
            </button>
          ))}
        </nav>

      </aside>

      {/* ==================================
          CONTENIDO PRINCIPAL
      ================================== */}

      <main className="contenido">

        {/* ==================================
            ENCABEZADO SUPERIOR
        ================================== */}

        <header className="barra-superior">

          <h4 className="mb-0">
            {pagina}
          </h4>

          {/* MENÚ DE ADMINISTRADOR */}

          <div className="position-relative">

            <details className="usuario-menu">

              <summary
                className="d-flex align-items-center gap-2"
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  userSelect: "none",
                }}
              >
                <span aria-hidden="true">
                  👤
                </span>

                <span className="fw-semibold">
                  ANDRES (ADMIN)
                </span>

                <span
                  style={{
                    fontSize: "12px",
                  }}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </summary>

              <div
                className="position-absolute bg-white border rounded shadow-sm p-2"
                style={{
                  right: 0,
                  top: "100%",
                  width: "245px",
                  zIndex: 1100,
                  marginTop: "5px",
                }}
              >

                {/* CAMBIAR CONTRASEÑA */}

                <button
                  type="button"
                  className="btn btn-light w-100 text-start mb-1"
                  onClick={(evento) => {
                    setMostrarCambioContrasena(
                      true
                    );

                    evento.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                >
                  🔑 Cambiar contraseña
                </button>

                {/* CONFIGURACIÓN */}

                <button
                  type="button"
                  className="btn btn-light w-100 text-start mb-1"
                  onClick={() => {
                    alert(
                      "Configuración: esta función se implementará próximamente."
                    );
                  }}
                >
                  ⚙️ Configuración
                </button>

                <hr className="my-2" />

                {/* CERRAR SESIÓN */}

                <button
                  type="button"
                  className="btn btn-outline-danger w-100 text-start"
                  onClick={onCerrarSesion}
                  disabled={
                    cerrandoSesion ||
                    typeof onCerrarSesion !==
                      "function"
                  }
                >
                  {cerrandoSesion
                    ? "Cerrando sesión..."
                    : "↪ Cerrar sesión"}
                </button>

                {errorSesion && (
                  <p className="text-danger small mt-2 mb-0">
                    {errorSesion}
                  </p>
                )}

              </div>

            </details>

          </div>

        </header>

        <div className="container-fluid py-4">

          {/* ==================================
              DASHBOARD
          ================================== */}

          {pagina === "Dashboard" && (
            <>

              <h5 className="mb-4">
                Resumen general
              </h5>

              {/* INDICADORES */}

              <div className="row g-3">

                <div className="col-md-4">
                  <div className="card shadow-sm border-0">
                    <div className="card-body">

                      <p className="text-muted mb-1">
                        Clientes en PostgreSQL
                      </p>

                      <h2>
                        {totalClientes === null
                          ? "—"
                          : totalClientes}
                      </h2>

                    </div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card shadow-sm border-0">
                    <div className="card-body">

                      <p className="text-muted mb-1">
                        Backend
                      </p>

                      <h5>
                        Laravel 13
                      </h5>

                    </div>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="card shadow-sm border-0">
                    <div className="card-body">

                      <p className="text-muted mb-1">
                        Base de datos
                      </p>

                      <h5>
                        PostgreSQL 18
                      </h5>

                    </div>
                  </div>
                </div>

              </div>

              <div className="alert alert-info mt-4">
                Sistema Web Corporación Ortega:
                gestión de clientes, almacén,
                modelos de estructuras, medidas
                automáticas, cotizaciones y
                proveedores.
              </div>

              {/* ==================================
                  ACCESO A CLIENTES
              ================================== */}

              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">

                  <h5>
                    Gestión de clientes
                  </h5>

                  <p className="text-muted">
                    Registra y administra clientes
                    conectados a PostgreSQL.
                  </p>

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() =>
                      setPagina("Clientes")
                    }
                  >
                    Administrar clientes
                  </button>

                </div>
              </div>

              {/* ==================================
                  ACCESO ÚNICO A ALMACÉN
              ================================== */}

              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">

                  <h5>
                    Gestión de almacén
                  </h5>

                  <p className="text-muted">
                    Registra materiales, controla
                    existencias, entradas y salidas
                    por metros o unidades.
                  </p>

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() =>
                      setPagina("Almacén")
                    }
                  >
                    Administrar almacén
                  </button>

                </div>
              </div>

              {/* ==================================
                  ACCESO A MODELOS
              ================================== */}

              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">

                  <h5>
                    Modelos de estructuras metálicas
                  </h5>

                  <p className="text-muted">
                    Configura estructuras, materiales,
                    componentes y reglas de cálculo.
                  </p>

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() =>
                      setPagina(
                        "Modelos de estructuras"
                      )
                    }
                  >
                    Registrar estructura
                  </button>

                </div>
              </div>

              {/* ==================================
                  ACCESO A MEDIDAS
              ================================== */}

              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">

                  <h5>
                    Medidas automáticas
                  </h5>

                  <p className="text-muted">
                    Calcula las medidas y cantidades
                    necesarias para cada estructura.
                  </p>

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() =>
                      setPagina(
                        "Medidas Automáticas"
                      )
                    }
                  >
                    Calcular medidas
                  </button>

                </div>
              </div>

              {/* ==================================
                  ACCESO A COTIZACIONES
              ================================== */}

              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">

                  <h5>
                    Cotizaciones
                  </h5>

                  <p className="text-muted">
                    Registra presupuestos, cantidades,
                    descuentos, IGV y precios de venta.
                  </p>

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() =>
                      setPagina("Cotizaciones")
                    }
                  >
                    Administrar cotizaciones
                  </button>

                </div>
              </div>

              {/* ==================================
                  ACCESO A PROVEEDORES
              ================================== */}

              <div className="card border-0 shadow-sm mt-4">
                <div className="card-body">

                  <h5>
                    Proveedores y precios de materiales
                  </h5>

                  <p className="text-muted">
                    Registra proveedores, relaciónalos
                    con materiales y configura sus
                    precios de referencia.
                  </p>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() =>
                      setPagina("Proveedores")
                    }
                  >
                    Administrar proveedores
                  </button>

                </div>
              </div>

            </>
          )}

          {/* ==================================
              MÓDULOS IMPLEMENTADOS
          ================================== */}

          {pagina === "Clientes" && (
            <Clientes />
          )}

          {/* ALMACÉN REEMPLAZA A MATERIALES */}

          {pagina === "Almacén" && (
            <Almacen />
          )}

          {pagina ===
            "Modelos de estructuras" && (
            <Modelos />
          )}

          {pagina ===
            "Medidas Automáticas" && (
            <MedidasAutomaticas />
          )}

          {pagina === "Cotizaciones" && (
            <Cotizaciones />
          )}

          {pagina === "Proveedores" && (
            <Proveedores />
          )}

          {/* ==================================
              CLIENTES LOCALES
          ================================== */}

          {pagina === "Clientes (local)" && (
            <>

              <h5 className="mb-3">
                Clientes del sistema anterior
              </h5>

              <div className="alert alert-warning">
                Esta pantalla conserva los
                clientes guardados anteriormente
                en el navegador. No están
                sincronizados con PostgreSQL.
              </div>

              {/* FORMULARIO LOCAL */}

              <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">

                  <h6 className="mb-3">
                    {editandoLocal !== null
                      ? "Editar cliente local"
                      : "Registrar cliente local"}
                  </h6>

                  <form
                    onSubmit={guardarClienteLocal}
                  >

                    <div className="row g-3">
                      {[
                        ["nombres", "Nombres"],
                        ["apellidos", "Apellidos"],
                        ["telefono", "Teléfono"],
                        [
                          "correo",
                          "Correo electrónico",
                        ],
                      ].map(
                        ([campo, etiqueta]) => (
                          <div
                            className="col-md-6"
                            key={campo}
                          >

                            <label className="form-label">
                              {etiqueta}
                            </label>

                            <input
                              className="form-control"
                              name={campo}
                              type={
                                campo === "correo"
                                  ? "email"
                                  : "text"
                              }
                              value={
                                formularioLocal[campo]
                              }
                              onChange={
                                cambiarCampoLocal
                              }
                              required={
                                campo === "nombres"
                              }
                            />

                          </div>
                        )
                      )}
                    </div>

                    <div className="d-flex gap-2 mt-3">

                      <button
                        type="submit"
                        className="btn btn-primary"
                      >
                        {editandoLocal !== null
                          ? "Actualizar"
                          : "Guardar"}
                      </button>

                      {editandoLocal !== null && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditandoLocal(null);

                            setFormularioLocal(
                              formularioInicial
                            );
                          }}
                        >
                          Cancelar
                        </button>
                      )}

                    </div>

                  </form>

                </div>
              </div>

              {/* LISTADO LOCAL */}

              <div className="card border-0 shadow-sm">
                <div className="card-body">

                  <h6>
                    Listado de clientes locales
                  </h6>

                  <div className="table-responsive">

                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Teléfono</th>
                          <th>Correo</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>

                      <tbody>

                        {clientesLocales.map(
                          (cliente) => (
                            <tr key={cliente.id}>

                              <td>
                                {cliente.nombres}{" "}
                                {cliente.apellidos}
                              </td>

                              <td>
                                {cliente.telefono}
                              </td>

                              <td>
                                {cliente.correo}
                              </td>

                              <td>
                                <div className="d-flex gap-2">

                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() =>
                                      editarClienteLocal(
                                        cliente
                                      )
                                    }
                                  >
                                    Editar
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() =>
                                      eliminarClienteLocal(
                                        cliente.id
                                      )
                                    }
                                  >
                                    Eliminar
                                  </button>

                                </div>
                              </td>

                            </tr>
                          )
                        )}

                        {clientesLocales.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="text-center text-muted py-4"
                            >
                              No hay clientes locales.
                            </td>
                          </tr>
                        )}

                      </tbody>
                    </table>

                  </div>

                </div>
              </div>

            </>
          )}

          {/* ==================================
              MÓDULOS PENDIENTES
          ================================== */}

          {!modulosImplementados.includes(
            pagina
          ) && (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">

                <h5>
                  Módulo de {pagina}
                </h5>

                <p className="text-muted mb-0">
                  Pantalla preparada para su
                  próxima implementación.
                </p>

              </div>
            </div>
          )}

        </div>

      </main>

    </div>
  );
}

export default App;

