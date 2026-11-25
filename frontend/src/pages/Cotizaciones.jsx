
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ==========================================
// CORPORACIÓN ORTEGA
// MÓDULO DE COTIZACIONES
//
// 1. CLIENTE Y ESTRUCTURA
// 2. DIMENSIONES Y MATERIALES
// 3. PRECIO DE VENTA
// 4. REVISIÓN Y CONFIRMACIÓN
//
// SIN DESCUENTO DE INVENTARIO
// ==========================================

const PASOS = [
  "Cliente y estructura",
  "Medidas y materiales",
  "Precio de venta",
  "Revisión",
];

// ==========================================
// FECHAS
// ==========================================

function fechaLocal(diasAdicionales = 0) {
  const fecha = new Date();

  fecha.setDate(
    fecha.getDate() + diasAdicionales
  );

  const anio = fecha.getFullYear();

  const mes = String(
    fecha.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    fecha.getDate()
  ).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function formularioInicial() {
  return {
    idCliente: "",
    idModeloProducto: "",
    fechaVencimiento: fechaLocal(7),

    ancho: "1.20",
    alto: "1.50",
    profundidad: "0",
    cantidad: "1",

    precioUnitario: "",
    descuento: "0",
    igvPorcentaje: "18",

    descripcion: "",
    observacion: "",
  };
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function estaActivo(valor) {
  return (
    valor === true ||
    valor === 1 ||
    valor === "1" ||
    valor === "true"
  );
}

function esNumero(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    String(valor).trim() !== "" &&
    Number.isFinite(Number(valor))
  );
}

function tieneDosDecimales(valor) {
  if (!esNumero(valor)) {
    return false;
  }

  return /^\d+(\.\d{1,2})?$/.test(
    String(valor).trim()
  );
}

function dinero(valor) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(valor) || 0);
}

function mostrarFecha(valor) {
  if (!valor) {
    return "—";
  }

  return String(valor).slice(0, 10);
}

function identificadorCalculo(formulario) {
  return JSON.stringify({
    idModeloProducto:
      String(formulario.idModeloProducto),

    ancho: String(formulario.ancho),
    alto: String(formulario.alto),
    profundidad: String(formulario.profundidad),
  });
}

function calcularImportes(formulario) {
  const cantidad = Number(formulario.cantidad);
  const precio = Number(formulario.precioUnitario);
  const descuento = Number(formulario.descuento);
  const porcentaje = Number(formulario.igvPorcentaje);

  const precioCentimos = Math.round(
    (Number.isFinite(precio) ? precio : 0) * 100
  );

  const descuentoCentimos = Math.round(
    (Number.isFinite(descuento) ? descuento : 0) * 100
  );

  const subtotalCentimos =
    precioCentimos *
    (Number.isFinite(cantidad) ? cantidad : 0);

  const baseCentimos = Math.max(
    0,
    subtotalCentimos - descuentoCentimos
  );

  const igvCentimos = Math.round(
    baseCentimos *
      (Number.isFinite(porcentaje) ? porcentaje : 0) /
      100
  );

  const totalCentimos =
    baseCentimos + igvCentimos;

  return {
    precioCentimos,
    descuentoCentimos,
    subtotalCentimos,
    baseCentimos,
    igvCentimos,
    totalCentimos,
  };
}

