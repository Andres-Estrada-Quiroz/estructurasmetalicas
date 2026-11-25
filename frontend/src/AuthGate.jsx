
import { useEffect, useState } from "react";
import App from "./App";

// ==========================================
// COMUNICACION CON LARAVEL
// ==========================================

async function leerRespuesta(respuesta) {
  const tipo =
    respuesta.headers.get("content-type") || "";

  if (!tipo.includes("application/json")) {
    throw new Error(
      "Laravel no devolvió JSON. Comprueba el servidor."
    );
  }

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    const detalle = datos.errors
      ? Object.values(datos.errors).flat()[0]
      : null;

    const error = new Error(
      detalle ||
        datos.mensaje ||
        datos.message ||
        `Error HTTP ${respuesta.status}`
    );

    error.status = respuesta.status;
    throw error;
  }

  return datos;
}

async function solicitar(
  ruta,
  metodo = "GET",
  cuerpo = null
) {
  const opciones = {
    method: metodo,
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  };

  if (metodo !== "GET") {
    const respuestaCsrf = await fetch(
      "/api/auth/csrf",
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      }
    );

    const csrf = await leerRespuesta(respuestaCsrf);

    if (!csrf.csrf_token) {
      throw new Error(
        "No se pudo obtener el token CSRF."
      );
    }

    opciones.headers["X-CSRF-TOKEN"] =
      csrf.csrf_token;

    opciones.headers["Content-Type"] =
      "application/json";

    if (cuerpo !== null) {
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const respuesta = await fetch(ruta, opciones);
  return leerRespuesta(respuesta);
}

// ==========================================
// OBTENER USUARIO AUTENTICADO
// ==========================================

function obtenerUsuario(datos) {
  if (
    datos.ok === false ||
    datos.autenticado === false ||
    datos.authenticated === false
  ) {
    return null;
  }

  const usuario =
    datos.usuario ??
    datos.user ??
    datos.data?.usuario ??
    datos.data?.user ??
    null;

  if (usuario && typeof usuario === "object") {
    return usuario;
  }

  if (
    datos.autenticado === true ||
    datos.authenticated === true ||
    datos.ok === true
  ) {
    return {
      nombres: "Usuario autenticado",
    };
  }

  return null;
}

// ==========================================
// CAMPO DE CONTRASEÑA CON OJITO
// ==========================================

function CampoContrasena({
  id,
  etiqueta,
  valor,
  alCambiar,
  autoComplete,
  minLength,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <label
        htmlFor={id}
        className="form-label"
      >
        {etiqueta}
      </label>

      <div className="input-group">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="form-control"
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVisible(!visible)}
          aria-label={
            visible
              ? "Ocultar contraseña"
              : "Mostrar contraseña"
          }
          title={
            visible
              ? "Ocultar contraseña"
              : "Mostrar contraseña"
          }
        >
          {visible ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function AuthGate() {
  const [usuario, setUsuario] = useState(null);

  const [verificando, setVerificando] =
    useState(true);

  const [procesando, setProcesando] =
    useState(false);

  // Pantallas:
  // login
  // solicitar
  // verificar
  // nuevaPassword

  const [vista, setVista] = useState("login");

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");

  const [codigo, setCodigo] = useState("");

  const [codigoVerificado, setCodigoVerificado] =
    useState(false);

  const [nuevaPassword, setNuevaPassword] =
    useState("");

  const [confirmarPassword, setConfirmarPassword] =
    useState("");

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // NOTIFICACION EMERGENTE

  const [notificacion, setNotificacion] =
    useState("");

  // ========================================
  // ELIMINAR NOTIFICACION A LOS 3 SEGUNDOS
  // ========================================

  useEffect(() => {
    if (!notificacion) {
      return;
    }

    const temporizador = setTimeout(() => {
      setNotificacion("");
    }, 3000);

    return () => {
      clearTimeout(temporizador);
    };
  }, [notificacion]);

  // ========================================
  // COMPROBAR SESION AL ABRIR EL SISTEMA
  // ========================================

  useEffect(() => {
    let activo = true;

    async function comprobarSesion() {
      try {
        const datos = await solicitar(
          "/api/auth/me"
        );

        if (activo) {
          setUsuario(obtenerUsuario(datos));
        }
      } catch (err) {
        if (activo) {
          setUsuario(null);

          if (
            err.status !== 401 &&
            err.status !== 403 &&
            err.status !== 423
          ) {
            setError(err.message);
          }
        }
      } finally {
        if (activo) {
          setVerificando(false);
        }
      }
    }

    comprobarSesion();

    return () => {
      activo = false;
    };
  }, []);

  // ========================================
  // CAMBIAR DE PANTALLA
  // ========================================

  function cambiarVista(nuevaVista) {
    setVista(nuevaVista);

    setError("");
    setMensaje("");
    setNotificacion("");

    if (nuevaVista !== "nuevaPassword") {
      setCodigoVerificado(false);
      setNuevaPassword("");
      setConfirmarPassword("");
    }
  }

  // ========================================
  // INICIAR SESION
  // ========================================

  async function iniciarSesion(evento) {
    evento.preventDefault();

    setError("");
    setMensaje("");
    setNotificacion("");

    if (!correo.trim() || !password) {
      setError(
        "Ingresa tu correo y contraseña."
      );
      return;
    }

    setProcesando(true);

    try {
      await solicitar(
        "/api/auth/login",
        "POST",
        {
          correo: correo.trim(),
          password,
        }
      );

      const datos = await solicitar(
        "/api/auth/me"
      );

      const usuarioActual =
        obtenerUsuario(datos);

      if (!usuarioActual) {
        throw new Error(
          "Laravel no confirmó la sesión activa."
        );
      }

      setUsuario(usuarioActual);
      setPassword("");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  // ========================================
  // CERRAR SESION
  // ========================================

  async function cerrarSesion() {
    if (procesando) {
      return;
    }

    setProcesando(true);
    setError("");
    setMensaje("");
    setNotificacion("");

    try {
      await solicitar(
        "/api/auth/logout",
        "POST"
      );

      setUsuario(null);
      setCorreo("");
      setPassword("");
      setCodigo("");
      setCodigoVerificado(false);
      setNuevaPassword("");
      setConfirmarPassword("");
      setVista("login");

      setMensaje(
        "Sesión cerrada correctamente."
      );
    } catch (err) {
      setError(
        "No se pudo cerrar la sesión: " +
          err.message
      );
    } finally {
      setProcesando(false);
    }
  }

  // ========================================
  // PASO 1: ENVIAR CODIGO
  // ========================================

  async function enviarCodigo(evento) {
    evento.preventDefault();

    setError("");
    setMensaje("");
    setNotificacion("");
    setProcesando(true);

    try {
      const datos = await solicitar(
        "/api/auth/recuperacion/solicitar",
        "POST",
        {
          correo: correo.trim(),
        }
      );

      setCodigo("");
      setCodigoVerificado(false);
      setNuevaPassword("");
      setConfirmarPassword("");

      setVista("verificar");

      // Se conserva este mensaje informativo
      // porque no confirma todavía el código.
      setMensaje(datos.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  // ========================================
  // PASO 2: VERIFICAR CODIGO
  // ========================================

  async function verificarCodigo(evento) {
    evento.preventDefault();

    setError("");
    setMensaje("");
    setNotificacion("");

    if (!/^[0-9]{6}$/.test(codigo)) {
      setError(
        "El código debe tener exactamente 6 números."
      );
      return;
    }

    setProcesando(true);

    try {
      const datos = await solicitar(
        "/api/auth/recuperacion/verificar",
        "POST",
        {
          correo: correo.trim(),
          codigo,
        }
      );

      if (datos.ok !== true) {
        throw new Error(
          "No se pudo verificar el código."
        );
      }

      // Laravel confirmó el código correcto.
      setCodigoVerificado(true);

      // Abrir la siguiente pantalla.
      setVista("nuevaPassword");

      // No mostrar aviso verde permanente.
      setMensaje("");

      // Mostrar notificación emergente.
      setNotificacion(
        "Código verificado correctamente"
      );
    } catch (err) {
      setCodigoVerificado(false);

      setError(err.message);

      // Si el código es incorrecto,
      // permanece en la misma pantalla.
      setVista("verificar");
    } finally {
      setProcesando(false);
    }
  }

  // ========================================
  // PASO 3: GUARDAR NUEVA CONTRASEÑA
  // ========================================

  async function guardarNuevaPassword(evento) {
    evento.preventDefault();

    setError("");
    setMensaje("");

    if (!codigoVerificado) {
      setError(
        "Primero debes verificar el código."
      );

      setVista("verificar");
      return;
    }

    if (nuevaPassword.length < 12) {
      setError(
        "La nueva contraseña debe tener al menos 12 caracteres."
      );
      return;
    }

    if (
      nuevaPassword !== confirmarPassword
    ) {
      setError(
        "Las contraseñas no coinciden."
      );
      return;
    }

    setProcesando(true);

    try {
      const datos = await solicitar(
        "/api/auth/recuperacion/restablecer",
        "POST",
        {
          correo: correo.trim(),
          codigo,
          password: nuevaPassword,
          password_confirmation:
            confirmarPassword,
        }
      );

      setCodigo("");
      setCodigoVerificado(false);
      setNuevaPassword("");
      setConfirmarPassword("");
      setPassword("");

      setVista("login");
      setNotificacion("");

      // Confirmación final del cambio de clave.
      setMensaje(datos.mensaje);
    } catch (err) {
      setError(err.message);

      // Si el código venció o necesita
      // nueva verificación, volver al paso 2.
      if (
        /código|codigo|verificar/i.test(
          err.message
        )
      ) {
        setCodigoVerificado(false);
        setVista("verificar");
      }
    } finally {
      setProcesando(false);
    }
  }

  // ========================================
  // VERIFICANDO SESION
  // ========================================

  if (verificando) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{
          minHeight: "100vh",
          backgroundColor: "#f4f6f9",
        }}
      >
        <div className="text-center">
          <div
            className="spinner-border text-primary mb-3"
            role="status"
          />

          <p>Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // ========================================
  // USUARIO AUTENTICADO
  // ========================================

  if (usuario) {
    return (
      <App
        usuario={usuario}
        onCerrarSesion={cerrarSesion}
        cerrandoSesion={procesando}
        errorSesion={error}
      />
    );
  }

  // ========================================
  // PANTALLAS DE ACCESO Y RECUPERACION
  // ========================================

  return (
    <div
      className="d-flex align-items-center justify-content-center p-3"
      style={{
        minHeight: "100vh",
        backgroundColor: "#eef2f6",
      }}
    >

      {/* ====================================
          NOTIFICACION EMERGENTE
          DESAPARECE EN 3 SEGUNDOS
      ==================================== */}

      {notificacion && (
        <div
          className="position-fixed top-0 end-0 m-4 alert alert-success shadow"
          role="status"
          aria-live="polite"
          style={{
            zIndex: 9999,
            minWidth: "280px",
            maxWidth: "380px",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <span
              style={{
                fontSize: "22px",
                fontWeight: "bold",
              }}
              aria-hidden="true"
            >
              ✓
            </span>

            <span className="flex-grow-1">
              {notificacion}
            </span>

            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar notificación"
              onClick={() =>
                setNotificacion("")
              }
            />
          </div>
        </div>
      )}

      {/* ====================================
          TARJETA DE AUTENTICACION
      ==================================== */}

      <div
        className="card border-0 shadow"
        style={{
          width: "100%",
          maxWidth: "450px",
        }}
      >
        <div className="card-body p-4 p-md-5">

          {/* TITULO */}

          <div className="text-center mb-4">
            <h3 className="fw-bold">
              CORPORACIÓN ORTEGA
            </h3>

            <p className="text-muted mb-0">
              Sistema Web de Gestión
            </p>
          </div>

          {/* ERRORES */}

          {error && (
            <div
              className="alert alert-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* MENSAJES INFORMATIVOS */}

          {mensaje && (
            <div
              className="alert alert-success"
              role="status"
            >
              {mensaje}
            </div>
          )}

          {/* ==================================
              INICIAR SESION
          ================================== */}

          {vista === "login" && (
            <>
              <h5 className="text-center mb-4">
                Iniciar sesión
              </h5>

              <form onSubmit={iniciarSesion}>
                <div className="mb-3">
                  <label
                    htmlFor="loginCorreo"
                    className="form-label"
                  >
                    Correo electrónico
                  </label>

                  <input
                    id="loginCorreo"
                    type="email"
                    className="form-control"
                    autoComplete="username"
                    maxLength={150}
                    value={correo}
                    onChange={(e) =>
                      setCorreo(e.target.value)
                    }
                    required
                  />
                </div>

                <CampoContrasena
                  id="loginPassword"
                  etiqueta="Contraseña"
                  valor={password}
                  alCambiar={setPassword}
                  autoComplete="current-password"
                />

                <div className="text-end mb-3">
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0"
                    onClick={() =>
                      cambiarVista("solicitar")
                    }
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={procesando}
                >
                  {procesando
                    ? "Validando acceso..."
                    : "Ingresar al sistema"}
                </button>
              </form>

              <p className="text-muted small text-center mt-4 mb-0">
                Acceso exclusivo para
                usuarios autorizados.
              </p>
            </>
          )}

          {/* ==================================
              PANTALLA 1: SOLICITAR CODIGO
          ================================== */}

          {vista === "solicitar" && (
            <>
              <h5 className="text-center mb-3">
                Recuperar contraseña
              </h5>

              <p className="text-muted small">
                Escribe tu correo registrado para
                recibir un código de recuperación.
              </p>

              <form onSubmit={enviarCodigo}>
                <div className="mb-3">
                  <label
                    htmlFor="correoRecuperacion"
                    className="form-label"
                  >
                    Correo electrónico
                  </label>

                  <input
                    id="correoRecuperacion"
                    className="form-control"
                    type="email"
                    value={correo}
                    onChange={(e) =>
                      setCorreo(e.target.value)
                    }
                    maxLength={150}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={procesando}
                >
                  {procesando
                    ? "Enviando código..."
                    : "Enviar código"}
                </button>
              </form>

              <button
                type="button"
                className="btn btn-link w-100 mt-3"
                onClick={() =>
                  cambiarVista("login")
                }
              >
                Volver al inicio de sesión
              </button>
            </>
          )}

          {/* ==================================
              PANTALLA 2: VERIFICAR CODIGO
          ================================== */}

          {vista === "verificar" && (
            <>
              <h5 className="text-center mb-3">
                Verificar código
              </h5>

              <p className="text-muted small">
                Revisa tu Gmail e ingresa los
                seis números recibidos. El código
                tiene una validez de 10 minutos.
              </p>

              <form onSubmit={verificarCodigo}>
                <div className="mb-3">
                  <label
                    htmlFor="codigoRecuperacion"
                    className="form-label"
                  >
                    Código de recuperación
                  </label>

                  <input
                    id="codigoRecuperacion"
                    type="text"
                    className="form-control text-center fs-4"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(
                        e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6)
                      )
                    }
                    placeholder="000000"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={procesando}
                >
                  {procesando
                    ? "Verificando..."
                    : "Verificar código"}
                </button>
              </form>

              <button
                type="button"
                className="btn btn-link w-100 mt-3"
                onClick={() =>
                  cambiarVista("solicitar")
                }
              >
                Solicitar otro código
              </button>

              <button
                type="button"
                className="btn btn-link w-100"
                onClick={() =>
                  cambiarVista("login")
                }
              >
                Volver al inicio de sesión
              </button>
            </>
          )}

          {/* ==================================
              PANTALLA 3: NUEVA CONTRASEÑA
          ================================== */}

          {vista === "nuevaPassword" &&
            codigoVerificado && (
              <>
                <h5 className="text-center mb-3">
                  Crear nueva contraseña
                </h5>

                {/* SIN MENSAJE VERDE FIJO */}

                <p className="text-muted small">
                  Ingresa una contraseña nueva
                  de al menos 12 caracteres.
                </p>

                <form onSubmit={guardarNuevaPassword}>
                  <CampoContrasena
                    id="nuevaPassword"
                    etiqueta="Nueva contraseña"
                    valor={nuevaPassword}
                    alCambiar={setNuevaPassword}
                    minLength={12}
                    autoComplete="new-password"
                  />

                  <CampoContrasena
                    id="confirmarPassword"
                    etiqueta="Confirmar contraseña"
                    valor={confirmarPassword}
                    alCambiar={setConfirmarPassword}
                    minLength={12}
                    autoComplete="new-password"
                  />

                  {confirmarPassword && (
                    <p
                      className={
                        nuevaPassword ===
                        confirmarPassword
                          ? "text-success small"
                          : "text-danger small"
                      }
                    >
                      {nuevaPassword ===
                      confirmarPassword
                        ? "Las contraseñas coinciden."
                        : "Las contraseñas no coinciden."}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={procesando}
                  >
                    {procesando
                      ? "Guardando..."
                      : "Guardar nueva contraseña"}
                  </button>
                </form>
              </>
            )}

        </div>
      </div>
    </div>
  );
}
