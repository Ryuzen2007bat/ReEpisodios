// =====================================================
// 0) CONFIGURACIÓN Y ESTADO
// =====================================================

// Pega aquí el "ID de cliente" que te da Google Cloud (termina en .apps.googleusercontent.com).
// No es un secreto: está pensado para ir en páginas públicas.
// Mientras diga "PEGA_AQUI...", la app funciona solo en este navegador (sin nube).
const GOOGLE_CLIENT_ID = "638796588774-bl3e1jei4d0qlhmrrojv6a4mggd4nc81.apps.googleusercontent.com";

const NUBE_ACTIVA = !GOOGLE_CLIENT_ID.startsWith("PEGA_AQUI");
const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.appdata"; // carpeta oculta de la app en SU Drive
const NOMBRE_ARCHIVO = "episodios.json";
const CLAVE_GUARDADO = "episodios-v1";
const CLAVE_NUBE = "episodios-nube-conectada";
const CLAVE_COPIA_PREVIA = "episodios-v1-copia-previa";
const CLAVE_ULTIMO_RESPALDO = "episodios-ultimo-respaldo";
const DIAS_RECORDATORIO = 7;   // si escribe sin Google, avisar tras estos días sin respaldo

// ---- Personalización del regalo ----
// Su nombre y su cumpleaños ("MM-DD"). Si los dejas vacíos, simplemente no aparecen.
const NOMBRE_AMIGO = "Laplace";
const CUMPLE_AMIGO = "11-10";

// Mensaje que verá UNA sola vez al abrir la página por primera vez. Vacío = no se muestra.
const DEDICATORIA = "Un regalo que no planeaba existir";

// Fechas canónicas de la obra: cumpleaños oficiales y aniversarios.
// Solo se incluyeron fechas confirmadas en más de una fuente.
const FECHAS_REZERO = {
  "01-01": "Hoy cumple años Reinhard van Astrea, el Santo de la Espada.",
  "01-24": "Un día como hoy, en 2014, salió el primer volumen de la novela ligera de Re:Zero.",
  "02-02": "Hoy cumplen años Rem y Ram.",
  "03-24": "Hoy cumple años Otto Suwen.",
  "04-01": "Hoy cumple años Natsuki Subaru. Es también el día en que Tappei Nagatsuki publicaba las historias IF.",
  "04-04": "Un día como hoy, en 2016, se estrenó el anime de Re:Zero.",
  "08-08": "Hoy cumple años Felt, candidata a la Selección Real.",
  "09-07": "Hoy cumple años Priscilla Barielle, candidata a la Selección Real.",
  "09-16": "Hoy cumple años Roswaal L. Mathers, señor de la mansión.",
  "09-23": "Hoy cumple años Emilia."
};

// Colores de las rutas: cada uno toma el color de cabello de un personaje.
const COLORES_RUTA = [
  { valor: "#5b9bff", nombre: "Azul de Rem" },
  { valor: "#ff8fc7", nombre: "Rosa de Ram" },
  { valor: "#d9d6f0", nombre: "Plata de Emilia" },
  { valor: "#f3d27a", nombre: "Dorado de Beatrice" },
  { valor: "#4fd18b", nombre: "Verde de Crusch" },
  { valor: "#ff5a5a", nombre: "Rojo de Reinhard" }
];

// El Tabú: si intenta escribir sobre su poder, la Bruja no lo permite.
const FRASES_TABU = [
  // Español
  "regreso por muerte", "regreso por la muerte",
  "retorno por muerte", "retorno por la muerte",
  // Inglés
  "return by death", "returns by death", "returned by death", "returning by death",
  // Japonés (romanizado, kana y kanji)
  "shi ni modori", "shinimodori", "しにもどり", "死に戻り"
];

// Susurros: si el título o las memorias mencionan ciertas cosas de la obra,
// aparece una línea extra al guardar. Se busca la palabra completa, sin tildes.
const SUSURROS = [
  { patron: /\bbarusu\b/, texto: () => "«Barusu»: así llama siempre Ram a Subaru. Desde la mansión se oye un suspiro de desdén." },
  { patron: /\bkashira\b/, texto: () => "«…kashira». Desde la Biblioteca Prohibida, Beatrice finge que no leyó esto." },
  { patron: /\b(emt|emilia-?tan)\b/, texto: () => "E.M.T.: Emilia-tan Maji Tenshi. Subaru aprueba este título." },
  { patron: /\bpatrasche\b/, texto: () => "Patrasche, el dragón de tierra de Subaru, aprueba este día." },
  { patron: /\bpuck\b/, texto: () => {
      const h = new Date().getHours();
      return h >= 9 && h < 17
        ? "Puck está de turno: solo se manifiesta de 9 a. m. a 5 p. m., y ahora mismo está despierto."
        : "Puck no responde: fuera de su horario de 9 a. m. a 5 p. m. descansa dentro del cristal de Emilia.";
    } },
  { patron: /\b(desde cero|from zero|re:? ?zero)\b/, texto: () => "Empezar la vida en otro mundo desde cero. Te suena de algo." }
];

// Las siete Brujas del Pecado (para el emblema de la portada).
const BRUJAS = [
  ["Echidna", "Bruja de la Codicia"],
  ["Minerva", "Bruja de la Ira"],
  ["Sekhmet", "Bruja de la Pereza"],
  ["Daphne", "Bruja de la Gula"],
  ["Typhon", "Bruja de la Soberbia"],
  ["Carmilla", "Bruja de la Lujuria"],
  ["Satella", "Bruja de la Envidia"]
];

// Todos los datos de la app viven en este único objeto.
// "actualizado" es la fecha-hora del último cambio.
let datos = { arcos: [], episodios: [], borrados: [], rutasBorradas: [], actualizado: "" };

// Estado de la pantalla
let mesVista = { anio: 0, mes: 0 };   // mes que muestra el calendario (mes: 0 = enero)
let fechaActual = "";                 // fecha ("AAAA-MM-DD") que se está editando en el formulario
let formularioTocado = false;         // si está escribiendo, una sincronización no le borra lo escrito

// Estado de la conexión con Google Drive
const nube = {
  cliente: null,        // el "cliente de token" de Google
  token: null,          // permiso temporal (dura ~1 hora; solo vive en memoria)
  venceEn: 0,           // cuándo vence el token (ms)
  archivoId: null,      // id del archivo episodios.json dentro de Drive
  subiendo: false,
  pendiente: false,
  temporizador: null,
  sinSubir: false,      // hay cambios que aún no llegan a Drive
  sesionLocal: false,   // en esta visita eligió "Leer sin conectar"
  esperaPortada: false  // la portada está esperando la conexión para abrirse
};

// =====================================================
// 1) FECHAS  (todo se maneja como texto "AAAA-MM-DD")
// =====================================================
function pad(n) { return String(n).padStart(2, "0"); }

// Arma "AAAA-MM-DD" desde números. mes: 0 = enero.
function aISO(anio, mes, dia) { return `${anio}-${pad(mes + 1)}-${pad(dia)}`; }

// La fecha de hoy usa la hora de TU computadora (Lima), no UTC.
function hoyISO() {
  const d = new Date();
  return aISO(d.getFullYear(), d.getMonth(), d.getDate());
}

