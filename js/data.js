/* =========================================================
   Buganvilla Tours 2.0 — Catálogo y configuración
   ---------------------------------------------------------
    IMPORTANTE: los PRECIOS, TURNOS y CAPACIDADES de este archivo
   son valores de DEMOSTRACIÓN. La web actual no publica tarifas,
   así que deben reemplazarse por las tarifas reales de la agencia.
   Los datos marcados como "fuente: web actual" sí se tomaron de
   https://buganvillatours.com/utv-en-huacachina/
   ========================================================= */

const CONFIG = {
  brand: "Buganvilla Tours",
  demo: true,
  defaultLocale: "es-PE",
  timeZone: "America/Lima",
  // fuente: web actual
  phones: ["948 401267", "947 929246"],
  whatsapp: "51948401267",
  email: "reservas@buganvillatours.com.pe",
  facebook: "https://www.facebook.com/Buganvillatours",
  // DEMO: tipo de cambio referencial para mostrar precios en USD
  exchangeRate: 3.75,
  // DEMO: ventana de reserva online
  bookingWindowDays: 90,
  minHoursBeforeDeparture: 3,
  // DEMO: política de cancelación mostrada al cliente
  freeCancellationHours: 24,
};

const CATEGORIES = {
  aventura: { label: "Aventura", badge: "badge-sand" },
  naturaleza: { label: "Naturaleza", badge: "badge-oasis" },
  cultura: { label: "Cultura", badge: "badge-pink" },
  gastronomia: { label: "Gastronomía", badge: "badge-warn" },
};

const TOURS = [
  {
    id: "utv-huacachina",
    title: "UTV en Huacachina",
    location: "Huacachina, Ica",
    category: "aventura",
    image: "https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina3.jpg",
    duration: "1 h aprox.", // fuente: web actual
    short: "Tour privado en UTV por las dunas, con mirador de la laguna y sandboarding.",
    priceFrom: 120, // DEMO (PEN por persona)
    bookable: true,
    url: "tour-utv.html",
    tags: ["Privado", "Sandboarding", "Mín. 2 personas"],
  },
  {
    id: "tubulares-sandboard",
    title: "Tubulares y Sandboard al atardecer",
    location: "Huacachina, Ica",
    category: "aventura",
    image: "https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina.jpg",
    duration: "2 h aprox.",
    short: "Recorrido en buggy compartido por las dunas y descensos en tabla con la puesta de sol.",
    priceFrom: 70, // DEMO
    bookable: false,
    tags: ["Compartido", "Sunset"],
  },
  {
    id: "ballestas-paracas",
    title: "Islas Ballestas y Reserva de Paracas",
    location: "Paracas, Ica",
    category: "naturaleza",
    image: "https://buganvillatours.com/wp-content/uploads/2018/04/Tour-Islas-Ballestas-Chincha.jpg",
    duration: "Medio día",
    short: "Paseo en lancha para ver lobos marinos y aves guaneras, y visita a la Reserva Nacional.",
    priceFrom: 95, // DEMO
    bookable: false,
    tags: ["Lancha", "Fauna marina"],
  },
  {
    id: "lineas-nasca",
    title: "Sobrevuelo Líneas de Nasca",
    location: "Nasca, Ica",
    category: "cultura",
    image: "https://images.unsplash.com/photo-1625851425826-9082c9bf3958?auto=format&fit=crop&w=1400&q=82",
    duration: "35 min de vuelo",
    short: "Observa desde el aire las figuras más famosas: el colibrí, el mono y la araña.",
    priceFrom: 380, // DEMO
    bookable: false,
    tags: ["Patrimonio UNESCO", "Avioneta"],
  },
  {
    id: "ruta-pisco",
    title: "Ruta del Pisco y bodegas",
    location: "Valle de Ica",
    category: "gastronomia",
    image: "https://buganvillatours.com/wp-content/uploads/2018/04/ruta-del-pisco-ica.jpg",
    duration: "4 h aprox.",
    short: "Visita a bodegas tradicionales y artesanales con degustación de piscos y vinos.",
    priceFrom: 85, // DEMO
    bookable: false,
    tags: ["Degustación", "Bodegas"],
  },
];

