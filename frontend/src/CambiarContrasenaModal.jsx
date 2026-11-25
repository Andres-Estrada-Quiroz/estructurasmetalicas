
import { useEffect, useState } from "react";

// ==========================================
// CAMPO DE CONTRASEÑA CON OJITO
// ==========================================

function CampoPassword({
  id,
  titulo,
  valor,
  alCambiar,
  completar,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-3">
      <label
        htmlFor={id}
        className="form-label fw-semibold"
      >
        {titulo}
      </label>

      <div className="input-group">
        <input
          id={id}
          className="form-control"
          type={visible ? "text" : "password"}
          value={valor}
          onChange={(e) =>
            alCambiar(e.target.value)
          }
          autoComplete={completar}
          minLength={
            completar === "new-password"
              ? 12
              : undefined
          }
          required
        />

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() =>
            setVisible((anterior) => !anterior)
          }
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
// VENTANA EMERGENTE
// ==========================================

export default function CambiarContrasenaModal({
  abierto,
  alCerrar,
  alGuardar,
}) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] =
    useState("");

  const [error, setError] = useState("");
  const [guardando, setGuardando] =
    useState(false);

  // Cerrar con ESC.
  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (evento) => {
      if (
        evento.key === "Escape" &&
        !guardando
      ) {
        alCerrar();
      }
    };

    document.addEventListener(
      "keydown",
      alPulsar
    );

    return () =>
      document.removeEventListener(
        "keydown",
        alPulsar
      );
  }, [abierto, guardando, alCerrar]);

  // Limpiar los campos al abrir.
  useEffect(() => {
    if (abierto) {
      setActual("");
      setNueva("");
      setConfirmacion("");
      setError("");
    }
  }, [abierto]);

  if (!abierto) return null;

  // ========================================
  // LEER RESPUESTAS DE LARAVEL
  // ========================================

  async function leerJson(respuesta) {
    const tipo =
      respuesta.headers.get("content-type") || "";

    if (!tipo.includes("application/json")) {
      throw new Error(
        "El servidor no devolvió una respuesta válida."
      );
    }

    const datos = await respuesta.json();

    if (
      !respuesta.ok ||
      datos.ok === false
    ) {
      const detalle = datos.errors
        ? Object.values(datos.errors).flat()[0]
        : null;

      throw new Error(
        detalle ||
          datos.mensaje ||
          datos.message ||
          "No se pudo cambiar la contraseña."
      );
    }

    return datos;
  }

  // ========================================
  // GUARDAR NUEVA CONTRASEÑA
  // ========================================

  async function guardar(evento) {
    evento.preventDefault();
    setError("");

    if (nueva.length < 12) {
      setError(
        "La contraseña nueva debe tener al menos 12 caracteres."
      );
      return;
    }

    if (nueva !== confirmacion) {
      setError(
        "Las contraseñas nuevas no coinciden."
      );
      return;
    }

    if (actual === nueva) {
      setError(
        "La contraseña nueva debe ser distinta a la actual."
      );
      return;
    }

    setGuardando(true);

    try {
      // Obtener token CSRF.
      const csrfRespuesta = await fetch(
        "/api/auth/csrf",
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const csrf = await leerJson(
        csrfRespuesta
      );

      if (!csrf.csrf_token) {
        throw new Error(
          "No se pudo obtener el token CSRF."
        );
      }

      // Enviar datos al backend Laravel.
      const respuesta = await fetch(
        "/api/auth/cambiar-contrasena",
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": csrf.csrf_token,
          },
          body: JSON.stringify({
            password_actual: actual,
            password: nueva,
            password_confirmation:
              confirmacion,
          }),
        }
      );

      await leerJson(respuesta);

      setActual("");
      setNueva("");
      setConfirmacion("");

      // Avisar al componente principal.
      alGuardar();
    } catch (err) {
      setError(
        err.message ||
          "No se pudo actualizar la contraseña."
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================
  // DISEÑO DE LA VENTANA
  // ========================================

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{
          zIndex: 1300,
        }}
      />

      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloCambiarContrasena"
        style={{
          zIndex: 1301,
        }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content shadow border-0">

            <div className="modal-header">
              <h5
                className="modal-title"
                id="tituloCambiarContrasena"
              >
                🔑 Cambiar contraseña
              </h5>

              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar"
                onClick={alCerrar}
                disabled={guardando}
              />
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">

                <p className="text-muted small">
                  Confirma tu contraseña actual.
                  La nueva debe tener al menos
                  12 caracteres.
                </p>

                {error && (
                  <div
                    className="alert alert-danger"
                    role="alert"
                  >
                    {error}
                  </div>
                )}

                <CampoPassword
                  id="contrasenaActualPerfil"
                  titulo="Contraseña actual"
                  valor={actual}
                  alCambiar={setActual}
                  completar="current-password"
                />

                <CampoPassword
                  id="contrasenaNuevaPerfil"
                  titulo="Nueva contraseña"
                  valor={nueva}
                  alCambiar={setNueva}
                  completar="new-password"
                />

                <CampoPassword
                  id="contrasenaConfirmacionPerfil"
                  titulo="Confirmar nueva contraseña"
                  valor={confirmacion}
                  alCambiar={setConfirmacion}
                  completar="new-password"
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={alCerrar}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : "Guardar contraseña"}
                </button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </>
  );
}