// "2026-11-10" -> "martes, 10 de noviembre de 2026"
function fechaBonita(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

// =====================================================
// 2) GUARDADO LOCAL  (siempre funciona, incluso sin internet)
//    El resto de la app solo llama a cargarDatos() y guardarDatos().
// =====================================================

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Revisa que lo cargado tenga la forma correcta (por si el archivo está dañado).
// "borrados" guarda qué días se quemaron y cuándo, para que otro dispositivo
// no los "resucite" al sincronizar.
function normalizar(d) {
  const arcos = Array.isArray(d && d.arcos)
    ? d.arcos.filter(a => a && typeof a.id === "number" && typeof a.nombre === "string")
    : [];
  const episodios = Array.isArray(d && d.episodios)
    ? d.episodios.filter(e => e && ES_FECHA.test(e.fecha) && typeof e.titulo === "string")
    : [];
  const borrados = Array.isArray(d && d.borrados)
    ? d.borrados.filter(b => b && ES_FECHA.test(b.fecha) && typeof b.en === "string")
    : [];
  const rutasBorradas = Array.isArray(d && d.rutasBorradas)
    ? d.rutasBorradas.filter(r => r && typeof r.id === "number" && typeof r.en === "string")
    : [];
  const actualizado = d && typeof d.actualizado === "string" ? d.actualizado : "";
  return { arcos, episodios, borrados, rutasBorradas, actualizado };
}

function datosVacios() {
  return { arcos: [], episodios: [], borrados: [], rutasBorradas: [], actualizado: "" };
}

async function cargarDatos() {
  try {
    const crudo = localStorage.getItem(CLAVE_GUARDADO);
    if (crudo) return normalizar(JSON.parse(crudo));
  } catch (e) {
    console.warn("No se pudo leer lo guardado:", e);
  }
  return datosVacios();
}

function guardarLocal() {
  localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(datos));
}

// Copia de seguridad automática antes de que una sincronización o importación
// cambie los datos de este navegador. Se puede recuperar desde la consola con:
//   localStorage.getItem("episodios-v1-copia-previa")
function guardarCopiaPrevia() {
  try {
    localStorage.setItem(CLAVE_COPIA_PREVIA, JSON.stringify({ guardada: new Date().toISOString(), datos }));
  } catch (e) {}
}

// Guarda aquí y, si hay sesión de Google, también en Drive.
async function guardarDatos() {
  datos.actualizado = new Date().toISOString();
  try {
    guardarLocal();
  } catch (e) {
    console.warn("No se pudo guardar:", e);
    mostrarMensaje("⚠ No se pudo guardar en este navegador. Exporta un respaldo.");
    return false;
  }
  marcarSinSubir(true);
  programarSubida();
  return true;
}

// ---- Fusión: une dos versiones del Libro sin perder páginas ----
// Regla: si un mismo día existe en ambos lados, gana la versión editada más recientemente.
// Si un día fue quemado después de su última edición, se queda quemado.
function idArcoUnico(arcos) {
  let id = Date.now();
  while (arcos.some(a => a.id === id)) id++;
  return id;
}

function firma(d) {
  const orden = arr => [...arr].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return JSON.stringify({
    a: [...d.arcos].sort((x, y) => x.id - y.id),
    e: orden(d.episodios),
    b: orden(d.borrados),
    r: [...d.rutasBorradas].sort((x, y) => x.id - y.id)
  });
}

