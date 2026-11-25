
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import DetalleModeloModal from "../DetalleModeloModal";

// ==========================================
// CORPORACIÓN ORTEGA
// MODELOS DE ESTRUCTURAS METÁLICAS
//
// REGISTRAR - VER - EDITAR
// DESACTIVAR - REACTIVAR
// ==========================================

const TIPOS = [
  ["ANCHO", "Ancho"],
  ["ALTO", "Alto"],
  ["PROFUNDIDAD", "Profundidad"],
  ["FIJO", "Medida fija"],
  ["AREA", "Área"],
  ["VOLUMEN", "Volumen"],
  ["UNIDAD", "Unidad"],
];

const UNIDADES = {
  ANCHO: "m",
  ALTO: "m",
  PROFUNDIDAD: "m",
  FIJO: "m",
  AREA: "m2",
  VOLUMEN: "m3",
  UNIDAD: "und",
};

const PASOS = [
  "Datos generales",
  "Materiales",
  "Piezas y medidas",
  "Revisión",
];

const DATOS_INICIALES = {
  nombre: "",
  descripcion: "",
  precioBase: "0",
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function nuevaPieza(tipoCalculo = "ANCHO") {
  return {
    clave: crypto.randomUUID(),
    idModeloComponente: null,
    nombre: "",
    cantidadPiezas: "1",
    tipoCalculo,
    factorCalculo: "1",
    ajusteMetros: "0",
    medidaFijaMetros: "",
  };
}

function nuevoMaterial() {
  return {
    clave: crypto.randomUUID(),
    idModeloMaterial: null,
    idMaterial: "",
    porcentajeMerma: "0",
    componentes: [nuevaPieza()],
  };
}

function estaActivo(valor) {
  return (
    valor === true ||
    valor === 1 ||
    valor === "1" ||
    valor === "true"
  );
}

function texto(valor, defecto = "") {
  return valor == null ? defecto : String(valor);
}

function esNumero(valor) {
  return (
    valor !== null &&
    valor !== undefined &&
    String(valor).trim() !== "" &&
    Number.isFinite(Number(valor))
  );
}

function esLineal(tipo) {
  return [
    "ANCHO",
    "ALTO",
    "PROFUNDIDAD",
    "FIJO",
  ].includes(tipo);
}

function buscarMaterial(materiales, idMaterial) {
  return materiales.find(
    (material) =>
      String(material.idMaterial) ===
      String(idMaterial)
  );
}

function reglaParaUnidad(unidad) {
  return (
    TIPOS.find(
      ([tipo]) => UNIDADES[tipo] === unidad
    )?.[0] || "ANCHO"
  );
}

function nombreRegla(tipo) {
  return (
    TIPOS.find(
      ([valor]) => valor === tipo
    )?.[1] || tipo
  );
}

function precioFormateado(valor) {
  const numero = Number(valor || 0);

  return Number.isFinite(numero)
    ? `S/ ${numero.toFixed(2)}`
    : "S/ 0.00";
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

  if (!respuesta.ok || datos.ok === false) {
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
// TRANSFORMAR DATOS EXISTENTES
// ==========================================

function convertirModelo(modelo) {
  if (
    !modelo ||
    !Array.isArray(modelo.materiales)
  ) {
    throw new Error(
      "El servidor no devolvió una configuración válida."
    );
  }

  return {
    datos: {
      nombre: texto(modelo.nombre),
      descripcion: texto(modelo.descripcion),
      precioBase: texto(
        modelo.precioBase,
        "0"
      ),
    },

    selecciones: modelo.materiales
      .filter(
        (material) => estaActivo(material.estado)
      )
      .map((material) => ({
        clave: crypto.randomUUID(),

        idModeloMaterial:
          material.idModeloMaterial ?? null,

        idMaterial: texto(material.idMaterial),

        porcentajeMerma: texto(
          material.porcentajeMerma,
          "0"
        ),

        componentes: (
          material.componentes || []
        )
          .filter(
            (pieza) => estaActivo(pieza.estado)
          )
          .map((pieza) => ({
            clave: crypto.randomUUID(),

            idModeloComponente:
              pieza.idModeloComponente ?? null,

            nombre: texto(pieza.nombre),

            cantidadPiezas: texto(
              pieza.cantidadPiezas,
              "1"
            ),

            tipoCalculo: pieza.tipoCalculo,

            factorCalculo: texto(
              pieza.factorCalculo,
              "1"
            ),

            ajusteMetros: texto(
              pieza.ajusteMetros,
              "0"
            ),

            medidaFijaMetros: texto(
              pieza.medidaFijaMetros
            ),
          })),
      })),
  };
}

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

export default function Modelos() {
  const [paso, setPaso] = useState(0);

  const [datos, setDatos] = useState({
    ...DATOS_INICIALES,
  });

  const [materiales, setMateriales] = useState([]);
  const [modelos, setModelos] = useState([]);

  const [selecciones, setSelecciones] = useState([
    nuevoMaterial(),
  ]);

  const [cargando, setCargando] = useState(false);

  const [
    cargandoEdicion,
    setCargandoEdicion,
  ] = useState(false);

  const [guardando, setGuardando] = useState(false);

  const [
    procesandoEstado,
    setProcesandoEstado,
  ] = useState(false);

  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  // Consultar detalles.
  const [idDetalle, setIdDetalle] = useState(null);

  // null = nuevo registro.
  // Número = edición de modelo existente.
  const [idEditando, setIdEditando] = useState(null);

  // Confirmación de registro o edición.
  const [confirmando, setConfirmando] = useState(false);

  // Confirmación de desactivación.
  const [
    modeloADesactivar,
    setModeloADesactivar,
  ] = useState(null);

  // Confirmación de reactivación.
  const [
    modeloAReactivar,
    setModeloAReactivar,
  ] = useState(null);

  // Pestañas de la lista.
  const [pestana, setPestana] = useState(
    "activas"
  );

  const formularioRef = useRef(null);
  const solicitudEdicionRef = useRef(0);

  // Evita enviar dos escrituras simultáneas.
  const escrituraEnCursoRef = useRef(false);

  const esEdicion = idEditando !== null;

  // Listas derivadas, sin alterar los datos.
  const modelosActivos = modelos.filter(
    (modelo) => estaActivo(modelo.estado)
  );

  const modelosInactivos = modelos.filter(
    (modelo) => !estaActivo(modelo.estado)
  );

  const modelosVisibles =
    pestana === "activas"
      ? modelosActivos
      : modelosInactivos;

  // ========================================
  // CONSULTAR MATERIALES Y MODELOS
  // ========================================

  const cargarDatos = useCallback(async () => {
    setCargando(true);

    try {
      const [
        respuestaMateriales,
        respuestaModelos,
      ] = await Promise.all([
        fetch("/api/materiales", {
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
      ]);

      const [
        datosMateriales,
        datosModelos,
      ] = await Promise.all([
        leerRespuesta(respuestaMateriales),
        leerRespuesta(respuestaModelos),
      ]);

      // Solo materiales disponibles para crear
      // o modificar estructuras.
      setMateriales(
        (datosMateriales.materiales || []).filter(
          (material) => estaActivo(material.estado)
        )
      );

      // Importante:
      // NO filtrar modelos inactivos aquí.
      // Necesitamos ambas listas para las pestañas.
      setModelos(datosModelos.modelos || []);

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
  // AVISO TEMPORAL
  // ========================================

  useEffect(() => {
    if (!aviso) return;

    const temporizador = setTimeout(
      () => setAviso(""),
      3500
    );

    return () => clearTimeout(temporizador);
  }, [aviso]);

  // ========================================
  // NAVEGACIÓN
  // ========================================

  function subirFormulario() {
    formularioRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function limpiarFormulario() {
    solicitudEdicionRef.current += 1;

    setDatos({
      ...DATOS_INICIALES,
    });

    setSelecciones([nuevoMaterial()]);
    setPaso(0);
    setIdEditando(null);
    setConfirmando(false);
    setCargandoEdicion(false);
    setError("");
  }

  function cancelarEdicion() {
    if (
      guardando ||
      procesandoEstado
    ) {
      return;
    }

    limpiarFormulario();
    subirFormulario();
  }

  // ========================================
  // CARGAR ESTRUCTURA PARA EDITAR
  // ========================================

  async function comenzarEdicion(id) {
    if (
      guardando ||
      procesandoEstado ||
      cargandoEdicion ||
      confirmando ||
      modeloADesactivar ||
      modeloAReactivar
    ) {
      return;
    }

    const solicitud =
      ++solicitudEdicionRef.current;

    setCargandoEdicion(true);
    setError("");
    setAviso("");

    try {
      const respuesta = await fetch(
        `/api/modelos/${id}/detalle`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const resultado =
        await leerRespuesta(respuesta);

      if (
        solicitud !== solicitudEdicionRef.current
      ) {
        return;
      }

      const modelo = resultado.modelo;

      if (
        !modelo ||
        !estaActivo(modelo.estado)
      ) {
        throw new Error(
          "La estructura no existe o está inactiva."
        );
      }

      if (
        estaActivo(modelo.tieneCotizaciones)
      ) {
        throw new Error(
          "Esta estructura está vinculada a una cotización y no puede editarse."
        );
      }

      const convertido = convertirModelo(modelo);

      if (
        convertido.selecciones.length === 0
      ) {
        throw new Error(
          "Esta estructura no tiene materiales activos."
        );
      }

      const idsMaterialesDisponibles =
        new Set(
          materiales.map(
            (material) =>
              String(material.idMaterial)
          )
        );

      for (
        const material of convertido.selecciones
      ) {
        if (!material.idModeloMaterial) {
          throw new Error(
            "Falta el identificador de un material."
          );
        }

        if (
          !idsMaterialesDisponibles.has(
            String(material.idMaterial)
          )
        ) {
          throw new Error(
            "La estructura contiene un material inactivo o no disponible."
          );
        }

        if (
          material.componentes.length === 0
        ) {
          throw new Error(
            "La estructura tiene un material sin piezas activas."
          );
        }

        if (
          material.componentes.some(
            (pieza) =>
              !pieza.idModeloComponente
          )
        ) {
          throw new Error(
            "Faltan identificadores de piezas. No es seguro editar."
          );
        }
      }

      setDatos(convertido.datos);

      setSelecciones(
        convertido.selecciones
      );

      setIdEditando(Number(id));
      setPaso(0);
      setConfirmando(false);

      setAviso(
        `Estructura ID ${id} cargada para editar.`
      );

      subirFormulario();
    } catch (err) {
      if (
        solicitud === solicitudEdicionRef.current
      ) {
        setError(err.message);
        subirFormulario();
      }
    } finally {
      if (
        solicitud === solicitudEdicionRef.current
      ) {
        setCargandoEdicion(false);
      }
    }
  }

  // ========================================
  // DATOS GENERALES
  // ========================================

  function cambiarDato(campo, valor) {
    setDatos((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  // ========================================
  // MATERIALES
  // ========================================

  function cambiarMaterial(
    clave,
    campo,
    valor
  ) {
    setSelecciones((anterior) =>
      anterior.map((material) => {
        if (
          material.clave !== clave
        ) {
          return material;
        }

        if (
          campo !== "idMaterial"
        ) {
          return {
            ...material,
            [campo]: valor,
          };
        }

        const seleccionado = buscarMaterial(
          materiales,
          valor
        );

        const regla = seleccionado
          ? reglaParaUnidad(
              seleccionado.unidadMedida
            )
          : "ANCHO";

        const cambioReal =
          String(material.idMaterial) !==
          String(valor);

        return {
          ...material,

          idMaterial: valor,

          // No reutilizar el identificador
          // cuando cambia el material.
          idModeloMaterial: cambioReal
            ? null
            : material.idModeloMaterial,

          componentes:
            material.componentes.map((pieza) => {
              const compatible =
                seleccionado &&
                UNIDADES[pieza.tipoCalculo] ===
                  seleccionado.unidadMedida;

              return {
                ...pieza,

                idModeloComponente: cambioReal
                  ? null
                  : pieza.idModeloComponente,

                tipoCalculo: compatible
                  ? pieza.tipoCalculo
                  : regla,

                ajusteMetros: compatible
                  ? pieza.ajusteMetros
                  : "0",

                medidaFijaMetros: compatible
                  ? pieza.medidaFijaMetros
                  : "",
              };
            }),
        };
      })
    );
  }

  function agregarMaterial() {
    setSelecciones((anterior) => [
      ...anterior,
      nuevoMaterial(),
    ]);
  }

  function quitarMaterial(clave) {
    setSelecciones((anterior) =>
      anterior.filter(
        (material) =>
          material.clave !== clave
      )
    );
  }

  // ========================================
  // PIEZAS
  // ========================================

  function agregarPieza(claveMaterial) {
    setSelecciones((anterior) =>
      anterior.map((material) => {
        if (
          material.clave !== claveMaterial
        ) {
          return material;
        }

        const seleccionado = buscarMaterial(
          materiales,
          material.idMaterial
        );

        const regla = seleccionado
          ? reglaParaUnidad(
              seleccionado.unidadMedida
            )
          : "ANCHO";

        return {
          ...material,

          componentes: [
            ...material.componentes,
            nuevaPieza(regla),
          ],
        };
      })
    );
  }

  function cambiarPieza(
    claveMaterial,
    clavePieza,
    campo,
    valor
  ) {
    setSelecciones((anterior) =>
      anterior.map((material) => {
        if (
          material.clave !== claveMaterial
        ) {
          return material;
        }

        return {
          ...material,

          componentes:
            material.componentes.map((pieza) => {
              if (
                pieza.clave !== clavePieza
              ) {
                return pieza;
              }

              return {
                ...pieza,
                [campo]: valor,

                ...(campo === "tipoCalculo"
                  ? {
                      ajusteMetros: "0",
                      medidaFijaMetros: "",
                    }
                  : {}),
              };
            }),
        };
      })
    );
  }

  function quitarPieza(
    claveMaterial,
    clavePieza
  ) {
    setSelecciones((anterior) =>
      anterior.map((material) =>
        material.clave === claveMaterial
          ? {
              ...material,

              componentes:
                material.componentes.filter(
                  (pieza) =>
                    pieza.clave !== clavePieza
                ),
            }
          : material
      )
    );
  }

  // ========================================
  // VALIDACIONES
  // ========================================

  function validarGenerales() {
    if (
      !datos.nombre.trim()
    ) {
      throw new Error(
        "Ingresa el nombre de la estructura."
      );
    }

    if (
      datos.nombre.trim().length > 50
    ) {
      throw new Error(
        "El nombre no puede superar 50 caracteres."
      );
    }

    if (
      datos.descripcion.length > 100
    ) {
      throw new Error(
        "La descripción no puede superar 100 caracteres."
      );
    }

    if (
      !esNumero(datos.precioBase) ||
      Number(datos.precioBase) < 0
    ) {
      throw new Error(
        "El precio base no es válido."
      );
    }
  }

  function validarMateriales() {
    if (
      selecciones.length === 0
    ) {
      throw new Error(
        "Agrega por lo menos un material."
      );
    }

    const ids = selecciones.map(
      (material) =>
        String(material.idMaterial)
    );

    if (
      ids.some((id) => !id)
    ) {
      throw new Error(
        "Selecciona todos los materiales."
      );
    }

    if (
      new Set(ids).size !== ids.length
    ) {
      throw new Error(
        "No repitas materiales. Sus piezas deben estar juntas."
      );
    }

    for (
      const material of selecciones
    ) {
      const seleccionado = buscarMaterial(
        materiales,
        material.idMaterial
      );

      if (!seleccionado) {
        throw new Error(
          "Uno de los materiales no está disponible."
        );
      }

      if (
        !esNumero(material.porcentajeMerma) ||
        Number(material.porcentajeMerma) < 0 ||
        Number(material.porcentajeMerma) > 100
      ) {
        throw new Error(
          `La merma de ${seleccionado.nombre} debe estar entre 0 y 100 %.`
        );
      }
    }
  }

  function validarPiezas() {
    for (
      const material of selecciones
    ) {
      const seleccionado = buscarMaterial(
        materiales,
        material.idMaterial
      );

      if (!seleccionado) {
        throw new Error(
          "Selecciona primero los materiales."
        );
      }

      if (
        material.componentes.length === 0
      ) {
        throw new Error(
          `Agrega por lo menos una pieza para ${seleccionado.nombre}.`
        );
      }

      for (
        const pieza of material.componentes
      ) {
        if (
          !pieza.nombre.trim() ||
          pieza.nombre.trim().length > 100
        ) {
          throw new Error(
            `Revisa el nombre de las piezas de ${seleccionado.nombre}.`
          );
        }

        if (
          !esNumero(pieza.cantidadPiezas) ||
          !Number.isInteger(
            Number(pieza.cantidadPiezas)
          ) ||
          Number(pieza.cantidadPiezas) < 1
        ) {
          throw new Error(
            `Cantidad incorrecta en ${pieza.nombre}.`
          );
        }

        if (
          !esNumero(pieza.factorCalculo) ||
          Number(pieza.factorCalculo) <= 0
        ) {
          throw new Error(
            `Factor incorrecto en ${pieza.nombre}.`
          );
        }

        if (
          UNIDADES[pieza.tipoCalculo] !==
          seleccionado.unidadMedida
        ) {
          throw new Error(
            `La regla de ${pieza.nombre} no es compatible con la unidad del material.`
          );
        }

        if (
          pieza.tipoCalculo === "FIJO" &&
          (
            !esNumero(
              pieza.medidaFijaMetros
            ) ||
            Number(
              pieza.medidaFijaMetros
            ) <= 0
          )
        ) {
          throw new Error(
            `Ingresa una medida fija válida para ${pieza.nombre}.`
          );
        }

        if (
          esLineal(
            pieza.tipoCalculo
          ) &&
          !esNumero(
            pieza.ajusteMetros
          )
        ) {
          throw new Error(
            `Ingresa un ajuste válido para ${pieza.nombre}.`
          );
        }
      }
    }
  }

  function validarTodo() {
    validarGenerales();
    validarMateriales();
    validarPiezas();
  }

  // ========================================
  // NAVEGACIÓN ENTRE CUATRO PASOS
  // ========================================

  function siguiente() {
    setError("");

    try {
      if (
        paso === 0
      ) {
        validarGenerales();
      }

      if (
        paso === 1
      ) {
        validarMateriales();
      }

      if (
        paso === 2
      ) {
        validarPiezas();
      }

      // Nunca guardar automáticamente.
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

  function irA(destino) {
    setError("");
    setPaso(destino);
    subirFormulario();
  }

  // ========================================
  // PREPARAR REGISTRO O EDICIÓN
  // ========================================

  function construirCuerpo() {
    return {
      nombre: datos.nombre.trim(),

      descripcion:
        datos.descripcion.trim(),

      precioBase:
        Number(datos.precioBase),

      materiales: selecciones.map(
        (material) => ({
          ...(
            esEdicion &&
            material.idModeloMaterial != null
              ? {
                  idModeloMaterial: Number(
                    material.idModeloMaterial
                  ),
                }
              : {}
          ),

          idMaterial: Number(
            material.idMaterial
          ),

          porcentajeMerma: Number(
            material.porcentajeMerma
          ),

          componentes:
            material.componentes.map(
              (pieza) => ({
                ...(
                  esEdicion &&
                  pieza.idModeloComponente != null
                    ? {
                        idModeloComponente: Number(
                          pieza.idModeloComponente
                        ),
                      }
                    : {}
                ),

                nombre:
                  pieza.nombre.trim(),

                cantidadPiezas: Number(
                  pieza.cantidadPiezas
                ),

                tipoCalculo:
                  pieza.tipoCalculo,

                factorCalculo: Number(
                  pieza.factorCalculo
                ),

                ajusteMetros: esLineal(
                  pieza.tipoCalculo
                )
                  ? Number(
                      pieza.ajusteMetros
                    )
                  : 0,

                medidaFijaMetros:
                  pieza.tipoCalculo === "FIJO"
                    ? Number(
                        pieza.medidaFijaMetros
                      )
                    : null,
              })
            ),
        })
      ),
    };
  }

  function solicitarConfirmacion() {
    setError("");

    if (
      paso !== 3 ||
      guardando ||
      procesandoEstado ||
      cargandoEdicion
    ) {
      return;
    }

    try {
      validarTodo();

      // Solo abre el modal.
      // No escribe en PostgreSQL.
      setConfirmando(true);
    } catch (err) {
      setError(err.message);
    }
  }

  // ========================================
  // GUARDAR SOLO TRAS CONFIRMACIÓN
  // ========================================

  async function guardarConfirmado() {
    if (
      !confirmando ||
      paso !== 3 ||
      guardando ||
      escrituraEnCursoRef.current
    ) {
      return;
    }

    escrituraEnCursoRef.current = true;

    setGuardando(true);
    setError("");

    let exito = false;

    try {
      validarTodo();

      const token = await obtenerCsrf();
      const cuerpo = construirCuerpo();

      const url = esEdicion
        ? `/api/modelos/${idEditando}`
        : "/api/modelos/configurar";

      const respuesta = await fetch(
        url,
        {
          method: esEdicion
            ? "PUT"
            : "POST",

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

      const resultado =
        await leerRespuesta(respuesta);

      exito = true;

      limpiarFormulario();

      setAviso(
        resultado.mensaje ||
          (
            esEdicion
              ? "Estructura actualizada correctamente."
              : "Estructura registrada correctamente."
          )
      );

      setPestana("activas");
      subirFormulario();
    } catch (err) {
      setError(err.message);
      subirFormulario();
    } finally {
      escrituraEnCursoRef.current = false;

      setConfirmando(false);
      setGuardando(false);
    }

    if (exito) {
      await cargarDatos();
    }
  }

  // ========================================
  // DESACTIVAR ESTRUCTURA
  // ========================================

  function solicitarDesactivacion(modelo) {
    if (
      guardando ||
      procesandoEstado ||
      cargandoEdicion ||
      escrituraEnCursoRef.current
    ) {
      return;
    }

    setError("");
    setModeloADesactivar(modelo);
  }

  async function confirmarDesactivacion() {
    if (
      !modeloADesactivar ||
      procesandoEstado ||
      escrituraEnCursoRef.current
    ) {
      return;
    }

    escrituraEnCursoRef.current = true;
    setProcesandoEstado(true);
    setError("");

    const modelo = modeloADesactivar;
    let exito = false;

    try {
      const token = await obtenerCsrf();

      const respuesta = await fetch(
        `/api/modelos/${modelo.idModeloProducto}`,
        {
          method: "DELETE",
          credentials: "include",

          headers: {
            Accept: "application/json",
            "X-CSRF-TOKEN": token,
          },
        }
      );

      const resultado =
        await leerRespuesta(respuesta);

      exito = true;

      // Si estaba en edición, descartar
      // el formulario de ese modelo.
      if (
        idEditando !== null &&
        Number(idEditando) ===
          Number(modelo.idModeloProducto)
      ) {
        limpiarFormulario();
      }

      setAviso(
        resultado.mensaje ||
          "Estructura desactivada correctamente."
      );

      setModeloADesactivar(null);
    } catch (err) {
      setError(err.message);
      setModeloADesactivar(null);
    } finally {
      escrituraEnCursoRef.current = false;
      setProcesandoEstado(false);
    }

    if (exito) {
      await cargarDatos();
    }
  }

  // ========================================
  // REACTIVAR ESTRUCTURA
  // ========================================

  function solicitarReactivacion(modelo) {
    if (
      guardando ||
      procesandoEstado ||
      cargandoEdicion ||
      escrituraEnCursoRef.current
    ) {
      return;
    }

    setError("");
    setModeloAReactivar(modelo);
  }

  async function confirmarReactivacion() {
    if (
      !modeloAReactivar ||
      procesandoEstado ||
      escrituraEnCursoRef.current
    ) {
      return;
    }

    escrituraEnCursoRef.current = true;
    setProcesandoEstado(true);
    setError("");

    const modelo = modeloAReactivar;
    let exito = false;

    try {
      const token = await obtenerCsrf();

      // Nueva ruta Laravel:
      // PATCH /api/modelos/{id}/reactivar
      const respuesta = await fetch(
        `/api/modelos/${modelo.idModeloProducto}/reactivar`,
        {
          method: "PATCH",
          credentials: "include",

          headers: {
            Accept: "application/json",
            "X-CSRF-TOKEN": token,
          },
        }
      );

      const resultado =
        await leerRespuesta(respuesta);

      exito = true;

      setModeloAReactivar(null);

      setAviso(
        resultado.mensaje ||
          "Estructura reactivada correctamente."
      );

      // Después de reactivar, mostrar
      // la pestaña de modelos activos.
      setPestana("activas");
    } catch (err) {
      setError(err.message);
      setModeloAReactivar(null);
    } finally {
      escrituraEnCursoRef.current = false;
      setProcesandoEstado(false);
    }

    if (exito) {
      await cargarDatos();
    }
  }

  // ========================================
  // INTERFAZ
  // ========================================

  return (
    <div className="container-fluid py-3">

      {/* VER DETALLE */}

      <DetalleModeloModal
        idModelo={idDetalle}
        alCerrar={() => setIdDetalle(null)}
      />

      {/* AVISO DE ÉXITO */}

      {aviso && (
        <div
          className="position-fixed top-0 end-0 m-4 alert alert-success shadow d-flex align-items-center gap-2"
          role="status"
          style={{
            zIndex: 2000,
            maxWidth: 390,
          }}
        >
          <span>✓</span>

          <span className="flex-grow-1">
            {aviso}
          </span>

          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar aviso"
            onClick={() => setAviso("")}
          />
        </div>
      )}

      {/* TÍTULO PRINCIPAL */}

      <h2 className="mb-2">
        Modelos de estructuras metálicas
      </h2>

      <p className="text-muted mb-4">
        Registra, consulta, edita, desactiva y
        reactiva estructuras metálicas.
      </p>

      {/* ==================================
          FORMULARIO DE CUATRO PASOS
      ================================== */}

      <div
        ref={formularioRef}
        className="card border-0 shadow-sm mb-4"
      >
        <div className="card-body p-3 p-md-4">

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h5 className="mb-1">
                {esEdicion
                  ? `Editar estructura ID ${idEditando}`
                  : "Registrar estructura"}
              </h5>

              {esEdicion && (
                <small className="text-muted">
                  Se conservará el ID del modelo.
                </small>
              )}
            </div>

            <div className="d-flex gap-2">
              <span
                className={
                  "badge " +
                  (
                    esEdicion
                      ? "bg-warning text-dark"
                      : "bg-primary"
                  )
                }
              >
                {esEdicion
                  ? "Modo edición"
                  : "Nuevo registro"}
              </span>

              <span className="badge bg-secondary">
                Paso {paso + 1} de 4
              </span>
            </div>
          </div>

          {/* CANCELAR EDICIÓN */}

          {esEdicion && (
            <div className="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>
                Estás editando el modelo{" "}
                <strong>
                  #{idEditando}
                </strong>.
                Los cambios no se guardan
                automáticamente.
              </span>

              <button
                type="button"
                className="btn btn-sm btn-outline-dark"
                disabled={
                  guardando ||
                  procesandoEstado
                }
                onClick={cancelarEdicion}
              >
                Cancelar edición
              </button>
            </div>
          )}

          {/* PROGRESO */}

          <div
            className="progress mb-4"
            style={{ height: 8 }}
          >
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={
                (paso + 1) * 25
              }
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: `${(paso + 1) * 25}%`,
              }}
            />
          </div>

          {/* PASOS */}

          <div className="row g-2 mb-4">
            {PASOS.map(
              (nombre, indice) => (
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
              )
            )}
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

          {cargandoEdicion && (
            <div className="alert alert-info">
              Cargando estructura para editar...
            </div>
          )}

          {/* ==================================
              PASO 1: DATOS GENERALES
          ================================== */}

          {paso === 0 && (
            <section>
              <h5 className="mb-3">
                1. Datos generales
              </h5>

              <div className="row g-3">

                <div className="col-md-8">
                  <label className="form-label">
                    Nombre de la estructura
                  </label>

                  <input
                    className="form-control"
                    maxLength={50}
                    placeholder="Ejemplo: Ventana metálica"
                    value={datos.nombre}
                    onChange={(e) =>
                      cambiarDato(
                        "nombre",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">
                    Precio base referencial (S/)
                  </label>

                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.01"
                    value={datos.precioBase}
                    onChange={(e) =>
                      cambiarDato(
                        "precioBase",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">
                    Descripción
                  </label>

                  <textarea
                    className="form-control"
                    rows={3}
                    maxLength={100}
                    placeholder="Características de la estructura"
                    value={datos.descripcion}
                    onChange={(e) =>
                      cambiarDato(
                        "descripcion",
                        e.target.value
                      )
                    }
                  />
                </div>

              </div>
            </section>
          )}

          {/* ==================================
              PASO 2: MATERIALES
          ================================== */}

          {paso === 1 && (
            <section>
              <h5 className="mb-2">
                2. Seleccionar materiales
              </h5>

              <p className="text-muted small">
                Selecciona los materiales que
                utilizará la estructura.
              </p>

              {!cargando &&
                materiales.length === 0 && (
                  <div className="alert alert-warning">
                    No hay materiales activos disponibles.
                  </div>
                )}

              {selecciones.map(
                (material, indice) => (
                  <div
                    key={material.clave}
                    className="border rounded p-3 mb-3"
                  >
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <strong>
                        Material {indice + 1}
                      </strong>

                      {selecciones.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() =>
                            quitarMaterial(
                              material.clave
                            )
                          }
                        >
                          Quitar
                        </button>
                      )}
                    </div>

                    <div className="row g-3">
                      <div className="col-md-8">
                        <label className="form-label">
                          Material
                        </label>

                        <select
                          className="form-select"
                          value={
                            material.idMaterial
                          }
                          onChange={(e) =>
                            cambiarMaterial(
                              material.clave,
                              "idMaterial",
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            Selecciona un material
                          </option>

                          {materiales.map(
                            (item) => (
                              <option
                                key={
                                  item.idMaterial
                                }
                                value={
                                  item.idMaterial
                                }
                                disabled={selecciones.some(
                                  (otro) =>
                                    otro.clave !==
                                      material.clave &&
                                    String(
                                      otro.idMaterial
                                    ) ===
                                      String(
                                        item.idMaterial
                                      )
                                )}
                              >
                                {item.codigo} —{" "}
                                {item.nombre} (
                                {item.unidadMedida})
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">
                          Merma (%)
                        </label>

                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="100"
                          step="0.01"
                          value={
                            material.porcentajeMerma
                          }
                          onChange={(e) =>
                            cambiarMaterial(
                              material.clave,
                              "porcentajeMerma",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              )}

              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={agregarMaterial}
              >
                + Agregar otro material
              </button>
            </section>
          )}

          {/* ==================================
              PASO 3: PIEZAS Y MEDIDAS
          ================================== */}

          {paso === 2 && (
            <section>
              <h5 className="mb-2">
                3. Piezas y medidas
              </h5>

              <p className="text-muted small mb-3">
                Define las piezas y sus reglas
                para el cálculo automático.
              </p>

              {selecciones.map(
                (material, indice) => {
                  const seleccionado =
                    buscarMaterial(
                      materiales,
                      material.idMaterial
                    );

                  return (
                    <div
                      key={material.clave}
                      className="card border mb-3"
                    >
                      <div className="card-header bg-light">
                        <strong>
                          Material {indice + 1}:{" "}
                          {seleccionado?.nombre ||
                            "Sin seleccionar"}
                        </strong>

                        <div className="small text-muted">
                          Unidad:{" "}
                          {seleccionado?.unidadMedida ||
                            "—"}
                        </div>
                      </div>

                      <div className="card-body">
                        {material.componentes.map(
                          (pieza, numero) => (
                            <div
                              key={pieza.clave}
                              className="border rounded p-3 mb-3"
                            >
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <strong>
                                  Pieza {numero + 1}
                                </strong>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    quitarPieza(
                                      material.clave,
                                      pieza.clave
                                    )
                                  }
                                >
                                  Quitar pieza
                                </button>
                              </div>

                              <div className="row g-3">

                                <div className="col-md-6">
                                  <label className="form-label">
                                    Nombre de la pieza
                                  </label>

                                  <input
                                    className="form-control"
                                    maxLength={100}
                                    placeholder="Ejemplo: Marco vertical"
                                    value={pieza.nombre}
                                    onChange={(e) =>
                                      cambiarPieza(
                                        material.clave,
                                        pieza.clave,
                                        "nombre",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div className="col-md-3">
                                  <label className="form-label">
                                    Cantidad
                                  </label>

                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="form-control"
                                    value={
                                      pieza.cantidadPiezas
                                    }
                                    onChange={(e) =>
                                      cambiarPieza(
                                        material.clave,
                                        pieza.clave,
                                        "cantidadPiezas",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div className="col-md-3">
                                  <label className="form-label">
                                    Regla de cálculo
                                  </label>

                                  <select
                                    className="form-select"
                                    value={
                                      pieza.tipoCalculo
                                    }
                                    onChange={(e) =>
                                      cambiarPieza(
                                        material.clave,
                                        pieza.clave,
                                        "tipoCalculo",
                                        e.target.value
                                      )
                                    }
                                  >
                                    {TIPOS.map(
                                      ([tipo, nombre]) => (
                                        <option
                                          key={tipo}
                                          value={tipo}
                                          disabled={
                                            seleccionado &&
                                            UNIDADES[tipo] !==
                                              seleccionado.unidadMedida
                                          }
                                        >
                                          {nombre}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </div>

                                <div className="col-md-4">
                                  <label className="form-label">
                                    Factor de cálculo
                                  </label>

                                  <input
                                    type="number"
                                    min="0.000001"
                                    step="any"
                                    className="form-control"
                                    value={
                                      pieza.factorCalculo
                                    }
                                    onChange={(e) =>
                                      cambiarPieza(
                                        material.clave,
                                        pieza.clave,
                                        "factorCalculo",
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>

                                {esLineal(
                                  pieza.tipoCalculo
                                ) && (
                                  <div className="col-md-4">
                                    <label className="form-label">
                                      Ajuste lineal (m)
                                    </label>

                                    <input
                                      type="number"
                                      step="any"
                                      className="form-control"
                                      value={
                                        pieza.ajusteMetros
                                      }
                                      onChange={(e) =>
                                        cambiarPieza(
                                          material.clave,
                                          pieza.clave,
                                          "ajusteMetros",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                )}

                                {pieza.tipoCalculo ===
                                  "FIJO" && (
                                  <div className="col-md-4">
                                    <label className="form-label">
                                      Medida fija (m)
                                    </label>

                                    <input
                                      type="number"
                                      min="0.000001"
                                      step="any"
                                      className="form-control"
                                      value={
                                        pieza.medidaFijaMetros
                                      }
                                      onChange={(e) =>
                                        cambiarPieza(
                                          material.clave,
                                          pieza.clave,
                                          "medidaFijaMetros",
                                          e.target.value
                                        )
                                      }
                                    />
                                  </div>
                                )}

                              </div>
                            </div>
                          )
                        )}

                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={() =>
                            agregarPieza(
                              material.clave
                            )
                          }
                        >
                          + Agregar pieza
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </section>
          )}

          {/* ==================================
              PASO 4: REVISIÓN
          ================================== */}

          {paso === 3 && (
            <section>
              <h5 className="mb-2">
                4. Revisión de la estructura
              </h5>

              <div className="alert alert-info">
                Revisa cuidadosamente toda la información.
                <strong>
                  {" "}Nada se guardará hasta
                  que confirmes.
                </strong>
              </div>

              {esEdicion && (
                <div className="alert alert-warning">
                  Actualizarás el modelo{" "}
                  <strong>
                    ID {idEditando}
                  </strong>.
                  No se creará otro modelo.
                </div>
              )}

              {/* REVISAR DATOS GENERALES */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Datos generales
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
                  <strong>Nombre:</strong>{" "}
                  {datos.nombre}
                </p>

                <p className="mb-1">
                  <strong>Precio base:</strong>{" "}
                  {precioFormateado(
                    datos.precioBase
                  )}
                </p>

                <p className="mb-0">
                  <strong>Descripción:</strong>{" "}
                  {datos.descripcion ||
                    "Sin descripción"}
                </p>
              </div>

              {/* REVISAR MATERIALES */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Materiales
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => irA(1)}
                  >
                    Editar
                  </button>
                </div>

                {selecciones.map(
                  (material) => {
                    const seleccionado =
                      buscarMaterial(
                        materiales,
                        material.idMaterial
                      );

                    return (
                      <p
                        key={material.clave}
                        className="mb-2"
                      >
                        <strong>
                          {seleccionado?.nombre ||
                            "Material"}
                        </strong>
                        {" — "}
                        Código:{" "}
                        {seleccionado?.codigo || "—"}
                        {" — "}
                        Unidad:{" "}
                        {seleccionado?.unidadMedida ||
                          "—"}
                        {" — "}
                        Merma:{" "}
                        {material.porcentajeMerma}%
                      </p>
                    );
                  }
                )}
              </div>

              {/* REVISAR TODAS LAS PIEZAS */}

              <div className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center">
                  <h6>
                    Piezas y reglas de cálculo
                  </h6>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => irA(2)}
                  >
                    Editar
                  </button>
                </div>

                {selecciones.map(
                  (material) => {
                    const seleccionado =
                      buscarMaterial(
                        materiales,
                        material.idMaterial
                      );

                    return (
                      <div
                        key={material.clave}
                        className="mb-4"
                      >
                        <strong>
                          {seleccionado?.nombre ||
                            "Material"}
                        </strong>

                        <div className="table-responsive mt-2">
                          <table className="table table-sm table-bordered align-middle">
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
                                (pieza) => (
                                  <tr
                                    key={pieza.clave}
                                  >
                                    <td>
                                      {pieza.nombre}
                                    </td>

                                    <td>
                                      {pieza.cantidadPiezas}
                                    </td>

                                    <td>
                                      {nombreRegla(
                                        pieza.tipoCalculo
                                      )}
                                    </td>

                                    <td>
                                      {pieza.factorCalculo}
                                    </td>

                                    <td>
                                      {esLineal(
                                        pieza.tipoCalculo
                                      )
                                        ? pieza.ajusteMetros
                                        : "—"}
                                    </td>

                                    <td>
                                      {pieza.tipoCalculo ===
                                      "FIJO"
                                        ? pieza.medidaFijaMetros
                                        : "—"}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <p className="text-muted small">
                Puedes regresar a cualquier paso
                y corregir los datos todas las veces
                que necesites.
              </p>
            </section>
          )}

          {/* NAVEGACIÓN SIN GUARDAR */}

          <hr className="my-4" />

          <div className="d-flex justify-content-between gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={
                paso === 0 ||
                guardando ||
                procesandoEstado ||
                cargandoEdicion
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
                  procesandoEstado ||
                  cargandoEdicion ||
                  (
                    paso === 1 &&
                    (
                      cargando ||
                      materiales.length === 0
                    )
                  )
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
                  procesandoEstado ||
                  cargandoEdicion ||
                  cargando
                }
                onClick={solicitarConfirmacion}
              >
                {esEdicion
                  ? "✓ Guardar cambios"
                  : "✓ Guardar estructura"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ==================================
          ESTRUCTURAS REGISTRADAS
          ACTIVAS / INACTIVAS
      ================================== */}

      <div className="card border-0 shadow-sm">
        <div className="card-body">

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h5 className="mb-0">
              Estructuras registradas
            </h5>

            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              disabled={
                cargando ||
                procesandoEstado
              }
              onClick={cargarDatos}
            >
              {cargando
                ? "Actualizando..."
                : "Actualizar lista"}
            </button>
          </div>

          {/* PESTAÑAS */}

          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              className={
                "btn " +
                (
                  pestana === "activas"
                    ? "btn-primary"
                    : "btn-outline-primary"
                )
              }
              onClick={() =>
                setPestana("activas")
              }
            >
              Activas ({modelosActivos.length})
            </button>

            <button
              type="button"
              className={
                "btn " +
                (
                  pestana === "inactivas"
                    ? "btn-secondary"
                    : "btn-outline-secondary"
                )
              }
              onClick={() =>
                setPestana("inactivas")
              }
            >
              Inactivas ({modelosInactivos.length})
            </button>
          </div>

          <p className="text-muted small">
            {pestana === "activas"
              ? "Estas estructuras están disponibles para las operaciones nuevas."
              : "Estas estructuras permanecen guardadas en PostgreSQL y pueden reactivarse si sus materiales y piezas siguen disponibles."}
          </p>

          {/* TABLA */}

          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {modelosVisibles.map(
                  (modelo) => (
                    <tr
                      key={
                        modelo.idModeloProducto
                      }
                    >
                      <td>
                        {modelo.idModeloProducto}
                      </td>

                      <td>
                        {modelo.nombre}
                      </td>

                      <td>
                        {pestana === "activas" ? (
                          <span className="badge bg-success">
                            Activa
                          </span>
                        ) : (
                          <span className="badge bg-secondary">
                            Inactiva
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="d-flex flex-wrap gap-2">

                          {/* VER DETALLE */}

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            disabled={
                              procesandoEstado
                            }
                            onClick={() =>
                              setIdDetalle(
                                modelo.idModeloProducto
                              )
                            }
                          >
                            👁 Ver detalle
                          </button>

                          {pestana === "activas" ? (
                            <>
                              {/* EDITAR */}

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-warning"
                                disabled={
                                  cargandoEdicion ||
                                  guardando ||
                                  procesandoEstado ||
                                  confirmando
                                }
                                onClick={() =>
                                  comenzarEdicion(
                                    modelo.idModeloProducto
                                  )
                                }
                              >
                                ✎ Editar
                              </button>

                              {/* DESACTIVAR */}

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={
                                  cargandoEdicion ||
                                  guardando ||
                                  procesandoEstado ||
                                  confirmando
                                }
                                onClick={() =>
                                  solicitarDesactivacion(
                                    modelo
                                  )
                                }
                              >
                                Desactivar
                              </button>
                            </>
                          ) : (
                            <>
                              {/* REACTIVAR */}

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                disabled={
                                  cargandoEdicion ||
                                  guardando ||
                                  procesandoEstado ||
                                  confirmando
                                }
                                onClick={() =>
                                  solicitarReactivacion(
                                    modelo
                                  )
                                }
                              >
                                ↻ Reactivar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}

                {modelosVisibles.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center text-muted py-4"
                    >
                      {pestana === "activas"
                        ? "No hay estructuras activas."
                        : "No hay estructuras inactivas."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* ==================================
          CONFIRMACIÓN DE GUARDADO
      ================================== */}

      {confirmando && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{
              zIndex: 1300,
            }}
          />

          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloGuardarModelo"
            style={{
              zIndex: 1301,
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow border-0">

                <div className="modal-header">
                  <h5
                    className="modal-title"
                    id="tituloGuardarModelo"
                  >
                    {esEdicion
                      ? "Confirmar actualización"
                      : "Confirmar registro"}
                  </h5>
                </div>

                <div className="modal-body">
                  <p>
                    ¿Deseas{" "}
                    {esEdicion
                      ? "guardar los cambios de"
                      : "registrar"}{" "}
                    la estructura{" "}
                    <strong>
                      {datos.nombre}
                    </strong>
                    ?
                  </p>

                  {esEdicion && (
                    <p>
                      ID original:{" "}
                      <strong>
                        {idEditando}
                      </strong>
                    </p>
                  )}

                  <p className="text-muted mb-0">
                    Ningún cambio se aplicará
                    hasta que confirmes.
                  </p>
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
                      : esEdicion
                      ? "Sí, guardar cambios"
                      : "Sí, guardar"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================================
          CONFIRMACIÓN DE DESACTIVACIÓN
      ================================== */}

      {modeloADesactivar && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{
              zIndex: 1300,
            }}
          />

          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloDesactivarModelo"
            style={{
              zIndex: 1301,
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow border-0">

                <div className="modal-header">
                  <h5
                    className="modal-title"
                    id="tituloDesactivarModelo"
                  >
                    Confirmar desactivación
                  </h5>
                </div>

                <div className="modal-body">
                  <p>
                    ¿Deseas desactivar la estructura{" "}
                    <strong>
                      {modeloADesactivar.nombre}
                    </strong>
                    ?
                  </p>

                  <p>
                    ID:{" "}
                    <strong>
                      {modeloADesactivar.idModeloProducto}
                    </strong>
                  </p>

                  <div className="alert alert-warning mb-0">
                    La estructura dejará de estar
                    disponible para operaciones nuevas.
                    Sus datos permanecerán guardados
                    en PostgreSQL.
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={procesandoEstado}
                    onClick={() =>
                      setModeloADesactivar(null)
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={procesandoEstado}
                    onClick={
                      confirmarDesactivacion
                    }
                  >
                    {procesandoEstado
                      ? "Desactivando..."
                      : "Sí, desactivar"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================================
          CONFIRMACIÓN DE REACTIVACIÓN
      ================================== */}

      {modeloAReactivar && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{
              zIndex: 1300,
            }}
          />

          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tituloReactivarModelo"
            style={{
              zIndex: 1301,
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow border-0">

                <div className="modal-header">
                  <h5
                    className="modal-title"
                    id="tituloReactivarModelo"
                  >
                    Confirmar reactivación
                  </h5>
                </div>

                <div className="modal-body">
                  <p>
                    ¿Deseas reactivar la estructura{" "}
                    <strong>
                      {modeloAReactivar.nombre}
                    </strong>
                    ?
                  </p>

                  <p>
                    ID original:{" "}
                    <strong>
                      {modeloAReactivar.idModeloProducto}
                    </strong>
                  </p>

                  <div className="alert alert-info mb-0">
                    Se recuperará la misma estructura,
                    con su identificador original.
                    No se creará otro modelo ni se
                    descontarán materiales del inventario.
                    Laravel comprobará que existan
                    materiales y piezas activos.
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={procesandoEstado}
                    onClick={() =>
                      setModeloAReactivar(null)
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={procesandoEstado}
                    onClick={
                      confirmarReactivacion
                    }
                  >
                    {procesandoEstado
                      ? "Reactivando..."
                      : "Sí, reactivar"}
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
