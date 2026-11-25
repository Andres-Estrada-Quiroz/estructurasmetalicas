
import { useEffect, useState } from "react";

const NOMBRES_REGLA = {
  ANCHO: "Ancho",
  ALTO: "Alto",
  PROFUNDIDAD: "Profundidad",
  FIJO: "Medida fija",
  AREA: "Área",
  VOLUMEN: "Volumen",
  UNIDAD: "Unidad",
};

function mostrarValor(valor, unidad = "") {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "—";
  }

  return `${valor}${unidad ? ` ${unidad}` : ""}`;
}

export default function DetalleModeloModal({
  idModelo,
  alCerrar,
}) {
  const [modelo, setModelo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!idModelo) return;

    const controlador = new AbortController();

    async function consultar() {
      setCargando(true);
      setModelo(null);
      setError("");

      try {
        const respuesta = await fetch(
          `/api/modelos/${idModelo}/detalle`,
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
            signal: controlador.signal,
          }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok || datos.ok === false) {
          throw new Error(
            datos.mensaje ||
              datos.message ||
              "No se pudo consultar la estructura."
          );
        }

        setModelo(datos.modelo);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    consultar();

    return () => controlador.abort();
  }, [idModelo]);

  useEffect(() => {
    if (!idModelo) return;

    function tecla(evento) {
      if (evento.key === "Escape") {
        alCerrar();
      }
    }

    document.addEventListener("keydown", tecla);

    return () => {
      document.removeEventListener(
        "keydown",
        tecla
      );
    };
  }, [idModelo, alCerrar]);

  if (!idModelo) return null;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1300 }}
      />

      <div
        className="modal fade show d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tituloDetalleModelo"
        tabIndex={-1}
        style={{
          zIndex: 1301,
          overflowY: "auto",
        }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h5
                  id="tituloDetalleModelo"
                  className="modal-title"
                >
                  Detalle de estructura metálica
                </h5>
                <small className="text-muted">
                  Modelo ID: {idModelo}
                </small>
              </div>

              <button
                type="button"
                className="btn-close"
                onClick={alCerrar}
                aria-label="Cerrar"
              />
            </div>

            <div className="modal-body">
              {cargando && (
                <div className="text-center py-5">
                  <div
                    className="spinner-border text-primary"
                    role="status"
                  />
                  <p className="mt-3">
                    Consultando estructura...
                  </p>
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

              {!cargando && !error && modelo && (
                <>
                  <div className="card mb-3">
                    <div className="card-body">
                      <div className="d-flex flex-wrap justify-content-between gap-2">
                        <h5 className="mb-2">
                          {modelo.nombre}
                        </h5>

                        <span className="badge bg-secondary">
                          Solo lectura
                        </span>
                      </div>

                      <div className="row g-3">
                        <div className="col-md-8">
                          <strong>Descripción</strong>
                          <p className="mb-0">
                            {modelo.descripcion ||
                              "Sin descripción"}
                          </p>
                        </div>

                        <div className="col-md-4">
                          <strong>
                            Precio base referencial
                          </strong>
                          <p className="mb-0">
                            S/{" "}
                            {Number(
                              modelo.precioBase || 0
                            ).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <h5 className="mb-3">
                    Materiales y reglas de cálculo
                  </h5>

                  {modelo.materiales.length === 0 && (
                    <div className="alert alert-warning">
                      No hay materiales asociados
                      a esta estructura.
                    </div>
                  )}

                  {modelo.materiales.map(
                    (material, indice) => (
                      <div
                        className="card mb-3"
                        key={
                          material.idModeloMaterial
                        }
                      >
                        <div className="card-header bg-light">
                          <strong>
                            {indice + 1}.{" "}
                            {material.nombre}
                          </strong>

                          <div className="text-muted small">
                            Código: {material.codigo}
                            {" · "}
                            Unidad:{" "}
                            {material.unidadMedida}
                            {" · "}
                            Merma:{" "}
                            {material.porcentajeMerma}%
                          </div>
                        </div>

                        <div className="card-body">
                          <div className="table-responsive">
                            <table className="table table-bordered table-striped table-sm align-middle">
                              <thead>
                                <tr>
                                  <th>Pieza</th>
                                  <th>Cantidad</th>
                                  <th>Regla</th>
                                  <th>Factor</th>
                                  <th>Ajuste (m)</th>
                                  <th>Medida fija (m)</th>
                                </tr>
                              </thead>

                              <tbody>
                                {material.componentes.map(
                                  (componente, numero) => (
                                    <tr key={numero}>
                                      <td>
                                        {componente.nombre}
                                      </td>

                                      <td>
                                        {componente.cantidadPiezas}
                                      </td>

                                      <td>
                                        {NOMBRES_REGLA[
                                          componente.tipoCalculo
                                        ] ||
                                          componente.tipoCalculo}
                                      </td>

                                      <td>
                                        {mostrarValor(
                                          componente.factorCalculo
                                        )}
                                      </td>

                                      <td>
                                        {mostrarValor(
                                          componente.ajusteMetros
                                        )}
                                      </td>

                                      <td>
                                        {mostrarValor(
                                          componente.medidaFijaMetros
                                        )}
                                      </td>
                                    </tr>
                                  )
                                )}

                                {material.componentes.length ===
                                  0 && (
                                  <tr>
                                    <td
                                      colSpan={6}
                                      className="text-center text-muted"
                                    >
                                      Sin piezas registradas
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  <div className="alert alert-info mb-0">
                    Esta ventana permite consultar
                    la configuración guardada.
                    No modifica los registros ni
                    descuenta materiales del stock.
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={alCerrar}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