function fusionar(local, remoto) {
  // Arcos: se unen; si dos arcos distintos comparten id, el de este navegador recibe uno nuevo.
  const arcos = remoto.arcos.map(a => ({ ...a }));
  const cambioId = new Map();
  for (const a of local.arcos) {
    const mismoId = arcos.find(x => x.id === a.id);
    if (mismoId) {
      if (mismoId.nombre === a.nombre && mismoId.color === a.color) continue;
      // Misma ruta renombrada o recoloreada en otro dispositivo: gana el cambio más reciente.
      if (a.editado || mismoId.editado) {
        if ((a.editado || "") > (mismoId.editado || "")) Object.assign(mismoId, a);
        continue;
      }
      if (mismoId.nombre === a.nombre) continue;
    }
    const mismoNombre = arcos.find(x => x.nombre === a.nombre);
    if (mismoNombre) { cambioId.set(a.id, mismoNombre.id); continue; }
    if (mismoId) {
      // Dos rutas antiguas distintas con el mismo id: la de este navegador recibe uno nuevo.
      const nuevo = idArcoUnico(arcos);
      cambioId.set(a.id, nuevo);
      arcos.push({ ...a, id: nuevo });
      continue;
    }
    arcos.push({ ...a });
  }

  // Rutas borradas: se quedan borradas salvo que se hayan editado después.
  const rutasQuemadas = new Map();
  for (const r of [...remoto.rutasBorradas, ...local.rutasBorradas]) {
    if (!rutasQuemadas.has(r.id) || r.en > rutasQuemadas.get(r.id)) rutasQuemadas.set(r.id, r.en);
  }
  const rutasVivas = arcos.filter(a => {
    const en = rutasQuemadas.get(a.id);
    return !en || en < (a.editado || "");
  });
  const ajustarArco = e =>
    e.arcoId != null && cambioId.has(e.arcoId) ? { ...e, arcoId: cambioId.get(e.arcoId) } : e;

  // Días quemados: se queda la fecha de quema más reciente.
  const quemas = new Map();
  for (const b of [...remoto.borrados, ...local.borrados]) {
    if (!quemas.has(b.fecha) || b.en > quemas.get(b.fecha)) quemas.set(b.fecha, b.en);
  }

  // Episodios
  const localMasNuevo = (local.actualizado || "") >= (remoto.actualizado || "");
  const porFecha = new Map(remoto.episodios.map(e => [e.fecha, e]));
  for (const original of local.episodios) {
    const eL = ajustarArco(original);
    const eR = porFecha.get(eL.fecha);
    if (!eR) { porFecha.set(eL.fecha, eL); continue; }
    const tL = eL.editado || "", tR = eR.editado || "";
    // Páginas antiguas sin fecha de edición: decide qué Libro se tocó por última vez.
    const gana = tL !== tR ? (tL > tR ? eL : eR) : (localMasNuevo ? eL : eR);
    porFecha.set(eL.fecha, gana);
  }

  const episodios = [];
  for (const [fecha, e] of porFecha) {
    const quemado = quemas.get(fecha);
    if (quemado && quemado >= (e.editado || "")) continue;
    episodios.push(e);
  }
  episodios.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Episodios cuya ruta ya no existe quedan sin ruta.
  const idsVivos = new Set(rutasVivas.map(a => a.id));
  const episodiosFinales = episodios.map(e =>
    e.arcoId != null && !idsVivos.has(e.arcoId) ? { ...e, arcoId: null } : e
  );

  const borrados = [...quemas]
    .map(([fecha, en]) => ({ fecha, en }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const rutasBorradas = [...rutasQuemadas]
    .map(([id, en]) => ({ id, en }))
    .sort((a, b) => a.id - b.id);

  const actualizado = [local.actualizado || "", remoto.actualizado || ""].sort().pop();
  return { arcos: rutasVivas, episodios: episodiosFinales, borrados, rutasBorradas, actualizado };
}

// Aplica lo que viene de otro lado (Drive o un respaldo). Devuelve true si algo cambió aquí.
function aplicarFusion(otro) {
  const resultado = fusionar(datos, otro);
  if (firma(resultado) === firma(datos)) return false;
  guardarCopiaPrevia();
  datos = resultado;
  try { guardarLocal(); } catch (e) {}
  refrescarSinTocarFormulario();
  return true;
}

// ---- Recordatorio de respaldo ----
function registrarRespaldo() {
  try { localStorage.setItem(CLAVE_ULTIMO_RESPALDO, new Date().toISOString()); } catch (e) {}
}

function diasSinRespaldo() {
  let ultimo = null;
  try { ultimo = localStorage.getItem(CLAVE_ULTIMO_RESPALDO); } catch (e) {}
  if (!ultimo) return Infinity;
  return Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000);
}

// Mensaje para la barra cuando se escribe solo en este navegador.
function avisoSoloLocal() {
  if (datos.episodios.length === 0) {
    return { texto: "Escribiendo solo en este navegador. Conecta Google para guardar tu Libro en tu Drive.", alerta: false };
  }
  const dias = diasSinRespaldo();
  if (dias >= DIAS_RECORDATORIO) {
    const cuando = dias === Infinity ? "Tu Libro nunca se ha respaldado" : `Llevas ${dias} días sin respaldo`;
    return {
      texto: `⚠ ${cuando}. Si se borra este navegador, estas páginas se pierden. Conecta Google o exporta un respaldo.`,
      alerta: true
    };
  }
  return { texto: "Escribiendo solo en este navegador. Conecta Google para guardar tu Libro en tu Drive.", alerta: false };
}

// =====================================================
// 3) GUARDADO EN LA NUBE  (Google Drive, carpeta oculta de la app)
// =====================================================
function nubeConectada() {
  return !!nube.token && Date.now() < nube.venceEn;
}

// ¿Eligió guardar en Google (en esta u otra visita)?
function modoGoogle() {
  try { return localStorage.getItem(CLAVE_NUBE) === "1"; } catch (e) { return false; }
}

function estadoNube(texto, alerta = false) {
  $("estado-nube").textContent = texto;
  $("barra-nube").classList.toggle("alerta", alerta);
}

function marcarSinSubir(valor) {
  if (!NUBE_ACTIVA) return;
  nube.sinSubir = valor;
}

function actualizarBotonNube() {
  const barra = $("barra-nube");
  const btn = $("btn-nube");
  if (!NUBE_ACTIVA) { barra.hidden = true; return; }
  barra.hidden = false;
  btn.disabled = !nube.cliente;
  if (nubeConectada()) {
    btn.textContent = "Desconectar";
    btn.dataset.modo = "desconectar";
  } else {
    btn.textContent = modoGoogle() ? "Reconectar con Google" : "Conectar con Google";
    btn.dataset.modo = "conectar";
  }
}

// Muestra en la barra el estado correcto cuando NO hay sesión activa.
function estadoSinSesion() {
  if (modoGoogle() && !nube.sesionLocal) {
    if (nube.sinSubir) {
      estadoNube("⚠ Tu sesión de Google venció: tus últimas páginas aún no llegan a Taygeta. Pulsa “Reconectar”.", true);
    } else {
      estadoNube("Tu sesión de Google no está activa. Pulsa “Reconectar” para sincronizar.");
    }
  } else {
    const aviso = avisoSoloLocal();
    estadoNube(aviso.texto, aviso.alerta);
  }
  actualizarBotonNube();
}

// fetch con el token puesto. Si Google dice 401, el token ya no sirve.
async function driveFetch(url, opciones = {}) {
  if (!nubeConectada()) throw new Error("SIN_TOKEN");
  const resp = await fetch(url, {
    ...opciones,
    headers: { ...(opciones.headers || {}), Authorization: "Bearer " + nube.token }
  });
  if (resp.status === 401) { nube.token = null; throw new Error("SIN_TOKEN"); }
  if (!resp.ok) throw new Error("DRIVE_" + resp.status);
  return resp;
}

async function buscarArchivo() {
  const q = encodeURIComponent(`name='${NOMBRE_ARCHIVO}' and trashed=false`);
  const r = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name)`
  );
  const j = await r.json();
  return j.files && j.files.length ? j.files[0].id : null;
}

async function leerDeDrive(id) {
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
  return normalizar(await r.json());
}

// Crea el archivo la primera vez; después lo actualiza.
async function escribirEnDrive(contenido) {
  const cuerpoJSON = JSON.stringify(contenido);

  if (nube.archivoId) {
    try {
      await driveFetch(
        `https://www.googleapis.com/upload/drive/v3/files/${nube.archivoId}?uploadType=media`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: cuerpoJSON }
      );
      return;
    } catch (e) {
      if (e.message !== "DRIVE_404") throw e;
      nube.archivoId = null;   // lo borraron desde fuera: lo creamos de nuevo
    }
  }

  const limite = "episodios_limite_" + Date.now();
  const meta = JSON.stringify({ name: NOMBRE_ARCHIVO, parents: ["appDataFolder"] });
  const cuerpo =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${limite}\r\nContent-Type: application/json\r\n\r\n${cuerpoJSON}\r\n` +
    `--${limite}--`;
  const r = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${limite}` }, body: cuerpo }
  );
  nube.archivoId = (await r.json()).id;
}

// Lee lo que hay en Drive, lo une con lo de aquí y sube el resultado.
// Así, si escribió desde el celular y la laptop, no se pisa nada.
// Devuelve { cambioLocal, cambioRemoto, nuevo }.
async function sincronizarConDrive() {
  if (!nube.archivoId) nube.archivoId = await buscarArchivo();

  let remoto = null;
  if (nube.archivoId) {
    try {
      remoto = await leerDeDrive(nube.archivoId);
    } catch (e) {
      if (e.message !== "DRIVE_404") throw e;
      nube.archivoId = null;
    }
  }

  if (!remoto) {
    await escribirEnDrive(datos);
    return { cambioLocal: false, cambioRemoto: true, nuevo: true };
  }

  const cambioLocal = aplicarFusion(remoto);
  const cambioRemoto = firma(remoto) !== firma(datos);
  if (cambioRemoto) await escribirEnDrive(datos);
  return { cambioLocal, cambioRemoto, nuevo: false };
}

function manejarErrorNube(e) {
  console.warn("Nube:", e);
  if (e && e.message === "SIN_TOKEN") {
    estadoSinSesion();
  } else {
    estadoNube(`⚠ No se pudo guardar en Drive (${e && e.message}). Sigue guardado en este navegador.`, true);
    actualizarBotonNube();
  }
}

// Espera un poquito (por si escribes varias cosas seguidas) y sube.
function programarSubida() {
  if (!NUBE_ACTIVA) return;
  if (!nubeConectada()) { estadoSinSesion(); return; }
  clearTimeout(nube.temporizador);
  nube.temporizador = setTimeout(subir, 800);
}

async function subir() {
  if (nube.subiendo) { nube.pendiente = true; return; }
  nube.subiendo = true;
  estadoNube("Llevando tu página a la Biblioteca de Taygeta…");
  try {
    do {
      nube.pendiente = false;
      await sincronizarConDrive();
    } while (nube.pendiente);   // si hubo cambios mientras subía, sube de nuevo
    marcarSinSubir(false);
    registrarRespaldo();
    estadoNube("📜 Registrado en la Biblioteca de Taygeta (tu Google Drive)");
  } catch (e) {
    manejarErrorNube(e);
  } finally {
    nube.subiendo = false;
  }
}

// ---- Conexión / desconexión ----
function cargarGoogle() {
  return new Promise((ok, fallo) => {
    if (window.google && google.accounts && google.accounts.oauth2) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = ok;
    s.onerror = () => fallo(new Error("No cargó Google"));
    document.head.appendChild(s);
  });
}