/* ---------- Detalle del tour reservable ---------- */
const UTV_TOUR = {
  id: "utv-huacachina",
  title: "UTV en Huacachina",
  // fuente: web actual (reescrito)
    description:
    "Recorre las dunas de Huacachina en un UTV privado con conductor. El recorrido incluye una parada para contemplar la laguna desde lo alto y una sesión de sandboarding amateur, con casco, lentes y equipo incluidos. Una experiencia de aproximadamente una hora, para grupos de al menos dos personas.",
  seatsPerVehicle: 3, // fuente: web actual
  minPax: 2, // fuente: web actual
  maxPaxPerBooking: 9, // DEMO
  // DEMO: precios en PEN
  prices: { adult: 120, child: 90 },
  childAgeLabel: "Niños (5 a 11 años)", // DEMO: confirmar edades reales
  // DEMO: turnos y capacidad (vehículos por turno × 3 asientos)
  slots: [
    { id: "s1000", time: "10:00", label: "Mañana", vehicles: 4 },
    { id: "s1400", time: "14:00", label: "Tarde", vehicles: 4 },
    { id: "s1630", time: "16:30", label: "Atardecer", vehicles: 5, featured: true },
  ],
  // DEMO: complementos opcionales
  extras: [
    { id: "fotos", label: "Fotos profesionales en HD", price: 40, per: "booking", icon: "camera" },
    { id: "gopro", label: "Video GoPro del recorrido", price: 60, per: "booking", icon: "video" },
    { id: "traslado", label: "Recojo y retorno a hotel en Ica", price: 25, per: "person", icon: "car" },
  ],
  // fuente: web actual
  itinerary: [
    { title: "Encuentro y equipamiento", text: "Presentación en GO Adventure, en Huacachina. Recibe el casco, los lentes y el equipo de sandboarding, y las indicaciones para el recorrido." },
    { title: "Recorrido por las dunas", text: "Salida en UTV privado con conductor. Cada unidad lleva hasta 3 pasajeros; los grupos mayores se distribuyen en los vehículos necesarios." },
    { title: "Mirador de Huacachina", text: "Una pausa en las dunas para observar el oasis desde lo alto y tomar fotografías del paisaje." },
    { title: "Sandboarding amateur", text: "Descensos en tabla con el equipo incluido y las indicaciones del guía. No se requiere experiencia previa." },
    { title: "Regreso al punto de encuentro", text: "Retorno a la oficina GO Adventure. La duración total del recorrido es de aproximadamente una hora." },
  ],
  // fuente: web actual ("Características")
  features: [
    { icon: "clock", label: "Duración", value: "1:00 h aprox." },
    { icon: "users", label: "Grupo", value: "Mínimo 2 personas" },
    { icon: "mountain", label: "Tipo", value: "Tour de aventura" },
    { icon: "calendar", label: "Reserva", value: "Con anticipación" },
  ],
  includes: ["UTV privado con conductor", "Casco y lentes de protección", "Equipo de sandboarding amateur", "Parada en mirador de la laguna"],
  // DEMO: confirmar con la agencia
  excludes: ["Tasa de ingreso a las dunas (si aplica)", "Alimentación", "Propinas"],
  recommendations: ["Ropa cómoda y zapatillas cerradas", "Bloqueador solar y gorra", "Agua", "Llegar 15 minutos antes del turno"],
  meetingPoint: {
    name: "Oficina GO Adventure — Huacachina", // fuente: web actual
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Huacachina+Ica+Peru",
    embed: "https://www.google.com/maps?q=Huacachina,+Ica,+Peru&output=embed",
  },
};

/* ---------- Reseñas (fuente: slider TripAdvisor de la web actual) ---------- */
const REVIEWS = [
  { topic: "Atención al viajero", title: "Acompañamiento durante el viaje", text: "Destaca la disposición del equipo para ayudar y resolver las consultas del viajero.", author: "Tourist823113", date: "Noviembre de 2023" },
  { topic: "Paracas y Ballestas", title: "Una visita bien coordinada", text: "Valora la atención de la agencia y la organización de su recorrido por Paracas y las Islas Ballestas.", author: "Kiari_94", date: "" },
  { topic: "Atención local", title: "Un servicio cercano", text: "Valora la amabilidad del equipo, el conocimiento de los guías y el cuidado de la organización.", author: "Stefannycondemarin", date: "" },
  { topic: "Valle de Ica", title: "Tradición para compartir", text: "Describe una visita a los vinos de Ica como una experiencia para compartir en familia.", author: "michaelvladimir2205", date: "" },
];

