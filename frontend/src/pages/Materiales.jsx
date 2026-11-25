
import { useCallback, useEffect, useState } from "react";

const formularioVacio = {
  codigo: "",
  nombre: "",
  descripcion: "",
  unidadMedida: "m",
  estado: true,
};

export default function Materiales() {
  const [materiales, setMateriales] = useState([]);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [editando, setEditando] = useState(null);
  const [csrf, setCsrf] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const cargarMateriales = useCallback(async () => {
    try {
      const respuesta = await fetch("/api/materiales", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!respuesta.ok) {
        throw new Error(
          respuesta.status === 401
            ? "Debes iniciar sesión para gestionar materiales."
            : "No se pudieron cargar los materiales."
        );
      }

      const datos = await respuesta.json();
      setMateriales(datos.materiales || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargarMateriales();
  }, [cargarMateriales]);

  async function obtenerCsrf() {
    const respuesta = await fetch("/api/auth/csrf", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (!respuesta.ok) {
      throw new Error("No se pudo obtener el token CSRF.");
    }

    const datos = await respuesta.json();
    setCsrf(datos.csrf_token);
    return datos.csrf_token;
  }

  function cambiarCampo(evento) {
    const { name, value, type, checked } = evento.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    try {
      const token = await obtenerCsrf();
      const url = editando
        ? `/api/materiales/${editando}`
        : "/api/materiales";

      const respuesta = await fetch(url, {
        method: editando ? "PUT" : "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": token,
        },
        body: JSON.stringify(formulario),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        const primerError = datos.errors
          ? Object.values(datos.errors).flat()[0]
          : null;

        throw new Error(
          primerError ||
          datos.mensaje ||
          datos.message ||
          "No se pudo guardar el material."
        );
      }

      setMensaje(datos.mensaje);
      setFormulario(formularioVacio);
      setEditando(null);
      await cargarMateriales();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  function editar(material) {
    setFormulario({
      codigo: material.codigo,
      nombre: material.nombre,
      descripcion: material.descripcion || "",
      unidadMedida: material.unidadMedida,
      estado: material.estado,
    });

    setEditando(material.idMaterial);
    setMensaje("");
    setError("");
  }

  async function desactivar(material) {
    if (
      !window.confirm(
        `¿Desactivar el material "${material.nombre}"?`
      )
    ) {
      return;
    }

    setError("");
    setMensaje("");
    setCargando(true);

    try {
      const token = await obtenerCsrf();

      const respuesta = await fetch(
        `/api/materiales/${material.idMaterial}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-TOKEN": token,
          },
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.mensaje ||
          datos.message ||
          "No se pudo desactivar el material."
        );
      }

      setMensaje(datos.mensaje);
      await cargarMateriales();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">Gestión de materiales</h2>

      <p className="text-muted">
        Registra y administra perfiles, tubos, planchas y
        otros materiales utilizados en estructuras metálicas.
      </p>

      {mensaje && (
        <div className="alert alert-success">{mensaje}</div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body">
          <h5 className="mb-3">
            {editando ? "Editar material" : "Registrar material"}
          </h5>

          <form onSubmit={guardar}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Código</label>
                <input
                  className="form-control"
                  name="codigo"
                  value={formulario.codigo}
                  onChange={cambiarCampo}
                  maxLength={50}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">Nombre</label>
                <input
                  className="form-control"
                  name="nombre"
                  value={formulario.nombre}
                  onChange={cambiarCampo}
                  maxLength={100}
                  required
                />
              </div>

              <div className="col-md-8">
                <label className="form-label">
                  Descripción
                </label>
                <textarea
                  className="form-control"
                  name="descripcion"
                  value={formulario.descripcion}
                  onChange={cambiarCampo}
                  rows={2}
                />
              </div>

              <div className="col-md-4">
                <label className="form-label">
                  Unidad de medida
                </label>

                <select
                  className="form-select"
                  name="unidadMedida"
                  value={formulario.unidadMedida}
                  onChange={cambiarCampo}
                >
                  <option value="m">Metros (m)</option>
                  <option value="m2">Metros cuadrados (m²)</option>
                  <option value="m3">Metros cúbicos (m³)</option>
                  <option value="und">Unidades (und)</option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-check-label">
                  <input
                    className="form-check-input me-2"
                    type="checkbox"
                    name="estado"
                    checked={Boolean(formulario.estado)}
                    onChange={cambiarCampo}
                  />
                  Material activo
                </label>
              </div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={cargando}
              >
                {cargando
                  ? "Guardando..."
                  : editando
                    ? "Actualizar material"
                    : "Registrar material"}
              </button>

              {editando !== null && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setEditando(null);
                    setFormulario(formularioVacio);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h5>Materiales registrados</h5>

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Unidad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {materiales.map((material) => (
                  <tr key={material.idMaterial}>
                    <td>{material.codigo}</td>
                    <td>{material.nombre}</td>
                    <td>{material.unidadMedida}</td>
                    <td>
                      <span
                        className={
                          material.estado
                            ? "badge bg-success"
                            : "badge bg-secondary"
                        }
                      >
                        {material.estado ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          type="button"
                          onClick={() => editar(material)}
                        >
                          Editar
                        </button>

                        {material.estado && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            type="button"
                            disabled={cargando}
                            onClick={() => desactivar(material)}
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {materiales.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center text-muted py-4"
                    >
                      No hay materiales registrados.
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