async function iniciarNube() {
  actualizarBotonNube();
  if (!NUBE_ACTIVA) { portadaLista(false); return; }

  try {
    await cargarGoogle();
  } catch (e) {
    estadoNube("No se pudo cargar el inicio de sesión de Google (¿sin internet?). Todo sigue guardándose en este navegador.", true);
    portadaLista(false, "No se pudo contactar a Google (¿sin internet?). Puedes leer sin conectar y sincronizar después.");
    return;
  }

  nube.cliente = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE_DRIVE,
    callback: alRecibirToken,
    error_callback: () => {
      estadoSinSesion();
      if (nube.esperaPortada) {
        nube.esperaPortada = false;
        portadaEstado("No se completó la conexión con Google. Puedes intentarlo de nuevo.");
        portadaOcupada(false);
      }
    }
  });
  actualizarBotonNube();
  portadaLista(true);
}

function conectarGoogle(silencioso = false) {
  // Tiene que salir de un clic. Con prompt "" Google no vuelve a pedir permiso si ya lo dio.
  if (nube.cliente) nube.cliente.requestAccessToken(silencioso ? { prompt: "" } : {});
}

function fallaPortada(texto) {
  if (!nube.esperaPortada) return;
  nube.esperaPortada = false;
  portadaEstado(texto);
  portadaOcupada(false);
}

function alRecibirToken(resp) {
  if (!resp || resp.error || !resp.access_token) {
    estadoNube("No se pudo conectar con Google.", true);
    fallaPortada("Google no entregó el permiso. Intenta de nuevo.");
    return;
  }
  const oauth = google.accounts.oauth2;
  if (oauth.hasGrantedAllScopes && !oauth.hasGrantedAllScopes(resp, SCOPE_DRIVE)) {
    estadoNube("Falta aceptar el permiso de Drive. Vuelve a intentar y deja marcada la casilla.", true);
    fallaPortada("Falta aceptar el permiso de Drive: vuelve a intentar y deja marcada la casilla.");
    return;
  }
  nube.token = resp.access_token;
  nube.venceEn = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
  nube.sesionLocal = false;
  try { localStorage.setItem(CLAVE_NUBE, "1"); } catch (e) {}
  sincronizarAlConectar();
}

function desconectarGoogle() {
  try {
    if (nube.token && window.google) google.accounts.oauth2.revoke(nube.token, () => {});
  } catch (e) {}
  nube.token = null;
  nube.archivoId = null;
  try { localStorage.removeItem(CLAVE_NUBE); } catch (e) {}
  const aviso = avisoSoloLocal();
  estadoNube("Desconectado. " + aviso.texto, aviso.alerta);
  actualizarBotonNube();
}

// Al conectar: unir lo de este navegador con lo que haya en Drive.
async function sincronizarAlConectar() {
  estadoNube("Abriendo la Biblioteca de Taygeta…");
  actualizarBotonNube();
  if (nube.subiendo) { nube.pendiente = true; return; }
  nube.subiendo = true;
  try {
    const r = await sincronizarConDrive();
    marcarSinSubir(false);
    registrarRespaldo();
    estadoNube(
      r.nuevo ? "📜 Tu Libro se creó en la Biblioteca de Taygeta (tu Google Drive)"
      : r.cambioLocal ? "📜 Se recuperaron páginas desde la Biblioteca de Taygeta"
      : r.cambioRemoto ? "📜 La Biblioteca de Taygeta recibió las páginas de este navegador"
      : "📜 Registrado en la Biblioteca de Taygeta"
    );
    actualizarBotonNube();
    if (nube.esperaPortada) { nube.esperaPortada = false; abrirLibro(); }
  } catch (e) {
    manejarErrorNube(e);
    fallaPortada("Se conectó con Google, pero no se pudo leer tu Drive. Intenta de nuevo.");
  } finally {
    nube.subiendo = false;
    if (nube.pendiente) { nube.pendiente = false; subir(); }
  }
}