async function leerRespuesta(respuesta) {
  let datos;

  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta no válida. HTTP ${respuesta.status}.`
    );
  }

  if (
    !respuesta.ok ||
    datos.ok === false
  ) {
    const validacion = datos.errors
      ? Object.values(datos.errors).flat()[0]
      : null;

    throw new Error(
      validacion ||
        datos.mensaje ||
        datos.message ||
        `Error HTTP ${respuesta.status}`
    );
  }

  return datos;
}

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

  if (!datos.csrf_token) {
    throw new Error(
      "No se pudo obtener el token CSRF."
    );
  }

  return datos.csrf_token;
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Cotizaciones() {
  const [paso, setPaso] = useState(0);

  const [formulario, setFormulario] =
    useState(formularioInicial);

  const [clientes, setClientes] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cotizaciones, setCotizaciones] =
    useState([]);

  const [
    resultadoMedidas,
    setResultadoMedidas,
  ] = useState(null);

  const [
    claveCalculo,
    setClaveCalculo,
  ] = useState(null);

  const [cargando, setCargando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Confirmación obligatoria.
  const [confirmando, setConfirmando] =
    useState(false);

  // Consulta de cotizaciones existentes.
  const [
    idDetalle,
    setIdDetalle,
  ] = useState(null);

  const [
    detalleCotizacion,
    setDetalleCotizacion,
  ] = useState(null);

  const [
    cargandoDetalle,
    setCargandoDetalle,
  ] = useState(false);

  const [
    errorDetalle,
    setErrorDetalle,
  ] = useState("");

  const formularioRef = useRef(null);

  // Controla cálculos antiguos.
  const solicitudCalculoRef = useRef(0);

  // Evita escrituras duplicadas.
  const guardadoEnCursoRef = useRef(false);

  // Mantiene una referencia actualizada
  // a los campos del formulario.
  const formularioActualRef = useRef(formulario);

  const importes = calcularImportes(formulario);

  const clienteSeleccionado = clientes.find(
    (cliente) =>
      String(cliente.idCliente) ===
      String(formulario.idCliente)
  );

  const modeloSeleccionado = modelos.find(
    (modelo) =>
      String(modelo.idModeloProducto) ===
      String(formulario.idModeloProducto)
  );

  const calculoVigente =
    resultadoMedidas !== null &&
    claveCalculo ===
      identificadorCalculo(formulario);

  // ========================================
  // CARGAR INFORMACIÓN DE POSTGRESQL
  // ========================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const respuestas = await Promise.all([
        fetch("/api/clientes", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),

        fetch("/api/modelos", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),

        fetch("/api/cotizaciones", {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }),
      ]);

      const [
        datosClientes,
        datosModelos,
        datosCotizaciones,
      ] = await Promise.all(
        respuestas.map(leerRespuesta)
      );

      // No ofrecer clientes inactivos.
      setClientes(
        (datosClientes.clientes || []).filter(
          (cliente) => estaActivo(cliente.estado)
        )
      );

      // No ofrecer estructuras desactivadas
      // para cotizaciones nuevas.
      setModelos(
        (datosModelos.modelos || []).filter(
          (modelo) => estaActivo(modelo.estado)
        )
      );

      // El historial no se filtra.
      setCotizaciones(
        Array.isArray(datosCotizaciones.cotizaciones)
          ? datosCotizaciones.cotizaciones
          : []
      );

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ========================================
  // CAMBIAR CAMPOS
  // ========================================

  function cambiarCampo(evento) {
    const { name, value } = evento.target;

    const siguienteFormulario = {
      ...formularioActualRef.current,
      [name]: value,
    };

    formularioActualRef.current = siguienteFormulario;

    setFormulario(siguienteFormulario);

    setError("");

    // Si cambian modelo o dimensiones,
    // se invalida el cálculo anterior.
    if (
      [
        "idModeloProducto",
        "ancho",
        "alto",
        "profundidad",
      ].includes(name)
    ) {
      solicitudCalculoRef.current += 1;

      setResultadoMedidas(null);
      setClaveCalculo(null);
      setMensaje("");
      setCalculando(false);
    }
  }

  // ========================================
  // VALIDAR PASO 1
  // ========================================

  function validarClienteYModelo() {
    if (
      !formulario.idCliente ||
      !clienteSeleccionado
    ) {
      throw new Error(
        "Selecciona un cliente activo."
      );
    }

    if (
      !formulario.idModeloProducto ||
      !modeloSeleccionado
    ) {
      throw new Error(
        "Selecciona una estructura metálica activa."
      );
    }

    if (
      !formulario.fechaVencimiento ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        formulario.fechaVencimiento
      ) ||
      formulario.fechaVencimiento < fechaLocal()
    ) {
      throw new Error(
        "La fecha de vencimiento no puede ser anterior a hoy."
      );
    }

    if (
      formulario.observacion.length > 100
    ) {
      throw new Error(
        "La observación no puede superar 100 caracteres."
      );
    }
  }

  // ========================================
  // VALIDAR DIMENSIONES
  // ========================================

  function validarDimensiones() {
    const ancho = Number(formulario.ancho);
    const alto = Number(formulario.alto);

    const profundidad = Number(
      formulario.profundidad
    );

    if (
      !esNumero(formulario.ancho) ||
      !esNumero(formulario.alto) ||
      !esNumero(formulario.profundidad) ||
      ancho <= 0 ||
      alto <= 0 ||
      profundidad < 0
    ) {
      throw new Error(
        "Ingresa dimensiones válidas. El ancho y el alto deben ser mayores que cero."
      );
    }

    const cantidad = Number(
      formulario.cantidad
    );

    if (
      !esNumero(formulario.cantidad) ||
      !Number.isInteger(cantidad) ||
      cantidad < 1
    ) {
      throw new Error(
        "La cantidad debe ser un número entero mayor que cero."
      );
    }

    if (
      formulario.descripcion.length > 255
    ) {
      throw new Error(
        "La descripción no puede superar 255 caracteres."
      );
    }
  }

  // ========================================
  // VALIDAR CÁLCULO DE MATERIALES
  // ========================================

  function validarCalculo() {
    if (
      !calculoVigente ||
      !Array.isArray(resultadoMedidas?.materiales) ||
      resultadoMedidas.materiales.length === 0
    ) {
      throw new Error(
        "Primero calcula los materiales con Laravel. Si cambiaste las dimensiones, vuelve a calcular."
      );
    }
  }

  // ========================================
  // VALIDAR PRECIO DE VENTA
  // ========================================

  function validarPrecios() {
    const cantidad = Number(
      formulario.cantidad
    );

    const precio = Number(
      formulario.precioUnitario
    );

    const descuento = Number(
      formulario.descuento
    );

    if (
      !Number.isInteger(cantidad) ||
      cantidad < 1
    ) {
      throw new Error(
        "La cantidad de estructuras no es válida."
      );
    }

    if (
      !tieneDosDecimales(
        formulario.precioUnitario
      ) ||
      precio <= 0
    ) {
      throw new Error(
        "Ingresa un precio unitario mayor que cero, con máximo dos decimales."
      );
    }

    if (
      !tieneDosDecimales(
        formulario.descuento
      ) ||
      descuento < 0
    ) {
      throw new Error(
        "Ingresa un descuento válido con máximo dos decimales."
      );
    }

    if (
      importes.descuentoCentimos >
      importes.subtotalCentimos
    ) {
      throw new Error(
        "El descuento no puede superar el subtotal."
      );
    }

    if (
      !["0", "18"].includes(
        String(formulario.igvPorcentaje)
      )
    ) {
      throw new Error(
        "Selecciona una tasa válida de IGV."
      );
    }
  }

  function validarTodo() {
    validarClienteYModelo();
    validarDimensiones();
    validarCalculo();
    validarPrecios();
  }

  // ========================================
  // CALCULAR MATERIALES CON LARAVEL
  // ========================================

  async function calcularMedidas() {
    if (calculando || guardando) {
      return;
    }

    setError("");
    setMensaje("");

    try {
      validarClienteYModelo();
      validarDimensiones();
    } catch (err) {
      setError(err.message);
      return;
    }

    const solicitud =
      ++solicitudCalculoRef.current;

    const formularioConsultado = {
      ...formularioActualRef.current,
    };

    const claveSolicitada =
      identificadorCalculo(formularioConsultado);

    setResultadoMedidas(null);
    setClaveCalculo(null);
    setCalculando(true);

    try {
      const parametros = new URLSearchParams({
        ancho: formularioConsultado.ancho,
        alto: formularioConsultado.alto,
        profundidad:
          formularioConsultado.profundidad,
      });

      const respuesta = await fetch(
        `/api/modelos/${formularioConsultado.idModeloProducto}/calcular?${parametros.toString()}`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const datos = await leerRespuesta(
        respuesta
      );

      // Evita colocar resultados de una
      // petición anterior si el usuario
      // modificó las medidas mientras calculaba.
      if (
        solicitud !== solicitudCalculoRef.current ||
        claveSolicitada !==
          identificadorCalculo(
            formularioActualRef.current
          )
      ) {
        return;
      }

      if (
        !datos.resultado ||
        !Array.isArray(
          datos.resultado.materiales
        ) ||
        datos.resultado.materiales.length === 0
      ) {
        throw new Error(
          "Laravel no devolvió materiales calculados."
        );
      }

      setResultadoMedidas(datos.resultado);
      setClaveCalculo(claveSolicitada);

      setMensaje(
        "Materiales calculados correctamente. Puedes continuar."
      );
    } catch (err) {
      if (
        solicitud === solicitudCalculoRef.current
      ) {
        setError(err.message);
      }
    } finally {
      if (
        solicitud === solicitudCalculoRef.current
      ) {
        setCalculando(false);
      }
    }
  }

  // ========================================
  // CAMBIAR DE PASO SIN GUARDAR
  // ========================================

  function subirFormulario() {
    formularioRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function siguiente() {
    setError("");

    try {
      if (paso === 0) {
        validarClienteYModelo();
      }

      if (paso === 1) {
        validarDimensiones();
        validarCalculo();
      }

      if (paso === 2) {
        validarPrecios();
      }

      setPaso((actual) =>
        Math.min(actual + 1, 3)
      );

      subirFormulario();
    } catch (err) {
      setError(err.message);
    }
  }

  function anterior() {
    setError("");

    setPaso((actual) =>
      Math.max(actual - 1, 0)
    );

    subirFormulario();
  }

  function irA(numero) {
    setError("");
    setPaso(numero);
    subirFormulario();
  }

  function reiniciarFormulario() {
    solicitudCalculoRef.current += 1;

    const inicial = formularioInicial();

    formularioActualRef.current = inicial;

    setFormulario(inicial);
    setResultadoMedidas(null);
    setClaveCalculo(null);
    setCalculando(false);
    setPaso(0);
    setConfirmando(false);
    setError("");
  }

  // ========================================
  // CONFIRMACIÓN DE GUARDADO
  // ========================================

  function solicitarConfirmacion() {
    if (
      paso !== 3 ||
      guardando ||
      calculando
    ) {
      return;
    }

    setError("");

    try {
      validarTodo();

      // No ejecuta ninguna operación POST.
      setConfirmando(true);
    } catch (err) {
      setError(err.message);
    }
  }

  // ========================================
  // REGISTRAR COTIZACIÓN
  // ========================================

  async function guardarConfirmado() {
    if (
      !confirmando ||
      paso !== 3 ||
      guardando ||
      guardadoEnCursoRef.current
    ) {
      return;
    }

    guardadoEnCursoRef.current = true;
    setGuardando(true);
    setError("");

    let guardadoCorrectamente = false;

    try {
      validarTodo();

      const token = await obtenerCsrf();

      const cuerpo = {
        idCliente: Number(
          formulario.idCliente
        ),

        idModeloProducto: Number(
          formulario.idModeloProducto
        ),

        fechaVencimiento:
          formulario.fechaVencimiento,

        ancho: Number(
          formulario.ancho
        ),

        alto: Number(
          formulario.alto
        ),

        profundidad: Number(
          formulario.profundidad
        ),

        cantidad: Number(
          formulario.cantidad
        ),

        precioUnitario: Number(
          formulario.precioUnitario
        ),

        descuento: Number(
          formulario.descuento
        ),

        igvPorcentaje: Number(
          formulario.igvPorcentaje
        ),

        descripcion:
          formulario.descripcion.trim(),

        observacion:
          formulario.observacion.trim(),
      };

      // ÚNICA OPERACIÓN QUE REGISTRA
      // LA COTIZACIÓN EN POSTGRESQL.
      //
      // Se ejecuta exclusivamente después
      // de pulsar "Sí, registrar".

      const respuesta = await fetch(
        "/api/cotizaciones",
        {
          method: "POST",
          credentials: "include",

          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/json",
            "X-CSRF-TOKEN": token,
          },

          body: JSON.stringify(cuerpo),
        }
      );

      const resultado = await leerRespuesta(
        respuesta
      );

      guardadoCorrectamente = true;

      const codigo =
        resultado.cotizacion?.idCotizacion;

      setMensaje(
        `${
          resultado.mensaje ||
          "Cotización registrada correctamente."
        }${
          codigo
            ? ` Código: #${codigo}`
            : ""
        }`
      );

      reiniciarFormulario();
      subirFormulario();
    } catch (err) {
      setError(err.message);
      subirFormulario();
    } finally {
      guardadoEnCursoRef.current = false;
      setConfirmando(false);
      setGuardando(false);
    }

    if (guardadoCorrectamente) {
      await cargarDatos();
    }
  }

  // ========================================
  // VER DETALLE DE COTIZACIÓN
  // ========================================

  async function abrirDetalle(idCotizacion) {
    setIdDetalle(idCotizacion);
    setDetalleCotizacion(null);
    setErrorDetalle("");
    setCargandoDetalle(true);

    try {
      const respuesta = await fetch(
        `/api/cotizaciones/${idCotizacion}`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const datos = await leerRespuesta(
        respuesta
      );

      setDetalleCotizacion(datos);
    } catch (err) {
      setErrorDetalle(err.message);
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle() {
    setIdDetalle(null);
    setDetalleCotizacion(null);
    setErrorDetalle("");
  }

  // ========================================
  // RESUMEN DE MATERIALES
  // ========================================

  function tablaMateriales() {
    if (!resultadoMedidas) {
      return null;
    }

    const cantidadEstructuras = Number(
      formulario.cantidad
    );

    return (
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle">
          <thead>
            <tr>
              <th>Material</th>
              <th>Unidad</th>
              <th>Neto por estructura</th>
              <th>Con merma por estructura</th>
              <th>Con merma total</th>
            </tr>
          </thead>

          <tbody>
            {(resultadoMedidas.materiales || []).map(
              (material, indice) => (
                <tr key={indice}>
                  <td>
                    {material.material}
                  </td>

                  <td>
                    {material.unidad}
                  </td>

                  <td>
                    {material.cantidadNeta}
                  </td>

                  <td>
                    {material.cantidadConMerma}
                  </td>

                  <td>
                    <strong>
                      {(
                        Number(
                          material.cantidadConMerma
                        ) *
                        (
                          Number.isFinite(
                            cantidadEstructuras
                          )
                            ? cantidadEstructuras
                            : 0
                        )
                      ).toFixed(4)}
                      {" "}
                      {material.unidad}
                    </strong>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    );
  }

  function resumenMonetario() {
    return (
      <div className="border rounded p-3">
        <div className="d-flex justify-content-between mb-2">
          <span>Subtotal</span>

          <strong>
            {dinero(
              importes.subtotalCentimos / 100
            )}
          </strong>
        </div>

        <div className="d-flex justify-content-between mb-2">
          <span>Descuento</span>

          <strong>
            {dinero(
              importes.descuentoCentimos / 100
            )}
          </strong>
        </div>

        <div className="d-flex justify-content-between mb-2">
          <span>
            IGV ({formulario.igvPorcentaje}%)
          </span>

          <strong>
            {dinero(
              importes.igvCentimos / 100
            )}
          </strong>
        </div>

        <hr />

        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            Total
          </h5>

          <h4 className="mb-0">
            {dinero(
              importes.totalCentimos / 100
            )}
          </h4>
        </div>
      </div>
    );
  }

  // ========================================
  // INTERFAZ PRINCIPAL
  // ========================================

  return (
    <div className="container-fluid py-3">

      <h2 className="mb-2">
        Cotizaciones
      </h2>

      <p className="text-muted mb-4">
        Registra cotizaciones de estructuras
        metálicas con cálculo automático de
        materiales y confirmación final.
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

      {/* ==================================
          FORMULARIO DE COTIZACIÓN
      ================================== */}

      <div
        ref={formularioRef}
        className="card border-0 shadow-sm mb-4"
      >
        <div className="card-body p-3 p-md-4">

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h5 className="mb-0">
              Nueva cotización
            </h5>

            <span className="badge bg-primary">
              Paso {paso + 1} de 4
            </span>
          </div>

          <div
            className="progress mb-4"
            style={{ height: 8 }}
          >
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={(paso + 1) * 25}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: `${(paso + 1) * 25}%`,
              }}
            />
          </div>

          <div className="row g-2 mb-4">
            {PASOS.map((nombre, indice) => (
              <div
                className="col-6 col-lg-3"
                key={nombre}
              >
                <div
                  className={
                    "rounded border p-2 h-100 " +
                    (
                      indice === paso
                        ? "border-primary bg-primary bg-opacity-10"
                        : indice < paso
                        ? "border-success"
                        : "border-light"
                    )
                  }
                >
                  <span
                    className={
                      "badge me-2 " +
                      (
                        indice < paso
                          ? "bg-success"
                          : indice === paso
                          ? "bg-primary"
                          : "bg-secondary"
                      )
                    }
                  >
                    {indice < paso
                      ? "✓"
                      : indice + 1}
                  </span>

                  <span className="small fw-semibold">
                    {nombre}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ==================================
              PASO 1
              CLIENTE Y ESTRUCTURA
          ================================== */}

          {paso === 0 && (
            <section>
              <h5 className="mb-3">
                1. Cliente y estructura
              </h5>

              <div className="row g-3">

                <div className="col-md-6">
                  <label className="form-label">
                    Cliente
                  </label>

                  <select
                    className="form-select"
                    name="idCliente"
                    value={formulario.idCliente}
                    onChange={cambiarCampo}
                  >
                    <option value="">
                      Selecciona un cliente
                    </option>

                    {clientes.map((cliente) => (
                      <option
                        key={cliente.idCliente}
                        value={cliente.idCliente}
                      >
                        {cliente.razonSocial ||
                          cliente.numeroDocumento}
                        {" — "}
                        {cliente.numeroDocumento}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">
                    Fecha de vencimiento
                  </label>

                  <input
                    type="date"
                    className="form-control"
                    name="fechaVencimiento"
                    min={fechaLocal()}
                    value={
                      formulario.fechaVencimiento
                    }
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">
                    Estructura metálica
                  </label>

                  <select
                    className="form-select"
                    name="idModeloProducto"
                    value={
                      formulario.idModeloProducto
                    }
                    onChange={cambiarCampo}
                  >
                    <option value="">
                      Selecciona una estructura activa
                    </option>

                    {modelos.map((modelo) => (
                      <option
                        key={
                          modelo.idModeloProducto
                        }
                        value={
                          modelo.idModeloProducto
                        }
                      >
                        {modelo.nombre}
                      </option>
                    ))}
                  </select>

                  <div className="form-text">
                    Las estructuras desactivadas no
                    aparecen en esta lista.
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label">
                    Observación
                  </label>

                  <textarea
                    className="form-control"
                    name="observacion"
                    rows={2}
                    maxLength={100}
                    value={
                      formulario.observacion
                    }
                    onChange={cambiarCampo}
                    placeholder="Observaciones generales de la cotización"
                  />
                </div>

              </div>

              {!cargando && clientes.length === 0 && (
                <div className="alert alert-warning mt-3">
                  No hay clientes activos disponibles.
                </div>
              )}

              {!cargando && modelos.length === 0 && (
                <div className="alert alert-warning mt-3">
                  No hay estructuras activas disponibles.
                </div>
              )}
            </section>
          )}

          {/* ==================================
              PASO 2
              MEDIDAS Y MATERIALES
          ================================== */}

          {paso === 1 && (
            <section>
              <h5 className="mb-3">
                2. Dimensiones y materiales
              </h5>

              <div className="alert alert-info">
                Las dimensiones se expresan en metros.
                El cálculo se realiza con las piezas
                y reglas configuradas en Laravel.
              </div>

              <div className="row g-3">

                <div className="col-md-4">
                  <label className="form-label">
                    Ancho (m)
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    name="ancho"
                    min="0.001"
                    step="any"
                    value={formulario.ancho}
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Alto (m)
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    name="alto"
                    min="0.001"
                    step="any"
                    value={formulario.alto}
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Profundidad (m)
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    name="profundidad"
                    min="0"
                    step="any"
                    value={
                      formulario.profundidad
                    }
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Cantidad de estructuras
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    name="cantidad"
                    min="1"
                    step="1"
                    value={formulario.cantidad}
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-md-8">
                  <label className="form-label">
                    Descripción del trabajo
                  </label>

                  <input
                    className="form-control"
                    name="descripcion"
                    maxLength={255}
                    value={
                      formulario.descripcion
                    }
                    onChange={cambiarCampo}
                    placeholder="Ejemplo: Fabricación e instalación de ventana corrediza"
                  />
                </div>

              </div>

              <button
                type="button"
                className="btn btn-outline-primary mt-3 mb-3"
                disabled={
                  calculando ||
                  guardando ||
                  !formulario.idModeloProducto
                }
                onClick={calcularMedidas}
              >
                {calculando
                  ? "Calculando..."
                  : "Calcular materiales"}
              </button>

              {calculoVigente && (
                <div className="card bg-light border">
                  <div className="card-body">
                    <h6>
                      Materiales necesarios
                    </h6>

                    <p className="text-muted small">
                      La columna total considera la
                      cantidad de estructuras solicitadas.
                    </p>

                    {tablaMateriales()}

                    <p className="small text-muted mb-0">
                      Este cálculo no descuenta
                      existencias del inventario.
                    </p>
                  </div>
                </div>
              )}

              {!calculoVigente && (
                <p className="text-muted small">
                  Debes calcular los materiales
                  antes de pasar al precio de venta.
                </p>
              )}
            </section>
          )}

          {/* ==================================
              PASO 3
              PRECIOS
          ================================== */}

          {paso === 2 && (
            <section>
              <h5 className="mb-3">
                3. Precio de venta
              </h5>

              <div className="alert alert-info">
                Ingresa el precio unitario de venta
                establecido por la empresa. El cálculo
                de materiales no establece
                automáticamente el precio comercial.
              </div>

              <div className="row g-3">

                <div className="col-md-4">
                  <label className="form-label">
                    Precio unitario (S/)
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    name="precioUnitario"
                    min="0.01"
                    step="0.01"
                    value={
                      formulario.precioUnitario
                    }
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Descuento total (S/)
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    name="descuento"
                    min="0"
                    step="0.01"
                    value={
                      formulario.descuento
                    }
                    onChange={cambiarCampo}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    IGV
                  </label>

                  <select
                    className="form-select"
                    name="igvPorcentaje"
                    value={
                      formulario.igvPorcentaje
                    }
                    onChange={cambiarCampo}
                  >
                    <option value="18">
                      18 %
                    </option>

                    <option value="0">
                      0 % — Sin IGV
                    </option>
                  </select>
                </div>

              </div>

              <div className="mt-4">
                {resumenMonetario()}
              </div>
            </section>
          )}

          {/* ==================================
              PASO 4
              REVISIÓN COMPLETA
          ================================== */}

          {paso === 3 && (
            <section>
              <h5 className="mb-3">
                4. Revisión de la cotización
              </h5>

              <div className="alert alert-info">
                Revisa cuidadosamente todos los datos.
                <strong>
                  {" "}La cotización no se registrará
                  hasta que confirmes el guardado.
                </strong>
              </div>

              {/* CLIENTE Y ESTRUCTURA */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Cliente y estructura
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => irA(0)}
                  >
                    Editar
                  </button>
                </div>

                <p className="mb-1">
                  <strong>Cliente:</strong>{" "}
                  {clienteSeleccionado?.razonSocial ||
                    clienteSeleccionado?.numeroDocumento ||
                    "—"}
                </p>

                <p className="mb-1">
                  <strong>Modelo:</strong>{" "}
                  {modeloSeleccionado?.nombre ||
                    "—"}
                </p>

                <p className="mb-1">
                  <strong>Vencimiento:</strong>{" "}
                  {mostrarFecha(
                    formulario.fechaVencimiento
                  )}
                </p>

                <p className="mb-0">
                  <strong>Observación:</strong>{" "}
                  {formulario.observacion ||
                    "Sin observaciones"}
                </p>
              </div>

              {/* DIMENSIONES */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Dimensiones
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => irA(1)}
                  >
                    Editar
                  </button>
                </div>

                <p className="mb-1">
                  <strong>Ancho:</strong>{" "}
                  {formulario.ancho} m
                </p>

                <p className="mb-1">
                  <strong>Alto:</strong>{" "}
                  {formulario.alto} m
                </p>

                <p className="mb-1">
                  <strong>Profundidad:</strong>{" "}
                  {formulario.profundidad} m
                </p>

                <p className="mb-1">
                  <strong>Cantidad:</strong>{" "}
                  {formulario.cantidad}
                </p>

                <p className="mb-0">
                  <strong>Descripción:</strong>{" "}
                  {formulario.descripcion ||
                    "Sin descripción"}
                </p>
              </div>

              {/* MATERIALES */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Materiales calculados
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => irA(1)}
                  >
                    Editar
                  </button>
                </div>

                {calculoVigente
                  ? tablaMateriales()
                  : (
                    <div className="alert alert-warning">
                      El cálculo de materiales
                      necesita actualizarse.
                    </div>
                  )}
              </div>

              {/* PRECIO */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Precio de venta
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => irA(2)}
                  >
                    Editar
                  </button>
                </div>

                <p className="mb-1">
                  <strong>Precio unitario:</strong>{" "}
                  {dinero(
                    formulario.precioUnitario
                  )}
                </p>

                <p className="mb-3">
                  <strong>Cantidad:</strong>{" "}
                  {formulario.cantidad}
                </p>

                {resumenMonetario()}
              </div>

              <p className="text-muted small">
                Puedes regresar a cualquier paso
                para corregir la información.
                No se ejecutará ningún guardado
                automático.
              </p>
            </section>
          )}

          {/* ==================================
              NAVEGACIÓN
          ================================== */}

          <hr className="my-4" />

          <div className="d-flex justify-content-between gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={
                paso === 0 ||
                guardando ||
                calculando
              }
              onClick={anterior}
            >
              ← Anterior
            </button>

            {paso < 3 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  guardando ||
                  calculando ||
                  cargando
                }
                onClick={siguiente}
              >
                Siguiente →
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success"
                disabled={
                  guardando ||
                  calculando ||
                  cargando
                }
                onClick={solicitarConfirmacion}
              >
                ✓ Registrar cotización
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ==================================
          COTIZACIONES REGISTRADAS
      ================================== */}

      <div className="card border-0 shadow-sm">
        <div className="card-body">

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h5 className="mb-0">
              Cotizaciones registradas
            </h5>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              disabled={cargando}
              onClick={cargarDatos}
            >
              {cargando
                ? "Actualizando..."
                : "Actualizar"}
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Vencimiento</th>
                  <th>Versión</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {cotizaciones.map((cotizacion) => (
                  <tr
                    key={
                      cotizacion.idCotizacion
                    }
                  >
                    <td>
                      #{cotizacion.idCotizacion}
                    </td>

                    <td>
                      {cotizacion.razonSocial ||
                        cotizacion.numeroDocumento}
                    </td>

                    <td>
                      {mostrarFecha(
                        cotizacion.fechaVencimiento
                      )}
                    </td>

                    <td>
                      {cotizacion.numeroVersion ??
                        "—"}
                    </td>

                    <td>
                      {dinero(
                        cotizacion.montoTotal
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          abrirDetalle(
                            cotizacion.idCotizacion
                          )
                        }
                      >
                        👁 Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}

                {cotizaciones.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-muted py-4"
                    >
                      {cargando
                        ? "Cargando cotizaciones..."
                        : "No hay cotizaciones registradas."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ==================================
          CONFIRMACIÓN FINAL OBLIGATORIA
      ================================== */}

      {confirmando && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1300 }}
          />

          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloConfirmarCotizacion"
            style={{ zIndex: 1301 }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow border-0">

                <div className="modal-header">
                  <h5
                    className="modal-title"
                    id="tituloConfirmarCotizacion"
                  >
                    Confirmar registro
                  </h5>
                </div>

                <div className="modal-body">
                  <p>
                    ¿Deseas registrar esta cotización?
                  </p>

                  <p className="mb-1">
                    <strong>Cliente:</strong>{" "}
                    {clienteSeleccionado?.razonSocial ||
                      clienteSeleccionado?.numeroDocumento}
                  </p>

                  <p className="mb-1">
                    <strong>Estructura:</strong>{" "}
                    {modeloSeleccionado?.nombre}
                  </p>

                  <p className="mb-1">
                    <strong>Cantidad:</strong>{" "}
                    {formulario.cantidad}
                  </p>

                  <p className="mb-3">
                    <strong>Total:</strong>{" "}
                    {dinero(
                      importes.totalCentimos / 100
                    )}
                  </p>

                  <div className="alert alert-info mb-0">
                    La cotización y su primera versión
                    se registrarán en PostgreSQL
                    solamente si confirmas.
                    No se descontará inventario.
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={guardando}
                    onClick={() =>
                      setConfirmando(false)
                    }
                  >
                    Volver a revisión
                  </button>

                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={guardando}
                    onClick={guardarConfirmado}
                  >
                    {guardando
                      ? "Guardando..."
                      : "Sí, registrar"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================================
          VER DETALLE DE COTIZACIÓN
      ================================== */}

      {idDetalle !== null && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1300 }}
          />

          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloDetalleCotizacion"
            style={{
              zIndex: 1301,
              overflowY: "auto",
            }}
          >
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content shadow border-0">

                <div className="modal-header">
                  <h5
                    className="modal-title"
                    id="tituloDetalleCotizacion"
                  >
                    Cotización #{idDetalle}
                  </h5>

                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Cerrar"
                    onClick={cerrarDetalle}
                  />
                </div>

                <div className="modal-body">
                  {cargandoDetalle && (
                    <div className="alert alert-info">
                      Cargando cotización...
                    </div>
                  )}

                  {errorDetalle && (
                    <div className="alert alert-danger">
                      {errorDetalle}
                    </div>
                  )}

                  {detalleCotizacion && (
                    <>
                      <h6>
                        Datos generales
                      </h6>

                      <p className="mb-1">
                        <strong>Cliente ID:</strong>{" "}
                        {detalleCotizacion.cotizacion?.idCliente}
                      </p>

                      <p className="mb-1">
                        <strong>Fecha de cotización:</strong>{" "}
                        {mostrarFecha(
                          detalleCotizacion.cotizacion?.fechaCotizacion
                        )}
                      </p>

                      <p className="mb-3">
                        <strong>Fecha de vencimiento:</strong>{" "}
                        {mostrarFecha(
                          detalleCotizacion.cotizacion?.fechaVencimiento
                        )}
                      </p>

                      <h6 className="mt-4">
                        Versiones
                      </h6>

                      <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle">
                          <thead>
                            <tr>
                              <th>Versión</th>
                              <th>Estado</th>
                              <th>Subtotal</th>
                              <th>Descuento</th>
                              <th>IGV</th>
                              <th>Total</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(detalleCotizacion.versiones || []).map(
                              (version) => (
                                <tr
                                  key={
                                    version.idVersionCotizacion
                                  }
                                >
                                  <td>
                                    {version.numeroVersion}
                                  </td>

                                  <td>
                                    {version.estado}
                                  </td>

                                  <td>
                                    {dinero(version.subTotal)}
                                  </td>

                                  <td>
                                    {dinero(version.descuento)}
                                  </td>

                                  <td>
                                    {dinero(version.igv)}
                                  </td>

                                  <td>
                                    <strong>
                                      {dinero(version.montoTotal)}
                                    </strong>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      <h6 className="mt-4">
                        Estructuras cotizadas
                      </h6>

                      <div className="table-responsive">
                        <table className="table table-sm table-bordered align-middle">
                          <thead>
                            <tr>
                              <th>Modelo ID</th>
                              <th>Ancho (m)</th>
                              <th>Alto (m)</th>
                              <th>Profundidad (m)</th>
                              <th>Cantidad</th>
                              <th>Precio unitario</th>
                              <th>Descripción</th>
                            </tr>
                          </thead>

                          <tbody>
                            {(detalleCotizacion.detalles || []).map(
                              (detalle) => (
                                <tr
                                  key={
                                    detalle.idDetalleCotizacion
                                  }
                                >
                                  <td>
                                    {detalle.idModeloProducto}
                                  </td>

                                  <td>
                                    {detalle.ancho}
                                  </td>

                                  <td>
                                    {detalle.alto}
                                  </td>

                                  <td>
                                    {detalle.profundidad ?? 0}
                                  </td>

                                  <td>
                                    {detalle.cantidad}
                                  </td>

                                  <td>
                                    {dinero(
                                      detalle.precioUnitario
                                    )}
                                  </td>

                                  <td>
                                    {detalle.descripcion || "—"}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={cerrarDetalle}
                  >
                    Cerrar
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