// Si la sesión venció pero ya había elegido Google, el clic en "Fijar punto de retorno"
// la renueva sola (Google exige que salga de un clic).
function renovarSesionSiHaceFalta() {
  if (NUBE_ACTIVA && nube.cliente && modoGoogle() && !nube.sesionLocal && !nubeConectada()) {
    conectarGoogle(true);
  }
}
// =====================================================
// 4) LÓGICA  (cálculos, sin tocar la pantalla)
// =====================================================
function episodiosOrdenados() {
  // Copia para no desordenar el original; las fechas ISO se ordenan bien como texto.
  return [...datos.episodios].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function episodioDe(fecha) {
  return datos.episodios.find(e => e.fecha === fecha) || null;
}

function numeroDe(fecha) {
  return episodiosOrdenados().findIndex(e => e.fecha === fecha) + 1; // 0 si no existe
}

function arcoPorId(id) {
  return datos.arcos.find(a => a.id === id) || null;
}

// Id basado en la hora: dos dispositivos casi nunca crearán el mismo.
function siguienteIdArco() {
  return idArcoUnico(datos.arcos);
}

// Color de una ruta. Las rutas antiguas sin color toman uno según su posición.
function colorDe(arco) {
  if (arco.color) return arco.color;
  const i = datos.arcos.findIndex(a => a.id === arco.id);
  return COLORES_RUTA[Math.max(0, i) % COLORES_RUTA.length].valor;
}

// Para una ruta nueva: el primer color que nadie esté usando.
function colorLibre() {
  const usados = new Set(datos.arcos.map(colorDe));
  const libre = COLORES_RUTA.find(c => !usados.has(c.valor));
  return (libre || COLORES_RUTA[datos.arcos.length % COLORES_RUTA.length]).valor;
}

function puntoColor(color) {
  const s = document.createElement("span");
  s.className = "punto-ruta";
  s.style.setProperty("--ruta", color);
  s.setAttribute("aria-hidden", "true");
  return s;
}

// El arco "actual" es el del episodio más reciente que tenga arco.
function arcoActual() {
  const conArco = episodiosOrdenados().filter(e => arcoPorId(e.arcoId));
  if (conArco.length === 0) return null;
  return arcoPorId(conArco[conArco.length - 1].arcoId);
}

function episodiosDelArco(arcoId) {
  return episodiosOrdenados().filter(e => e.arcoId === arcoId);
}

// =====================================================
// 5) PANTALLA
// =====================================================
const $ = id => document.getElementById(id);

function mostrarMensaje(texto) {
  $("mensaje").textContent = texto;
}

// ---- Formulario ----
function cargarFormulario(fecha) {
  fechaActual = fecha;
  const hoy = hoyISO();
  const ep = episodioDe(fecha);

  $("fecha-label").textContent = fechaBonita(fecha);
  $("pregunta").textContent =
    fecha === hoy ? "¿Cuál es el título de este ciclo?" : "¿Cómo se tituló aquel ciclo?";

  const especial = fechaEspecial(fecha);
  $("fecha-especial").textContent = especial || "";
  $("fecha-especial").hidden = !especial;

  $("titulo").value = ep ? ep.titulo : "";
  $("porque").value = ep && ep.porque ? ep.porque : "";
  llenarSelectArcos(ep && ep.arcoId != null ? ep.arcoId : "");

  // Si ya tiene porqué o arco, dejamos el desplegable abierto.
  $("detalles").open = !!(ep && (ep.porque || ep.arcoId != null));

  actualizarBotonesFormulario();
  formularioTocado = false;
  mostrarMensaje("");
  dibujarCalendario(); // para resaltar el día seleccionado
}

function actualizarBotonesFormulario() {
  const ep = episodioDe(fechaActual);
  $("btn-borrar").hidden = !ep;
  $("btn-guardar").textContent = ep ? "Reescribir ciclo" : "Fijar punto de retorno";
}

// Tras una sincronización: redibuja todo, pero si está escribiendo no le toca el formulario.
function refrescarSinTocarFormulario() {
  if (!fechaActual) return;   // la app aún no arranca
  dibujarResumen();
  dibujarArcos();
  if (formularioTocado) {
    llenarSelectArcos($("arco").value === "" ? "" : Number($("arco").value));
    actualizarBotonesFormulario();
    dibujarCalendario();
  } else {
    const msg = $("mensaje").textContent;
    cargarFormulario(fechaActual);
    mostrarMensaje(msg);
  }
}

function llenarSelectArcos(seleccionado) {
  const select = $("arco");
  select.innerHTML = "";
  const sinArco = document.createElement("option");
  sinArco.value = "";
  sinArco.textContent = "Sin ruta asignada";
  select.appendChild(sinArco);

  for (const arco of datos.arcos) {
    const op = document.createElement("option");
    op.value = String(arco.id);
    op.textContent = arco.nombre;   // textContent: seguro aunque el nombre tenga símbolos raros
    select.appendChild(op);
  }
  select.value = seleccionado === "" ? "" : String(seleccionado);
}

// ---- Resumen ----
function dibujarResumen() {
  const cont = $("resumen");
  cont.innerHTML = "";

  const hoy = new Date();
  const prefijoMes = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;
  const delMes = datos.episodios.filter(e => e.fecha.startsWith(prefijoMes)).length;
  const nombreMes = hoy.toLocaleDateString("es-PE", { month: "long" });

  const h = document.createElement("h2");
  h.textContent = "Registro de Od Laguna";
  cont.appendChild(h);

  const p1 = document.createElement("p");
  p1.textContent = `${nombreMes}: ${delMes} de ${hoy.getDate()} días escritos en tu Libro.`;
  cont.appendChild(p1);

  const arco = arcoActual();
  const p2 = document.createElement("p");
  if (arco) {
    const n = episodiosDelArco(arco.id).length;
    p2.append(
      "Ruta actual: ",
      puntoColor(colorDe(arco)),
      `${arco.nombre} (${n} ${n === 1 ? "episodio" : "episodios"})`
    );
  } else {
    p2.textContent = "Ninguna ruta en curso. Toda historia empieza desde cero.";
  }
  cont.appendChild(p2);

  const orden = episodiosOrdenados();
  const p3 = document.createElement("p");
  if (orden.length > 0) {
    const ult = orden[orden.length - 1];
    p3.textContent = `Último: Ep. ${orden.length} — ${ult.titulo}`;
  } else {
    p3.textContent = "La primera página de tu Libro sigue en blanco. Escríbela arriba.";
  }
  cont.appendChild(p3);
}

// ---- Calendario ----
function dibujarCalendario() {
  const { anio, mes } = mesVista;
  const hoy = hoyISO();

  $("mes-titulo").textContent = new Date(anio, mes, 1)
    .toLocaleDateString("es-PE", { month: "long", year: "numeric" });

  const primerDia = new Date(anio, mes, 1).getDay();   // 0 = domingo
  const diasDelMes = new Date(anio, mes + 1, 0).getDate();
  const vacias = (primerDia + 6) % 7;                   // semana empieza en lunes

  const grid = $("cal-grid");
  grid.innerHTML = "";

  for (let i = 0; i < vacias; i++) {
    const hueco = document.createElement("div");
    hueco.className = "vacia";
    grid.appendChild(hueco);
  }

  for (let dia = 1; dia <= diasDelMes; dia++) {
    const fecha = aISO(anio, mes, dia);
    const ep = episodioDe(fecha);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dia secundario";
    if (ep) btn.classList.add("con-episodio");
    if (fecha === hoy) btn.classList.add("hoy");
    if (fecha === fechaActual) btn.classList.add("seleccionado");
    if (fechaEspecial(fecha)) btn.classList.add("especial");
    if (fecha > hoy) btn.disabled = true;               // los días futuros aún no se nombran

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = dia;
    btn.appendChild(num);

    if (ep) {
      const tit = document.createElement("span");
      tit.className = "tit";
      tit.textContent = ep.titulo;
      btn.appendChild(tit);
      btn.title = ep.titulo;
      const ruta = arcoPorId(ep.arcoId);
      if (ruta) {
        btn.classList.add("con-ruta");
        btn.style.setProperty("--ruta", colorDe(ruta));
        btn.title += ` · ${ruta.nombre}`;
      }
    }

    btn.addEventListener("click", () => {
      cargarFormulario(fecha);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    grid.appendChild(btn);
  }
}

function cambiarMes(delta) {
  // new Date maneja solito el paso de diciembre a enero y viceversa.
  const d = new Date(mesVista.anio, mesVista.mes + delta, 1);
  mesVista = { anio: d.getFullYear(), mes: d.getMonth() };
  dibujarCalendario();
}

// ---- Arcos ----
function dibujarArcos() {
  const cont = $("lista-arcos");
  cont.innerHTML = "";

  if (datos.arcos.length === 0) {
    const p = document.createElement("p");
    p.className = "vacio-msg";
    p.textContent = "Aún no hay rutas fijadas. Comienza una desde el formulario con “+ Nueva ruta”.";
    cont.appendChild(p);
    return;
  }

  for (const arco of datos.arcos) {
    const eps = episodiosDelArco(arco.id);

    const det = document.createElement("details");
    det.dataset.ruta = String(arco.id);
    if (rutasAbiertas.has(arco.id)) det.open = true;
    det.addEventListener("toggle", () => {
      if (det.open) rutasAbiertas.add(arco.id); else rutasAbiertas.delete(arco.id);
    });
    const sum = document.createElement("summary");
    sum.append(
      puntoColor(colorDe(arco)),
      `${arco.nombre} · ${eps.length} ${eps.length === 1 ? "episodio" : "episodios"}`
    );
    det.appendChild(sum);

    const ul = document.createElement("ul");
    for (const ep of eps) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "secundario";
      b.textContent = `Ep. ${numeroDe(ep.fecha)} · ${ep.fecha} · ${ep.titulo}`;
      b.addEventListener("click", () => {
        const [a, m] = ep.fecha.split("-").map(Number);
        mesVista = { anio: a, mes: m - 1 };
        cargarFormulario(ep.fecha);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      li.appendChild(b);
      ul.appendChild(li);
    }
    if (eps.length > 0) det.appendChild(ul);
    det.appendChild(accionesDeRuta(arco));
    cont.appendChild(det);
  }
}

// Rutas desplegadas: se recuerdan al redibujar para que no se cierren solas.
const rutasAbiertas = new Set();

function accionesDeRuta(arco) {
  const caja = document.createElement("div");
  caja.className = "ruta-acciones";

  const colores = document.createElement("div");
  colores.className = "ruta-colores";
  colores.setAttribute("role", "group");
  colores.setAttribute("aria-label", "Color de la ruta");
  const actual = colorDe(arco);
  for (const c of COLORES_RUTA) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "muestra";
    b.style.setProperty("--ruta", c.valor);
    b.title = c.nombre;
    b.setAttribute("aria-label", c.nombre);
    b.setAttribute("aria-pressed", String(c.valor === actual));
    b.addEventListener("click", () => cambiarColorRuta(arco.id, c));
    colores.appendChild(b);
  }

  const renombrar = document.createElement("button");
  renombrar.type = "button";
  renombrar.className = "secundario chico";
  renombrar.textContent = "Renombrar";
  renombrar.addEventListener("click", () => renombrarRuta(arco.id));

  const borrar = document.createElement("button");
  borrar.type = "button";
  borrar.className = "peligro chico";
  borrar.textContent = "Borrar ruta";
  borrar.addEventListener("click", () => borrarRuta(arco.id));

  caja.append(colores, renombrar, borrar);
  return caja;
}

function dibujarTodo() {
  dibujarResumen();
  dibujarCalendario();
  dibujarArcos();
}

// =====================================================
// 6) ACCIONES  (lo que pasa cuando se hace clic)
// =====================================================
async function alGuardar(evento) {
  evento.preventDefault(); // evita que el formulario recargue la página
  renovarSesionSiHaceFalta(); // debe ir antes de cualquier await (Google exige un clic)

  // El Tabú: no se puede dejar por escrito.
  if (contieneTabu($("titulo").value) || contieneTabu($("porque").value)) {
    activarTabu();
    return;
  }

  const titulo = $("titulo").value.trim();
  if (!titulo) { mostrarMensaje("Falta el título."); return; }

  const porque = $("porque").value.trim();
  const arcoTexto = $("arco").value;

  const nuevo = {
    fecha: fechaActual,
    titulo,
    porque: porque || null,
    arcoId: arcoTexto === "" ? null : Number(arcoTexto),
    editado: new Date().toISOString()
  };

  // Si este día se había quemado antes, la nueva página lo reemplaza.
  datos.borrados = datos.borrados.filter(b => b.fecha !== fechaActual);

  const i = datos.episodios.findIndex(e => e.fecha === fechaActual);
  if (i >= 0) datos.episodios[i] = nuevo;
  else datos.episodios.push(nuevo);

  if (await guardarDatos()) {
    dibujarTodo();
    cargarFormulario(fechaActual);
    const susurro = buscarSusurro(`${titulo} ${porque}`);
    mostrarMensaje(`✔ Punto de retorno fijado: Ep. ${numeroDe(fechaActual)} — ${titulo}` +
      (susurro ? `\n${susurro}` : ""));
  }
}

async function alBorrar() {
  const ep = episodioDe(fechaActual);
  if (!ep) return;
  if (!confirm(
    `¿Quemar la página “${ep.titulo}”?\n\n` +
    `Una de las reglas de la Torre de Pléyades es no faltarle el respeto a la Biblioteca de Taygeta… ` +
    `y este ciclo se perderá como una línea temporal descartada.`
  )) return;

  datos.episodios = datos.episodios.filter(e => e.fecha !== fechaActual);
  // Se anota la quema para que otro dispositivo no traiga la página de vuelta.
  datos.borrados = datos.borrados.filter(b => b.fecha !== fechaActual);
  datos.borrados.push({ fecha: fechaActual, en: new Date().toISOString() });
  if (await guardarDatos()) {
    dibujarTodo();
    cargarFormulario(fechaActual);
    mostrarMensaje("La página ardió. Nadie más recordará ese ciclo.");
  }
}

async function alCrearArco() {
  const nombre = (prompt("Nombre de la nueva ruta (ej: Ruta de la pereza):") || "").trim();
  if (!nombre) return;

  const arco = { id: siguienteIdArco(), nombre, color: colorLibre(), editado: new Date().toISOString() };
  datos.arcos.push(arco);

  if (await guardarDatos()) {
    llenarSelectArcos(arco.id);   // lo deja elegido en el formulario
    dibujarArcos();
  }
}

async function cambiarColorRuta(id, color) {
  const arco = arcoPorId(id);
  if (!arco || colorDe(arco) === color.valor) return;
  arco.color = color.valor;
  arco.editado = new Date().toISOString();
  if (await guardarDatos()) {
    dibujarTodo();
    mostrarMensaje(`La ruta “${arco.nombre}” ahora lleva el ${color.nombre.toLowerCase()}.`);
  }
}

async function renombrarRuta(id) {
  const arco = arcoPorId(id);
  if (!arco) return;
  const nombre = (prompt("Nuevo nombre para la ruta:", arco.nombre) || "").trim();
  if (!nombre || nombre === arco.nombre) return;
  if (datos.arcos.some(a => a.id !== id && a.nombre === nombre)) {
    mostrarMensaje(`Ya existe una ruta llamada “${nombre}”.`);
    return;
  }
  arco.nombre = nombre;
  arco.editado = new Date().toISOString();
  if (await guardarDatos()) {
    dibujarTodo();
    llenarSelectArcos($("arco").value === "" ? "" : Number($("arco").value));
    mostrarMensaje(`La ruta ahora se llama “${nombre}”.`);
  }
}

async function borrarRuta(id) {
  const arco = arcoPorId(id);
  if (!arco) return;
  const n = episodiosDelArco(id).length;
  const detalle = n === 0
    ? "No tiene episodios."
    : n === 1
      ? "Su único episodio seguirá en tu Libro, pero sin ruta."
      : `Sus ${n} episodios seguirán en tu Libro, pero sin ruta.`;
  if (!confirm(
    `¿Borrar la ruta “${arco.nombre}”?\n\n` +
    `Se convertirá en algo que nunca sucedió: nadie más recordará que existió.\n` +
    detalle
  )) return;

  datos.arcos = datos.arcos.filter(a => a.id !== id);
  // Se anota el borrado para que otro dispositivo no traiga la ruta de vuelta.
  datos.rutasBorradas = datos.rutasBorradas.filter(r => r.id !== id);
  datos.rutasBorradas.push({ id, en: new Date().toISOString() });
  datos.episodios = datos.episodios.map(e => e.arcoId === id ? { ...e, arcoId: null } : e);
  rutasAbiertas.delete(id);

  if (await guardarDatos()) {
    dibujarTodo();
    if (formularioTocado) llenarSelectArcos($("arco").value === String(id) || $("arco").value === "" ? "" : Number($("arco").value));
    else cargarFormulario(fechaActual);
    mostrarMensaje(`La ruta “${arco.nombre}” se desvaneció. Nunca sucedió.`);
  }
}

// ---- Respaldo manual ----
function exportarRespaldo() {
  const texto = JSON.stringify(datos, null, 2);
  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `episodios-respaldo-${hoyISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  registrarRespaldo();
  if (!nubeConectada()) estadoSinSesion();
}

async function importarRespaldo(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  try {
    const nuevos = normalizar(JSON.parse(await archivo.text()));
    if (!confirm(
      `El respaldo trae ${nuevos.episodios.length} episodios y ${nuevos.arcos.length} arcos.\n\n` +
      `Sus páginas se unirán con tu Libro actual: no se borra nada. ` +
      `Si un mismo día está en ambos, se queda la versión editada más recientemente. ¿Continuar?`
    )) {
      evento.target.value = "";
      return;
    }
    formularioTocado = false;
    aplicarFusion(nuevos);
    await guardarDatos();
    dibujarTodo();
    cargarFormulario(hoyISO());
    mostrarMensaje("✔ Respaldo unido a tu Libro.");
  } catch (e) {
    mostrarMensaje("⚠ Ese archivo no es un respaldo válido.");
  }
  evento.target.value = ""; // permite volver a elegir el mismo archivo
}

// =====================================================
// 7) DETALLES DE RE:ZERO
// =====================================================

// ---- Fechas especiales ----
function fechaEspecial(iso) {
  const md = iso.slice(5); // "MM-DD"
  if (CUMPLE_AMIGO && md === CUMPLE_AMIGO) {
    return `Feliz cumpleaños${NOMBRE_AMIGO ? ", " + NOMBRE_AMIGO : ""}. Un año más escrito en tu Libro.`;
  }
  return FECHAS_REZERO[md] || null;
}

// ---- Susurros ----
function buscarSusurro(texto) {
  const t = normalizarTexto(texto);
  const s = SUSURROS.find(x => x.patron.test(t));
  return s ? s.texto() : null;
}

// ---- Emblema de la portada: cada toque convoca a una de las siete Brujas ----
let brujaActual = 0;
function tocarEmblema() {
  const [nombre, titulo] = BRUJAS[brujaActual % BRUJAS.length];
  brujaActual++;
  const emblema = document.querySelector(".libro-emblema");
  if (brujaActual % BRUJAS.length === 0) {
    portadaEstado(`${nombre}, ${titulo}. Las siete Brujas del Pecado están reunidas: el té está servido.`);
    emblema.classList.add("reunidas");
    setTimeout(() => emblema.classList.remove("reunidas"), 2600);
  } else {
    portadaEstado(`${nombre}, ${titulo}.`);
  }
}

// ---- Dedicatoria (solo la primera vez) ----
const CLAVE_DEDICATORIA = "episodios-dedicatoria-vista";

function mostrarDedicatoria() {
  if (!DEDICATORIA) return;
  try { if (localStorage.getItem(CLAVE_DEDICATORIA) === "1") return; } catch (e) {}

  const fondo = document.createElement("div");
  fondo.className = "dedicatoria";
  fondo.setAttribute("role", "dialog");
  fondo.setAttribute("aria-modal", "true");

  const caja = document.createElement("div");
  caja.className = "dedicatoria-caja";

  const h = document.createElement("h2");
  h.textContent = NOMBRE_AMIGO ? `Para ${NOMBRE_AMIGO}` : "Para ti";
  const p = document.createElement("p");
  p.textContent = DEDICATORIA;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Empezar desde cero";
  btn.addEventListener("click", () => {
    try { localStorage.setItem(CLAVE_DEDICATORIA, "1"); } catch (e) {}
    fondo.remove();
    $("titulo").focus();
  });

  caja.append(h, p, btn);
  fondo.appendChild(caja);
  document.body.appendChild(fondo);
  btn.focus();
}

// ---- El Tabú ----
// En la obra, cuando Subaru intenta contarle a alguien sobre su Regreso por Muerte,
// el tiempo se detiene, una mano de sombra le aprieta el corazón y la Bruja susurra "te amo".
let tabuActivo = false;

function normalizarTexto(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function contieneTabu(texto) {
  const t = normalizarTexto(texto);
  return FRASES_TABU.some(f => t.includes(normalizarTexto(f)));
}

// Borra la frase prohibida del texto (sin importar mayúsculas ni espacios de más).
function quitarTabu(texto) {
  let r = texto;
  for (const f of FRASES_TABU) {
    const patron = f.split(" ").map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
    r = r.replace(new RegExp(patron, "giu"), "");
  }
  return r.replace(/\s{2,}/g, " ").trim();
}

function revisarTabu(evento) {
  if (contieneTabu(evento.target.value)) activarTabu();
}

// Latidos graves con Web Audio (sin archivos de sonido).
function sonarLatidos() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const golpe = (t, fuerza) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(fuerza, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(vol).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    };
    const ahora = ctx.currentTime + 0.05;
    for (let i = 0; i < 4; i++) {
      golpe(ahora + i * 1.1, 0.5);
      golpe(ahora + i * 1.1 + 0.22, 0.35);
    }
    setTimeout(() => ctx.close(), 5500);
  } catch (e) {}
}

function activarTabu() {
  if (tabuActivo) return;
  tabuActivo = true;

  // Las palabras no llegan a quedar escritas.
  $("titulo").value = quitarTabu($("titulo").value);
  $("porque").value = quitarTabu($("porque").value);
  if (document.activeElement) document.activeElement.blur();

  document.body.classList.add("tiempo-detenido");

  const capa = document.createElement("div");
  capa.className = "tabu";
  capa.setAttribute("role", "alert");
  capa.setAttribute("aria-label", "El tiempo se detuvo. Una voz susurra: te amo.");

  // Sombras que se arrastran desde los bordes hacia el corazón
  const angulos = [200, 155, 250, 290, 335, 20, 65, 110];
  angulos.forEach((ang, i) => {
    const brazo = document.createElement("div");
    brazo.className = "brazo";
    brazo.style.setProperty("--ang", ang + "deg");
    const sombra = document.createElement("div");
    sombra.className = "sombra";
    sombra.style.animationDelay = (i * 0.12) + "s";
    brazo.appendChild(sombra);
    capa.appendChild(brazo);
  });

  const corazon = document.createElement("div");
  corazon.className = "corazon";
  corazon.textContent = "♥";
  capa.appendChild(corazon);

  // Susurros de la Bruja
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "susurro";
    s.textContent = i % 3 === 0 ? "Te amo" : "愛してる";
    s.style.left = (8 + Math.random() * 78) + "%";
    s.style.top = (8 + Math.random() * 80) + "%";
    s.style.fontSize = (0.9 + Math.random() * 1.1).toFixed(2) + "rem";
    s.style.animationDelay = (0.4 + i * 0.2) + "s";
    capa.appendChild(s);
  }

  const texto = document.createElement("p");
  texto.className = "tabu-texto";
  texto.textContent = "«Te amo. Te amo. Te amo…»";
  capa.appendChild(texto);

  document.body.appendChild(capa);
  sonarLatidos();

  setTimeout(() => capa.classList.add("apretando"), 1800);   // la mano aprieta
  setTimeout(() => capa.classList.add("saliendo"), 4600);
  setTimeout(() => {
    capa.remove();
    document.body.classList.remove("tiempo-detenido");
    tabuActivo = false;
    mostrarMensaje("…No pudiste decirlo. Las palabras se borraron solas.");
    aumentarAroma();
  }, 5400);
}

// ---- Aroma de la Bruja ----
// En la obra, el olor de la Bruja que Subaru lleva encima se vuelve más intenso
// después de cada Regreso por Muerte y cuando intenta revelar su poder.
// Aquí lo mide un contador que sube con cada Tabú (no forma parte del respaldo).
const CLAVE_AROMA = "episodios-aroma-bruja";
const AROMA_MAXIMO = 7;

function leerAroma() {
  try { return Math.max(0, parseInt(localStorage.getItem(CLAVE_AROMA), 10) || 0); }
  catch (e) { return 0; }
}

function dibujarAroma(recien) {
  const n = leerAroma();
  const el = $("aroma");
  el.hidden = n === 0;            // no aparece hasta que descubra el Tabú
  if (n === 0) return;
  el.style.setProperty("--nivel", Math.min(n, AROMA_MAXIMO) / AROMA_MAXIMO);
  el.title = `Aroma de la Bruja · intensidad ${Math.min(n, AROMA_MAXIMO)}/${AROMA_MAXIMO}`;
  if (recien) {
    el.classList.remove("recien");
    void el.offsetWidth;          // reinicia la animación
    el.classList.add("recien");
  }
}

function aumentarAroma() {
  try { localStorage.setItem(CLAVE_AROMA, String(leerAroma() + 1)); } catch (e) {}
  dibujarAroma(true);
}

function explicarAroma() {
  const n = Math.min(leerAroma(), AROMA_MAXIMO);
  const frases = [
    "Apenas se percibe.",
    "Un olor tenue, dulce y extraño.",
    "Alguien con buen olfato empezaría a sospechar.",
    "Rem ya lo habría notado.",
    "El miasma es denso. Garfiel no te dejaría pasar.",
    "Hueles igual que el Culto de la Bruja.",
    "La Bruja no te suelta.",
    "Ella está aquí."
  ];
  mostrarMensaje(`Aroma de la Bruja (${n}/${AROMA_MAXIMO}): ${frases[n]}`);
}

// ---- Ceniza / polvo estelar en el fondo ----
function iniciarCeniza() {
  const lienzo = $("ceniza");
  const ctx = lienzo.getContext && lienzo.getContext("2d");
  if (!ctx) return;
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  let ancho = 0, alto = 0, particulas = [];
  const colores = ["216,180,254", "176,114,245", "201,167,90", "245,243,255"];

  function nueva(enCualquierAltura) {
    return {
      x: Math.random() * ancho,
      y: enCualquierAltura ? Math.random() * alto : alto + 10,
      r: 0.4 + Math.random() * 1.4,
      vy: 0.08 + Math.random() * 0.25,      // sube despacio, como ceniza
      vx: (Math.random() - 0.5) * 0.12,
      fase: Math.random() * Math.PI * 2,
      alfa: 0.15 + Math.random() * 0.45,
      color: colores[Math.floor(Math.random() * colores.length)]
    };
  }

  function ajustar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ancho = window.innerWidth; alto = window.innerHeight;
    lienzo.width = ancho * dpr; lienzo.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cantidad = Math.round(Math.min(70, (ancho * alto) / 22000));
    particulas = Array.from({ length: cantidad }, () => nueva(true));
  }

  function pintar(t) {
    ctx.clearRect(0, 0, ancho, alto);
    for (const p of particulas) {
      const parpadeo = 0.6 + 0.4 * Math.sin(t / 900 + p.fase);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${(p.alfa * parpadeo).toFixed(3)})`;
      ctx.shadowColor = `rgba(${p.color},0.8)`;
      ctx.shadowBlur = p.r * 4;
      ctx.fill();
    }
  }

  function paso(t) {
    if (!document.hidden) {
      for (const p of particulas) {
        p.y -= p.vy;
        p.x += p.vx + Math.sin(t / 2000 + p.fase) * 0.08;
        if (p.y < -10 || p.x < -10 || p.x > ancho + 10) Object.assign(p, nueva(false));
      }
      pintar(t);
    }
    requestAnimationFrame(paso);
  }

  ajustar();
  window.addEventListener("resize", ajustar);
  if (quieto) pintar(0);
  else requestAnimationFrame(paso);
}

// =====================================================
// 8) PORTADA DEL LIBRO
//    Se muestra en cada visita: abrir con Google evita escribir en un navegador
//    sin respaldo y que una versión vieja pise a otra.
// =====================================================
function portadaEstado(texto) {
  $("portada-estado").textContent = texto || "";
}

function portadaOcupada(ocupada) {
  const btn = $("btn-abrir-google");
  btn.disabled = ocupada;
  btn.textContent = ocupada ? "Abriendo la Biblioteca…" : "Abrir con mi cuenta de Google";
}

// Se llama cuando ya se sabe si Google está disponible.
function portadaLista(googleDisponible, aviso) {
  const btnGoogle = $("btn-abrir-google");
  const btnLocal = $("btn-abrir-local");
  if (!NUBE_ACTIVA) {
    // Sin nube configurada: la portada solo abre el libro.
    btnGoogle.hidden = true;
    $("portada-nota").hidden = true;
    btnLocal.textContent = "Abrir el Libro";
    btnLocal.classList.remove("enlace");
    btnLocal.focus();
    return;
  }
  if (googleDisponible) {
    portadaOcupada(false);
    btnGoogle.focus();
  } else {
    btnGoogle.disabled = true;
    btnGoogle.textContent = "Google no está disponible";
    btnLocal.focus();
  }
  if (aviso) portadaEstado(aviso);
}

function configurarPortada() {
  $("portada-nombre").textContent = NOMBRE_AMIGO ? `de ${NOMBRE_AMIGO}` : "";
  $("portada-nombre").hidden = !NOMBRE_AMIGO;
  document.querySelector(".libro-emblema").addEventListener("click", tocarEmblema);

  $("btn-abrir-google").addEventListener("click", () => {
    portadaEstado("Esperando a Google…");
    portadaOcupada(true);
    nube.esperaPortada = true;
    conectarGoogle(modoGoogle());   // si ya dio permiso antes, no se lo vuelve a pedir
  });

  $("btn-abrir-local").addEventListener("click", () => {
    nube.esperaPortada = false;
    nube.sesionLocal = NUBE_ACTIVA;
    abrirLibro();
    if (NUBE_ACTIVA) estadoSinSesion();
  });
}

function abrirLibro() {
  const portada = $("portada");
  if (portada.hidden || portada.classList.contains("abriendo")) return;
  portada.classList.add("abriendo");
  const quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    portada.hidden = true;
    document.body.classList.remove("con-portada");
    mostrarDedicatoria();
    if (!document.querySelector(".dedicatoria")) $("titulo").focus();
  }, quieto ? 0 : 1100);
}

// =====================================================
// 9) ARRANQUE
// =====================================================
async function iniciar() {
  datos = await cargarDatos();

  const hoy = new Date();
  mesVista = { anio: hoy.getFullYear(), mes: hoy.getMonth() };

  $("form-episodio").addEventListener("submit", alGuardar);
  $("btn-borrar").addEventListener("click", alBorrar);
  $("btn-nuevo-arco").addEventListener("click", alCrearArco);
  $("mes-prev").addEventListener("click", () => cambiarMes(-1));
  $("mes-next").addEventListener("click", () => cambiarMes(1));
  $("btn-exportar").addEventListener("click", exportarRespaldo);
  $("archivo-importar").addEventListener("change", importarRespaldo);
  $("btn-nube").addEventListener("click", () => {
    if ($("btn-nube").dataset.modo === "desconectar") desconectarGoogle();
    else conectarGoogle();
  });
  $("titulo").addEventListener("input", revisarTabu);
  $("porque").addEventListener("input", revisarTabu);
  $("aroma").addEventListener("click", explicarAroma);
  for (const id of ["titulo", "porque", "arco"]) {
    $(id).addEventListener("input", () => { formularioTocado = true; });
  }

  // Si hay páginas que aún no llegan a Drive, avisa antes de cerrar la pestaña.
  window.addEventListener("beforeunload", e => {
    if (nube.sinSubir && modoGoogle() && !nube.sesionLocal) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  configurarPortada();
  iniciarCeniza();
  dibujarAroma(false);
  dibujarTodo();
  cargarFormulario(hoyISO());
  iniciarNube();   // no bloquea: la portada habilita el botón de Google cuando carga
}

iniciar();
